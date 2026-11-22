import { useState } from 'react';
import {
  BookOpen,
  Bot,
  Check,
  Download,
  FilePlus2,
  FolderPlus,
  Loader2,
  Paperclip,
  Pause,
  Play,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { countWords } from '../../../lib/wordHumanizer';
import { CloudSyncState } from '../../../services/writerSyncService';
import { OrderRecord } from '../../../types/domain';
import { WriterSession } from './types';

interface WriterWorkspaceTabsProps {
  sessions: WriterSession[];
  activeSession: WriterSession;
  orders: OrderRecord[];
  concurrencyLimit: number;
  exportingAll: boolean;
  cloudSyncState: CloudSyncState;
  enabledSkillsCount: number;
  activeModelName: string;
  hasApiKey: boolean;
  linkedOrder: OrderRecord | null;
  totalDraftedWords: number;
  attachingToOrder: boolean;
  exportingDocx: boolean;
  onSelectSession: (sessionId: string) => void;
  onAddNewBlank: () => void;
  onImportMultipleOrders: (selectedOrders: OrderRecord[]) => void;
  onCloseSession: (sessionId: string) => void;
  onRunAllParallel: () => void;
  onPauseAll: () => void;
  onConcurrencyChange: (limit: number) => void;
  onExportAllDocx: () => void;
  onLoadFromOrder: (orderCode: string) => void;
  onOpenSkills: () => void;
  onOpenApiSettings: () => void;
  onAttachToLinkedOrder?: () => void;
  onPushToHumanizer?: () => void;
  onOpenDeliverModal?: () => void;
  onExportDocx: () => void;
  onExportPdf?: () => void;
}

export function isWriterSessionBusy(session: WriterSession): boolean {
  return (
    session.batchStatus === 'queued' ||
    session.batchStatus === 'outlining' ||
    session.batchStatus === 'writing_sections' ||
    session.outline.some((sec) => sec.status === 'generating')
  );
}

function formatCompactModelName(rawModel: string): string {
  const trimmed = rawModel.trim();
  if (!trimmed) return 'Cài đặt AI';
  const withoutVendor = trimmed.includes('/')
    ? trimmed.split('/').pop() || trimmed
    : trimmed;
  return withoutVendor.length > 24
    ? `${withoutVendor.slice(0, 22)}…`
    : withoutVendor;
}

export function WriterWorkspaceTabs({
  sessions,
  activeSession,
  orders,
  concurrencyLimit,
  exportingAll,
  cloudSyncState,
  enabledSkillsCount,
  activeModelName,
  hasApiKey,
  linkedOrder,
  totalDraftedWords,
  attachingToOrder,
  exportingDocx,
  onSelectSession,
  onAddNewBlank,
  onImportMultipleOrders,
  onCloseSession,
  onRunAllParallel,
  onPauseAll,
  onConcurrencyChange,
  onExportAllDocx,
  onLoadFromOrder,
  onOpenSkills,
  onOpenApiSettings,
  onAttachToLinkedOrder,
  onPushToHumanizer,
  onOpenDeliverModal,
  onExportDocx,
  onExportPdf,
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
    <section className="bg-white border border-zinc-200/90 rounded-2xl shadow-2xs overflow-hidden">
      {/* TOP BAR: Paper Tabs on Left + System Status & AI Settings tucked cleanly into Top-Right Corner */}
      <div className="bg-slate-50/90 border-b border-zinc-200/80 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Browser-style Session Tabs + Add / Batch Import */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {sessions.map((sess, idx) => {
            const isActive = sess.id === activeSession.id;
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
            let statusText = '';

            if (sess.batchStatus === 'outlining') {
              dotClass = 'bg-[#12489B] animate-pulse';
              statusText = 'Lập dàn ý';
            } else if (busy) {
              dotClass = 'bg-[#12489B] animate-pulse';
              statusText = `${completedSections}/${totalSections}`;
            } else if (sess.batchStatus === 'queued') {
              dotClass = 'bg-amber-400 animate-pulse';
              statusText = 'Chờ luồng';
            } else if (sess.batchStatus === 'error') {
              dotClass = 'bg-rose-500';
              statusText = 'Lỗi';
            } else if (
              totalSections > 0 &&
              completedSections === totalSections &&
              draftedWords > 0
            ) {
              dotClass = 'bg-emerald-500';
            } else if (sess.batchStatus === 'paused') {
              dotClass = 'bg-amber-500';
            }

            const tabLabel = sess.linkedOrderCode
              ? `#${sess.linkedOrderCode}`
              : sess.title || `Bài #${idx + 1}`;

            return (
              <div
                key={sess.id}
                className={`group inline-flex items-center gap-1.5 rounded-lg border pl-2.5 pr-1 py-1 text-xs transition-colors ${
                  isActive
                    ? 'border-[#12489B]/40 bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'border-transparent bg-zinc-200/50 text-zinc-600 hover:bg-zinc-200/80 hover:text-slate-900'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectSession(sess.id)}
                  className="flex items-center gap-1.5 text-left min-w-0"
                  title={`${sess.title || tabLabel} (${completedSections}/${totalSections} mục · ${draftedWords.toLocaleString('vi-VN')} từ)`}
                >
                  {busy ? (
                    <Loader2 className="w-3 h-3 text-[#12489B] animate-spin shrink-0" />
                  ) : (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                  )}
                  <span className="truncate max-w-[145px]">{tabLabel}</span>
                  <span className="font-mono text-[10px] text-zinc-400 tabular-nums">
                    {completedSections}/{totalSections}
                  </span>
                  {draftedWords > 0 && (
                    <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-zinc-100 text-zinc-600 tabular-nums">
                      {draftedWords.toLocaleString('vi-VN')}w
                    </span>
                  )}
                  {statusText && (
                    <span className="text-[10px] font-medium text-[#12489B]">
                      · {statusText}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onCloseSession(sess.id)}
                  title="Đóng tab bài này"
                  className="p-0.5 rounded hover:bg-zinc-200/80 text-zinc-400 hover:text-rose-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Quick Add Tab & Batch Import */}
          <button
            type="button"
            onClick={onAddNewBlank}
            title="Mở thêm 1 tab bài viết mới"
            className="btn-press inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-600 hover:text-slate-900 hover:bg-zinc-200/60 rounded-lg"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>+ Bài mới</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOrderPicker((v) => !v)}
            title="Mở nhiều đơn hàng thành nhiều tab để chạy song song"
            className={`btn-press inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg ${
              showOrderPicker
                ? 'bg-blue-100/80 text-[#12489B]'
                : 'text-zinc-600 hover:text-slate-900 hover:bg-zinc-200/60'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#12489B]" />
            <span>+ Nạp nhiều đơn</span>
          </button>

          {/* Parallel Runner Controls (only prominent when multiple tabs or running) */}
          {sessions.length >= 2 && (
            <div className="inline-flex items-center gap-1 pl-1.5 ml-1 border-l border-zinc-200">
              <select
                aria-label="Số luồng chạy song song"
                value={concurrencyLimit}
                onChange={(e) => onConcurrencyChange(Number(e.target.value) || 2)}
                className="px-1.5 py-0.5 text-[11px] font-mono bg-white border border-zinc-200 rounded text-zinc-700 focus:outline-none"
              >
                <option value={2}>2 luồng</option>
                <option value={3}>3 luồng</option>
                <option value={4}>4 luồng</option>
              </select>

              {runnableCount > 0 && (
                <button
                  type="button"
                  onClick={onRunAllParallel}
                  className="btn-press inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-[#12489B] hover:bg-[#0B2559] text-white rounded-md"
                >
                  <Play className="w-3 h-3" />
                  <span>Chạy {runnableCount} bài</span>
                </button>
              )}

              {draftedPapersCount >= 2 && (
                <button
                  type="button"
                  disabled={exportingAll}
                  onClick={onExportAllDocx}
                  className="btn-press inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white border border-zinc-200 text-slate-700 hover:bg-zinc-50 rounded-md"
                >
                  <Download className="w-3 h-3" />
                  <span>Tải {draftedPapersCount} file</span>
                </button>
              )}
            </div>
          )}

          {anyRunning && (
            <button
              type="button"
              onClick={onPauseAll}
              className="btn-press inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-md"
            >
              <Pause className="w-3 h-3" />
              <span>Dừng</span>
            </button>
          )}
        </div>

        {/* Top-Right Corner: Quiet System Status Pill Group (Cloud Sync + Skills + AI Model) */}
        <div className="inline-flex items-center gap-1 bg-white/90 border border-zinc-200/80 rounded-lg px-2 py-1 text-[11px] ml-auto shrink-0">
          {/* Cloud Sync Dot */}
          <span
            title={
              cloudSyncState === 'synced'
                ? 'Đã đồng bộ đám mây thời gian thực qua Firestore'
                : cloudSyncState === 'permission_denied'
                ? 'Chưa đồng bộ Cloud (kiểm tra quyền Firestore)'
                : 'Đang kết nối đồng bộ Cloud...'
            }
            className="inline-flex items-center gap-1.5 pr-2 border-r border-zinc-200 text-zinc-500 select-none"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                cloudSyncState === 'synced'
                  ? 'bg-emerald-500'
                  : cloudSyncState === 'permission_denied'
                  ? 'bg-amber-500'
                  : 'bg-zinc-400 animate-pulse'
              }`}
            />
            <span className="hidden sm:inline">
              {cloudSyncState === 'synced'
                ? 'Đã đồng bộ'
                : cloudSyncState === 'permission_denied'
                ? 'Offline'
                : 'Đang đồng bộ'}
            </span>
          </span>

          {/* Skills Library Button */}
          <button
            type="button"
            onClick={onOpenSkills}
            title="Mở thư viện File Skill quy chuẩn học thuật"
            className="btn-press inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-zinc-700 hover:bg-zinc-100 hover:text-[#12489B] font-medium"
          >
            <BookOpen className="w-3 h-3 text-[#12489B]" />
            <span>Skills ({enabledSkillsCount})</span>
          </button>

          <span className="text-zinc-200">|</span>

          {/* AI Provider / Model Button */}
          <button
            type="button"
            onClick={onOpenApiSettings}
            title={
              hasApiKey
                ? `Model AI đang dùng: ${activeModelName} (Bấm để đổi Model / API Key)`
                : 'Chưa cấu hình API Key — Bấm để cài đặt'
            }
            className={`btn-press inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${
              hasApiKey
                ? 'text-slate-700 hover:bg-zinc-100 hover:text-[#12489B]'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Bot
              className={`w-3 h-3 ${
                hasApiKey ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
            <span className="font-mono">
              {hasApiKey ? formatCompactModelName(activeModelName) : 'Cài đặt API'}
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible Multi-Order Batch Picker */}
      {showOrderPicker && (
        <div className="popover-enter p-3 bg-blue-50/40 border-b border-blue-200/70 space-y-2.5">
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
                className="btn-press px-3 py-1 text-xs font-semibold bg-[#12489B] text-white rounded-md hover:bg-[#0B2559] disabled:opacity-40"
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
              Chưa có đơn hàng nào trong danh sách.
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
                        ? 'border-[#12489B] bg-white shadow-2xs'
                        : 'border-zinc-200 bg-white/80 hover:border-zinc-300'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        isChecked
                          ? 'bg-[#12489B] border-[#12489B] text-white'
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

      {/* BOTTOM BAR: Clean 1-Row Document Context (Left) & Publishing Actions (Right) */}
      <div className="px-3.5 py-2.5 bg-white flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Linked Order Selector without redundant title pills */}
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
          <span className="text-[11px] font-semibold text-zinc-500 whitespace-nowrap">
            Đơn liên kết:
          </span>
          <select
            aria-label="Nạp đề bài từ mã đơn cho tab hiện tại"
            value={activeSession.linkedOrderCode}
            onChange={(e) => onLoadFromOrder(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#12489B] max-w-full sm:max-w-[380px] truncate"
          >
            <option value="">-- Bài viết độc lập (Chưa gắn mã đơn) --</option>
            {orders.map((o) => (
              <option key={o.id} value={o.orderCode}>
                #{o.orderCode} · {o.subject} ({o.wordCount}w)
              </option>
            ))}
          </select>
        </div>

        {/* Right: Harmonized Publishing & Export Actions */}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {linkedOrder && onAttachToLinkedOrder && (
            <button
              type="button"
              disabled={attachingToOrder || totalDraftedWords === 0}
              onClick={onAttachToLinkedOrder}
              title={`Đính kèm nhanh bản nháp .DOCX vào hồ sơ đơn #${linkedOrder.orderCode}`}
              className="btn-press px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 bg-white text-slate-700 hover:bg-zinc-50 hover:text-slate-900 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Paperclip className="w-3.5 h-3.5 text-zinc-500" />
              <span>{attachingToOrder ? 'Đang lưu...' : 'Lưu nháp vào đơn'}</span>
            </button>
          )}

          {onPushToHumanizer && (
            <button
              type="button"
              disabled={totalDraftedWords === 0}
              onClick={onPushToHumanizer}
              title="Xuất file Word và chuyển thẳng sang tab Word Humanizer"
              className="btn-press px-2.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 bg-white text-slate-700 hover:bg-zinc-50 hover:text-slate-900 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
              <span>Humanize</span>
            </button>
          )}

          <button
            type="button"
            disabled={exportingDocx}
            onClick={onExportDocx}
            title="Tải file Word .DOCX về máy tính"
            className="btn-press px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200/90 bg-blue-50/60 text-[#12489B] hover:bg-blue-100/80 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportingDocx ? 'Đang xuất...' : 'Tải .DOCX'}</span>
          </button>

          {onExportPdf && (
            <button
              type="button"
              disabled={totalDraftedWords === 0}
              onClick={onExportPdf}
              title="Xuất & Tải file PDF chuẩn A4 (giữ nguyên Trang bìa, Mục lục & font Tiếng Việt/Anh)"
              className="btn-press px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200/90 bg-rose-50/70 text-rose-700 hover:bg-rose-100/80 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải .PDF</span>
            </button>
          )}

          {onOpenDeliverModal && (
            <button
              type="button"
              disabled={totalDraftedWords === 0}
              onClick={onOpenDeliverModal}
              title="Bàn giao và đẩy bài trực tiếp lên Portal cho khách hàng"
              className="btn-press px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#12489B] hover:bg-[#0B2559] text-white shadow-2xs disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {linkedOrder
                  ? `Đẩy bài cho khách (#${linkedOrder.orderCode})`
                  : 'Đẩy bài cho khách'}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
