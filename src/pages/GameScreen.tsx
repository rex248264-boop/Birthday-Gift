import { useGame } from '@/engine';
import { currentFrame } from '@/engine';
import { FrameView } from '@/components/FrameView';
import styles from './GameScreen.module.css';

export function GameScreen() {
  const currentSceneId = useGame((s) => s.currentSceneId);
  const currentFrameId = useGame((s) => s.currentFrameId);
  const scriptVersion = useGame((s) => s.scriptVersion);
  void scriptVersion; // touched so HMR re-renders

  if (!currentSceneId || !currentFrameId) {
    return (
      <div className={styles.empty}>
        <p>未启动场次。返回标题页开始游戏。</p>
      </div>
    );
  }

  const frame = currentFrame();
  if (!frame) {
    return (
      <div className={styles.empty}>
        <p>找不到画面：{currentSceneId} / {currentFrameId}</p>
      </div>
    );
  }

  return <FrameView sceneId={currentSceneId} frame={frame} />;
}
