import { useState } from 'react';
import {
  Archive,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Inbox,
  PlusCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { OrderInquiry } from '../../types/domain';
import { copyTextToClipboard, formatDateTime } from '../../lib/utils';

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
              Phiếu đặt bài khách gửi không cần đăng nhập (đã tự động báo Telegram) — duyệt &amp; tạo đơn trực tiếp tại đây.
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
                return (
                  <article
                    key={inq.id}
                    className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                      inq.status === 'new'
                        ? 'bg-blue-50/30 border-blue-200/90'
                        : 'bg-zinc-50/50 border-zinc-200/80'
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
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white rounded-xl border border-zinc-200/80 px-3 py-2">
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
                      {inq.notes && (
                        <p className="text-[11.5px] text-zinc-600 bg-white/80 border border-zinc-200/70 rounded-lg p-2 whitespace-pre-wrap leading-relaxed mt-1.5">
                          {inq.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-zinc-200/70 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onCreateOrderFromInquiry(inq)}
                        className="btn-press inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#12489B] hover:bg-[#0B2559] text-white text-xs font-bold shadow-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>
                          {inq.status === 'converted'
                            ? 'Tạo thêm đơn từ phiếu này'
                            : 'Tạo đơn hàng ngay'}
                        </span>
                      </button>

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
  );
}
