import type { Frame } from './types';
import { extractAssetHints } from './parseAssetHints';
import { parseDescription } from './parseDescription';
import { parseDialogue } from './parseDialogue';
import { parseNarration } from './parseNarration';
import { parseTransition } from './parseTransition';

// A frame starts with: ## Frame X.Y · Title  (or ## Frame X.Y Title, or ## Frame N · Title)
// We collect everything until the next "## Frame ..." or end of document.

// Frame IDs may include a letter suffix, e.g. "6a.1" or "6b.2"
const FRAME_HEADER_RE = /^##\s+Frame\s+([0-9]+[a-z]?(?:\.[0-9]+[a-z]?)?)\s*[·•．\.\-]?\s*(.+?)\s*$/i;
const SUBSECTION_RE = /^###\s+(画面描述|背景旁白|对话|转场)\s*$/;

export function parseFramesFromBody(body: string, startingLineOffset = 0): Frame[] {
  const lines = body.split(/\r?\n/);
  const frames: Frame[] = [];

  type FrameRaw = { id: string; title: string; startLine: number; body: string[] };
  const rawFrames: FrameRaw[] = [];

  let current: FrameRaw | null = null;
  lines.forEach((line, idx) => {
    const m = line.match(FRAME_HEADER_RE);
    if (m) {
      if (current) rawFrames.push(current);
      current = { id: m[1], title: m[2].trim(), startLine: startingLineOffset + idx, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  });
  if (current) rawFrames.push(current);

  for (const rf of rawFrames) {
    frames.push(buildFrame(rf));
  }

  return frames;
}

function buildFrame(rf: { id: string; title: string; startLine: number; body: string[] }): Frame {
  const sections = splitFrameSections(rf.body);

  const description = sections.画面描述 ? parseDescription(sections.画面描述) : null;
  const narration = sections.背景旁白 ? parseNarration(sections.背景旁白) : null;
  const dialogue = sections.对话 ? parseDialogue(sections.对话) : null;
  const transition = sections.转场 ? parseTransition(sections.转场) : null;

  return {
    id: rf.id,
    title: rf.title,
    description,
    narration,
    dialogue,
    transition,
    rawMarkdown: rf.body.join('\n'),
    sourceLine: rf.startLine,
  };
}

function splitFrameSections(body: string[]): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey != null) {
      const trimmed = buffer.join('\n').trim();
      if (trimmed.length > 0) {
        sections[currentKey] = (sections[currentKey] ? sections[currentKey] + '\n\n' : '') + trimmed;
      }
    }
  };

  for (const line of body) {
    const m = line.match(SUBSECTION_RE);
    if (m) {
      flush();
      currentKey = m[1];
      buffer = [];
      continue;
    }
    if (currentKey) buffer.push(line);
  }
  flush();
  return sections;
}

export function frameHasInteractive(frame: Frame): boolean {
  if (!frame.dialogue) return false;
  return frame.dialogue.items.some((it) => it.kind === 'choice' || it.kind === 'input');
}
