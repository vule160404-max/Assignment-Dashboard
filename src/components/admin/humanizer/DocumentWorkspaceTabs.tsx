import { FilePlus2, Pause, Play, X } from 'lucide-react';
import { HixTabInfo } from '../../../lib/hixBridgeClient';
import {
  HumanizerSession,
  computeSessionChunks,
  isSessionRunning,
} from './types';

interface DocumentWorkspaceTabsProps {
  sessions: HumanizerSession[];
  activeSessionId: string;
  hixTabs: HixTabInfo[];
  onSelectSession: (sessionId: string) => void;
  onAddNewBlank: () => void;
  onCloseSession: (sessionId: string) => void;
  onRunAllParallel: () => void;
  onPauseAll: () => void;
}

export function DocumentWorkspaceTabs({
  sessions,
  activeSessionId,
  hixTabs,
  onSelectSession,
  onAddNewBlank,
  onCloseSession,
  onRunAllParallel,
  onPauseAll,
}: DocumentWorkspaceTabsProps) {
  if (sessions.length === 0) return null;

  const anyRunning = sessions.some((s) => isSessionRunning(s.playbackStatus));
  const runnableCount = sessions.filter((s) => {
    const chks = computeSessionChunks(s);
    const done = chks.filter((c) => s.chunkResults[c.id]?.accepted).length;
    return chks.length > 0 && done < chks.length && !isSessionRunning(s.playbackStatus);
  }).length;

  const getTabBadgeLabel = (session: HumanizerSession): string => {
    const targetId = session.preferredTabId ?? session.assignedTabId;
    if (typeof targetId === 'number') {
      const idx = hixTabs.findIndex((t) => t.tabId === targetId);
      if (idx >= 0) return `Tab #${idx + 1}`;
    }
    return 'Auto tab';
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-900">
            Danh sách bài đang mở ({sessions.length})
          </span>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-500">
            Mỗi bài có thể gắn với 1 tab HIX Bypass riêng để chạy song song không đè nhau
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sessions.length >= 2 && runnableCount > 0 && (
            <button
              type="button"
              onClick={onRunAllParallel}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#4338CA] hover:bg-[#3730A3] text-white rounded-lg whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Chạy tất cả song song ({runnableCount} bài)</span>
            </button>
          )}

          {anyRunning && sessions.length >= 2 && (
            <button
              type="button"
              onClick={onPauseAll}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-[#DC2626] hover:bg-red-100 rounded-lg whitespace-nowrap"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Tạm dừng tất cả</span>
            </button>
          )}

          <button
            type="button"
            onClick={onAddNewBlank}
            className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-800 rounded-lg whitespace-nowrap"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Thêm bài mới</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sessions.map((sess) => {
          const isActive = sess.sessionId === activeSessionId;
          const chks = computeSessionChunks(sess);
          const done = chks.filter((c) => sess.chunkResults[c.id]?.accepted).length;
          const running = isSessionRunning(sess.playbackStatus);

          let dotClass = 'bg-zinc-300';
          let statusLabel = '';
          if (running) {
            dotClass = 'bg-[#4338CA] animate-pulse';
            statusLabel = 'Đang chạy';
          } else if (sess.playbackStatus === 'review_glitch') {
            dotClass = 'bg-[#D97706]';
            statusLabel = 'Duyệt lỗi';
          } else if (sess.playbackStatus === 'completed') {
            dotClass = 'bg-[#16A34A]';
            statusLabel = 'Xong';
          } else if (sess.playbackStatus === 'paused') {
            dotClass = 'bg-amber-400';
            statusLabel = 'Tạm dừng';
          }

          return (
            <div
              key={sess.sessionId}
              className={`group inline-flex items-center gap-2 rounded-lg border pl-3 pr-1.5 py-1.5 text-xs transition-colors ${
                isActive
                  ? 'border-[#4338CA] bg-indigo-50/70 text-slate-900'
                  : 'border-zinc-200 bg-zinc-50/70 text-zinc-700 hover:bg-zinc-100/80'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectSession(sess.sessionId)}
                className="flex items-center gap-2 text-left min-w-0"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                <span className="font-medium truncate max-w-[160px]">
                  {sess.wordDoc.fileName}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {done}/{chks.length}
                </span>
                {statusLabel && (
                  <span className="text-[11px] font-medium text-zinc-600">
                    · {statusLabel}
                  </span>
                )}
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600">
                  {getTabBadgeLabel(sess)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onCloseSession(sess.sessionId)}
                title="Đóng bài này"
                aria-label={`Đóng ${sess.wordDoc.fileName}`}
                className="p-1 rounded hover:bg-zinc-200/70 text-zinc-400 hover:text-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
