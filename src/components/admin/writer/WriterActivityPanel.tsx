import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  PauseCircle,
  Sparkles,
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
  currentStepLabel: string;
  activeModelDisplayName: string;
  hasResearchedSources: boolean;
  completedSectionsCount: number;
  totalSectionsCount: number;
  totalDraftedWords: number;
  targetWordCount: number;
  logs: WriterActivityLogEntry[];
  onClearLogs: () => void;
}

export function WriterActivityPanel({
  isOpen,
  onToggleOpen,
  stickyTopPx = 152,
  isBusy,
  currentStepLabel,
  activeModelDisplayName,
  hasResearchedSources,
  completedSectionsCount,
  totalSectionsCount,
  totalDraftedWords,
  targetWordCount,
  logs,
  onClearLogs,
}: WriterActivityPanelProps) {
  const progressPct =
    targetWordCount > 0
      ? Math.min(100, Math.round((totalDraftedWords / targetWordCount) * 100))
      : totalSectionsCount > 0
      ? Math.round((completedSectionsCount / totalSectionsCount) * 100)
      : 0;

  // Collapsed state: sleek floating edge pill on the right side
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        title="Mở bảng Trạng thái & Lịch sử trợ lý AI"
        className="btn-press fixed right-4 bottom-5 z-30 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/95 backdrop-blur-md border border-zinc-200/95 shadow-lg hover:border-[#12489B]/50 hover:bg-blue-50/40 text-xs font-semibold text-slate-800"
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isBusy ? 'bg-[#12489B] animate-ping' : 'bg-emerald-500'
          }`}
        />
        <PanelRightOpen className="w-3.5 h-3.5 text-[#12489B]" />
        <span>Trạng thái AI</span>
        {logs.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-blue-50 text-[#12489B] border border-blue-200/70">
            {logs.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside
      style={{
        top: `${stickyTopPx}px`,
        maxHeight: `calc(100vh - ${stickyTopPx + 16}px)`,
      }}
      className="xl:col-span-3 xl:sticky xl:z-20 xl:flex xl:flex-col bg-white border border-zinc-200/90 rounded-2xl shadow-2xs overflow-hidden transition-[top] duration-150"
    >
      {/* Header */}
      <div className="shrink-0 px-3.5 py-2.5 bg-zinc-50/90 border-b border-zinc-200/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200/70 flex items-center justify-center text-[#12489B] shrink-0">
            {isBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-900 truncate">
              Trạng thái Trợ lý AI
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {logs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              title="Xóa lịch sử hoạt động"
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

      {/* Live Status Summary Card */}
      <div className="shrink-0 p-3 border-b border-zinc-100 space-y-2.5 bg-slate-50/50">
        <div
          className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
            isBusy
              ? 'bg-blue-50/70 border-blue-200 text-[#0B2559]'
              : 'bg-white border-zinc-200/80 text-slate-700'
          }`}
        >
          {isBusy ? (
            <Loader2 className="w-3.5 h-3.5 text-[#12489B] animate-spin shrink-0 mt-0.5" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {isBusy ? 'Đang thực hiện' : 'Trạng thái hiện tại'}
            </div>
            <p className="text-[11px] font-semibold leading-snug mt-0.5 break-words">
              {currentStepLabel || 'Sẵn sàng nhận lệnh lập dàn ý hoặc viết bài.'}
            </p>
          </div>
        </div>

        {/* Model & Research Source Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-[10px] font-mono font-semibold text-slate-700 truncate max-w-full"
            title={activeModelDisplayName}
          >
            {activeModelDisplayName}
          </span>
          {hasResearchedSources && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 text-[10px] font-semibold text-emerald-700">
              <Globe className="w-2.5 h-2.5" />
              <span>Đã có nguồn web</span>
            </span>
          )}
        </div>

        {/* Paper Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
            <span>
              Tiến độ: {completedSectionsCount}/{totalSectionsCount} mục
            </span>
            <span className="font-mono tabular-nums text-slate-700 font-semibold">
              {totalDraftedWords.toLocaleString('vi-VN')} /{' '}
              {targetWordCount.toLocaleString('vi-VN')} từ ({progressPct}%)
            </span>
          </div>
          <div className="h-1.5 w-full bg-zinc-200/80 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressPct >= 95 ? 'bg-emerald-500' : 'bg-[#12489B]'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Activity History Timeline */}
      <div className="xl:flex-1 xl:min-h-0 xl:overflow-y-auto p-3 space-y-2 max-h-72 xl:max-h-none">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-0.5">
          <span>Lịch sử hoạt động</span>
          <span className="font-mono">{logs.length} sự kiện</span>
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center space-y-1.5">
            <Clock className="w-5 h-5 text-zinc-300 mx-auto" />
            <p className="text-[11px] text-zinc-400">
              Chưa có hoạt động nào.
            </p>
            <p className="text-[10px] text-zinc-400 px-2">
              Mọi bước tra cứu nguồn, lập dàn ý, viết bài và xuất file sẽ hiển thị theo thời gian thực tại đây.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((entry) => (
              <div
                key={entry.id}
                className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                  entry.status === 'running'
                    ? 'bg-blue-50/50 border-blue-200/80'
                    : entry.status === 'error'
                    ? 'bg-rose-50/60 border-rose-200/80'
                    : entry.status === 'warning'
                    ? 'bg-amber-50/60 border-amber-200/80'
                    : 'bg-zinc-50/60 border-zinc-200/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
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
                    <span className="font-semibold text-slate-800 leading-snug break-words">
                      {entry.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 shrink-0 tabular-nums">
                    {entry.timestamp}
                  </span>
                </div>

                {entry.detail && (
                  <p className="text-[10.5px] text-zinc-600 leading-relaxed pl-5 break-words">
                    {entry.detail}
                  </p>
                )}

                {(entry.model || entry.durationSec !== undefined) && (
                  <div className="flex items-center gap-1.5 pl-5 pt-0.5">
                    {entry.model && (
                      <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-white border border-zinc-200/80 text-zinc-500 truncate max-w-[140px]">
                        {entry.model}
                      </span>
                    )}
                    {entry.durationSec !== undefined && (
                      <span className="text-[9.5px] font-mono text-zinc-400 tabular-nums">
                        {entry.durationSec.toFixed(1)}s
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
