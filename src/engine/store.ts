import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Script } from '@/parser';
import { loadAllScripts } from '@/parser';

export type Flags = Record<string, number | string | boolean>;

export type AppPhase = 'title' | 'playing' | 'ending';

export type FontScale = 'sm' | 'md' | 'lg';

export type ScriptUpdateTrigger = number;

export interface GameState {
  script: Script;
  diagnostics: ReturnType<typeof loadAllScripts>['diagnostics'];
  scriptVersion: ScriptUpdateTrigger;

  phase: AppPhase;
  currentSceneId: string | null;
  currentFrameId: string | null;
  currentDialogueIdx: number;

  flags: Flags;
  history: { sceneId: string; frameId: string }[];

  /**
   * 玩家在每一帧的选择记录。key = `${sceneId}/${frameId}`，value = 选项字母（如 "A"）。
   * 用于在 FrameView 中把 choice 节点就地替换为对应 option 的 branchLines。
   */
  chosenOptionByFrame: Record<string, string>;

  devMode: boolean;
  showDevPanel: boolean;
  audioUnlocked: boolean;
  fontScale: FontScale;

  setPhase: (p: AppPhase) => void;
  setFontScale: (scale: FontScale) => void;
  startNewGame: (sceneId?: string) => void;
  jumpTo: (sceneId: string, frameId?: string) => void;
  advance: () => void;
  setDialogueIdx: (i: number) => void;
  setFlag: (key: string, value: number | string | boolean) => void;
  addToFlag: (key: string, delta: number) => void;
  getFlag: <T = number | string | boolean | undefined>(key: string) => T;
  setChosenOption: (sceneId: string, frameId: string, letter: string) => void;
  clearChosenOption: (sceneId: string, frameId: string) => void;
  toggleDevPanel: () => void;
  unlockAudio: () => void;
  reloadScript: () => void;
}

const initial = loadAllScripts();
const FIRST_SCENE = initial.script.sceneOrder[0] ?? 'S01';

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      script: initial.script,
      diagnostics: initial.diagnostics,
      scriptVersion: Date.now(),

      phase: 'title',
      currentSceneId: null,
      currentFrameId: null,
      currentDialogueIdx: 0,

      flags: {},
      history: [],
      chosenOptionByFrame: {},

      devMode: import.meta.env.DEV,
      showDevPanel: false,
      audioUnlocked: false,
      fontScale: 'md',

      setPhase: (p) => set({ phase: p }),
      setFontScale: (scale) => set({ fontScale: scale }),

      startNewGame: (sceneId) => {
        const id = sceneId ?? FIRST_SCENE;
        const scene = get().script.scenes.get(id);
        const firstFrame = scene?.frames[0];
        set({
          phase: 'playing',
          currentSceneId: id,
          currentFrameId: firstFrame?.id ?? null,
          currentDialogueIdx: 0,
          flags: {},
          history: firstFrame ? [{ sceneId: id, frameId: firstFrame.id }] : [],
          chosenOptionByFrame: {},
        });
      },

      jumpTo: (sceneId, frameId) => {
        const scene = get().script.scenes.get(sceneId.toUpperCase());
        if (!scene) {
          console.warn(`[jumpTo] scene not found: ${sceneId}`);
          return;
        }
        const frame = frameId
          ? scene.frames.find((f) => f.id === frameId) ?? scene.frames[0]
          : scene.frames[0];
        if (!frame) return;
        const targetKey = `${scene.id}/${frame.id}`;
        set((s) => {
          // 进入目标帧时清掉该帧上的旧选择记录，使重访时玩家可以重新选择
          const nextChosen = { ...s.chosenOptionByFrame };
          delete nextChosen[targetKey];
          return {
            phase: 'playing',
            currentSceneId: scene.id,
            currentFrameId: frame.id,
            currentDialogueIdx: 0,
            history: [...s.history, { sceneId: scene.id, frameId: frame.id }],
            chosenOptionByFrame: nextChosen,
          };
        });
      },

      advance: () => {
        const { script, currentSceneId, currentFrameId, chosenOptionByFrame } = get();
        if (!currentSceneId || !currentFrameId) return;
        const scene = script.scenes.get(currentSceneId);
        if (!scene) return;
        const idx = scene.frames.findIndex((f) => f.id === currentFrameId);
        if (idx < 0) return;

        // 命运分叉：当前帧已选中的选项若带 targetSceneId，跳到指定目标
        const chosenLetter = chosenOptionByFrame[`${currentSceneId}/${currentFrameId}`];
        if (chosenLetter) {
          const curFrame = scene.frames[idx];
          for (const item of curFrame?.dialogue?.items ?? []) {
            if (item.kind === 'choice') {
              const opt = item.options.find((o) => o.letter === chosenLetter);
              if (opt?.targetSceneId) {
                get().jumpTo(opt.targetSceneId, opt.targetFrameId);
                return;
              }
              break;
            }
          }
        }

        const next = scene.frames[idx + 1];
        if (next) {
          set((s) => ({
            currentFrameId: next.id,
            currentDialogueIdx: 0,
            history: [...s.history, { sceneId: scene.id, frameId: next.id }],
          }));
        } else {
          // End of scene: S14 has a conditional hidden route to S15 (true ending)
          // only unlocked when the player completed both S06A and S13A good paths.
          if (scene.id === 'S14') {
            const { history } = get();
            const visitedS06A = history.some((h) => h.sceneId === 'S06A');
            const visitedS13A = history.some((h) => h.sceneId === 'S13A');
            if (visitedS06A && visitedS13A && script.scenes.has('S15')) {
              get().jumpTo('S15');
            } else {
              set({ phase: 'ending' });
            }
            return;
          }
          // General case: try downstream meta, otherwise next scene in order
          const downstreamMatch = scene.meta.downstream?.match(/S\d+[a-z]?/i);
          const nextSceneId = downstreamMatch
            ? downstreamMatch[0].toUpperCase()
            : nextInOrder(script, scene.id);
          if (nextSceneId && script.scenes.has(nextSceneId)) {
            get().jumpTo(nextSceneId);
          } else {
            set({ phase: 'ending' });
          }
        }
      },

      setDialogueIdx: (i) => set({ currentDialogueIdx: i }),

      setFlag: (key, value) => set((s) => ({ flags: { ...s.flags, [key]: value } })),
      addToFlag: (key, delta) =>
        set((s) => {
          const cur = Number(s.flags[key] ?? 0);
          return { flags: { ...s.flags, [key]: cur + delta } };
        }),
      getFlag: (key) => get().flags[key] as never,

      setChosenOption: (sceneId, frameId, letter) =>
        set((s) => ({
          chosenOptionByFrame: {
            ...s.chosenOptionByFrame,
            [`${sceneId}/${frameId}`]: letter,
          },
        })),

      clearChosenOption: (sceneId, frameId) =>
        set((s) => {
          const key = `${sceneId}/${frameId}`;
          if (!(key in s.chosenOptionByFrame)) return s;
          const next = { ...s.chosenOptionByFrame };
          delete next[key];
          return { chosenOptionByFrame: next };
        }),

      toggleDevPanel: () => set((s) => ({ showDevPanel: !s.showDevPanel })),
      unlockAudio: () => set({ audioUnlocked: true }),

      reloadScript: () => {
        const { script, diagnostics } = loadAllScripts();
        set({ script, diagnostics, scriptVersion: Date.now() });
      },
    }),
    {
      name: 'xiangjianni-save',
      partialize: (s) => ({
        flags: s.flags,
        history: s.history,
        currentSceneId: s.currentSceneId,
        currentFrameId: s.currentFrameId,
        currentDialogueIdx: s.currentDialogueIdx,
        phase: s.phase,
        chosenOptionByFrame: s.chosenOptionByFrame,
        fontScale: s.fontScale,
      }),
    },
  ),
);

function nextInOrder(script: Script, sceneId: string): string | null {
  const idx = script.sceneOrder.indexOf(sceneId);
  if (idx < 0) return null;
  return script.sceneOrder[idx + 1] ?? null;
}

// HMR: re-parse scripts when any .md changes
if (import.meta.hot) {
  if (typeof window !== 'undefined') {
    import.meta.hot.on('script-changed', () => {
      useGame.getState().reloadScript();
    });
  }
}
