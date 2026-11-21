import { HixBypassMode } from '../../../lib/hixBridgeClient';
import {
  GlitchCheckResult,
  HumanizeChunk,
  ParsedWordDocument,
  buildSentenceBoundaryChunks,
  MIN_HIX_CHUNK_WORDS,
} from '../../../lib/wordHumanizer';

export type PlaybackStatus =
  | 'idle'
  | 'ready'
  | 'highlighting'
  | 'processing_hix'
  | 'review_glitch'
  | 'pasting'
  | 'paused'
  | 'completed';

export interface ChunkResult {
  outputText: string;
  accepted: boolean;
}

export interface GlitchReviewPayload {
  chunk: HumanizeChunk;
  rawOutput: string;
  editedOutput: string;
  check: GlitchCheckResult;
}

export interface HumanizerSession {
  sessionId: string;
  wordDoc: ParsedWordDocument;
  docFingerprint: string;
  isPastedDoc: boolean;
  pastedSourceText: string;
  excludedParaIndices: number[];
  refSectionIdx: number;
  protectedTermsInput: string;
  restoredFromCheckpoint: boolean;
  chunkResults: Record<string, ChunkResult>;
  maxWordsPerChunk: number;
  hixMode: HixBypassMode;
  selectedOrderCode: string;
  /** Explicit Chrome tabId chosen by user, or undefined for automatic idle-tab assignment */
  preferredTabId?: number;
  /** Chrome tabId currently bound/last used by this session */
  assignedTabId?: number;
  playbackStatus: PlaybackStatus;
  currentChunkIdx: number;
  playbackError: string;
  hixStepText: string;
  glitchReview: GlitchReviewPayload | null;
  inspectChunkId: string | null;
  showOverwriteTint: boolean;
}

export interface SavedHumanizeCheckpoint {
  fingerprint: string;
  fileName: string;
  maxWordsPerChunk: number;
  hixMode: HixBypassMode;
  protectedTermsInput: string;
  excludedParagraphIndices: number[];
  chunkResults: Record<string, ChunkResult>;
  pastedPlainText?: string;
  updatedAt: string;
}

const CHECKPOINT_STORAGE_KEY = 'assigntrack_hix_checkpoints_v1';
let inMemoryCheckpoints: Record<string, SavedHumanizeCheckpoint> = {};

export function readCheckpoints(): Record<string, SavedHumanizeCheckpoint> {
  try {
    window.localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
  } catch {
    // ignore
  }
  return { ...inMemoryCheckpoints };
}

export function writeCheckpoint(entry: SavedHumanizeCheckpoint): void {
  const all = { ...inMemoryCheckpoints, [entry.fingerprint]: entry };
  const sorted = Object.values(all)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  const trimmed: Record<string, SavedHumanizeCheckpoint> = {};
  sorted.forEach((item) => {
    trimmed[item.fingerprint] = item;
  });
  inMemoryCheckpoints = trimmed;
}

export function removeCheckpoint(fingerprint: string): void {
  if (!inMemoryCheckpoints[fingerprint]) return;
  const next = { ...inMemoryCheckpoints };
  delete next[fingerprint];
  inMemoryCheckpoints = next;
}

export function clearAllCheckpoints(): void {
  inMemoryCheckpoints = {};
  try {
    window.localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function computeSessionChunks(session: HumanizerSession): HumanizeChunk[] {
  return buildSentenceBoundaryChunks(
    session.wordDoc.paragraphs,
    session.maxWordsPerChunk,
    MIN_HIX_CHUNK_WORDS,
    new Set(session.excludedParaIndices)
  );
}

export function rebuildParagraphTextsForSession(
  wordDoc: ParsedWordDocument,
  chunks: HumanizeChunk[],
  chunkResults: Record<string, ChunkResult>
): Record<number, string> {
  const map: Record<number, string> = {};
  const chunksByPara = new Map<number, HumanizeChunk[]>();

  chunks.forEach((c) => {
    const list = chunksByPara.get(c.paragraphIndex) || [];
    list.push(c);
    chunksByPara.set(c.paragraphIndex, list);
  });

  for (const para of wordDoc.paragraphs) {
    const paraChunks = chunksByPara.get(para.index);
    if (!paraChunks || paraChunks.length === 0) continue;

    let rebuilt = '';
    let cursor = 0;
    let anyReplaced = false;

    for (const chk of paraChunks) {
      if (chk.startOffset > cursor) {
        rebuilt += para.text.slice(cursor, chk.startOffset);
      }
      const res = chunkResults[chk.id];
      if (res?.accepted) {
        rebuilt += res.outputText;
        anyReplaced = true;
      } else {
        rebuilt += para.text.slice(chk.startOffset, chk.endOffset);
      }
      cursor = chk.endOffset;
    }

    if (cursor < para.text.length) {
      rebuilt += para.text.slice(cursor);
    }

    if (anyReplaced) {
      map[para.index] = rebuilt;
    }
  }

  return map;
}

export function isSessionRunning(status: PlaybackStatus): boolean {
  return (
    status === 'highlighting' ||
    status === 'processing_hix' ||
    status === 'pasting'
  );
}
