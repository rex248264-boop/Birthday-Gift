import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { DialogueLine } from '@/parser';
import styles from './DialogueBox.module.css';
import { audio } from '@/audio/audioManager';
import { resolveCharacter } from '@/config/characters';
import { useTextOffsetStyle } from '@/engine';

type Props = {
  line: DialogueLine;
  sceneId: string;
  frameId: string;
  maleLineNumber: number;
  onComplete?: () => void;
};

const CHARS_PER_SECOND = 36;

export function DialogueBox({ line, sceneId, frameId, maleLineNumber, onComplete }: Props) {
  const text = line.text;
  const [shown, setShown] = useState('');
  const isHe = line.speaker === '他' || line.speaker === '陌生访客' || line.speaker === '男主';
  const isNarrator = line.speaker === '旁白';
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    setShown('');
    if (!text) {
      completedRef.current = true;
      onComplete?.();
      return;
    }
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(interval);
        completedRef.current = true;
        onComplete?.();
      }
    }, 1000 / CHARS_PER_SECOND);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    if (!isHe) return;
    audio.playVoice(sceneId, frameId, maleLineNumber, line.hints.voice);
    return () => audio.stopVoice();
  }, [isHe, sceneId, frameId, maleLineNumber, line.hints.voice]);

  const skipReveal = () => {
    if (!completedRef.current && text.length > 0) {
      setShown(text);
      completedRef.current = true;
      onComplete?.();
    }
  };

  const character = useMemo(() => resolveCharacter(line.speaker), [line.speaker]);
  const nameOffset = useTextOffsetStyle('dialogue-name');
  const textOffset = useTextOffsetStyle('dialogue-text');
  const actionOffset = useTextOffsetStyle('dialogue-action');

  return (
    <motion.div
      className={`${styles.root} ${isNarrator ? styles.narrator : ''}`}
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      onClick={skipReveal}
      role="button"
      tabIndex={0}
    >
      <span className={styles.decoTL} aria-hidden="true" />
      <span className={styles.decoBR} aria-hidden="true" />
      {!isNarrator && (
        <div className={styles.namePlate}>
          <div className={styles.nameStack} style={nameOffset}>
            <span className={styles.name}>{character.display || line.speaker}</span>
            {character.alias && <span className={styles.alias}>{character.alias}</span>}
          </div>
        </div>
      )}
      <div className={styles.bodyZone}>
        {line.action && !isNarrator && (
          <span className={styles.action} style={actionOffset}>（{line.action}）</span>
        )}
        <p className={styles.text} style={textOffset}>
          {shown}
          {shown.length < text.length && <span className={styles.caret}>▌</span>}
        </p>
      </div>
    </motion.div>
  );
}
