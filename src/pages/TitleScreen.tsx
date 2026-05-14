import { useGame } from '@/engine';
import { audio } from '@/audio/audioManager';
import styles from './TitleScreen.module.css';

export function TitleScreen() {
  const startNewGame = useGame((s) => s.startNewGame);
  const unlockAudio = useGame((s) => s.unlockAudio);
  const script = useGame((s) => s.script);
  const currentSceneId = useGame((s) => s.currentSceneId);
  const setPhase = useGame((s) => s.setPhase);

  const handleStart = () => {
    audio.unlock();
    unlockAudio();
    startNewGame(script.sceneOrder[0]);
  };

  const handleContinue = () => {
    audio.unlock();
    unlockAudio();
    setPhase('playing');
  };

  const hasSave = currentSceneId !== null;

  return (
    <div className={styles.root}>
      <video
        className={styles.bgVideo}
        src="/assets/video/home.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className={styles.overlay} />

      <div className={styles.titleStack}>
        <img
          src="/assets/ui/title-logo.png"
          alt="想见你"
          className={styles.titleLogo}
          draggable={false}
        />
      </div>

      <div className={styles.buttons}>
        <button className={styles.btnPrimary} onClick={handleStart}>
          开始游戏
        </button>
        {hasSave && (
          <button className={styles.btnSecondary} onClick={handleContinue}>
            继续
          </button>
        )}
      </div>

      <div className={styles.footer}>
        <div>v0.0.1 · 画面式互动 AVG</div>
        <div className={styles.footerHint}>iPhone · 竖屏体验</div>
      </div>
    </div>
  );
}
