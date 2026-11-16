import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import {
  createRevisionRequest,
  fetchTrackingPortalOnce,
  subscribeOrderRevisions,
  subscribeTrackingPortal,
} from '../services/firestoreService';
import {
  formatBytes,
  formatDateTime,
  getStageMeta,
  isValidOrderCode,
  normalizeOrderCode,
} from '../lib/utils';
import {
  AttachmentItem,
  FIELD_LIMITS,
  ORDER_STAGES,
  RevisionRequest,
  TrackingPortalRecord,
} from '../types/domain';
import { DeadlineBadge } from './DeadlineBadge';
import { OrderChatPanel } from './OrderChatPanel';
import { PaymentQrCard } from './PaymentQrCard';
import { PdfPreviewModal } from './PdfPreviewModal';

interface ClientPortalViewProps {
  initialOrderCode?: string;
  nowMs: number;
  onSwitchToAdmin: () => void;
  onToast: (msg: string) => void;
}

const CATEGORY_LABELS: Record<AttachmentItem['category'], string> = {
  brief: 'Đề bài & Tài liệu',
  turnitin: 'Báo cáo Turnitin / AI',
  draft: 'Bản nháp',
  final: 'Bài hoàn chỉnh',
};

export function ClientPortalView({
  initialOrderCode = '',
  nowMs,
  onSwitchToAdmin,
  onToast,
}: ClientPortalViewProps) {
  const [codeInput, setCodeInput] = useState(initialOrderCode);
  const [activeCode, setActiveCode] = useState(
    initialOrderCode ? normalizeOrderCode(initialOrderCode) : ''
  );
  const [portal, setPortal] = useState<TrackingPortalRecord | null>(null);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

  // Revision modal state
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionMsg, setRevisionMsg] = useState('');
  const [submittingRev, setSubmittingRev] = useState(false);

  useEffect(() => {
    if (!activeCode) {
      setPortal(null);
      setRevisions([]);
      return;
    }

    setLoading(true);
    setLookupError('');

    const unsubPortal = subscribeTrackingPortal(activeCode, (data) => {
      setPortal(data);
      setLoading(false);
      if (!data) {
        setLookupError(`Không tìm thấy đơn hàng với mã "${activeCode}". Vui lòng kiểm tra lại.`);
      }
    });

    const unsubRevs = subscribeOrderRevisions(activeCode, (list) => {
      setRevisions(list);
    });

    return () => {
      unsubPortal();
      unsubRevs();
    };
  }, [activeCode]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeOrderCode(codeInput);
    if (!isValidOrderCode(normalized)) {
      setLookupError('Mã đơn hàng không hợp lệ (ví dụ: ASG-2026-001).');
      return;
    }
    setLoading(true);
    setLookupError('');
    try {
      const found = await fetchTrackingPortalOnce(normalized);
      if (!found) {
        setLookupError(`Không tìm thấy đơn hàng với mã "${normalized}".`);
        setLoading(false);
        return;
      }
      setActiveCode(normalized);
      const url = new URL(window.location.href);
      url.searchParams.set('code', normalized);
      window.history.replaceState({}, '', url.toString());
    } catch {
      setLookupError('Không thể tra cứu mã đơn lúc này.');
      setLoading(false);
    }
  };

  const handleResetLookup = () => {
    setActiveCode('');
    setPortal(null);
    setLookupError('');
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.toString());
  };

  const handleSubmitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal || !revisionMsg.trim() || submittingRev) return;
    setSubmittingRev(true);
    try {
      await createRevisionRequest(portal.orderCode, revisionMsg.trim());
      setRevisionMsg('');
      setShowRevisionForm(false);
      onToast('Đã gửi yêu cầu chỉnh sửa tới Admin.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gửi yêu cầu thất bại.');
    } finally {
      setSubmittingRev(false);
    }
  };

  const isFullyPaid = portal?.paymentStatus === 'fully_paid';
  const currentStageMeta = portal ? getStageMeta(portal.stage) : null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A]">
      {/* Top Bar Contract: 3 clean zones */}
      <header className="bg-white border-b border-zinc-200 px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleResetLookup();
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            AssignTrack
          </a>

          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-zinc-600">
            <button
              type="button"
              onClick={handleResetLookup}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Tra cứu đơn hàng
            </button>
          </nav>

          <button
            type="button"
            onClick={onSwitchToAdmin}
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Admin Portal
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {!activeCode || !portal ? (
          <div className="max-w-md mx-auto mt-10 bg-white border border-zinc-200 rounded-xl p-7 space-y-5">
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-slate-900">
                Theo dõi tiến độ bài làm
              </h1>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Nhập mã đơn hàng được cung cấp (không cần đăng ký tài khoản) để xem tiến độ thời gian thực, tải tài liệu và thanh toán.
              </p>
            </div>

            <form onSubmit={handleLookup} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Mã đơn hàng
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="Ví dụ: ASG-2026-001"
                    className="w-full pl-9 pr-3 py-2.5 text-sm font-mono uppercase bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                  />
                </div>
              </div>

              {lookupError && (
                <p className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {lookupError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !codeInput.trim()}
                className="w-full py-2.5 px-4 text-sm font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] disabled:opacity-50 transition-colors"
              >
                {loading ? 'Đang kiểm tra...' : 'Xem tiến độ đơn hàng'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Back + Header Summary */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleResetLookup}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Tra cứu mã khác
              </button>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                Cập nhật: {new Date(portal.updatedAt).toLocaleString('vi-VN')}
              </span>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-[#4338CA]">
                      #{portal.orderCode}
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">
                      ·
                    </span>
                    <span className="text-xs text-zinc-600">{portal.subject}</span>
                    <span aria-hidden="true" className="text-zinc-300">
                      ·
                    </span>
                    <span className="text-xs text-zinc-600 font-mono tabular-nums">
                      {portal.wordCount.toLocaleString('vi-VN')} từ
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">
                      ·
                    </span>
                    <span className="text-xs text-zinc-600">
                      Trích dẫn {portal.citationStyle}
                    </span>
                  </div>
                  <h1 className="text-xl font-bold text-slate-900">
                    {portal.topic}
                  </h1>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <DeadlineBadge
                    deadlineAt={portal.deadlineAt}
                    nowMs={nowMs}
                    orderStatus={portal.orderStatus}
                  />
                  <span className="text-xs text-zinc-500 font-mono tabular-nums">
                    Hạn nộp: {formatDateTime(portal.deadlineAt)}
                  </span>
                </div>
              </div>

              {/* Progress Bar & 6-stage Pipeline */}
              <div className="space-y-3 pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-900">
                    {currentStageMeta?.step}. {currentStageMeta?.label}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#4338CA] tabular-nums">
                    {portal.progressPercent}%
                  </span>
                </div>

                <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#4338CA] transition-all duration-300"
                    style={{ width: `${portal.progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                  {ORDER_STAGES.map((st) => {
                    const currentStep = currentStageMeta?.step || 1;
                    const done = st.step <= currentStep;
                    const isCurrent = st.step === currentStep;
                    return (
                      <div
                        key={st.key}
                        className={`p-2 rounded-lg border text-xs transition-colors ${
                          isCurrent
                            ? 'bg-indigo-50/70 border-[#4338CA]/40 text-[#4338CA] font-semibold'
                            : done
                            ? 'bg-zinc-50 border-zinc-200 text-slate-800'
                            : 'bg-white border-zinc-100 text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          {done && !isCurrent && (
                            <CheckCircle2 className="w-3 h-3 text-[#16A34A] shrink-0" />
                          )}
                          <span className="truncate">
                            {st.step}. {st.shortLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {portal.publicStatusNote && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-sm text-slate-800">
                    <span className="text-xs font-semibold text-zinc-500 block mb-1">
                      Ghi chú tiến độ mới nhất từ người viết:
                    </span>
                    {portal.publicStatusNote}
                  </div>
                )}
              </div>
            </div>

            {/* 2-Column Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Brief Verification, Files, Revisions */}
              <div className="lg:col-span-7 space-y-6">
                {/* Brief & Outline Verification */}
                {(portal.outlineAndInstructions || portal.rubricNotes) && (
                  <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Thông tin đề bài & Dàn ý đã chốt
                    </h2>
                    {portal.outlineAndInstructions && (
                      <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50 border border-zinc-200 rounded-lg p-3.5">
                        {portal.outlineAndInstructions}
                      </div>
                    )}
                    {portal.rubricNotes && (
                      <div className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed">
                        <span className="font-semibold text-zinc-800">Rubric / Yêu cầu đặc biệt: </span>
                        {portal.rubricNotes}
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments & Page-Windowed Previews */}
                <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Tài liệu & Bài làm ({portal.attachments.length})
                    </h2>
                    <span className="text-xs text-zinc-500">
                      Nhấn Xem trước để kiểm tra nội dung
                    </span>
                  </div>

                  {portal.attachments.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">
                      Chưa có tài liệu nào được đính kèm.
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg overflow-hidden">
                      {portal.attachments.map((att) => {
                        const locked = att.isPaymentLocked && !isFullyPaid;
                        return (
                          <div
                            key={att.id}
                            className="p-3.5 bg-white flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <FileText className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {att.name}
                                </p>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                  {CATEGORY_LABELS[att.category]}
                                  {att.sizeBytes > 0 && ` · ${formatBytes(att.sizeBytes)}`}
                                  {att.category === 'turnitin' &&
                                    ` · Xem đến trang ${(att.turnitinScorePage || 1) + 2}`}
                                  {locked &&
                                    ` · Khóa tải (xem trước ${att.previewMaxPages || 2} trang)`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(att)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-slate-900 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Xem trước
                              </button>

                              {locked ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#D97706] bg-amber-50 border border-amber-200 rounded-lg whitespace-nowrap">
                                  <Lock className="w-3 h-3" />
                                  Chờ thanh toán
                                </span>
                              ) : (
                                att.fileIdOrUrl && (
                                  <a
                                    href={
                                      att.sourceType === 'upload'
                                        ? `${att.fileIdOrUrl}?download=1`
                                        : att.fileIdOrUrl
                                    }
                                    target={att.sourceType === 'url' ? '_blank' : undefined}
                                    rel="noopener noreferrer"
                                    download={att.sourceType === 'upload' ? att.name : undefined}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] transition-colors whitespace-nowrap"
                                  >
                                    Tải xuống
                                  </a>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Revision Request Section */}
                <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Yêu cầu chỉnh sửa (Revision)
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Gửi phản hồi từ giảng viên trực tiếp tại đây để tránh trôi tin nhắn.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRevisionForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Yêu cầu sửa
                    </button>
                  </div>

                  {showRevisionForm && (
                    <form
                      onSubmit={handleSubmitRevision}
                      className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3"
                    >
                      <textarea
                        rows={3}
                        value={revisionMsg}
                        onChange={(e) => setRevisionMsg(e.target.value)}
                        maxLength={FIELD_LIMITS.revisionMessageMax}
                        placeholder="Mô tả chi tiết phần cần chỉnh sửa theo góp ý của giảng viên..."
                        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRevisionForm(false)}
                          className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={revisionMsg.trim().length < 3 || submittingRev}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Gửi yêu cầu
                        </button>
                      </div>
                    </form>
                  )}

                  {revisions.length > 0 && (
                    <div className="space-y-2.5">
                      {revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="border border-zinc-200 rounded-lg p-3.5 space-y-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono text-zinc-500 tabular-nums">
                              {new Date(rev.createdAt).toLocaleString('vi-VN')}
                            </span>
                            <span
                              className={`px-2 py-0.5 font-medium rounded border ${
                                rev.status === 'resolved'
                                  ? 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                                  : rev.status === 'in_progress'
                                  ? 'bg-amber-50 text-[#D97706] border-amber-200'
                                  : 'bg-indigo-50 text-[#4338CA] border-indigo-200'
                              }`}
                            >
                              {rev.status === 'resolved'
                                ? 'Đã sửa xong'
                                : rev.status === 'in_progress'
                                ? 'Đang xử lý'
                                : 'Chờ xử lý'}
                            </span>
                          </div>
                          <p className="text-slate-800 whitespace-pre-wrap">{rev.message}</p>
                          {rev.adminReply && (
                            <p className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded p-2.5">
                              <span className="font-semibold text-slate-900">Phản hồi: </span>
                              {rev.adminReply}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Payment QR & 48h Live Chat */}
              <div className="lg:col-span-5 space-y-6">
                <PaymentQrCard
                  orderCode={portal.orderCode}
                  totalAmount={portal.totalAmount}
                  depositAmount={portal.depositAmount}
                  paidAmount={portal.paidAmount}
                  paymentStatus={portal.paymentStatus}
                  bankSnapshot={portal.bankSnapshot}
                  onToast={onToast}
                />

                <OrderChatPanel
                  orderCode={portal.orderCode}
                  senderRole="client"
                  senderName="Khách hàng"
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <PdfPreviewModal
        attachment={previewAttachment}
        isFullyPaid={isFullyPaid}
        isAdmin={false}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
}
