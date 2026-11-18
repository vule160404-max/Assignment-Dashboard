import { useState } from 'react';
import {
  Check,
  Download,
  FilePlus2,
  FolderPlus,
  Loader2,
  Pause,
  Play,
  X,
} from 'lucide-react';
import { countWords } from '../../../lib/wordHumanizer';
import { OrderRecord } from '../../../types/domain';
import { WriterSession } from './types';

interface WriterWorkspaceTabsProps {
  sessions: WriterSession[];
  activeSessionId: string;
  orders: OrderRecord[];
  concurrencyLimit: number;
  exportingAll: boolean;
  onSelectSession: (sessionId: string) => void;
  onAddNewBlank: () => void;
  onImportMultipleOrders: (selectedOrders: OrderRecord[]) => void;
  onCloseSession: (sessionId: string) => void;
  onRunAllParallel: () => void;
  onPauseAll: () => void;
  onConcurrencyChange: (limit: number) => void;
  onExportAllDocx: () => void;
}

export function isWriterSessionBusy(session: WriterSession): boolean {
  return (
    session.batchStatus === 'queued' ||
    session.batchStatus === 'outlining' ||
    session.batchStatus === 'writing_sections' ||
    session.outline.some((sec) => sec.status === 'generating')
  );
}

export function WriterWorkspaceTabs({
  sessions,
  activeSessionId,
  orders,
  concurrencyLimit,
  exportingAll,
  onSelectSession,
  onAddNewBlank,
  onImportMultipleOrders,
  onCloseSession,
  onRunAllParallel,
  onPauseAll,
  onConcurrencyChange,
  onExportAllDocx,
}: WriterWorkspaceTabsProps) {
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const [pickedCodes, setPickedCodes] = useState<string[]>([]);

  if (sessions.length === 0) return null;

  const anyRunning = sessions.some((s) => isWriterSessionBusy(s));
  const runnableCount = sessions.filter((s) => {
    if (isWriterSessionBusy(s)) return false;
    const doneSecs = s.outline.filter((sec) => countWords(sec.content) > 0).length;
    return s.outline.length === 0 || doneSecs < s.outline.length;
  }).length;

  const draftedPapersCount = sessions.filter((s) =>
    s.outline.some((sec) => countWords(sec.content) > 0)
  ).length;

  const existingLinkedCodes = new Set(
    sessions.map((s) => s.linkedOrderCode).filter(Boolean)
  );
  const availableOrders = orders.filter((o) => o.orderStatus !== 'cancelled');

  const togglePickCode = (code: string) => {
    setPickedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleConfirmBatchOrders = () => {
    const chosen = availableOrders.filter((o) =>
      pickedCodes.includes(o.orderCode)
    );
    if (chosen.length > 0) {
      onImportMultipleOrders(chosen);
    }
    setPickedCodes([]);
    setShowOrderPicker(false);
  };

  return (
    <section className="bg-white border border-zinc-200/90 rounded-xl p-3 shadow-2xs space-y-2.5">
      {/* Top Row: Multi-Paper Controls & Parallel Execution */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-900">
            Danh sách bài đang làm ({sessions.length} bài)
          </span>
          <span className="text-zinc-300">·</span>
          <span className="text-zinc-500">
            Có thể mở nhiều bài để AI tự lập dàn ý và viết song song ở chế độ chạy nền
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Concurrency Selector */}
          {sessions.length >= 2 && (
            <label className="inline-flex items-center gap-1 text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
              <span className="text-[11px]">Luồng chạy:</span>
              <select
                value={concurrencyLimit}
                onChange={(e) =>
                  onConcurrencyChange(Number(e.target.value) || 2)
                }
                className="font-mono font-semibold text-slate-900 bg-transparent focus:outline-none"
              >
                <option value={2}>2 bài/lúc</option>
                <option value={3}>3 bài/lúc</option>
                <option value={4}>4 bài/lúc</option>
              </select>
            </label>
          )}

          {/* Run All Parallel Button */}
          {runnableCount > 0 && (
            <button
              type="button"
              onClick={onRunAllParallel}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#4338CA] hover:bg-indigo-700 text-white rounded-lg whitespace-nowrap shadow-2xs"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {sessions.length >= 2
                  ? `Viết song song tất cả (${runnableCount} bài)`
                  : 'Tự động viết bài này'}
              </span>
            </button>
          )}

          {/* Pause All Button */}
          {anyRunning && (
            <button
              type="button"
              onClick={onPauseAll}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg whitespace-nowrap"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Dừng tất cả</span>
            </button>
          )}

          {/* Batch Import from Orders */}
          <button
            type="button"
            onClick={() => setShowOrderPicker((v) => !v)}
            className={`btn-press inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap ${
              showOrderPicker
                ? 'bg-indigo-50 text-[#4338CA] border-indigo-200'
                : 'bg-white text-slate-800 border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#4338CA]" />
            <span>+ Nạp nhiều Đơn cùng lúc</span>
          </button>

          {/* Add New Blank Paper */}
          <button
            type="button"
            onClick={onAddNewBlank}
            className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-800 rounded-lg whitespace-nowrap"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>+ Bài mới</span>
          </button>

          {/* Batch Export All DOCX */}
          {draftedPapersCount >= 2 && (
            <button
              type="button"
              disabled={exportingAll}
              onClick={onExportAllDocx}
              className="btn-press inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-lg whitespace-nowrap disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {exportingAll
                  ? 'Đang xuất...'
                  : `Tải tất cả (${draftedPapersCount} .DOCX)`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Multi-Order Batch Picker */}
      {showOrderPicker && (
        <div className="popover-enter p-3 rounded-xl bg-indigo-50/45 border border-indigo-200/80 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900">
              Tích chọn các Đơn hàng muốn mở thành nhiều tab bài viết cùng lúc:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setPickedCodes(
                    availableOrders
                      .filter((o) => !existingLinkedCodes.has(o.orderCode))
                      .map((o) => o.orderCode)
                  )
                }
                className="btn-press px-2 py-1 text-[11px] font-medium bg-white border border-zinc-200 rounded text-zinc-700 hover:bg-zinc-50"
              >
                Chọn tất cả đơn chưa mở
              </button>
              <button
                type="button"
                disabled={pickedCodes.length === 0}
                onClick={handleConfirmBatchOrders}
                className="btn-press px-3 py-1 text-xs font-semibold bg-[#4338CA] text-white rounded-md hover:bg-indigo-700 disabled:opacity-40"
              >
                Mở {pickedCodes.length} đơn đã chọn
              </button>
              <button
                type="button"
                onClick={() => setShowOrderPicker(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {availableOrders.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Chưa có đơn hàng nào trong danh sách. Bạn có thể bấm "+ Bài mới" để tự nhập nhiều bài nghiên cứu độc lập.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {availableOrders.map((ord) => {
                const isChecked = pickedCodes.includes(ord.orderCode);
                const alreadyOpened = existingLinkedCodes.has(ord.orderCode);
                return (
                  <div
                    key={ord.id}
                    onClick={() => togglePickCode(ord.orderCode)}
                    className={`p-2 rounded-lg border text-xs cursor-pointer flex items-start gap-2 ${
                      isChecked
                        ? 'border-[#4338CA] bg-white shadow-2xs'
                        : 'border-zinc-200 bg-white/80 hover:border-zinc-300'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isChecked
                          ? 'bg-[#4338CA] border-[#4338CA] text-white'
                          : 'border-zinc-300 bg-white'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-bold text-slate-900 flex items-center justify-between gap-1">
                        <span>#{ord.orderCode}</span>
                        <span className="text-[10px] font-normal text-zinc-500">
                          {ord.wordCount}w · {ord.citationStyle}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-600 truncate">
                        {ord.subject}: {ord.topic}
                      </div>
                      {alreadyOpened && (
                        <span className="inline-block mt-0.5 text-[10px] text-emerald-700 font-medium">
                          Đã có tab mở
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Horizontal Paper Session Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {sessions.map((sess, idx) => {
          const isActive = sess.id === activeSessionId;
          const totalSections = sess.outline.length;
          const completedSections = sess.outline.filter(
            (sec) => countWords(sec.content) > 0
          ).length;
          const draftedWords = sess.outline.reduce(
            (sum, sec) => sum + countWords(sec.content),
            0
          );
          const busy = isWriterSessionBusy(sess);

          let dotClass = 'bg-zinc-300';
          let statusBadge = '';

          if (sess.batchStatus === 'outlining') {
            dotClass = 'bg-[#4338CA] animate-pulse';
            statusBadge = 'Đang lập dàn ý...';
          } else if (busy) {
            dotClass = 'bg-[#4338CA] animate-pulse';
            statusBadge = `Đang viết (${completedSections}/${totalSections})`;
          } else if (sess.batchStatus === 'queued') {
            dotClass = 'bg-amber-400 animate-pulse';
            statusBadge = 'Đang chờ luồng...';
          } else if (sess.batchStatus === 'error') {
            dotClass = 'bg-rose-500';
            statusBadge = 'Lỗi';
          } else if (
            totalSections > 0 &&
            completedSections === totalSections &&
            draftedWords > 0
          ) {
            dotClass = 'bg-emerald-500';
            statusBadge = 'Hoàn tất';
          } else if (sess.batchStatus === 'paused') {
            dotClass = 'bg-amber-500';
            statusBadge = 'Tạm dừng';
          }

          return (
            <div
              key={sess.id}
              className={`card-interactive group inline-flex items-center gap-2 rounded-xl border pl-3 pr-1.5 py-1.5 text-xs ${
                isActive
                  ? 'border-[#4338CA] bg-indigo-50/75 text-slate-900 ring-2 ring-indigo-500/10'
                  : 'border-zinc-200 bg-zinc-50/70 text-zinc-700 hover:bg-zinc-100/80'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectSession(sess.id)}
                className="flex items-center gap-2 text-left min-w-0"
              >
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#4338CA] animate-spin shrink-0" />
                ) : (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`}
                  />
                )}
                <span className="font-semibold truncate max-w-[175px]">
                  {sess.title || `Bài #${idx + 1}`}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {completedSections}/{totalSections} mục
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-zinc-200/90 text-zinc-600 tabular-nums">
                  {draftedWords.toLocaleString('vi-VN')}w
                </span>
                {statusBadge && (
                  <span className="text-[11px] font-semibold text-[#4338CA]">
                    · {statusBadge}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onCloseSession(sess.id)}
                title="Đóng tab bài này"
                className="p-1 rounded-md hover:bg-zinc-200/70 text-zinc-400 hover:text-rose-600"
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
