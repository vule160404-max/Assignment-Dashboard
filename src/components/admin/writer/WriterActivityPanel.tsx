import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Globe,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  PauseCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';

export type WriterActivityStatus =
  | 'running'
  | 'success'
  | 'info'
  | 'warning'
  | 'error';

export interface WriterActivityLogEntry {
  id: string;
  timestamp: string;
  status: WriterActivityStatus;
  title: string;
  detail?: string;
  model?: string;
  durationSec?: number;
}

interface WriterActivityPanelProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  stickyTopPx?: number;
  isBusy: boolean;
  onStopAi: () => void;
  currentStepLabel: string;
  researchedSources?: string;
  completedSectionsCount: number;
  totalSectionsCount: number;
  errorSectionsCount: number;
  onJumpToFirstError?: () => void;
  totalDraftedWords: number;
  targetWordCount: number;
  logs: WriterActivityLogEntry[];
  orderScopeLabel?: string;
  onClearLogs: () => void;
  onRunAudit?: () => void;
  lastAuditScore?: number | null;
  lastAuditCriticalCount?: number;
  isAuditing?: boolean;
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function WriterActivityPanel({
  isOpen,
  onToggleOpen,
  stickyTopPx = 152,
  isBusy,
  onStopAi,
  currentStepLabel,
  researchedSources,
  completedSectionsCount,
  totalSectionsCount,
  errorSectionsCount,
  onJumpToFirstError,
  totalDraftedWords,
  targetWordCount,
  logs,
  orderScopeLabel,
  onClearLogs,
  onRunAudit,
  lastAuditScore = null,
  lastAuditCriticalCount = 0,
  isAuditing = false,
}: WriterActivityPanelProps) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showSourcesPreview, setShowSourcesPreview] = useState(false);

  // Live ticking timer while AI is running
  useEffect(() => {
    if (!isBusy) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isBusy, currentStepLabel]);

  const hasSources = Boolean(researchedSources?.trim());
  const sourceUrlCount = hasSources
    ? (researchedSources?.match(/https?:\/\/[^\s)]+/g) || []).length
    : 0;

  // Collapsed state: sleek floating pill on the right edge
  if (!isOpen) {
    return (
      <div className="fixed right-4 bottom-5 z-30 inline-flex items-center gap-1.5">
        {isBusy && (
          <button
            type="button"
            onClick={onStopAi}
            title="Dừng ngay trợ lý AI"
            className="btn-press inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-lg text-xs font-semibold"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Dừng ({formatElapsed(elapsedSec)})</span>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleOpen}
          title="Mở bảng Trạng thái Trợ lý AI"
          className="btn-press inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-md border border-zinc-200/95 shadow-lg hover:border-[#12489B]/50 text-xs font-semibold text-slate-800"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isBusy
                ? 'bg-[#12489B] animate-ping'
                : errorSectionsCount > 0
                ? 'bg-rose-500'
                : 'bg-emerald-500'
            }`}
          />
          <PanelRightOpen className="w-3.5 h-3.5 text-[#12489B]" />
          <span>Trợ lý AI</span>
          {logs.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-blue-50 text-[#12489B] border border-blue-200/70">
              {logs.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  // Filter out duplicate "running" log entry when the live Active Strip already shows it
  const visibleLogs = logs.filter((entry, idx) => !(isBusy && idx === 0 && entry.status === 'running'));

  return (
    <aside
      style={{
        top: `${stickyTopPx}px`,
        maxHeight: `calc(100vh - ${stickyTopPx + 16}px)`,
      }}
      className="xl:col-span-3 xl:sticky xl:z-20 xl:flex xl:flex-col bg-white border border-zinc-200/90 rounded-2xl shadow-2xs overflow-hidden transition-[top] duration-150"
    >
      {/* Compact Header */}
      <div className="shrink-0 px-3.5 py-2.5 bg-zinc-50/90 border-b border-zinc-200/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isBusy
                ? 'bg-[#12489B] animate-pulse'
                : errorSectionsCount > 0
                ? 'bg-rose-500'
                : 'bg-emerald-500'
            }`}
          />
          <h3 className="text-xs font-bold text-slate-900 truncate">
            Trợ lý AI
          </h3>
          <span
            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
              isBusy
                ? 'bg-blue-50 text-[#12489B] border border-blue-200/70'
                : errorSectionsCount > 0
                ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
            }`}
          >
            {isBusy
              ? formatElapsed(elapsedSec)
              : errorSectionsCount > 0
              ? `${errorSectionsCount} lỗi`
              : 'Sẵn sàng'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {logs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              title={
                orderScopeLabel
                  ? `Xóa nhật ký riêng của ${orderScopeLabel}`
                  : 'Xóa nhật ký đơn này'
              }
              className="btn-press p-1 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleOpen}
            title="Thu gọn bảng trạng thái"
            className="btn-press p-1 rounded-md text-zinc-400 hover:text-slate-800 hover:bg-zinc-200/60"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Running Task Strip + Instant Stop Button (only shown while busy) */}
      {isBusy && (
        <div className="shrink-0 px-3 py-2.5 bg-blue-50/70 border-b border-blue-200/80 space-y-2">
          <div className="flex items-start gap-2">
            <Loader2 className="w-3.5 h-3.5 text-[#12489B] animate-spin shrink-0 mt-0.5" />
            <p className="text-[11px] font-semibold text-[#0B2559] leading-snug flex-1 break-words">
              {currentStepLabel || 'Đang xử lý yêu cầu...'}
            </p>
          </div>
          <button
            type="button"
            onClick={onStopAi}
            className="btn-press w-full py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Dừng ngay ({formatElapsed(elapsedSec)})</span>
          </button>
        </div>
      )}

      {/* Compact 2-Metric Status Grid: Web Sources + Writing Status */}
      <div className="shrink-0 p-2.5 border-b border-zinc-100 bg-slate-50/40 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {/* Metric 1: Researched Web Sources (Clickable to inspect!) */}
          <button
            type="button"
            disabled={!hasSources}
            onClick={() => hasSources && setShowSourcesPreview((v) => !v)}
            className={`p-2 rounded-xl border text-left transition-colors ${
              hasSources
                ? 'bg-emerald-50/60 border-emerald-200/80 hover:bg-emerald-50 cursor-pointer'
                : 'bg-white border-zinc-200/80 cursor-default'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <Globe className="w-3 h-3 text-[#12489B]" />
                <span>Nguồn web</span>
              </span>
              {hasSources &&
                (showSourcesPreview ? (
                  <ChevronUp className="w-3 h-3 text-emerald-700" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-emerald-700" />
                ))}
            </div>
            <div
              className={`text-[11px] font-bold mt-0.5 truncate ${
                hasSources ? 'text-emerald-800' : 'text-zinc-400'
              }`}
            >
              {hasSources
                ? sourceUrlCount > 0
                  ? `${sourceUrlCount} URL · Xem`
                  : 'Đã lưu · Xem'
                : 'Chưa tra cứu'}
            </div>
          </button>

          {/* Metric 2: Draft & Error Quick Status */}
          <button
            type="button"
            disabled={errorSectionsCount === 0 || !onJumpToFirstError}
            onClick={() => errorSectionsCount > 0 && onJumpToFirstError?.()}
            className={`p-2 rounded-xl border text-left transition-colors ${
              errorSectionsCount > 0
                ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-50 cursor-pointer'
                : 'bg-white border-zinc-200/80 cursor-default'
            }`}
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
              <FileText className="w-3 h-3 text-[#12489B]" />
              <span>Bài viết</span>
            </div>
            {errorSectionsCount > 0 ? (
              <div className="text-[11px] font-bold text-rose-700 mt-0.5 truncate">
                {errorSectionsCount} mục lỗi · Mở
              </div>
            ) : (
              <div className="text-[11px] font-bold font-mono text-slate-800 mt-0.5 truncate tabular-nums">
                {completedSectionsCount}/{totalSectionsCount} ·{' '}
                {totalDraftedWords.toLocaleString('vi-VN')}w
              </div>
            )}
          </button>
        </div>

        {/* Expandable Real-Time Perplexity Sources Inspector */}
        {hasSources && showSourcesPreview && (
          <div className="p-2.5 rounded-xl bg-white border border-emerald-200/90 max-h-44 overflow-y-auto text-[10.5px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words font-mono">
            {researchedSources}
          </div>
        )}

        {/* Final Academic QA Auditor CTA */}
        {onRunAudit && (
          <button
            type="button"
            disabled={isBusy || isAuditing || totalDraftedWords === 0}
            onClick={onRunAudit}
            className={`btn-press w-full px-2.5 py-2 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 disabled:opacity-50 ${
              lastAuditScore !== null && lastAuditCriticalCount > 0
                ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-50 text-rose-800'
                : lastAuditScore !== null && lastAuditScore >= 85
                ? 'bg-emerald-50/80 border-emerald-200 hover:bg-emerald-50 text-emerald-800'
                : 'bg-white border-blue-200/90 hover:bg-blue-50/60 text-[#0B2559]'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {isAuditing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#12489B] shrink-0" />
              ) : lastAuditCriticalCount > 0 ? (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-[#12489B] shrink-0" />
              )}
              <span className="text-[11px] font-bold truncate">
                {isAuditing ? 'Đang kiểm duyệt bài...' : 'Kiểm duyệt bài (AI QA)'}
              </span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                lastAuditScore === null
                  ? 'bg-blue-50 text-[#12489B] border border-blue-200/70'
                  : lastAuditCriticalCount > 0
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {lastAuditScore === null
                ? 'Rà lỗi'
                : lastAuditCriticalCount > 0
                ? `${lastAuditCriticalCount} lỗi · ${lastAuditScore}đ`
                : `${lastAuditScore}đ`}
            </span>
          </button>
        )}
      </div>

      {/* Compact Scannable Activity Log */}
      <div className="xl:flex-1 xl:min-h-0 xl:overflow-y-auto px-3 py-2.5 max-h-72 xl:max-h-none">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 gap-1.5">
          <span className="inline-flex items-center gap-1 min-w-0">
            <Activity className="w-3 h-3 shrink-0" />
            <span className="shrink-0">Nhật ký</span>
            {orderScopeLabel && (
              <span
                title={`Nhật ký lưu riêng cho ${orderScopeLabel}`}
                className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200/80 text-[9.5px] font-mono normal-case tracking-normal text-slate-600 truncate max-w-[115px]"
              >
                {orderScopeLabel}
              </span>
            )}
          </span>
          <span className="font-mono shrink-0">
            {targetWordCount > 0
              ? `Mục tiêu ${targetWordCount.toLocaleString('vi-VN')}w`
              : `${visibleLogs.length}`}
          </span>
        </div>

        {visibleLogs.length === 0 ? (
          <div className="py-6 text-center space-y-1">
            <Clock className="w-4 h-4 text-zinc-300 mx-auto" />
            <p className="text-[11px] text-zinc-400">
              {isBusy
                ? 'Đang ghi nhận kết quả bước hiện tại...'
                : 'Chưa có nhật ký hoạt động.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {visibleLogs.map((entry) => (
              <div key={entry.id} className="py-2 first:pt-0 last:pb-0 space-y-0.5">
                <div className="flex items-start justify-between gap-2 text-[11px]">
                  <div className="flex items-start gap-1.5 min-w-0">
                    {entry.status === 'running' ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#12489B] animate-spin shrink-0 mt-0.5" />
                    ) : entry.status === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : entry.status === 'error' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    ) : entry.status === 'warning' ? (
                      <PauseCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-[#12489B] shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`font-semibold leading-snug break-words ${
                        entry.status === 'error'
                          ? 'text-rose-700'
                          : 'text-slate-800'
                      }`}
                    >
                      {entry.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] tabular-nums">
                    {entry.durationSec !== undefined && (
                      <span className="text-zinc-500">
                        {entry.durationSec.toFixed(1)}s
                      </span>
                    )}
                    <span className="text-zinc-400">{entry.timestamp.slice(0, 5)}</span>
                  </div>
                </div>

                {entry.detail && (
                  <p
                    className={`text-[10.5px] leading-snug pl-5 break-words ${
                      entry.status === 'error'
                        ? 'text-rose-600'
                        : 'text-zinc-500'
                    }`}
                  >
                    {entry.detail}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
