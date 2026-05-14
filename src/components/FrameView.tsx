import { useEffect, useMemo, useRef, useState } from 'react';
import type { Frame } from '@/parser';
import { tapAdvance, currentScene, getEffectiveItems, submitTextInput } from '@/engine';
import { SceneBackground } from './SceneBackground';
import { Character } from './Character';
import { MicroEffect } from './MicroEffect';
import { NarrationBox } from './NarrationBox';
import { DialogueBox } from './DialogueBox';
import { ChoiceMenu } from './ChoiceMenu';
import { TextInputBox } from './TextInputBox';
import { Transition } from './Transition';
import { VideoTransition } from './VideoTransition';
import { TopBar } from './TopBar';
import { BottomControls } from './BottomControls';
import { useGame } from '@/engine';
import { resolveTransitionVideo, pickFirstExisting } from '@/engine/assetResolver';
import { audio } from '@/audio/audioManager';
import styles from './FrameView.module.css';

type Props = {
  sceneId: string;
  frame: Frame;
};

export function FrameView({ sceneId, frame }: Props) {
  const dialogueIdx = useGame((s) => s.currentDialogueIdx);
  const audioUnlocked = useGame((s) => s.audioUnlocked);
  // 订阅完整 map，使跨帧延续 choice（refFrameId）也能响应式地更新
  const chosenOptionByFrame = useGame((s) => s.chosenOptionByFrame);
  const chosenLetter = chosenOptionByFrame[`${sceneId}/${frame.id}`];

  // 把选中的 choice 节点替换为该 option 的 branchLines；
  // 这样 dialogueIdx 不变也能继续正确指向"选中后第一行支线对话"。
  const items = useMemo(
    () => getEffectiveItems(frame, chosenLetter, chosenOptionByFrame, sceneId),
    [frame, chosenLetter, chosenOptionByFrame, sceneId],
  );

  const currentItem = items[dialogueIdx];

  // Narration and dialogue share the bottom slot. Narration plays first; once
  // the player advances past its last page, `narrationDismissed` flips and
  // dialogue takes over the same spot — they never coexist on screen.
  //
  // 每次点击翻一"页"（NARRATION_PAGE_SIZE 行），整页替换，不逐行累积。
  const NARRATION_PAGE_SIZE = 3;
  const [narrationPage, setNarrationPage] = useState(0); // 当前页起始行索引
  const [narrationDismissed, setNarrationDismissed] = useState(false);
  const [transitionVisible, setTransitionVisible] = useState(false);
  const [bgOverride, setBgOverride] = useState<string | null>(null);
  const bgOverrideToggleRef = useRef(false);

  // Probe for a transition video keyed to this frame (plays when leaving the frame).
  const [videoTransitionSrc, setVideoTransitionSrc] = useState<string | null>(null);
  const [showVideoTransition, setShowVideoTransition] = useState(false);

  const narrationLines = frame.narration?.lines ?? [];
  const hasNarration = narrationLines.length > 0;
  const atLastNarrationPage = narrationPage + NARRATION_PAGE_SIZE >= narrationLines.length;
  const narrationActive = hasNarration && !narrationDismissed;

  useEffect(() => {
    setNarrationPage(0);
    setNarrationDismissed(false);
    setTransitionVisible(false);
    setBgOverride(null);
    bgOverrideToggleRef.current = false;
    setVideoTransitionSrc(null);
    setShowVideoTransition(false);
    // Probe for a transition video for this frame
    const candidates = resolveTransitionVideo(sceneId, frame.id);
    pickFirstExisting(candidates).then((url) => setVideoTransitionSrc(url));
  }, [frame.id, sceneId]);

  // Auto-advance past scene-switch items and toggle background between black and white
  useEffect(() => {
    if (currentItem?.kind === 'scene-switch') {
      bgOverrideToggleRef.current = !bgOverrideToggleRef.current;
      setBgOverride(bgOverrideToggleRef.current ? '#000000' : '#ffffff');
      tapAdvance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem]);

  useEffect(() => {
    if (!audioUnlocked) return;
    const bgmHint = frame.description?.hints.bgm ?? frame.dialogue?.hints.bgm;
    audio.playBGM(sceneId, bgmHint);
  }, [sceneId, frame.id, audioUnlocked]);

  useEffect(() => {
    if (!audioUnlocked) return;
    const sfx = frame.description?.hints.sfx;
    if (sfx) audio.playSFX(sfx);
  }, [sceneId, frame.id, audioUnlocked]);

  const maleLineMap = useMemo(() => {
    const map = new Map<number, number>();
    let counter = 0;
    items.forEach((it, idx) => {
      if (it.kind === 'line' && (it.speaker === '他' || it.speaker === '陌生访客' || it.speaker === '男主')) {
        counter += 1;
        map.set(idx, counter);
      }
    });
    return map;
  }, [items]);

  const activeSpeaker =
    currentItem && currentItem.kind === 'line' ? currentItem : null;

  const isChoice = currentItem?.kind === 'choice';
  const isInput = currentItem?.kind === 'input';
  const isInteractive = isChoice || isInput;

  // True when the next tap would call state.advance() (exit this frame).
  const nextTapExitsFrame =
    !isInteractive &&
    (items.length === 0 || dialogueIdx >= items.length - 1);

  const onScreenTap = () => {
    // Narration advances *first*, even when the upcoming dialogue item is a
    // choice/input — otherwise the player would be stuck on narration whenever
    // the next beat is interactive.
    if (narrationActive) {
      if (atLastNarrationPage) {
        // Hand off the bottom slot from narration to dialogue.
        setNarrationDismissed(true);
      } else {
        setNarrationPage((p) => p + NARRATION_PAGE_SIZE);
      }
      return;
    }
    if (isInteractive) return;

    // If there's a transition video for this frame and we're about to leave it,
    // show the video first; actual advance happens in onVideoTransitionDone.
    if (nextTapExitsFrame && videoTransitionSrc && !showVideoTransition) {
      setShowVideoTransition(true);
      return;
    }

    tapAdvance();
  };

  const onVideoTransitionDone = () => {
    setShowVideoTransition(false);
    useGame.getState().advance();
  };

  // Custom handler for TextInputBox: replicates submitTextInput but intercepts
  // the final state.advance() so we can play the transition video first.
  const handleTextInputConfirm = (flagKey: string | undefined, value: string) => {
    const storeState = useGame.getState();
    if (flagKey) storeState.setFlag(flagKey, value);
    const newIdx = storeState.currentDialogueIdx + 1;
    storeState.setDialogueIdx(newIdx);
    const wouldAdvance = newIdx >= items.length;
    if (wouldAdvance && videoTransitionSrc) {
      setShowVideoTransition(true);
    } else if (wouldAdvance) {
      storeState.advance();
    }
  };

  const bgHint = frame.description?.hints.bg;
  const effectHint = frame.description?.hints.effect;
  const effectPos = (frame.description?.hints.effectPos as
    | 'center' | 'center-top' | 'center-bottom' | 'left' | 'right' | 'full'
    | undefined) ?? 'center';

  const scene = currentScene();
  const sceneTitle = scene?.title;

  return (
    <div className={styles.root} onClick={onScreenTap}>
      <SceneBackground
        sceneId={sceneId}
        frameId={frame.id}
        hint={bgHint}
        fallbackText={frame.description?.scene?.text}
        bgOverride={bgOverride}
      />

      <MicroEffect hint={effectHint} position={effectPos} />

      <Character
        speaker={activeSpeaker?.speaker ?? ''}
        action={activeSpeaker?.action}
        active={!narrationActive && !!activeSpeaker && activeSpeaker.speaker !== '旁白'}
      />

      {narrationActive && (
        <NarrationBox lines={narrationLines} pageStart={narrationPage} pageSize={NARRATION_PAGE_SIZE} />
      )}

      {!isInteractive && <TopBar contextLabel={sceneTitle} />}
      {!isInteractive && <BottomControls />}

      {!narrationActive && currentItem && currentItem.kind === 'line' && (
        <DialogueBox
          key={`${frame.id}-${dialogueIdx}`}
          line={currentItem}
          sceneId={sceneId}
          frameId={frame.id}
          maleLineNumber={maleLineMap.get(dialogueIdx) ?? 1}
        />
      )}

      {!narrationActive && currentItem && currentItem.kind === 'choice' && (
        <ChoiceMenu choice={currentItem} />
      )}

      {!narrationActive && currentItem && currentItem.kind === 'input' && (
        <TextInputBox block={currentItem} onConfirm={handleTextInputConfirm} />
      )}

      <Transition visible={transitionVisible} text={frame.transition?.rawText.split('\n')[0]} />

      {showVideoTransition && videoTransitionSrc && (
        <VideoTransition src={videoTransitionSrc} onDone={onVideoTransitionDone} />
      )}
    </div>
  );
}
