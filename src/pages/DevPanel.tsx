import { useState, useEffect, useMemo } from 'react';
import {
  useGame,
  useTextOffsets,
  useCurrentTheme,
  getNonEmptyOffsets,
  TEXT_SLOTS,
  ALL_THEMES,
  THEME_LABEL,
  type TextSlotKey,
  type SceneTheme,
  type FontScale,
} from '@/engine';
import styles from './DevPanel.module.css';

type SaveStatus = 'idle' | 'saving' | 'ok' | 'err' | 'unchanged' | 'notfound';

export function DevPanel() {
  const devMode = useGame((s) => s.devMode);
  const showDevPanel = useGame((s) => s.showDevPanel);
  const toggleDevPanel = useGame((s) => s.toggleDevPanel);
  const script = useGame((s) => s.script);
  const diagnostics = useGame((s) => s.diagnostics);
  const currentSceneId = useGame((s) => s.currentSceneId);
  const currentFrameId = useGame((s) => s.currentFrameId);
  const flags = useGame((s) => s.flags);
  const jumpTo = useGame((s) => s.jumpTo);
  const setFlag = useGame((s) => s.setFlag);
  const reloadScript = useGame((s) => s.reloadScript);
  const fontScale = useGame((s) => s.fontScale);
  const setFontScale = useGame((s) => s.setFontScale);

  const [showAll, setShowAll] = useState(false);

  // ── 内容编辑器 ──────────────────────────────────────────────
  const [editText, setEditText] = useState('');
  const [editOriginal, setEditOriginal] = useState('');
  const [editFilePath, setEditFilePath] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // 当前画面切换时，把 rawMarkdown 载入编辑框
  useEffect(() => {
    if (!currentSceneId || !currentFrameId) return;
    const scene = script.scenes.get(currentSceneId);
    const frame = scene?.frames.find((f) => f.id === currentFrameId);
    if (!frame || !scene) return;
    setEditOriginal(frame.rawMarkdown);
    setEditText(frame.rawMarkdown);
    setEditFilePath(scene.filePath);
    setSaveStatus('idle');
  }, [currentSceneId, currentFrameId, script]);

  const handleSave = async () => {
    if (editText === editOriginal) {
      setSaveStatus('unchanged');
      return;
    }
    setSaveStatus('saving');
    try {
      const res = await fetch('/dev/patch-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: editFilePath, from: editOriginal, to: editText }),
      });
      if (res.ok) {
        setSaveStatus('ok');
        setEditOriginal(editText);
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        const data = await res.json() as { error?: string };
        setSaveStatus(data.error?.includes('not found') ? 'notfound' : 'err');
      }
    } catch {
      setSaveStatus('err');
    }
  };

  const saveLabel: Record<SaveStatus, string> = {
    idle: '保存到文件',
    saving: '保存中…',
    ok: '✓ 已保存',
    err: '✕ 保存失败',
    unchanged: '内容未变',
    notfound: '✕ 未找到原文',
  };

  if (!devMode) return null;

  return (
    <>
      <button className={styles.fab} onClick={toggleDevPanel} aria-label="Dev panel">
        ⚙
      </button>
      {showDevPanel && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span>Dev · 调试面板</span>
            <button className={styles.closeBtn} onClick={toggleDevPanel}>
              ✕
            </button>
          </div>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>字号</div>
            <div className={styles.txRow}>
              <label className={styles.txLabel}>大小</label>
              <div className={styles.txThemeGroup}>
                {(
                  [
                    { scale: 'sm' as FontScale, label: '小' },
                    { scale: 'md' as FontScale, label: '标准' },
                    { scale: 'lg' as FontScale, label: '大' },
                  ] as const
                ).map(({ scale, label }) => (
                  <button
                    key={scale}
                    className={`${styles.txChip} ${fontScale === scale ? styles.txChipActive : ''}`}
                    onClick={() => setFontScale(scale)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>当前位置</div>
            <div className={styles.kv}>
              <span>scene</span> <code>{currentSceneId ?? '—'}</code>
            </div>
            <div className={styles.kv}>
              <span>frame</span> <code>{currentFrameId ?? '—'}</code>
            </div>
          </section>

          {/* ── 内容编辑器 ── */}
          {editFilePath && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>编辑当前画面文案</div>
              <div className={styles.editMeta}>{editFilePath.split('/').slice(-2).join('/')}</div>
              <textarea
                className={styles.editTextarea}
                value={editText}
                onChange={(e) => { setEditText(e.target.value); setSaveStatus('idle'); }}
                spellCheck={false}
              />
              <div className={styles.editFooter}>
                <button
                  className={`${styles.saveBtn} ${saveStatus === 'ok' ? styles.saveBtnOk : ''} ${saveStatus.startsWith('err') || saveStatus === 'notfound' ? styles.saveBtnErr : ''}`}
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                >
                  {saveLabel[saveStatus]}
                </button>
                {editText !== editOriginal && (
                  <button
                    className={styles.resetBtn}
                    onClick={() => { setEditText(editOriginal); setSaveStatus('idle'); }}
                  >
                    还原
                  </button>
                )}
              </div>
              {saveStatus === 'notfound' && (
                <div className={styles.editHint}>
                  提示：原文在文件中未匹配到，可能是上次保存后内容已变更。请点还原后重试。
                </div>
              )}
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.sectionTitle}>跳转</div>
            <div className={styles.sceneGrid}>
              {script.sceneOrder.map((id) => (
                <button
                  key={id}
                  className={`${styles.sceneBtn} ${id === currentSceneId ? styles.sceneBtnActive : ''}`}
                  onClick={() => jumpTo(id)}
                >
                  {id}
                </button>
              ))}
            </div>
            {currentSceneId && (
              <>
                <div className={styles.sectionSubtitle}>{currentSceneId} 的画面</div>
                <div className={styles.frameGrid}>
                  {script.scenes.get(currentSceneId)?.frames.map((f) => (
                    <button
                      key={f.id}
                      className={`${styles.frameBtn} ${
                        f.id === currentFrameId ? styles.frameBtnActive : ''
                      }`}
                      onClick={() => jumpTo(currentSceneId, f.id)}
                      title={f.title}
                    >
                      {f.id} · {f.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>Flags（爱意值等）</div>
            <div className={styles.flagList}>
              {Object.entries(flags).length === 0 && <div className={styles.muted}>（无）</div>}
              {Object.entries(flags).map(([k, v]) => (
                <div key={k} className={styles.kv}>
                  <span>{k}</span>
                  <code>{String(v)}</code>
                  {typeof v === 'number' && (
                    <>
                      <button onClick={() => setFlag(k, v - 1)}>-1</button>
                      <button onClick={() => setFlag(k, v + 1)}>+1</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.flagAdd}>
              <button onClick={() => setFlag('loveValue', Number(flags.loveValue ?? 0) + 1)}>
                + loveValue
              </button>
              <button onClick={() => setFlag('saveHim', true)}>set saveHim = true</button>
            </div>
          </section>

          <TextOffsetSection />

          <section className={styles.section}>
            <div className={styles.sectionTitle}>剧本诊断 ({diagnostics.length})</div>
            <button className={styles.reloadBtn} onClick={() => reloadScript()}>
              ↻ 重新解析剧本
            </button>
            {diagnostics.length > 0 && (
              <>
                <button className={styles.toggleAll} onClick={() => setShowAll((v) => !v)}>
                  {showAll ? '收起' : '展开全部'}
                </button>
                <ul className={styles.diagList}>
                  {(showAll ? diagnostics : diagnostics.slice(0, 5)).map((d, i) => (
                    <li key={i} className={d.level === 'error' ? styles.diagError : styles.diagWarn}>
                      [{d.level}] {d.scene ?? ''}{d.frame ? `/${d.frame}` : ''} — {d.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  文字位置微调子面板
 * ──────────────────────────────────────────────────────────────────────── */

type ExportMode = 'idle' | 'json' | 'css';

function TextOffsetSection() {
  const offsets = useTextOffsets((s) => s.offsets);
  const setOffset = useTextOffsets((s) => s.set);
  const patchOffset = useTextOffsets((s) => s.patch);
  const resetOffset = useTextOffsets((s) => s.reset);
  const copyTo = useTextOffsets((s) => s.copyTo);

  const sceneTheme = useCurrentTheme();
  const [theme, setTheme] = useState<SceneTheme>(sceneTheme);
  const [followScene, setFollowScene] = useState(true);
  const [slot, setSlot] = useState<TextSlotKey>('dialogue-text');
  const [step, setStep] = useState<number>(1);
  const [exportMode, setExportMode] = useState<ExportMode>('idle');

  useEffect(() => {
    if (followScene) setTheme(sceneTheme);
  }, [sceneTheme, followScene]);

  const current = offsets[theme]?.[slot] ?? { dx: 0, dy: 0 };

  const nudge = (axis: 'dx' | 'dy', dir: 1 | -1) => {
    patchOffset(theme, slot, { [axis]: dir * step });
  };

  const setExact = (axis: 'dx' | 'dy', raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setOffset(theme, slot, { ...current, [axis]: n });
  };

  const exportText = useMemo(() => {
    const filtered = getNonEmptyOffsets(offsets);
    if (exportMode === 'json') {
      return JSON.stringify(filtered, null, 2);
    }
    if (exportMode === 'css') {
      const lines: string[] = [];
      for (const t of ALL_THEMES) {
        const map = filtered[t];
        const entries = Object.entries(map);
        if (entries.length === 0) continue;
        lines.push(`/* theme: ${t} */`);
        for (const [k, v] of entries) {
          if (!v) continue;
          lines.push(
            `--tx-${t}-${k}-x: ${v.dx}px;  --tx-${t}-${k}-y: ${v.dy}px;`,
          );
        }
      }
      return lines.length > 0 ? lines.join('\n') : '/* 全部为 0，没有非空数据 */';
    }
    return '';
  }, [exportMode, offsets]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>文字位置微调</div>

      {/* 主题选择 */}
      <div className={styles.txRow}>
        <label className={styles.txLabel}>主题</label>
        <div className={styles.txThemeGroup}>
          {ALL_THEMES.map((t) => (
            <button
              key={t}
              className={`${styles.txChip} ${theme === t ? styles.txChipActive : ''}`}
              onClick={() => {
                setTheme(t);
                setFollowScene(false);
              }}
            >
              {THEME_LABEL[t]}
            </button>
          ))}
          <button
            className={`${styles.txChip} ${followScene ? styles.txChipActive : ''}`}
            onClick={() => {
              setFollowScene(true);
              setTheme(sceneTheme);
            }}
            title="自动跟随当前场景主题"
          >
            跟随场景
          </button>
        </div>
      </div>

      {/* 文字类型 */}
      <div className={styles.txRow}>
        <label className={styles.txLabel}>类型</label>
        <select
          className={styles.txSelect}
          value={slot}
          onChange={(e) => setSlot(e.target.value as TextSlotKey)}
        >
          {Object.entries(groupSlots()).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((it) => (
                <option key={it.key} value={it.key}>
                  {it.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* 步长 */}
      <div className={styles.txRow}>
        <label className={styles.txLabel}>步长</label>
        <div className={styles.txThemeGroup}>
          {[1, 2, 5, 10].map((n) => (
            <button
              key={n}
              className={`${styles.txChip} ${step === n ? styles.txChipActive : ''}`}
              onClick={() => setStep(n)}
            >
              {n}px
            </button>
          ))}
        </div>
      </div>

      {/* 方向按钮（十字布局） */}
      <div className={styles.txDpad}>
        <div />
        <button className={styles.txArrow} onClick={() => nudge('dy', -1)} title={`上 ${step}px`}>↑</button>
        <div />
        <button className={styles.txArrow} onClick={() => nudge('dx', -1)} title={`左 ${step}px`}>←</button>
        <button className={styles.txArrowCenter} onClick={() => setOffset(theme, slot, { dx: 0, dy: 0 })} title="重置当前">
          ⊙
        </button>
        <button className={styles.txArrow} onClick={() => nudge('dx', 1)} title={`右 ${step}px`}>→</button>
        <div />
        <button className={styles.txArrow} onClick={() => nudge('dy', 1)} title={`下 ${step}px`}>↓</button>
        <div />
      </div>

      {/* 数值显示与精确输入 */}
      <div className={styles.txValueRow}>
        <label className={styles.txValueLabel}>X</label>
        <input
          className={styles.txInput}
          type="number"
          value={current.dx}
          onChange={(e) => setExact('dx', e.target.value)}
        />
        <label className={styles.txValueLabel}>Y</label>
        <input
          className={styles.txInput}
          type="number"
          value={current.dy}
          onChange={(e) => setExact('dy', e.target.value)}
        />
      </div>

      {/* 操作 */}
      <div className={styles.txActions}>
        <button
          className={styles.txBtn}
          onClick={() => resetOffset(theme)}
          title={`清空 ${THEME_LABEL[theme]} 全部 slot 的偏移`}
        >
          重置本主题
        </button>
        <button className={styles.txBtn} onClick={() => resetOffset()} title="清空全部主题">
          全部重置
        </button>
        <button
          className={styles.txBtn}
          onClick={() => {
            const other = ALL_THEMES.find((t) => t !== theme);
            if (other) copyTo(theme, other);
          }}
          title="把当前主题的全部偏移复制到另一主题"
        >
          复制到其它主题
        </button>
      </div>

      {/* 导出 */}
      <div className={styles.txActions}>
        <button
          className={styles.txBtn}
          onClick={() => setExportMode((m) => (m === 'json' ? 'idle' : 'json'))}
        >
          {exportMode === 'json' ? '收起 JSON' : '导出 JSON'}
        </button>
        <button
          className={styles.txBtn}
          onClick={() => setExportMode((m) => (m === 'css' ? 'idle' : 'css'))}
        >
          {exportMode === 'css' ? '收起 CSS 变量' : '导出 CSS 变量'}
        </button>
      </div>
      {exportMode !== 'idle' && (
        <textarea className={styles.txExport} value={exportText} readOnly spellCheck={false} />
      )}
    </section>
  );
}

function groupSlots() {
  const groups: Record<string, typeof TEXT_SLOTS[number][]> = {};
  for (const s of TEXT_SLOTS) {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  }
  return groups;
}
