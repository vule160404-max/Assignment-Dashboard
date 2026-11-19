import { useEffect, useRef } from 'react';
import { AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { GlitchReviewPayload } from './types';

interface GlitchReviewPanelProps {
  review: GlitchReviewPayload;
  totalChunks: number;
  onChangeEditedOutput: (nextText: string) => void;
  onRetry: () => void;
  onAccept: (editedText: string) => void;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSuspectTokens(text: string, tokens: string[]) {
  if (!tokens || tokens.length === 0) return text;
  const pattern = tokens
    .filter((t) => t.trim().length > 0)
    .map(escapeRegExp)
    .join('|');
  if (!pattern) return text;

  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    const isSuspect = tokens.some((t) => t.toLowerCase() === part.toLowerCase());
    if (!isSuspect) return <span key={idx}>{part}</span>;
    return (
      <mark
        key={idx}
        className="bg-red-100 text-[#DC2626] font-semibold px-1 rounded underline decoration-[#DC2626]/60"
      >
        {part}
      </mark>
    );
  });
}

export function GlitchReviewPanel({
  review,
  totalChunks,
  onChangeEditedOutput,
  onRetry,
  onAccept,
}: GlitchReviewPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [review.chunk.id]);

  return (
    <div
      ref={panelRef}
      className="surface-enter bg-white border border-amber-300 rounded-xl p-5 space-y-4 shadow-[0_14px_36px_rgb(15,23,42,0.08)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-bold text-[#D97706] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Phát hiện đoạn văn từ HIX Bypass có dấu hiệu lỗi ký tự hoặc sai lệch trích dẫn (Chưa dán đè)
          </p>
          <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
            {review.check.reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
        <span className="font-mono text-xs text-zinc-500 tabular-nums">
          Đoạn {review.chunk.chunkOrder}/{totalChunks}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 space-y-1.5">
          <p className="text-xs font-semibold text-zinc-600">Đoạn gốc trong Word</p>
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
            {review.chunk.text}
          </p>
        </div>

        <div className="bg-amber-50/40 border border-amber-200 rounded-lg p-3.5 space-y-2">
          <p className="text-xs font-semibold text-[#D97706]">
            Bản HIX Bypass trả về (vị trí nghi lỗi được tô đỏ)
          </p>
          <p className="text-xs text-slate-800 leading-relaxed bg-white border border-zinc-200 rounded-md p-2.5">
            {highlightSuspectTokens(review.rawOutput, review.check.suspectTokens)}
          </p>
          <label className="block text-[11px] font-medium text-zinc-600">
            Chỉnh sửa nhanh nếu muốn vẫn dán đoạn này:
          </label>
          <textarea
            rows={4}
            value={review.editedOutput}
            onChange={(e) => onChangeEditedOutput(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
        <button
          type="button"
          onClick={onRetry}
          className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Không dán & Thử lại (Retry) ở HIX Bypass</span>
        </button>
        <button
          type="button"
          onClick={() => onAccept(review.editedOutput)}
          className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white border border-zinc-300 text-slate-800 hover:bg-zinc-50 rounded-lg"
        >
          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
          <span>Vẫn dán đoạn này & Tiếp tục</span>
        </button>
      </div>
    </div>
  );
}
