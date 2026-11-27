import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSearch,
  GitCompareArrows,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import {
  CohortPairSimilarity,
  computeCohortSimilarityReport,
} from '../../../lib/cohortEngine';
import { getSafeExternalUrl } from '../../../lib/utils';
import { parseDocxFile } from '../../../lib/wordHumanizer';
import { AttachmentItem, OrderRecord } from '../../../types/domain';
import { WriterSession } from './types';

interface WriterCohortSimilarityModalProps {
  isOpen: boolean;
  sessions: WriterSession[];
  activeSession?: WriterSession;
  orders?: OrderRecord[];
  scrubbingPairKey: string | null;
  exportingAll: boolean;
  onScrubPairCollisions: (pair: CohortPairSimilarity) => Promise<void>;
  onScrubAllRiskyPairs: (pairs: CohortPairSimilarity[]) => Promise<void>;
  onExportAllDocx: () => void;
  onJumpToSessionSection: (sessionId: string, sectionId: string) => void;
  onClose: () => void;
}

interface OrderArchiveCandidate {
  order: OrderRecord;
  attachment: AttachmentItem;
  downloadUrl: string;
  relevanceScore: number;
}

function resolveAttachmentDownloadUrl(att: AttachmentItem): string {
  const safe = getSafeExternalUrl(att.fileIdOrUrl);
  if (safe) return safe;
  const raw = (att.fileIdOrUrl || '').trim();
  if (raw && !raw.startsWith('/') && !raw.includes('://')) {
    return `/api/files/${encodeURIComponent(raw)}`;
  }
  return '';
}

function pickBestDeliverableAttachment(order: OrderRecord): AttachmentItem | null {
  const atts = (order.attachments || []).filter((a) => {
    if (a.isBackup) return false;
    const lower = a.name.toLowerCase();
    return (
      (lower.endsWith('.docx') || lower.endsWith('.txt') || lower.endsWith('.md')) &&
      Boolean(resolveAttachmentDownloadUrl(a))
    );
  });
  if (atts.length === 0) return null;
  return (
    atts.find((a) => a.category === 'final') ||
    atts.find((a) => a.category === 'draft') ||
    atts.find((a) => /final|ban_giao|hoan_thanh|humaniz/i.test(a.name)) ||
    atts[0]
  );
}

export function WriterCohortSimilarityModal({
  isOpen,
  sessions,
  activeSession,
  orders = [],
  scrubbingPairKey,
  exportingAll,
  onScrubPairCollisions,
  onScrubAllRiskyPairs,
  onExportAllDocx,
  onJumpToSessionSection,
  onClose,
}: WriterCohortSimilarityModalProps) {
  const [mode, setMode] = useState<'cohort' | 'orders'>(() =>
    sessions.length < 2 ? 'orders' : 'cohort'
  );
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [expandedPairKey, setExpandedPairKey] = useState<string | null>(null);
  const [scanningOrders, setScanningOrders] = useState(false);
  const [orderScanProgress, setOrderScanProgress] = useState('');
  const [orderScanError, setOrderScanError] = useState('');
  const [orderPairs, setOrderPairs] = useState<CohortPairSimilarity[]>([]);
  const [scannedOrderCount, setScannedOrderCount] = useState(0);
  const orderTextCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (isOpen && sessions.length < 2) {
      setMode('orders');
    }
  }, [isOpen, sessions.length]);

  const orderCandidates = useMemo<OrderArchiveCandidate[]>(() => {
    const activeTokens = new Set(
      `${activeSession?.subject || ''} ${activeSession?.topic || ''}`
        .toLowerCase()
        .split(/[^a-z0-9à-ỹ]+/i)
        .filter((w) => w.length >= 3)
    );
    const activeCode = (activeSession?.linkedOrderCode || '').trim().toUpperCase();

    const list: OrderArchiveCandidate[] = [];
    for (const ord of orders) {
      if (activeCode && ord.orderCode.trim().toUpperCase() === activeCode) {
        continue;
      }
      const isCompleted =
        ord.stage === 'delivered_revision' ||
        ord.stage === 'awaiting_final_payment' ||
        ord.orderStatus === 'completed';
      const att = pickBestDeliverableAttachment(ord);
      if (!att) continue;
      if (!isCompleted && att.category !== 'final') continue;

      const downloadUrl = resolveAttachmentDownloadUrl(att);
      if (!downloadUrl) continue;

      const ordTokens = `${ord.subject || ''} ${ord.topic || ''}`
        .toLowerCase()
        .split(/[^a-z0-9à-ỹ]+/i)
        .filter((w) => w.length >= 3);
      let overlap = 0;
      for (const tok of ordTokens) {
        if (activeTokens.has(tok)) overlap++;
      }
      list.push({
        order: ord,
        attachment: att,
        downloadUrl,
        relevanceScore: overlap + (att.category === 'final' ? 2 : 0),
      });
    }

    list.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.order.updatedAt.localeCompare(a.order.updatedAt);
    });
    return list.slice(0, 20);
  }, [orders, activeSession?.linkedOrderCode, activeSession?.subject, activeSession?.topic]);

  const activeDraftText = useMemo(() => {
    if (!activeSession) return '';
    if (activeSession.fullPaperOverride?.trim()) {
      return activeSession.fullPaperOverride.trim();
    }
    return activeSession.outline
      .map((s) => s.content.trim())
      .filter(Boolean)
      .join('\n\n');
  }, [activeSession]);

  const handleScanCompletedOrders = async () => {
    if (!activeSession || !activeDraftText.trim()) {
      setOrderScanError('Bài viết hiện tại chưa có nội dung thân bài để đối chiếu.');
      return;
    }
    if (orderCandidates.length === 0) {
      setOrderScanError(
        'Chưa tìm thấy đơn hàng nào đã hoàn thành kèm file .docx/.txt trong danh sách Đơn hàng.'
      );
      return;
    }

    setScanningOrders(true);
    setOrderScanError('');
    const syntheticSessions: WriterSession[] = [];

    try {
      for (let i = 0; i < orderCandidates.length; i++) {
        const cand = orderCandidates[i];
        setOrderScanProgress(
          `Đang đọc bài #${cand.order.orderCode} (${i + 1}/${orderCandidates.length})...`
        );
        const cacheKey = `${cand.order.id}:${cand.attachment.id}`;
        let extracted = orderTextCacheRef.current.get(cacheKey);
        if (extracted === undefined) {
          try {
            const resp = await fetch(cand.downloadUrl, { credentials: 'same-origin' });
            if (!resp.ok) continue;
            const blob = await resp.blob();
            if (cand.attachment.name.toLowerCase().endsWith('.docx')) {
              const file = new File([blob], cand.attachment.name, {
                type:
                  cand.attachment.mimeType ||
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              });
              const parsed = await parseDocxFile(file);
              extracted = parsed.paragraphs.map((p) => p.text).join('\n\n');
            } else {
              extracted = await blob.text();
            }
            orderTextCacheRef.current.set(cacheKey, extracted);
          } catch {
            continue;
          }
        }
        if (extracted && extracted.trim().length > 80) {
          syntheticSessions.push({
            ...activeSession,
            id: `order_${cand.order.id}`,
            title: `#${cand.order.orderCode} · ${cand.order.topic || cand.attachment.name}`,
            topic: cand.order.topic,
            fullPaperOverride: extracted,
            outline: [],
          });
        }
      }

      setScannedOrderCount(syntheticSessions.length);
      if (syntheticSessions.length === 0) {
        setOrderPairs([]);
        setOrderScanError(
          'Không thể đọc nội dung từ các file đính kèm trong Đơn hàng (có thể file trống hoặc chưa tải được).'
        );
        return;
      }

      const simReport = computeCohortSimilarityReport([
        activeSession,
        ...syntheticSessions,
      ]);
      const filtered = simReport.pairs.filter(
        (p) => p.sessionIdA === activeSession.id || p.sessionIdB === activeSession.id
      );
      setOrderPairs(filtered);
    } finally {
      setScanningOrders(false);
      setOrderScanProgress('');
    }
  };

  const report = useMemo(() => {
    void refreshNonce;
    if (!isOpen) return null;
    return computeCohortSimilarityReport(sessions);
  }, [isOpen, sessions, refreshNonce]);

  if (!isOpen || !report || typeof document === 'undefined') return null;

  const activePairs = mode === 'orders' ? orderPairs : report.pairs;
  const riskyPairs = activePairs.filter(
    (p) => p.bodySimilarityPercent >= 3 && p.collisions.length > 0
  );
  const maxSim =
    mode === 'orders'
      ? orderPairs.length > 0
        ? orderPairs[0].bodySimilarityPercent
        : 0
      : report.maxSimilarityPercent;
  const avgSim =
    mode === 'orders'
      ? orderPairs.length > 0
        ? Number(
            (
              orderPairs.reduce((acc, p) => acc + p.bodySimilarityPercent, 0) /
              orderPairs.length
            ).toFixed(1)
          )
        : 0
      : report.avgSimilarityPercent;
  const isBusy = Boolean(scrubbingPairKey) || scanningOrders;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ma trận kiểm tra trùng lặp Similarity"
      onClick={() => {
        if (!isBusy) onClose();
      }}
      className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-xs p-3 sm:p-5 flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-[0_24px_70px_rgba(8,28,68,0.32)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#081C44] text-white flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
              <GitCompareArrows className="w-3.5 h-3.5 text-amber-300" />
              <span>Turnitin Shingle Similarity Matrix</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">
              {mode === 'orders'
                ? `Soi Similarity với Bài Đã Xong Trong Đơn Hàng (${orderCandidates.length} đơn khả dụng)`
                : `Đối chiếu Trùng lặp Chéo Nhóm Cùng Lớp (${report.sessionCount} bài)`}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Đo chính xác chuỗi cụm 5+ từ trùng nhau ở phần Thân bài (đã tự động loại trừ mục References; nguồn trích dẫn giao nhau ngẫu nhiên hoàn toàn hợp lệ).
            </p>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="btn-press p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setMode('cohort')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              mode === 'cohort'
                ? 'bg-[#081C44] text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Nhóm cùng lớp đang mở ({report.sessionCount})
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setMode('orders')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              mode === 'orders'
                ? 'bg-[#081C44] text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileSearch className="w-3.5 h-3.5 text-amber-400" />
            <span>So với bài đã xong trong Đơn hàng ({orderCandidates.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-[#F8FAFC]">
          {/* Executive Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-xl bg-white border border-slate-200/90 p-4 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {mode === 'orders' ? 'Số đơn đã đối chiếu' : 'Số cặp đối chiếu chéo'}
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {mode === 'orders' ? `${scannedOrderCount} đơn` : `${report.pairs.length} cặp`}
              </div>
              <div className="text-[11px] text-slate-500">
                {mode === 'orders'
                  ? `Trong ${orderCandidates.length} đơn hoàn thành có file Word`
                  : `Từ ${report.sessionCount} bài đang có nội dung`}
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/90 p-4 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Similarity cao nhất
              </div>
              <div
                className={`text-2xl font-bold font-mono tabular-nums ${
                  maxSim >= 8
                    ? 'text-rose-600'
                    : maxSim >= 3
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {maxSim.toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-500">
                Ngưỡng an toàn: &lt; 3.0%
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200/90 p-4 space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Trạng thái đối chiếu
              </div>
              <div className="pt-0.5">
                {maxSim < 3 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>An toàn tuyệt đối</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{riskyPairs.length} cặp nên khử câu trùng</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Trung bình: {avgSim.toFixed(1)}% · Lúc {report.computedAt}
              </div>
            </div>
          </div>

          {mode === 'orders' && (
            <div className="rounded-xl bg-white border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900">
                  Quét &amp; đo Similarity bài đang viết với các đơn đã hoàn thành
                </div>
                <div className="text-[11px] text-slate-500">
                  Ưu tiên quét tối đa 20 đơn hoàn thành gần nhất / cùng môn học có file Word (.docx/.txt).
                </div>
                {orderScanProgress && (
                  <div className="text-[11px] font-semibold text-[#12489B]">
                    {orderScanProgress}
                  </div>
                )}
                {orderScanError && (
                  <div className="text-[11px] font-semibold text-rose-600">
                    {orderScanError}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={isBusy || !activeDraftText.trim() || orderCandidates.length === 0}
                onClick={() => void handleScanCompletedOrders()}
                className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold disabled:opacity-45 cursor-pointer"
              >
                {scanningOrders ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSearch className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>
                  {scanningOrders
                    ? 'Đang quét đơn hàng...'
                    : orderPairs.length > 0
                    ? 'Quét lại Đơn hàng'
                    : `Quét ${orderCandidates.length} bài đã xong`}
                </span>
              </button>
            </div>
          )}

          {activePairs.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-xl border border-slate-200 space-y-2">
              <p className="text-sm font-bold text-slate-800">
                {mode === 'orders'
                  ? 'Bấm "Quét bài đã xong" ở trên để đo Similarity với kho Đơn hàng'
                  : 'Cần ít nhất 2 tab bài viết đã có nội dung thân bài để đối chiếu chéo'}
              </p>
              <p className="text-xs text-slate-500">
                {mode === 'orders'
                  ? 'Hệ thống sẽ tải các file .docx đã bàn giao trong mục Đơn hàng và so khớp cụm 5+ từ.'
                  : 'Hãy chạy viết tối thiểu 2 bài rồi mở lại bảng đối chiếu này.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {mode === 'orders'
                    ? 'Kết quả đo Similarity với các bài đã xong trong Đơn hàng'
                    : 'Chi tiết từng cặp bài trong nhóm'}
                </span>
                <div className="flex items-center gap-2">
                  {mode === 'cohort' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setRefreshNonce((n) => n + 1)}
                      className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Quét lại</span>
                    </button>
                  )}

                  {mode === 'cohort' && riskyPairs.length > 0 && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onScrubAllRiskyPairs(riskyPairs)}
                      className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold disabled:opacity-40"
                    >
                      {scrubbingPairKey === '__ALL__' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      <span>Tự động khử toàn bộ {riskyPairs.length} cặp &ge; 3%</span>
                    </button>
                  )}
                </div>
              </div>

              {activePairs.map((pair) => {
                const pairKey = `${pair.sessionIdA}__${pair.sessionIdB}`;
                const isExpanded = expandedPairKey === pairKey;
                const isScrubbingThis =
                  scrubbingPairKey === pairKey || scrubbingPairKey === '__ALL__';

                const badgeCls =
                  pair.status === 'danger'
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : pair.status === 'caution'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700';

                return (
                  <div
                    key={pairKey}
                    className="rounded-xl bg-white border border-slate-200/90 overflow-hidden"
                  >
                    <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-900">
                          <span className="truncate max-w-[260px]">
                            {pair.titleA}
                          </span>
                          <span className="text-slate-400 font-mono">↔</span>
                          <span className="truncate max-w-[260px]">
                            {pair.titleB}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono">
                          <span>
                            Nguồn trích dẫn dùng chung tự nhiên:{' '}
                            <strong className="text-slate-700">
                              {pair.sharedCitationCount} nguồn
                            </strong>{' '}
                            ({pair.totalCitationsA} vs {pair.totalCitationsB})
                          </span>
                          <span>·</span>
                          <span>
                            Cụm câu trùng phát hiện:{' '}
                            <strong className="text-slate-700">
                              {pair.collisions.length} câu
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-lg border font-mono text-xs font-bold tabular-nums ${badgeCls}`}
                        >
                          Similarity thân bài: {pair.bodySimilarityPercent.toFixed(1)}%
                        </span>

                        {pair.collisions.length > 0 && (
                          <>
                            {mode === 'cohort' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void onScrubPairCollisions(pair)}
                                className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold disabled:opacity-40"
                              >
                                {isScrubbingThis ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                )}
                                <span>Khử câu trùng</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPairKey(isExpanded ? null : pairKey)
                              }
                              className="btn-press p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              title="Xem chi tiết các câu trùng"
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && pair.collisions.length > 0 && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/70 space-y-2.5">
                        {pair.collisions.map((col, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg bg-white border border-slate-200/90 p-3 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 font-mono text-[11px] font-semibold text-rose-700">
                                Trùng {col.sharedWordCount} từ liên tiếp: "{col.sharedPhrase}"
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  onJumpToSessionSection(
                                    pair.sessionIdA,
                                    col.sectionIdA
                                  );
                                  onClose();
                                }}
                                className="text-[11px] font-semibold text-[#12489B] hover:underline"
                              >
                                Mở đoạn này →
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11.5px] text-slate-600">
                              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                                <div className="font-bold text-slate-800 mb-0.5">
                                  {pair.titleA} ({col.sectionTitleA})
                                </div>
                                <p className="leading-relaxed">{col.sentenceA}</p>
                              </div>
                              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                                <div className="font-bold text-slate-800 mb-0.5">
                                  {pair.titleB} ({col.sectionTitleB})
                                </div>
                                <p className="leading-relaxed">{col.sentenceB}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Mỗi file Word xuất ra tự động mang tên Tác giả (Author) &amp; lịch sử ngày tạo riêng theo từng tab.
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {report.sessionCount >= 2 && (
              <button
                type="button"
                disabled={exportingAll || isBusy}
                onClick={onExportAllDocx}
                className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {exportingAll
                    ? 'Đang đóng gói...'
                    : `Tải trọn bộ ${report.sessionCount} file .DOCX`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
