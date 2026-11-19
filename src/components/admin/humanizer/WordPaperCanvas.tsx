import { type ReactElement, useEffect, useRef } from 'react';
import {
  HumanizeChunk,
  MIN_HIX_CHUNK_WORDS,
  ParsedWordDocument,
  countWords,
} from '../../../lib/wordHumanizer';
import { ChunkResult, PlaybackStatus } from './types';

interface WordPaperCanvasProps {
  wordDoc: ParsedWordDocument;
  chunks: HumanizeChunk[];
  chunkResults: Record<string, ChunkResult>;
  playbackStatus: PlaybackStatus;
  currentChunkIdx: number;
  refSectionIdx: number;
  excludedParaIndices: number[];
  cleanPresentationMode: boolean;
  showOverwriteTint: boolean;
  isRunning: boolean;
  completedCount: number;
  onToggleParagraphInclusion: (paraIdx: number) => void;
  onInspectChunk: (chunkId: string) => void;
}

export function WordPaperCanvas({
  wordDoc,
  chunks,
  chunkResults,
  playbackStatus,
  currentChunkIdx,
  refSectionIdx,
  excludedParaIndices,
  cleanPresentationMode,
  showOverwriteTint,
  isRunning,
  completedCount,
  onToggleParagraphInclusion,
  onInspectChunk,
}: WordPaperCanvasProps) {
  const activeSpanRef = useRef<HTMLSpanElement | null>(null);
  const excludedParaSet = new Set(excludedParaIndices);
  const activeChunk = chunks[currentChunkIdx] || null;

  useEffect(() => {
    if (
      (playbackStatus === 'highlighting' ||
        playbackStatus === 'processing_hix' ||
        playbackStatus === 'pasting') &&
      activeSpanRef.current
    ) {
      activeSpanRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [playbackStatus, currentChunkIdx]);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl max-w-[780px] mx-auto px-6 sm:px-14 py-9 sm:py-12 shadow-[0_8px_28px_rgb(15,23,42,0.04)] space-y-5">
      <div className="pb-4 border-b border-zinc-100 flex items-center justify-between gap-4 text-xs text-zinc-400 font-mono">
        <span className="truncate">{wordDoc.fileName}</span>
        <span>Academic Word Playback</span>
      </div>

      <div className="space-y-4">
        {wordDoc.paragraphs.map((para) => {
          if (para.isEmpty) {
            return <div key={para.index} className="h-2" />;
          }

          if (para.isHeading) {
            const isRefHeading = refSectionIdx >= 0 && para.index === refSectionIdx;
            return (
              <h3
                key={para.index}
                className="text-base sm:text-lg font-bold text-slate-900 pt-2 flex items-center gap-2"
              >
                <span>{para.text}</span>
                {isRefHeading && !cleanPresentationMode && (
                  <span className="text-[11px] font-normal text-zinc-500 font-mono">
                    (Bỏ qua mặc định)
                  </span>
                )}
              </h3>
            );
          }

          const isExcluded = excludedParaSet.has(para.index);
          const canTogglePara =
            !cleanPresentationMode &&
            !isRunning &&
            playbackStatus !== 'review_glitch' &&
            completedCount === 0 &&
            countWords(para.text) >= MIN_HIX_CHUNK_WORDS;

          const paraChunks = chunks.filter((c) => c.paragraphIndex === para.index);
          if (paraChunks.length === 0) {
            return (
              <div key={para.index} className="flex items-start gap-2.5 group">
                {canTogglePara && (
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={() => onToggleParagraphInclusion(para.index)}
                    title="Chọn / bỏ chọn đoạn này để Humanize"
                    aria-label="Chọn đoạn văn để Humanize"
                    className="mt-1.5 w-3.5 h-3.5 accent-[#12489B] shrink-0 cursor-pointer"
                  />
                )}
                <p
                  className={`text-[15px] leading-[1.75] ${
                    isExcluded && !cleanPresentationMode
                      ? 'text-zinc-400'
                      : 'text-slate-800'
                  }`}
                >
                  {para.text}
                </p>
              </div>
            );
          }

          const nodes: ReactElement[] = [];
          let cursor = 0;

          paraChunks.forEach((chk) => {
            if (chk.startOffset > cursor) {
              nodes.push(
                <span key={`pre_${chk.id}`}>
                  {para.text.slice(cursor, chk.startOffset)}
                </span>
              );
            }

            const isCurrentActive =
              activeChunk?.id === chk.id &&
              (playbackStatus === 'highlighting' ||
                playbackStatus === 'processing_hix' ||
                playbackStatus === 'review_glitch' ||
                playbackStatus === 'pasting' ||
                playbackStatus === 'paused');

            const doneResult = chunkResults[chk.id];

            if (isCurrentActive && playbackStatus === 'pasting' && doneResult?.accepted) {
              nodes.push(
                <span
                  key={chk.id}
                  ref={activeSpanRef}
                  className="relative inline bg-emerald-100 text-slate-900 px-1 py-0.5 rounded ring-1 ring-[#16A34A]/40 transition-colors"
                >
                  <span className="inline-flex items-center gap-1 mr-1.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#16A34A] text-white rounded align-middle">
                    Đang dán đè
                  </span>
                  {doneResult.outputText}
                </span>
              );
            } else if (
              isCurrentActive &&
              (playbackStatus === 'highlighting' ||
                playbackStatus === 'processing_hix' ||
                playbackStatus === 'review_glitch' ||
                playbackStatus === 'paused')
            ) {
              let actionBadge = 'Đang tạm dừng';
              if (playbackStatus === 'highlighting') {
                actionBadge = 'AI đang tô đen';
              } else if (playbackStatus === 'processing_hix') {
                actionBadge = 'Đang qua HIX Bypass';
              } else if (playbackStatus === 'review_glitch') {
                actionBadge = 'Chờ kiểm duyệt';
              }

              nodes.push(
                <span
                  key={chk.id}
                  ref={activeSpanRef}
                  className="relative inline bg-blue-100/95 text-slate-900 px-1 py-0.5 rounded ring-1 ring-[#12489B]/45"
                >
                  <span className="inline-flex items-center gap-1 mr-1.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#12489B] text-white rounded align-middle">
                    {actionBadge}
                  </span>
                  {doneResult?.accepted ? doneResult.outputText : chk.text}
                </span>
              );
            } else if (doneResult?.accepted) {
              nodes.push(
                <span
                  key={chk.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onInspectChunk(chk.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onInspectChunk(chk.id);
                    }
                  }}
                  title="Bấm để xem đối chiếu thay đổi trước/sau"
                  className={`cursor-pointer rounded px-0.5 transition-colors ${
                    showOverwriteTint
                      ? 'bg-emerald-50/85 border-b border-emerald-300 hover:bg-emerald-100/80'
                      : 'hover:bg-zinc-100'
                  }`}
                >
                  {doneResult.outputText}
                </span>
              );
            } else {
              nodes.push(
                <span key={chk.id} className="text-slate-800">
                  {chk.text}
                </span>
              );
            }

            cursor = chk.endOffset;
          });

          if (cursor < para.text.length) {
            nodes.push(
              <span key={`tail_${para.index}`} className="text-slate-500">
                {para.text.slice(cursor)}
              </span>
            );
          }

          return (
            <div key={para.index} className="flex items-start gap-2.5">
              {canTogglePara && (
                <input
                  type="checkbox"
                  checked={!isExcluded}
                  onChange={() => onToggleParagraphInclusion(para.index)}
                  title="Chọn / bỏ chọn đoạn này để Humanize"
                  aria-label="Chọn đoạn văn để Humanize"
                  className="mt-1.5 w-3.5 h-3.5 accent-[#12489B] shrink-0 cursor-pointer"
                />
              )}
              <p className="text-[15px] leading-[1.75] text-slate-900">{nodes}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
