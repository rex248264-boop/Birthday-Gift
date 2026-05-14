import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveBackground, pickFirstExisting } from '@/engine/assetResolver';
import styles from './SceneBackground.module.css';

type Props = {
  sceneId: string;
  frameId: string;
  hint?: string;
  fallbackText?: string;
  bgOverride?: string | null;
};

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(url);
}

export function SceneBackground({ sceneId, frameId, hint, fallbackText, bgOverride }: Props) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    setTried(false);
    const candidates = resolveBackground(sceneId, frameId, hint);
    pickFirstExisting(candidates).then((url) => {
      if (cancelled) return;
      setResolved(url);
      setTried(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sceneId, frameId, hint]);

  const isVideo = resolved ? isVideoUrl(resolved) : false;

  return (
    <div className={styles.root} aria-hidden>
      <AnimatePresence mode="sync">
        {resolved && !isVideo && (
          <motion.div
            key={resolved}
            className={styles.image}
            style={{ backgroundImage: `url(${resolved})` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )}
        {resolved && isVideo && (
          <motion.video
            key={resolved}
            className={styles.video}
            src={resolved}
            autoPlay
            loop
            muted
            playsInline
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      {tried && !resolved && !bgOverride && (
        <div className={styles.placeholder}>
          <div className={styles.placeholderInner}>
            <div className={styles.placeholderTag}>[场景占位]</div>
            <div className={styles.placeholderText}>{fallbackText || `${sceneId} · Frame ${frameId}`}</div>
            <div className={styles.placeholderHint}>
              放置 <code>public/assets/bg/{sceneId}-{frameId}.jpg</code> 或 <code>.mp4</code> 即可替换
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {bgOverride && (
          <motion.div
            key="bg-override"
            className={styles.bgOverride}
            style={{ backgroundColor: bgOverride }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
