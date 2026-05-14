import { useGame } from '@/engine';
import styles from './EndingScreen.module.css';

export function EndingScreen() {
  const setPhase = useGame((s) => s.setPhase);
  const flags = useGame((s) => s.flags);

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>· 暂告一段落 ·</h2>
      <p className={styles.text}>
        本次旅程留下了这些印记：
      </p>
      <pre className={styles.flags}>{JSON.stringify(flags, null, 2)}</pre>
      <button className={styles.btn} onClick={() => setPhase('title')}>
        回到标题页
      </button>
    </div>
  );
}
