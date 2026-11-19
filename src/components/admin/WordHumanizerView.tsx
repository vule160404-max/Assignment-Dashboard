import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FolderUp,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { countWords } from '../../lib/wordHumanizer';
import { OrderRecord } from '../../types/domain';
import { ChunkDiffDrawer } from './humanizer/ChunkDiffDrawer';
import { DocumentWorkspaceTabs } from './humanizer/DocumentWorkspaceTabs';
import { GlitchReviewPanel } from './humanizer/GlitchReviewPanel';
import { HixConnectionHeader } from './humanizer/HixConnectionHeader';
import { WordPaperCanvas } from './humanizer/WordPaperCanvas';
import { WordUploadToolbar } from './humanizer/WordUploadToolbar';
import { computeSessionChunks, isSessionRunning } from './humanizer/types';
import { useHumanizerSessions } from './humanizer/useHumanizerSessions';

interface WordHumanizerViewProps {
  orders: OrderRecord[];
  initialOrderCode?: string;
  onAttachDocxToOrder?: (order: OrderRecord, file: File) => Promise<void>;
  onToast: (msg: string) => void;
}

export function WordHumanizerView({
  orders,
  initialOrderCode = '',
  onAttachDocxToOrder,
  onToast,
}: WordHumanizerViewProps) {
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [cleanPresentationMode, setCleanPresentationMode] = useState(false);
  const emptyDropInputRef = useRef<HTMLInputElement | null>(null);

  const {
    bridgeStatus,
    checkingBridge,
    downloadingExt,
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    busyTabIds,
    recentCheckpoints,
    exportingDocx,
    attachingOrder,
    refreshBridge,
    mutateSession,
    handleUploadFiles,
    handleCreateFromPaste,
    handleRestorePastedCheckpoint,
    handleStartOrResume,
    handlePauseSession,
    handleStopAndReset,
    handleRunAllParallel,
    handlePauseAll,
    handleCloseSession,
    handleRetrySingleChunk,
    handleResolveGlitch,
    handleDownloadDocx,
    handleAttachToOrder,
    handleDownloadExtensionZip,
    handleDeleteCheckpoint,
    handleClearAllCheckpoints,
  } = useHumanizerSessions({
    orders,
    initialOrderCode,
    onAttachDocxToOrder,
    onToast,
  });

  const chunks = useMemo(
    () => (activeSession ? computeSessionChunks(activeSession) : []),
    [activeSession]
  );

  const completedCount = useMemo(() => {
    if (!activeSession) return 0;
    return chunks.filter((c) => activeSession.chunkResults[c.id]?.accepted).length;
  }, [activeSession, chunks]);

  const totalDocumentWords = useMemo(() => {
    if (!activeSession) return 0;
    return activeSession.wordDoc.paragraphs.reduce(
      (sum, p) => sum + countWords(p.text),
      0
    );
  }, [activeSession]);

  const chunkedWordsTotal = useMemo(
    () => chunks.reduce((sum, c) => sum + c.wordCount, 0),
    [chunks]
  );

  const isRunning = activeSession
    ? isSessionRunning(activeSession.playbackStatus)
    : false;
  const progressPercent =
    chunks.length > 0 ? Math.round((completedCount / chunks.length) * 100) : 0;

  const activeOrder = useMemo(() => {
    const code = activeSession?.selectedOrderCode || '';
    return orders.find((o) => o.orderCode === code) || null;
  }, [activeSession?.selectedOrderCode, orders]);

  const inspectedChunk = activeSession?.inspectChunkId
    ? chunks.find((c) => c.id === activeSession.inspectChunkId) || null
    : null;
  const inspectedResult =
    inspectedChunk && activeSession
      ? activeSession.chunkResults[inspectedChunk.id] || null
      : null;

  let statusHeadline = 'Sẵn sàng trình chiếu';
  if (activeSession) {
    const idx = activeSession.currentChunkIdx;
    if (activeSession.playbackStatus === 'highlighting') {
      statusHeadline = `AI đang tô đen đoạn ${idx + 1}/${chunks.length}...`;
    } else if (activeSession.playbackStatus === 'processing_hix') {
      statusHeadline = `Đoạn ${idx + 1}/${chunks.length}: ${
        activeSession.hixStepText || 'Đang gửi sang tab HIX Bypass...'
      }`;
    } else if (activeSession.playbackStatus === 'review_glitch') {
      statusHeadline = `Tạm dừng kiểm duyệt lỗi văn bản (Đoạn ${idx + 1}/${chunks.length})`;
    } else if (activeSession.playbackStatus === 'pasting') {
      statusHeadline = `Đang dán đè văn bản mới lên đoạn ${idx + 1}/${chunks.length}...`;
    } else if (activeSession.playbackStatus === 'paused') {
      statusHeadline = `Đã tạm dừng tại đoạn ${idx + 1}/${chunks.length}`;
    } else if (activeSession.playbackStatus === 'completed') {
      statusHeadline = `Hoàn tất dán đè ${completedCount}/${chunks.length} đoạn`;
    }
  }

  return (
    <div className="space-y-4">
      {!cleanPresentationMode && (
        <HixConnectionHeader
          bridgeStatus={bridgeStatus}
          busyTabIds={busyTabIds}
          checkingBridge={checkingBridge}
          downloadingExt={downloadingExt}
          showInstallGuide={showInstallGuide}
          onRefreshBridge={() => void refreshBridge()}
          onDownloadExtension={() => {
            setShowInstallGuide(true);
            void handleDownloadExtensionZip();
          }}
          onToggleInstallGuide={() => setShowInstallGuide((v) => !v)}
        />
      )}

      {!cleanPresentationMode && (
        <DocumentWorkspaceTabs
          sessions={sessions}
          activeSessionId={activeSessionId}
          hixTabs={bridgeStatus.hixTabs}
          onSelectSession={setActiveSessionId}
          onAddNewBlank={() => setActiveSessionId('')}
          onCloseSession={handleCloseSession}
          onRunAllParallel={() => void handleRunAllParallel()}
          onPauseAll={handlePauseAll}
        />
      )}

      {!cleanPresentationMode && (
        <WordUploadToolbar
          orders={orders}
          activeSession={activeSession}
          hixTabs={bridgeStatus.hixTabs}
          completedCount={completedCount}
          onUploadFiles={handleUploadFiles}
          onCreateFromPaste={handleCreateFromPaste}
          onUpdateSessionConfig={(sid, patch) =>
            mutateSession(sid, (cur) => ({ ...cur, ...patch }))
          }
        />
      )}

      {!activeSession ? (
        <section
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files || []);
            if (files.length > 0) void handleUploadFiles(files);
          }}
          className="bg-white border border-dashed border-zinc-300 rounded-xl py-14 px-6 text-center space-y-4"
        >
          <input
            ref={emptyDropInputRef}
            type="file"
            accept=".docx"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) void handleUploadFiles(files);
              e.target.value = '';
            }}
          />
          <FolderUp className="w-8 h-8 text-zinc-400 mx-auto" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              Kéo thả hoặc chọn nhiều file Word (.docx) để trình chiếu & chạy song song
            </p>
            <p className="text-xs text-zinc-500 max-w-lg mx-auto leading-relaxed">
              Có thể nạp nhiều bài Word cùng lúc. Mỗi bài sẽ tự động gắn với 1 tab{' '}
              <span className="font-mono text-slate-700">hixbypass.com</span> riêng để chạy song song không xung đột.
            </p>
          </div>
          <button
            type="button"
            onClick={() => emptyDropInputRef.current?.click()}
            className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Chọn file .docx từ máy (hỗ trợ chọn nhiều file)</span>
          </button>

          {recentCheckpoints.length > 0 && (
            <div className="max-w-lg mx-auto mt-4 pt-4 border-t border-zinc-200/80 text-left space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">
                  Tiến trình đang lưu gần đây (Auto-save):
                </p>
                <button
                  type="button"
                  onClick={handleClearAllCheckpoints}
                  className="btn-press inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 rounded-md"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa tất cả</span>
                </button>
              </div>
              <div className="space-y-1.5">
                {recentCheckpoints.slice(0, 4).map((cp) => {
                  const done = Object.values(cp.chunkResults).filter((r) => r.accepted).length;
                  return (
                    <div
                      key={cp.fingerprint}
                      className="flex flex-wrap items-center justify-between gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 truncate">{cp.fileName}</p>
                        <p className="text-[11px] text-zinc-500 font-mono tabular-nums">
                          Đã xong {done} đoạn · {new Date(cp.updatedAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {cp.pastedPlainText ? (
                          <button
                            type="button"
                            onClick={() => void handleRestorePastedCheckpoint(cp)}
                            className="btn-press px-2.5 py-1 text-xs font-medium bg-blue-50 text-[#12489B] hover:bg-blue-100 rounded-md whitespace-nowrap"
                          >
                            Khôi phục ngay
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => emptyDropInputRef.current?.click()}
                            className="btn-press px-2.5 py-1 text-xs font-medium bg-zinc-200/70 text-slate-800 hover:bg-zinc-200 rounded-md whitespace-nowrap"
                          >
                            Chọn lại file để chạy tiếp
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteCheckpoint(cp.fingerprint, cp.fileName)
                          }
                          title={`Xóa bản lưu tạm "${cp.fileName}"`}
                          aria-label={`Xóa bản lưu tạm ${cp.fileName}`}
                          className="btn-press p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="relative bg-[#F4F4F5] border border-zinc-200 rounded-2xl p-4 sm:p-7 space-y-5">
          {(isRunning ||
            activeSession.playbackStatus === 'paused' ||
            activeSession.playbackStatus === 'review_glitch' ||
            cleanPresentationMode) && (
            <div className="sticky top-16 z-30 flex justify-end pointer-events-none">
              <div className="pointer-events-auto inline-flex items-center gap-1.5 bg-white/95 backdrop-blur border border-zinc-200 rounded-xl p-1.5 shadow-[0_10px_28px_rgb(15,23,42,0.12)]">
                {isRunning || activeSession.playbackStatus === 'review_glitch' ? (
                  <button
                    type="button"
                    onClick={() => handlePauseSession(activeSession.sessionId)}
                    className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#DC2626] text-white rounded-lg hover:bg-red-700 whitespace-nowrap"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Tạm dừng bài này</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStartOrResume(activeSession.sessionId)}
                      disabled={
                        chunks.length === 0 ||
                        (activeSession.playbackStatus === 'completed' &&
                          completedCount === chunks.length)
                      }
                      className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] disabled:opacity-45 whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>
                        {activeSession.playbackStatus === 'paused' ? 'Tiếp tục' : 'Bắt đầu'}
                      </span>
                    </button>
                    {activeSession.playbackStatus === 'paused' && (
                      <button
                        type="button"
                        onClick={() => handleStopAndReset(activeSession.sessionId)}
                        className="btn-press inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-100 text-slate-800 hover:bg-zinc-200 rounded-lg whitespace-nowrap"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Dừng hẳn</span>
                      </button>
                    )}
                  </>
                )}

                {cleanPresentationMode && (
                  <button
                    type="button"
                    onClick={() => setCleanPresentationMode(false)}
                    className="btn-press inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium bg-zinc-100 text-slate-700 hover:bg-zinc-200 rounded-lg whitespace-nowrap"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Thoát trình chiếu gọn</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Playback Control & Progress Header */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono tabular-nums">
                  <span className="font-semibold text-slate-900 truncate max-w-[260px]">
                    {activeSession.wordDoc.fileName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{totalDocumentWords} từ gốc</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {chunks.length} lượt câu ({chunkedWordsTotal} từ)
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900">{statusHeadline}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCleanPresentationMode((v) => !v)}
                  className={`btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap ${
                    cleanPresentationMode
                      ? 'bg-[#0F172A] text-white'
                      : 'bg-zinc-100 hover:bg-zinc-200/80 text-slate-800'
                  }`}
                >
                  {cleanPresentationMode ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Thoát trình chiếu gọn</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Trình chiếu gọn</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    mutateSession(activeSession.sessionId, (s) => ({
                      ...s,
                      showOverwriteTint: !s.showOverwriteTint,
                    }))
                  }
                  className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-800 rounded-lg whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>
                    {activeSession.showOverwriteTint
                      ? 'Ẩn màu đã dán đè'
                      : 'Hiện màu đã dán đè'}
                  </span>
                </button>

                {!isRunning && activeSession.playbackStatus !== 'review_glitch' && (
                  <button
                    type="button"
                    disabled={
                      chunks.length === 0 ||
                      (activeSession.playbackStatus === 'completed' &&
                        completedCount === chunks.length)
                    }
                    onClick={() => handleStartOrResume(activeSession.sessionId)}
                    className="btn-press inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] disabled:opacity-45 whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {activeSession.playbackStatus === 'paused'
                        ? 'Tiếp tục trình chiếu'
                        : 'Bắt đầu Humanize'}
                    </span>
                  </button>
                )}

                {completedCount > 0 && (
                  <>
                    <button
                      type="button"
                      disabled={exportingDocx}
                      onClick={() => void handleDownloadDocx(activeSession.sessionId)}
                      className="btn-press inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#16A34A] text-white rounded-lg hover:bg-emerald-700 disabled:opacity-45 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{exportingDocx ? 'Đang xuất...' : 'Tải Word (.docx)'}</span>
                    </button>

                    {activeOrder && onAttachDocxToOrder && (
                      <button
                        type="button"
                        disabled={attachingOrder}
                        onClick={() => void handleAttachToOrder(activeSession.sessionId)}
                        className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-[#12489B] hover:bg-blue-100 rounded-lg disabled:opacity-45 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {attachingOrder
                            ? 'Đang đính kèm...'
                            : `Gắn vào đơn #${activeOrder.orderCode}`}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStopAndReset(activeSession.sessionId)}
                      className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Làm lại</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-500">
                <span>
                  Đã hoàn thành {completedCount}/{chunks.length} đoạn câu
                </span>
                <span className="font-semibold text-slate-900">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="progress-fill h-full w-full bg-[#12489B]"
                  style={{ transform: `scaleX(${progressPercent / 100})` }}
                />
              </div>
            </div>

            {activeSession.restoredFromCheckpoint && (
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl px-3.5 py-2.5 text-xs text-[#12489B] flex flex-wrap items-center justify-between gap-2">
                <span>
                  Đã khôi phục tiến trình đang làm dở ({completedCount}/{chunks.length} đoạn đã xong). Bấm Tiếp tục để chạy nốt phần còn lại.
                </span>
                {!isRunning && (
                  <button
                    type="button"
                    onClick={() => handleStopAndReset(activeSession.sessionId)}
                    className="btn-press px-2.5 py-1 text-xs font-semibold bg-white border border-blue-200 rounded-md hover:bg-blue-100"
                  >
                    Xóa bản lưu & chạy lại
                  </button>
                )}
              </div>
            )}

            {!cleanPresentationMode && !isRunning && completedCount === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-xs text-zinc-600">
                <span>
                  {activeSession.refSectionIdx >= 0
                    ? 'Đã tự động bỏ qua phần Tài liệu tham khảo (References/Phụ lục). Bạn có thể tick chọn/bỏ từng đoạn bên dưới.'
                    : 'Tick chọn hoặc bỏ chọn các đoạn văn bên dưới trước khi bấm Bắt đầu Humanize.'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const defaultExcl =
                      activeSession.refSectionIdx >= 0
                        ? activeSession.wordDoc.paragraphs
                            .filter((p) => p.index >= activeSession.refSectionIdx)
                            .map((p) => p.index)
                        : [];
                    mutateSession(activeSession.sessionId, (s) => ({
                      ...s,
                      excludedParaIndices: defaultExcl,
                    }));
                    onToast(
                      activeSession.refSectionIdx >= 0
                        ? 'Đã chọn lại toàn bộ thân bài & bỏ qua References.'
                        : 'Đã chọn lại toàn bộ các đoạn đủ điều kiện.'
                    );
                  }}
                  className="btn-press px-2.5 py-1 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-800 rounded-md whitespace-nowrap"
                >
                  {activeSession.refSectionIdx >= 0
                    ? 'Chỉ chọn phần thân bài'
                    : 'Chọn lại tất cả'}
                </button>
              </div>
            )}

            {activeSession.playbackError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-[#DC2626] flex items-start gap-2.5 leading-relaxed"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{activeSession.playbackError}</span>
              </div>
            )}
          </div>

          {activeSession.playbackStatus === 'review_glitch' &&
            activeSession.glitchReview && (
              <GlitchReviewPanel
                review={activeSession.glitchReview}
                totalChunks={chunks.length}
                onChangeEditedOutput={(nextText) =>
                  mutateSession(activeSession.sessionId, (s) => ({
                    ...s,
                    glitchReview: s.glitchReview
                      ? { ...s.glitchReview, editedOutput: nextText }
                      : null,
                  }))
                }
                onRetry={() =>
                  handleResolveGlitch(activeSession.sessionId, { action: 'retry' })
                }
                onAccept={(text) =>
                  handleResolveGlitch(activeSession.sessionId, {
                    action: 'accept',
                    text,
                  })
                }
              />
            )}

          <WordPaperCanvas
            wordDoc={activeSession.wordDoc}
            chunks={chunks}
            chunkResults={activeSession.chunkResults}
            playbackStatus={activeSession.playbackStatus}
            currentChunkIdx={activeSession.currentChunkIdx}
            refSectionIdx={activeSession.refSectionIdx}
            excludedParaIndices={activeSession.excludedParaIndices}
            cleanPresentationMode={cleanPresentationMode}
            showOverwriteTint={activeSession.showOverwriteTint}
            isRunning={isRunning}
            completedCount={completedCount}
            onToggleParagraphInclusion={(paraIdx) => {
              if (
                isRunning ||
                activeSession.playbackStatus === 'review_glitch' ||
                completedCount > 0
              ) {
                return;
              }
              mutateSession(activeSession.sessionId, (s) => ({
                ...s,
                excludedParaIndices: s.excludedParaIndices.includes(paraIdx)
                  ? s.excludedParaIndices.filter((i) => i !== paraIdx)
                  : [...s.excludedParaIndices, paraIdx],
              }));
            }}
            onInspectChunk={(chunkId) =>
              mutateSession(activeSession.sessionId, (s) => ({
                ...s,
                inspectChunkId: s.inspectChunkId === chunkId ? null : chunkId,
              }))
            }
          />

          {inspectedChunk && inspectedResult && (
            <ChunkDiffDrawer
              chunk={inspectedChunk}
              result={inspectedResult}
              totalChunks={chunks.length}
              isRunning={isRunning}
              onRetryChunk={(chunkId) =>
                handleRetrySingleChunk(activeSession.sessionId, chunkId)
              }
              onClose={() =>
                mutateSession(activeSession.sessionId, (s) => ({
                  ...s,
                  inspectChunkId: null,
                }))
              }
            />
          )}
        </section>
      )}
    </div>
  );
}
