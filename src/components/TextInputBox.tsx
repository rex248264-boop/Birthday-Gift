import { useState } from 'react';
import { motion } from 'framer-motion';
import type { TextInputBlock } from '@/parser';
import { submitTextInput, useTextOffsetStyle } from '@/engine';
import styles from './TextInputBox.module.css';

type Props = {
  block: TextInputBlock;
  /** If provided, replaces the default submitTextInput call. */
  onConfirm?: (flagKey: string | undefined, value: string) => void;
};

export function TextInputBox({ block, onConfirm }: Props) {
  const [value, setValue] = useState('');
  const promptOffset = useTextOffsetStyle('input-prompt');
  const submitOffset = useTextOffsetStyle('input-submit');
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    if (onConfirm) {
      onConfirm(block.flagKey, value.trim());
    } else {
      submitTextInput(block.flagKey, value.trim());
    }
  };
  return (
    <div className={styles.overlay}>
      <motion.form
        className={styles.box}
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {block.prompt && (
          <p className={styles.prompt} style={promptOffset}>{block.prompt}</p>
        )}
        <input
          autoFocus
          className={styles.input}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={block.placeholder ?? ''}
          maxLength={60}
        />
        <button type="submit" className={styles.submit} disabled={!value.trim()}>
          <span style={submitOffset}>{block.buttonLabel || '许好了'}</span>
        </button>
      </motion.form>
    </div>
  );
}
