import { useState } from 'react';
import {
  Archive,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Inbox,
  Paperclip,
  PlusCircle,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { OrderInquiry } from '../../types/domain';
import {
  copyTextToClipboard,
  formatBytes,
  formatDateTime,
} from '../../lib/utils';

interface OrderInquiriesInboxProps {
  inquiries: OrderInquiry[];
  onCreateOrderFromInquiry: (inquiry: OrderInquiry) => void;
  onUpdateStatus: (
    inquiryId: string,
    status: OrderInquiry['status'],
    convertedOrderCode?: string
  ) => Promise<void>;
  onDelete: (inquiryId: string) => Promise<void>;
  onToast: (msg: string) => void;
}

function buildZaloHref(contact: string): string | null {
  const digits = contact.replace(/\D/g, '');
  if (digits.length >= 9 && digits.length <= 12) {
    return `https://zalo.me/${digits}`;
  }
  if (/^https?:\/\//i.test(contact.trim())) {
    return contact.trim();
  }
  return null;
}

export function OrderInquiriesInbox({
  inquiries,
  onCreateOrderFromInquiry,
  onUpdateStatus,
  onDelete,
  onToast,
}: OrderInquiriesInboxProps) {
  const [expanded, setExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<'new' | 'all'>('new');
  const [copiedId, setCopiedId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState<OrderInquiry | null>(
    null
  );

  const newCount = inquiries.filter((i) => i.status === 'new').length;
  const visibleItems =
    viewMode === 'new'
      ? inquiries.filter((i) => i.status === 'new')
      : inquiries;

  const handleCopyContact = async (inquiry: OrderInquiry) => {
    const ok = await copyTextToClipboard(inquiry.contactInfo);
    if (ok) {
      setCopiedId(inquiry.id);
      onToast(`Đã sao chép liên hệ: ${inquiry.contactInfo}`);
      window.setTimeout(() => setCopiedId(''), 1600);
    }
  };

  return (
    <>
      <section className="bg-white border border-blue-200/90 rounded-2xl overflow-hidden shadow-[0_6px_22px_rgba(18,72,155,0.05)]">
        {/* Header Bar */}
        <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#F4F7FB] to-white border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#0B2559] text-white flex items-center justify-center shrink-0">
              <Inbox className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Đơn đăng ký mới từ Khách hàng
                </h2>
                {newCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10.5px] font-bold font-mono animate-pulse">
                    {newCount} mới
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[10.5px] font-semibold">
                    0 mới
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                Bấm vào phiếu bất kỳ để xem chi tiết, lưu file đề bài xuống máy hoặc tạo đơn hàng trực tiếp.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex bg-zinc-100 p-0.5 rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('new')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === 'new'
                    ? 'bg-white text-[#0B2559] shadow-2xs'
                    : 'text-zinc-500 hover:text-slate-900'
                }`}
              >
                Chờ duyệt ({newCount})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  viewMode === 'all'
                    ? 'bg-white text-[#0B2559] shadow-2xs'
                    : 'text-zinc-500 hover:text-slate-900'
                }`}
              >
                Tất cả ({inquiries.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="btn-press p-1.5 rounded-lg text-zinc-500 hover:text-slate-900 hover:bg-zinc-100"
              title={expanded ? 'Thu gọn' : 'Mở rộng'}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        {expanded && (
          <div className="p-4 sm:p-5">
            {visibleItems.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500">
                {viewMode === 'new'
                  ? 'Không có phiếu đăng ký mới nào đang chờ duyệt.'
                  : 'Chưa có phiếu đăng ký nào từ khách hàng.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {visibleItems.map((inq) => {
                  const contactHref = buildZaloHref(inq.contactInfo);
                  const isBusy = busyId === inq.id;
                  const attachedFiles = inq.attachments || [];
                  return (
                    <article
                      key={inq.id}
                      onClick={() => setSelectedInquiry(inq)}
                      className={`cursor-pointer rounded-2xl border p-4 space-y-3 transition-all hover:shadow-md ${
                        inq.status === 'new'
                          ? 'bg-blue-50/30 border-blue-200/90 hover:border-[#12489B]'
                          : 'bg-zinc-50/50 border-zinc-200/80 hover:border-zinc-300'
                      }`}
                    >
                      {/* Top row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-[#0B2559] text-white text-[10.5px] font-mono font-bold">
                            #{inq.inquiryCode}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-slate-700 text-[10.5px] font-semibold">
                            {inq.serviceType}
                          </span>
                          {attachedFiles.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-bold">
                              <Paperclip className="w-3 h-3" />
                              {attachedFiles.length} đề bài
                            </span>
                          )}
                          {inq.status === 'converted' && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10.5px] font-bold">
                              Đã tạo đơn{' '}
                              {inq.convertedOrderCode
                                ? `#${inq.convertedOrderCode}`
                                : ''}
                            </span>
                          )}
                          {inq.status === 'archived' && (
                            <span className="px-2 py-0.5 rounded-md bg-zinc-200/70 text-zinc-600 text-[10.5px] font-semibold">
                              Đã ẩn
                            </span>
                          )}
                        </div>

                        <span className="text-[10.5px] text-zinc-400 font-mono inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(inq.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>

                      {/* Customer + Contact */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white rounded-xl border border-zinc-200/80 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900">
                            {inq.customerName}
                          </span>
                          <span className="text-zinc-400 mx-1.5">·</span>
                          <span className="font-mono font-semibold text-[#12489B]">
                            {inq.contactInfo}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleCopyContact(inq)}
                            className="p-1 rounded-md text-zinc-500 hover:text-slate-900 hover:bg-zinc-100"
                            title="Sao chép liên hệ"
                          >
                            {copiedId === inq.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {contactHref && (
                            <a
                              href={contactHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-[#12489B] text-[#12489B] hover:text-white text-[10.5px] font-bold inline-flex items-center gap-1 transition-colors"
                            >
                              <span>Nhắn ngay</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Assignment details */}
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-slate-900 leading-snug">
                          {inq.subject} — {inq.topic}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600 font-mono">
                          <span>
                            Độ dài:{' '}
                            <strong className="text-slate-800">
                              {inq.wordCount > 0
                                ? `${inq.wordCount.toLocaleString('vi-VN')} từ`
                                : 'Chưa rõ'}
                            </strong>
                          </span>
                          <span>· {inq.citationStyle}</span>
                          <span>
                            · Hạn:{' '}
                            <strong className="text-rose-600">
                              {formatDateTime(inq.deadlineAt)}
                            </strong>
                          </span>
                        </div>

                        {/* Quick Download Brief Strip */}
                        {attachedFiles.length > 0 && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="pt-1.5 flex flex-wrap gap-1.5"
                          >
                            {attachedFiles.map((att) => (
                              <a
                                key={att.id}
                                href={`${att.fileIdOrUrl}?download=1`}
                                download={att.name}
                                className="btn-press inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200/90 text-[11px] font-bold transition-colors"
                                title={`Lưu đề bài xuống: ${att.name}`}
                              >
                                <Download className="w-3 h-3 shrink-0" />
                                <span className="max-w-[160px] truncate">
                                  {att.name}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="pt-2 border-t border-zinc-200/70 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onCreateOrderFromInquiry(inq)}
                            className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12489B] hover:bg-[#0B2559] text-white text-xs font-bold shadow-xs"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>
                              {inq.status === 'converted'
                                ? 'Tạo thêm đơn'
                                : 'Tạo đơn ngay'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedInquiry(inq)}
                            className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 hover:border-[#12489B] text-slate-700 text-xs font-semibold"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#12489B]" />
                            <span>Chi tiết</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {inq.status === 'new' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setBusyId(inq.id);
                                try {
                                  await onUpdateStatus(inq.id, 'archived');
                                  onToast(`Đã ẩn phiếu #${inq.inquiryCode}`);
                                } finally {
                                  setBusyId('');
                                }
                              }}
                              className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-[11px] font-semibold text-zinc-600"
                            >
                              <Archive className="w-3 h-3" />
                              <span>Ẩn</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setBusyId(inq.id);
                                try {
                                  await onUpdateStatus(inq.id, 'new', '');
                                  onToast(`Đã mở lại phiếu #${inq.inquiryCode}`);
                                } finally {
                                  setBusyId('');
                                }
                              }}
                              className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-[11px] font-semibold text-zinc-600"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Mở lại</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  `Xóa vĩnh viễn phiếu đăng ký #${inq.inquiryCode}?`
                                )
                              ) {
                                return;
                              }
                              setBusyId(inq.id);
                              try {
                                await onDelete(inq.id);
                                if (selectedInquiry?.id === inq.id) {
                                  setSelectedInquiry(null);
                                }
                                onToast(`Đã xóa phiếu #${inq.inquiryCode}`);
                              } finally {
                                setBusyId('');
                              }
                            }}
                            className="btn-press p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Xóa phiếu đăng ký"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* INQUIRY DETAIL MODAL WITH BRIEF DOWNLOAD */}
      {selectedInquiry && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setSelectedInquiry(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0B2559] text-white flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-white/15 text-sky-200 text-[11px] font-mono font-bold">
                    #{selectedInquiry.inquiryCode}
                  </span>
                  <span className="text-xs text-sky-200/90 truncate">
                    {selectedInquiry.serviceType}
                  </span>
                </div>
                <h3 className="text-base font-bold truncate">
                  {selectedInquiry.subject} — {selectedInquiry.topic}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#F4F7FB] border border-zinc-200/80 p-3.5">
                  <div className="text-[11px] text-zinc-500 font-semibold uppercase">
                    Khách hàng &amp; Liên hệ
                  </div>
                  <div className="font-bold text-slate-900 mt-1">
                    {selectedInquiry.customerName}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono font-semibold text-[#12489B]">
                      {selectedInquiry.contactInfo}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyContact(selectedInquiry)}
                      className="p-1 rounded hover:bg-white text-zinc-500"
                      title="Sao chép liên hệ"
                    >
                      {copiedId === selectedInquiry.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F4F7FB] border border-zinc-200/80 p-3.5">
                  <div className="text-[11px] text-zinc-500 font-semibold uppercase">
                    Yêu cầu học thuật
                  </div>
                  <div className="font-bold text-slate-900 mt-1">
                    {selectedInquiry.wordCount > 0
                      ? `${selectedInquiry.wordCount.toLocaleString('vi-VN')} từ`
                      : 'Chưa rõ số từ'}{' '}
                    · Chuẩn {selectedInquiry.citationStyle}
                  </div>
                  <div className="text-rose-600 font-mono font-semibold text-xs mt-1">
                    Deadline: {formatDateTime(selectedInquiry.deadlineAt)}
                  </div>
                </div>
              </div>

              {selectedInquiry.notes && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-800">
                    Ghi chú / Link đề bài khách gửi
                  </div>
                  <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedInquiry.notes}
                  </div>
                </div>
              )}

              {/* Attached Brief Files from R2 with Download Button */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-[#12489B]" />
                    <span>
                      Tệp đề bài đính kèm (
                      {(selectedInquiry.attachments || []).length})
                    </span>
                  </span>
                </div>

                {!selectedInquiry.attachments ||
                selectedInquiry.attachments.length === 0 ? (
                  <p className="text-xs text-zinc-500 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-3.5">
                    Khách hàng không tải lên tệp đề bài trực tiếp (kiểm tra phần ghi chú hoặc nhắn Zalo khách hàng).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedInquiry.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-blue-50/40 border border-blue-200/80"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-9 h-9 rounded-lg bg-white border border-blue-200 text-[#12489B] flex items-center justify-center shrink-0">
                            <Paperclip className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {att.name}
                            </div>
                            <div className="text-[11px] font-mono text-zinc-500">
                              {formatBytes(att.sizeBytes)} · Lưu trữ trên R2
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`${att.fileIdOrUrl}?download=1`}
                            download={att.name}
                            className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Lưu đề bài xuống</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="btn-press px-4 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-slate-700"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = selectedInquiry;
                  setSelectedInquiry(null);
                  onCreateOrderFromInquiry(target);
                }}
                className="btn-press inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#12489B] hover:bg-[#0B2559] text-white text-xs font-bold shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tạo đơn hàng từ phiếu này</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
