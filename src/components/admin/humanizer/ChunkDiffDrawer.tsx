import { ArrowRight, RefreshCw } from 'lucide-react';
import {
  HumanizeChunk,
  computeWordDiff,
  countWords,
} from '../../../lib/wordHumanizer';
import { ChunkResult } from './types';

interface ChunkDiffDrawerProps {
  chunk: HumanizeChunk;
  result: ChunkResult;
  totalChunks: number;
  isRunning: boolean;
  onRetryChunk: (chunkId: string) => void;
  onClose: () => void;
}

export function ChunkDiffDrawer({
  chunk,
  result,
  totalChunks,
  isRunning,
  onRetryChunk,
  onClose,
}: ChunkDiffDrawerProps) {
  return (
    <div className="surface-enter max-w-[780px] mx-auto bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
          <span>
            Đối chiếu thay đổi · Đoạn {chunk.chunkOrder}/{totalChunks}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-mono text-zinc-500">
            {countWords(chunk.text)}w → {countWords(result.outputText)}w
          </span>
        </p>
        <div className="flex items-center gap-2">
          {!isRunning && (
            <button
              type="button"
              onClick={() => onRetryChunk(chunk.id)}
              className="btn-press inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-50 text-[#12489B] hover:bg-blue-100 rounded-md"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Chạy lại đoạn này</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-press px-2 py-1 text-xs font-medium text-zinc-500 hover:text-slate-900"
          >
            Đóng
          </button>
        </div>
      </div>

      <div className="text-sm leading-relaxed bg-zinc-50 border border-zinc-200 rounded-lg p-3.5">
        {computeWordDiff(chunk.text, result.outputText).map((part, i) => {
          if (part.type === 'removed') {
            return (
              <del
                key={i}
                className="bg-red-100/80 text-[#DC2626] px-1 rounded mx-0.5"
              >
                {part.value}
              </del>
            );
          }
          if (part.type === 'added') {
            return (
              <ins
                key={i}
                className="no-underline bg-emerald-100/90 text-[#16A34A] font-medium px-1 rounded mx-0.5"
              >
                {part.value}
              </ins>
            );
          }
          return (
            <span key={i} className="text-slate-800 mx-0.5">
              {part.value}
            </span>
          );
        })}
      </div>
    </div>
  );
}
