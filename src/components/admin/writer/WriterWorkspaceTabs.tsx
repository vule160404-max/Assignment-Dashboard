import { useState } from 'react';
import {
  BookOpen,
  Bot,
  Check,
  Download,
  FilePlus2,
  FolderPlus,
  GitCompareArrows,
  Loader2,
  Paperclip,
  Pause,
  Play,
  Send,
  Sparkles,
  Users,
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
  onOpenCohortCloner: () => void;
  onOpenCohortSimilarity: () => void;
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
  onOpenCohortCloner,
  onOpenCohortSimilarity,
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

  /* ---- Active session file name label ---- */
  const activeLabel = activeSession.linkedOrderCode
    ? `${activeSession.linkedOrderCode} · ${(activeSession.topic || activeSession.title || 'Untitled').slice(0, 48)}`
    : (activeSession.topic || activeSession.title || 'Untitled').slice(0, 56);
  const activeFilename = `${activeLabel}.docx`;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
      {/* ───── TOP BAR: macOS-style title + main nav tabs ───── */}
      <div className="bg-[#FAFBFC] border-b border-zinc-200/80 px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left: file name pill */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-[11px] h-[11px] rounded-full bg-[#FF5F57]" />
            <span className="w-[11px] h-[11px] rounded-full bg-[#FEBC2E]" />
            <span className="w-[11px] h-[11px] rounded-full bg-[#28C840]" />
          </div>
          <span className="text-[12.5px] font-semibold text-slate-700 truncate">
            {activeFilename}
          </span>
        </div>

        {/* Center: main navigation tab group – inspired by reference */}
        <div className="hidden sm:flex items-center bg-white rounded-lg border border-zinc-200/90 p-0.5 shadow-2xs">
          <button
            type="button"
            className="px-3.5 py-1.5 text-[11.5px] font-bold rounded-md bg-[#12489B] text-white"
          >
            Soạn thảo & Trích dẫn
          </button>
          <button
            type="button"
            onClick={onOpenSkills}
            title="Mở thư viện File Skill quy chuẩn học thuật"
            className="px-3.5 py-1.5 text-[11.5px] font-semibold rounded-md text-zinc-600 hover:text-[#12489B] hover:bg-zinc-50 inline-flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#12489B]" />
            <span>Skills ({enabledSkillsCount})</span>
          </button>
        </div>

        {/* Right: system status & API only */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            title={
              cloudSyncState === 'synced'
                ? 'Đã đồng bộ Cloud Firestore'
                : cloudSyncState === 'permission_denied'
                ? 'Offline'
                : 'Đang đồng bộ...'
            }
            className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500"
          >
            <span
              className={`w-[7px] h-[7px] rounded-full ${
                cloudSyncState === 'synced'
                  ? 'bg-emerald-500'
                  : cloudSyncState === 'permission_denied'
                  ? 'bg-amber-500'
                  : 'bg-zinc-400 animate-pulse'
              }`}
            />
          </span>

          <button
            type="button"
            onClick={onOpenApiSettings}
            title={
              hasApiKey
                ? `Model: ${activeModelName} (Bấm để cài đặt API)`
                : 'Chưa cấu hình API Key'
            }
            className={`btn-press inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
              hasApiKey
                ? 'bg-white border-zinc-200 text-slate-700 hover:bg-zinc-50'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Bot
              className={`w-3.5 h-3.5 ${
                hasApiKey ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
            <span className="font-mono">
              {hasApiKey ? formatCompactModelName(activeModelName) : 'API'}
            </span>
          </button>
        </div>
      </div>

      {/* ───── SESSION TABS ROW ───── */}
      <div className="bg-white border-b border-zinc-100 px-3 py-1.5 flex items-center gap-1 overflow-x-auto">
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

          let dotColor = 'bg-zinc-300';
          if (sess.batchStatus === 'outlining' || busy) dotColor = 'bg-[#12489B] animate-pulse';
          else if (sess.batchStatus === 'queued') dotColor = 'bg-amber-400 animate-pulse';
          else if (sess.batchStatus === 'error') dotColor = 'bg-rose-500';
          else if (totalSections > 0 && completedSections === totalSections && draftedWords > 0) dotColor = 'bg-emerald-500';
          else if (sess.batchStatus === 'paused') dotColor = 'bg-amber-500';

          const tabLabel = sess.linkedOrderCode
            ? `#${sess.linkedOrderCode}`
            : sess.title || `Bài #${idx + 1}`;

          return (
            <div
              key={sess.id}
              className={`group shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] transition-all cursor-pointer ${
                isActive
                  ? 'bg-white border border-zinc-200 shadow-sm text-slate-900 font-bold'
                  : 'text-zinc-500 hover:text-slate-700 hover:bg-zinc-50'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectSession(sess.id)}
                className="flex items-center gap-1.5 min-w-0"
                title={`${tabLabel} (${completedSections}/${totalSections} · ${draftedWords.toLocaleString('vi-VN')}w)`}
              >
                {busy ? (
                  <Loader2 className="w-3 h-3 text-[#12489B] animate-spin shrink-0" />
                ) : (
                  <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${dotColor}`} />
                )}
                {sess.cohortMeta && (
                  <span className="px-1 py-px rounded bg-[#0B2559] text-amber-300 font-mono text-[9px] font-bold shrink-0">
                    N{sess.cohortMeta.cloneIndex}/{sess.cohortMeta.cohortSize}
                  </span>
                )}
                <span className="truncate max-w-[120px]">{tabLabel}</span>
                {draftedWords > 0 && (
                  <span className="font-mono text-[10px] text-zinc-400 tabular-nums">
                    {draftedWords.toLocaleString('vi-VN')}w
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onCloseSession(sess.id)}
                title="Đóng tab"
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-200 text-zinc-400 hover:text-rose-600 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}

        {/* Divider */}
        <span className="w-px h-5 bg-zinc-200 mx-0.5 shrink-0" />

        {/* Quick actions */}
        <button
          type="button"
          onClick={onAddNewBlank}
          title="Thêm tab mới"
          className="btn-press shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-[#12489B] hover:bg-blue-50"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setShowOrderPicker((v) => !v)}
          title="Nạp nhiều đơn"
          className={`btn-press shrink-0 p-1.5 rounded-lg ${
            showOrderPicker
              ? 'bg-blue-50 text-[#12489B]'
              : 'text-zinc-400 hover:text-[#12489B] hover:bg-blue-50'
          }`}
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onOpenCohortCloner}
          title="Nhân bản cùng lớp"
          className="btn-press shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold rounded-lg bg-blue-50 text-[#0B2559] hover:bg-[#0B2559] hover:text-white border border-blue-200/90 hover:border-[#0B2559] transition-colors"
        >
          <Users className="w-3 h-3" />
          <span className="hidden xl:inline">Nhân bản</span>
        </button>

        <button
          type="button"
          onClick={onOpenCohortSimilarity}
          title="Soi Similarity"
          className="btn-press shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg"
        >
          <GitCompareArrows className="w-3 h-3" />
          <span className="hidden xl:inline">Similarity</span>
        </button>

        {/* Parallel runner */}
        {sessions.length >= 2 && (
          <div className="inline-flex items-center gap-1 pl-1.5 ml-0.5 border-l border-zinc-200 shrink-0">
            <select
              aria-label="Luồng"
              value={concurrencyLimit}
              onChange={(e) => onConcurrencyChange(Number(e.target.value) || 2)}
              className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-zinc-200 rounded text-zinc-700"
            >
              <option value={2}>2×</option>
              <option value={3}>3×</option>
              <option value={4}>4×</option>
            </select>

            {runnableCount > 0 && (
              <button
                type="button"
                onClick={onRunAllParallel}
                className="btn-press inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-bold bg-[#12489B] text-white rounded-md hover:bg-[#0B2559]"
              >
                <Play className="w-2.5 h-2.5" />
                <span>{runnableCount}</span>
              </button>
            )}

            {draftedPapersCount >= 2 && (
              <button
                type="button"
                disabled={exportingAll}
                onClick={onExportAllDocx}
                className="btn-press inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-medium bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-md"
              >
                <Download className="w-2.5 h-2.5" />
                <span>{draftedPapersCount}</span>
              </button>
            )}
          </div>
        )}

        {anyRunning && (
          <button
            type="button"
            onClick={onPauseAll}
            className="btn-press shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-md"
          >
            <Pause className="w-2.5 h-2.5" />
            <span>Dừng</span>
          </button>
        )}
      </div>

      {/* ───── Collapsible Multi-Order Batch Picker ───── */}
      {showOrderPicker && (
        <div className="popover-enter p-3.5 bg-blue-50/30 border-b border-blue-200/60 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900">
              Chọn đơn hàng để mở nhiều tab:
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
                className="btn-press px-2.5 py-1 text-[11px] font-medium bg-white border border-zinc-200 rounded-lg text-zinc-700 hover:bg-zinc-50"
              >
                Chọn tất cả
              </button>
              <button
                type="button"
                disabled={pickedCodes.length === 0}
                onClick={handleConfirmBatchOrders}
                className="btn-press px-3 py-1 text-[11px] font-bold bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] disabled:opacity-40"
              >
                Mở {pickedCodes.length} đơn
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
            <p className="text-xs text-zinc-500">Chưa có đơn hàng nào.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {availableOrders.map((ord) => {
                const isChecked = pickedCodes.includes(ord.orderCode);
                const alreadyOpened = existingLinkedCodes.has(ord.orderCode);
                return (
                  <div
                    key={ord.id}
                    onClick={() => togglePickCode(ord.orderCode)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-colors ${
                      isChecked
                        ? 'border-[#12489B] bg-blue-50/50 shadow-sm'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
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
                      <div className="text-[11px] text-zinc-600 truncate mt-0.5">
                        {ord.subject}: {ord.topic}
                      </div>
                      {alreadyOpened && (
                        <span className="inline-block mt-1 text-[10px] text-emerald-700 font-medium">
                          Đã mở
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

      {/* ───── BOTTOM BAR: Order link + Publishing Actions ───── */}
      <div className="px-4 py-2 bg-[#FAFBFC] flex flex-wrap items-center justify-between gap-2">
        {/* Left: Linked order */}
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
          <select
            aria-label="Nạp đề bài từ đơn"
            value={activeSession.linkedOrderCode}
            onChange={(e) => onLoadFromOrder(e.target.value)}
            className="px-2.5 py-1.5 text-[11.5px] font-medium bg-white border border-zinc-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#12489B] max-w-[340px] truncate"
          >
            <option value="">— Bài viết độc lập —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.orderCode}>
                #{o.orderCode} · {o.subject} ({o.wordCount}w)
              </option>
            ))}
          </select>
        </div>

        {/* Right: Publish actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          {linkedOrder && onAttachToLinkedOrder && (
            <button
              type="button"
              disabled={attachingToOrder || totalDraftedWords === 0}
              onClick={onAttachToLinkedOrder}
              className="btn-press px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Paperclip className="w-3 h-3" />
              <span>{attachingToOrder ? 'Đang lưu...' : 'Lưu nháp'}</span>
            </button>
          )}

          {onPushToHumanizer && (
            <button
              type="button"
              disabled={totalDraftedWords === 0}
              onClick={onPushToHumanizer}
              className="btn-press px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Humanize</span>
            </button>
          )}

          <button
            type="button"
            disabled={exportingDocx}
            onClick={onExportDocx}
            className="btn-press px-3 py-1.5 text-[11px] font-bold rounded-lg bg-[#12489B] text-white hover:bg-[#0B2559] disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <Download className="w-3 h-3" />
            <span>{exportingDocx ? 'Đang xuất...' : '.DOCX'}</span>
          </button>

          {onExportPdf && (
            <button
              type="button"
              disabled={totalDraftedWords === 0}
              onClick={onExportPdf}
              className="btn-press px-3 py-1.5 text-[11px] font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Download className="w-3 h-3" />
              <span>.PDF</span>
            </button>
          )}

          {onOpenDeliverModal && (
            <button
              type="button"
              disabled={totalDraftedWords === 0}
              onClick={onOpenDeliverModal}
              className="btn-press px-3.5 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 inline-flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-3 h-3" />
              <span>
                {linkedOrder
                  ? `Đẩy bài (#${linkedOrder.orderCode})`
                  : 'Đẩy bài'}
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
