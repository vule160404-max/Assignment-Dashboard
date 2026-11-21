import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  FileText,
  Lock,
  Send,
  Unlock,
  X,
} from 'lucide-react';
import { formatVnd } from '../../../lib/utils';
import { OrderRecord } from '../../../types/domain';
import { WriterSession } from './types';

interface WriterDeliverModalProps {
  isOpen: boolean;
  orders: OrderRecord[];
  session: WriterSession;
  totalDraftedWords: number;
  onDeliver: (
    order: OrderRecord,
    opts: { isDraftOnly: boolean; isLocked: boolean; note: string }
  ) => Promise<void>;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function WriterDeliverModal({
  isOpen,
  orders,
  session,
  totalDraftedWords,
  onDeliver,
  onClose,
  onToast,
}: WriterDeliverModalProps) {
  const [selectedOrderCode, setSelectedOrderCode] = useState<string>(
    session.linkedOrderCode || orders[0]?.orderCode || ''
  );
  const [deliveryMode, setDeliveryMode] = useState<'final' | 'draft'>('final');
  const [delivering, setDelivering] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const selectedOrder = useMemo(() => {
    return (
      orders.find((o) => o.orderCode === selectedOrderCode) ||
      orders.find((o) => o.orderCode === session.linkedOrderCode) ||
      orders[0] ||
      null
    );
  }, [orders, selectedOrderCode, session.linkedOrderCode]);

  const isFullyPaid = selectedOrder?.paymentStatus === 'fully_paid';
  const [isLocked, setIsLocked] = useState<boolean>(!isFullyPaid);
  const [note, setNote] = useState<string>(
    'Đã hoàn thành và bàn giao bài hoàn chỉnh cho quý khách.'
  );

  // Sync default lock and note when order or delivery mode changes
  const handleSelectOrder = (code: string) => {
    setSelectedOrderCode(code);
    const ord = orders.find((o) => o.orderCode === code);
    if (ord) {
      const fully = ord.paymentStatus === 'fully_paid';
      setIsLocked(!fully);
      setNote(
        deliveryMode === 'final'
          ? fully
            ? 'Đã hoàn thành và bàn giao bài hoàn chỉnh cho quý khách.'
            : 'Đã bàn giao bản hoàn chỉnh. Quý khách vui lòng kiểm tra và hoàn tất thanh toán để tải file đầy đủ.'
          : 'Đã có bản thảo (Draft). Quý khách vui lòng xem trước và góp ý nếu cần.'
      );
    }
  };

  const handleChangeMode = (mode: 'final' | 'draft') => {
    setDeliveryMode(mode);
    if (mode === 'draft') {
      setIsLocked(false);
      setNote('Đã có bản thảo (Draft). Quý khách vui lòng xem trước và góp ý nếu cần.');
    } else {
      setIsLocked(!isFullyPaid);
      setNote(
        isFullyPaid
          ? 'Đã hoàn thành và bàn giao bài hoàn chỉnh cho quý khách.'
          : 'Đã bàn giao bản hoàn chỉnh. Quý khách vui lòng kiểm tra và hoàn tất thanh toán để tải file đầy đủ.'
      );
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedOrder) {
      setErrorMsg('Vui lòng chọn đơn hàng cần đẩy bài.');
      onToast('Vui lòng chọn đơn hàng cần đẩy bài.');
      return;
    }
    if (totalDraftedWords === 0) {
      setErrorMsg('Chưa có nội dung bài viết để đẩy lên cho khách.');
      onToast('Chưa có nội dung bài viết để đẩy lên cho khách.');
      return;
    }

    setDelivering(true);
    try {
      await onDeliver(selectedOrder, {
        isDraftOnly: deliveryMode === 'draft',
        isLocked,
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đẩy bài cho khách thất bại.';
      setErrorMsg(msg);
      onToast(msg);
    } finally {
      setDelivering(false);
    }
  };

  const debtAmount = selectedOrder
    ? Math.max(0, selectedOrder.totalAmount - selectedOrder.paidAmount)
    : 0;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5"
    >
      <div
        className="modal-panel bg-white border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Đẩy bài trực tiếp lên Portal khách hàng
              </h3>
              <p className="text-xs text-zinc-500">
                Giao file Word .DOCX hoàn thiện trực tiếp cho khách mà không cần qua tab Humanize.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="btn-press p-1.5 rounded-lg text-zinc-400 hover:text-slate-900 hover:bg-zinc-200/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Order Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Chọn đơn hàng nhận bài bàn giao *
            </label>
            <select
              value={selectedOrderCode}
              onChange={(e) => handleSelectOrder(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B]"
            >
              <option value="">-- Chọn đơn hàng --</option>
              {orders.map((o) => (
                <option key={o.id} value={o.orderCode}>
                  #{o.orderCode} · {o.clientDisplayName} · {o.subject} ({o.wordCount}w)
                </option>
              ))}
            </select>
          </div>

          {/* Selected Order Overview Card */}
          {selectedOrder && (
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">
                  Đơn #{selectedOrder.orderCode} · {selectedOrder.clientDisplayName}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    isFullyPaid
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {isFullyPaid ? 'Đã tất toán 100%' : `Còn nợ: ${formatVnd(debtAmount)}`}
                </span>
              </div>
              <div className="text-zinc-600 line-clamp-1">
                <span className="font-medium text-slate-800">Môn học:</span> {selectedOrder.subject}
                {selectedOrder.topic ? ` · Đề tài: ${selectedOrder.topic}` : ''}
              </div>
              <div className="text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-200/80">
                <span>Số từ yêu cầu: {selectedOrder.wordCount} từ</span>
                <span>Tiến độ hiện tại: {selectedOrder.progressPercent}%</span>
              </div>
            </div>
          )}

          {/* Delivery Mode Choice */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              Chế độ bàn giao
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChangeMode('final')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  deliveryMode === 'final'
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500'
                    : 'border-zinc-200 bg-white hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">
                    Bản hoàn chỉnh (Final)
                  </span>
                  {deliveryMode === 'final' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Tiến độ 100%, chuyển đơn sang Hoàn thành / Chờ tất toán.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleChangeMode('draft')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  deliveryMode === 'draft'
                    ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                    : 'border-zinc-200 bg-white hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">
                    Bản thảo (Draft)
                  </span>
                  {deliveryMode === 'draft' && (
                    <CheckCircle2 className="w-4 h-4 text-[#12489B]" />
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Chuyển đơn sang Đã có bản thảo (Draft) để khách đọc thử.
                </p>
              </button>
            </div>
          </div>

          {/* Payment Lock Setting */}
          <div className="p-3.5 rounded-xl border border-zinc-200 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isLocked}
                  onChange={(e) => setIsLocked(e.target.checked)}
                  className="w-4 h-4 accent-amber-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  {isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>Khóa tải xuống (Xem rõ 3 trang đầu, các trang sau làm mờ)</span>
                </span>
              </label>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                  isLocked
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {isLocked ? 'Đang khóa tải' : 'Cho phép tải ngay'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed pl-6">
              {isLocked
                ? 'Khách hàng có thể đọc rõ 3 trang đầu (Bìa + Mục lục + Trang nội dung đầu) và xem hiệu ứng làm mờ các trang sau. Hệ thống sẽ tự động mở khóa toàn bộ khi khách thanh toán 100%.'
                : 'Khách hàng có thể bấm tải trực tiếp toàn bộ file Word .DOCX về máy ngay trên Portal.'}
            </p>
          </div>

          {/* Status Note Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Ghi chú trạng thái hiển thị cho khách trên Portal
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập lời nhắn hoặc ghi chú cho khách hàng..."
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B]"
            />
          </div>

          {/* File Output Info & R2 Versioning Policy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs text-[#0B2559]">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#12489B] shrink-0" />
                <div>
                  <div className="font-semibold">
                    Tệp Word .DOCX chuẩn bị đẩy lên R2{selectedOrder ? ` (orders/${selectedOrder.orderCode}/latest/)` : ''}:
                  </div>
                  <div className="text-[11px] text-zinc-600">
                    {totalDraftedWords.toLocaleString()} từ ·{' '}
                    {session.format.coverPage?.enabled ? 'Có trang bìa' : 'Không trang bìa'} ·{' '}
                    {session.format.includeTableOfContents ? 'Có mục lục' : 'Không mục lục'}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white text-slate-800 border border-blue-100 shrink-0">
                .DOCX
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed px-1">
              Portal khách hàng sẽ hiển thị ngay bản mới nhất này. Bản vừa bị thay thế (nếu có) sẽ được tự động lưu làm <strong>1 bản Backup</strong> trên R2, các bản cũ hơn sẽ tự động xóa.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="break-words font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={delivering}
              onClick={onClose}
              className="btn-press px-4 py-2 text-xs font-medium text-zinc-600 hover:text-slate-900"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={delivering || !selectedOrder || totalDraftedWords === 0}
              className="btn-press px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {delivering ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Đang xuất & Đẩy bài...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Xác nhận & Đẩy bài lên Portal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
