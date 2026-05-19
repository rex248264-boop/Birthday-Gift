import { useMemo } from 'react';
import { useGame } from '@/engine';
import { audio } from '@/audio/audioManager';
import styles from './GameOverScreen.module.css';

export function GameOverScreen() {
  const goToTitle = useGame((s) => s.goToTitle);
  const endingSceneId = useGame((s) => s.endingSceneId);
  const script = useGame((s) => s.script);

  const subtitle = useMemo(() => {
    if (endingSceneId === 'S06B') return '赛博·虚无之相';
    if (endingSceneId === 'S13B') return '民国·邮轮孤帆';
    const title = endingSceneId ? script.scenes.get(endingSceneId)?.title : undefined;
    return title ?? '';
  }, [endingSceneId, script]);

  const handleHome = () => {
    audio.stopBGM();
    audio.stopVoice();
    goToTitle();
  };

  return (
    <div className={styles.root}>
      <h1 className={styles.heading}>游戏结束</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      <p className={styles.hint}>你可以回到主界面，从已通关章节重新选择另一条路。</p>
      <button type="button" className={styles.btn} onClick={handleHome}>
        回到主界面
      </button>
    </div>
  );
}
