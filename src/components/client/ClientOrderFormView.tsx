import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  createOrderInquiry,
  uploadPublicInquiryFile,
} from '../../services/firestoreService';
import {
  AttachmentItem,
  CITATION_STYLES,
  CitationStyle,
  ORDER_INQUIRY_SERVICES,
  OrderInquiry,
} from '../../types/domain';
import { formatBytes, formatDateTime } from '../../lib/utils';

function generateDraftInquiryCode(): string {
  const year = new Date().getFullYear();
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `REQ-${year}-${suffix}`;
}

const ZALO_URL = 'https://zalo.me/0916045202';
const MESSENGER_URL = 'https://www.facebook.com/messages/t/61596358456580';

function getDefaultDeadlineInput(): string {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  d.setHours(23, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

interface ClientOrderFormViewProps {
  defaultServiceType?: string;
  onGoToLookup?: () => void;
  onToast?: (msg: string) => void;
}

export function ClientOrderFormView({
  defaultServiceType,
  onGoToLookup,
  onToast,
}: ClientOrderFormViewProps) {
  const [customerName, setCustomerName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [serviceType, setServiceType] = useState(
    defaultServiceType || ORDER_INQUIRY_SERVICES[0]
  );
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [wordCount, setWordCount] = useState('2000');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA');
  const [deadlineInput, setDeadlineInput] = useState(getDefaultDeadlineInput);
  const [notes, setNotes] = useState('');
  const [draftInquiryCode, setDraftInquiryCode] = useState(
    generateDraftInquiryCode
  );
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedInquiry, setSubmittedInquiry] = useState<OrderInquiry | null>(
    null
  );

  useEffect(() => {
    if (defaultServiceType) {
      setServiceType(defaultServiceType);
    }
  }, [defaultServiceType]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg('');

    const remainingSlots = Math.max(0, 5 - attachments.length);
    if (remainingSlots === 0) {
      setErrorMsg('Bạn chỉ có thể đính kèm tối đa 5 tệp đề bài cho mỗi phiếu.');
      return;
    }

    const picked = Array.from(fileList).slice(0, remainingSlots);
    setUploadingFiles(true);
    try {
      const uploadedItems: AttachmentItem[] = [];
      for (const file of picked) {
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`Tệp "${file.name}" vượt quá giới hạn 20 MB.`);
        }
        const uploaded = await uploadPublicInquiryFile(file, draftInquiryCode);
        uploadedItems.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: uploaded.fileName.slice(0, 240),
          category: 'brief',
          sourceType: 'upload',
          fileIdOrUrl: uploaded.url,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          isPaymentLocked: false,
          previewMaxPages: 20,
          uploadedAt: new Date().toISOString(),
          ...(uploaded.r2Key ? { r2Key: uploaded.r2Key } : {}),
        });
      }
      setAttachments((prev) => [...prev, ...uploadedItems].slice(0, 5));
      onToast?.(
        uploadedItems.length === 1
          ? `Đã tải lên tệp "${uploadedItems[0].name}"`
          : `Đã tải lên ${uploadedItems.length} tệp đề bài.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể tải tệp đề bài lên lúc này. Vui lòng thử lại.'
      );
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (uploadingFiles) {
      setErrorMsg('Vui lòng chờ tệp đề bài tải lên hoàn tất.');
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg('Vui lòng nhập họ tên hoặc nickname của bạn.');
      return;
    }
    if (!contactInfo.trim() || contactInfo.trim().length < 3) {
      setErrorMsg('Vui lòng nhập số Zalo, SĐT hoặc link Facebook để chúng tôi liên hệ báo giá.');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Vui lòng nhập môn học hoặc chuyên ngành.');
      return;
    }
    if (!topic.trim()) {
      setErrorMsg('Vui lòng nhập tên đề tài hoặc yêu cầu ngắn gọn.');
      return;
    }
    const deadlineMs = deadlineInput ? new Date(deadlineInput).getTime() : 0;
    if (!deadlineMs || Number.isNaN(deadlineMs)) {
      setErrorMsg('Vui lòng chọn thời hạn nộp bài hợp lệ.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createOrderInquiry({
        inquiryCode: draftInquiryCode,
        customerName: customerName.trim(),
        contactInfo: contactInfo.trim(),
        serviceType,
        subject: subject.trim(),
        topic: topic.trim(),
        wordCount: Math.max(0, Number(wordCount) || 0),
        citationStyle,
        deadlineAt: deadlineMs,
        notes: notes.trim(),
        attachments,
      });
      setSubmittedInquiry(created);
      onToast?.('Đã gửi phiếu đăng ký thành công! Tư vấn viên sẽ liên hệ trong 15 phút.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể gửi phiếu đăng ký lúc này. Vui lòng thử lại hoặc nhắn Zalo 0916.045.202.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedInquiry) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-emerald-200/90 shadow-[0_14px_40px_rgba(15,23,42,0.06)] p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold font-mono">
              Mã tiếp nhận: {submittedInquiry.inquiryCode}
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Đã tiếp nhận yêu cầu đặt bài!
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Thông tin của bạn đã được chuyển ngay tới đội ngũ AssignTrack. Chúng tôi sẽ liên hệ qua{' '}
              <strong className="text-slate-900">{submittedInquiry.contactInfo}</strong> trong vòng 15 phút để báo giá &amp; cấp <strong>Mã đơn (Passcode)</strong> theo dõi tiến độ.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-[#F4F7FB] border border-zinc-200/80 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-zinc-500">Dịch vụ:</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {submittedInquiry.serviceType}
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Môn học:</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {submittedInquiry.subject}
            </div>
          </div>
          <div className="sm:col-span-2">
            <span className="text-zinc-500">Đề tài / Yêu cầu:</span>
            <div className="font-bold text-slate-900 mt-0.5">
              {submittedInquiry.topic}
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Độ dài &amp; Chuẩn trích dẫn:</span>
            <div className="font-semibold text-slate-800 mt-0.5">
              {submittedInquiry.wordCount > 0
                ? `${submittedInquiry.wordCount.toLocaleString('vi-VN')} từ`
                : 'Trao đổi thêm'}{' '}
              · {submittedInquiry.citationStyle}
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Hạn nộp dự kiến:</span>
            <div className="font-semibold text-slate-800 mt-0.5">
              {formatDateTime(submittedInquiry.deadlineAt)}
            </div>
          </div>
          {submittedInquiry.attachments &&
            submittedInquiry.attachments.length > 0 && (
              <div className="sm:col-span-2 pt-2 border-t border-zinc-200/70 space-y-1">
                <span className="text-zinc-500">
                  Tệp đề bài đã tải lên ({submittedInquiry.attachments.length}):
                </span>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {submittedInquiry.attachments.map((att) => (
                    <span
                      key={att.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-[11px] font-semibold text-slate-700"
                    >
                      <Paperclip className="w-3 h-3 text-[#12489B]" />
                      <span className="max-w-[200px] truncate">{att.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
        </div>

        <div className="rounded-2xl bg-blue-50/70 border border-blue-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-700">
            Có file đề bài PDF / Word / Rubric muốn gửi kèm ngay? Nhắn mã{' '}
            <strong className="font-mono text-[#0B2559]">
              {submittedInquiry.inquiryCode}
            </strong>{' '}
            qua Zalo hoặc Messenger nhé!
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={ZALO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold"
            >
              <span>Gửi qua Zalo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-zinc-200 hover:border-[#12489B] text-slate-800 text-xs font-bold"
            >
              <span>Messenger</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => {
              setSubmittedInquiry(null);
              setSubject('');
              setTopic('');
              setNotes('');
              setAttachments([]);
              setDraftInquiryCode(generateDraftInquiryCode());
            }}
            className="btn-press px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-slate-700"
          >
            + Gửi thêm yêu cầu khác
          </button>
          {onGoToLookup && (
            <button
              type="button"
              onClick={onGoToLookup}
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-xs font-bold text-[#12489B]"
            >
              <span>Đã có mã đơn? Tra cứu tiến độ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Info Column */}
      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-3xl bg-gradient-to-br from-[#071A42] via-[#0B2559] to-[#12489B] text-white p-6 space-y-4 shadow-lg">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-sky-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Không cần đăng ký tài khoản</span>
          </span>
          <h2 className="text-xl font-bold leading-snug">
            Phiếu đăng ký đặt bài &amp; Báo giá trong 15 phút
          </h2>
          <p className="text-xs text-slate-200/90 leading-relaxed">
            Điền nhanh thông tin bài làm của bạn. Sau khi chốt yêu cầu, bạn sẽ nhận <strong>Mã đơn hàng (Passcode)</strong> để theo dõi tiến độ 6 mốc, xem trước bài viết &amp; tải báo cáo Turnitin trực tiếp.
          </p>

          <div className="space-y-2.5 pt-2 border-t border-white/15 text-xs">
            <div className="flex items-center gap-2 text-slate-100">
              <ShieldCheck className="w-4 h-4 text-sky-300 shrink-0" />
              <span>Bảo mật thông tin khách hàng 100%</span>
            </div>
            <div className="flex items-center gap-2 text-slate-100">
              <Clock className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Nhận cứu bài gấp 12h – 24h đúng hạn</span>
            </div>
            <div className="flex items-center gap-2 text-slate-100">
              <FileText className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>Tặng kèm báo cáo Turnitin &amp; AI rõ ràng</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-zinc-200/90 p-4 space-y-2.5 text-xs">
          <div className="font-bold text-slate-900">
            Cần gửi file đề bài trực tiếp?
          </div>
          <p className="text-zinc-500 leading-relaxed">
            Bạn có thể gửi trực tiếp file PDF/Word đề bài qua Zalo hoặc Messenger để được tư vấn viên hỗ trợ tức thì:
          </p>
          <div className="flex items-center gap-2 pt-1">
            <a
              href={ZALO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press flex-1 py-2 px-3 rounded-xl bg-blue-50 hover:bg-[#0B2559] text-[#0B2559] hover:text-white border border-blue-200/80 font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Zalo 0916.045.202</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press py-2 px-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-slate-700 border border-zinc-200 font-bold inline-flex items-center justify-center gap-1"
            >
              <span>Messenger</span>
            </a>
          </div>
        </div>
      </div>

      {/* Right Concise Registration Form */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-8 bg-white rounded-3xl border border-zinc-200/90 shadow-[0_12px_36px_rgba(15,23,42,0.04)] p-6 sm:p-7 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Thông tin bài làm cần hỗ trợ
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Các trường đánh dấu <span className="text-rose-500 font-bold">*</span> là bắt buộc.
            </p>
          </div>
          {onGoToLookup && (
            <button
              type="button"
              onClick={onGoToLookup}
              className="text-xs font-semibold text-[#12489B] hover:underline"
            >
              Đã có mã đơn? Tra cứu ngay →
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Họ tên / Nickname <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="VD: Minh Anh / Alex"
              maxLength={120}
              required
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-200 bg-zinc-50/40 focus:bg-white focus:outline-none focus:border-[#12489B] focus:ring-2 focus:ring-[#12489B]/15"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Số Zalo / Link Facebook <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="VD: 0912345678 hoặc link FB"
              maxLength={160}
              required
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-200 bg-zinc-50/40 focus:bg-white focus:outline-none focus:border-[#12489B] focus:ring-2 focus:ring-[#12489B]/15"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Loại dịch vụ <span className="text-rose-500">*</span>
            </label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-200 bg-zinc-50/40 focus:bg-white focus:outline-none focus:border-[#12489B] font-medium text-slate-800"
            >
              {ORDER_INQUIRY_SERVICES.map((srv) => (
                <option key={srv} value={srv}>
                  {srv}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Môn học / Chuyên ngành <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="VD: Marketing, Finance, BUSM2570..."
              maxLength={120}
              required
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-200 bg-zinc-50/40 focus:bg-white focus:outline-none focus:border-[#12489B] focus:ring-2 focus:ring-[#12489B]/15"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Đề tài / Yêu cầu chính <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="VD: Phân tích chiến lược Marketing của VinFast tại thị trường Việt Nam..."
            maxLength={240}
            required
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-200 bg-zinc-50/40 focus:bg-white focus:outline-none focus:border-[#12489B] focus:ring-2 focus:ring-[#12489B]/15"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Số từ dự kiến
            </label>
            <input
              type="number"
              min={0}
              max={500000}
              step={100}
              value={wordCount}
              onChange={(e) => setWordCount(e.target.value)}
              placeholder="2000"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-200 bg-zinc-50/40 focus:bg-white focus:outline-none focus:border-[#12489B]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Chuẩn trích dẫn
            </label>
            <select
              value={citationStyle}
              onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-200 bg-zinc-50/40 focus:bg-white focus:outline-none focus:border-[#12489B] font-medium text-slate-800"
            >
              {CITATION_STYLES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Hạn nộp (Deadline) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="datetime-local"
                value={deadlineInput}
                onChange={(e) => setDeadlineInput(e.target.value)}
                required
                className="w-full pl-8 pr-2.5 py-2.5 text-xs rounded-xl border border-zinc-200 bg-zinc-50/40 focus:bg-white focus:outline-none focus:border-[#12489B]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Ghi chú thêm / Link đề bài (Google Drive, Rubric, yêu cầu điểm mục tiêu...)
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={3000}
            placeholder="Dán link đề bài Google Drive (nếu có) hoặc ghi chú thêm về Rubric, mục tiêu điểm (Credit / Distinction / HD)..."
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-zinc-200 bg-zinc-50/40 focus:bg-white focus:outline-none focus:border-[#12489B] focus:ring-2 focus:ring-[#12489B]/15 resize-y"
          />
        </div>

        {/* File Upload Dropzone (Cloudflare R2) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-bold text-slate-700">
              Tải lên file đề bài / Rubric (Tùy chọn)
            </label>
            <span className="text-[11px] text-zinc-400">
              {attachments.length}/5 tệp · PDF, Word, Excel, PPT, Ảnh, ZIP (≤ 20 MB)
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.zip"
            onChange={(e) => void handleFilesSelected(e.target.files)}
            className="hidden"
          />

          <div
            onClick={() => {
              if (!uploadingFiles && attachments.length < 5) {
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (!uploadingFiles && attachments.length < 5) {
                void handleFilesSelected(e.dataTransfer.files);
              }
            }}
            className={`rounded-2xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
              uploadingFiles || attachments.length >= 5
                ? 'border-zinc-200 bg-zinc-50/60 cursor-not-allowed opacity-75'
                : 'border-blue-200/90 bg-[#F4F7FB]/70 hover:border-[#12489B] hover:bg-blue-50/50 cursor-pointer'
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-1.5">
              {uploadingFiles ? (
                <>
                  <Loader2 className="w-5 h-5 text-[#12489B] animate-spin" />
                  <p className="text-xs font-semibold text-[#0B2559]">
                    Đang tải tệp đề bài lên máy chủ lưu trữ bảo mật...
                  </p>
                </>
              ) : (
                <>
                  <UploadCloud className="w-6 h-6 text-[#12489B]" />
                  <p className="text-xs font-semibold text-slate-800">
                    Bấm để chọn file hoặc kéo thả đề bài vào đây
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Tệp đề bài được mã hóa lưu trữ an toàn để chuyên gia xem &amp; báo giá chính xác hơn.
                  </p>
                </>
              )}
            </div>
          </div>

          {attachments.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-50/50 border border-blue-200/80 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="w-3.5 h-3.5 text-[#12489B] shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">
                      {att.name}
                    </span>
                    <span className="text-[10.5px] font-mono text-zinc-500 shrink-0">
                      ({formatBytes(att.sizeBytes)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    aria-label={`Gỡ tệp ${att.name}`}
                    className="p-1 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-zinc-500">
            Gửi phiếu hoàn toàn miễn phí · Chốt giá rõ ràng trước khi làm.
          </span>
          <button
            type="submit"
            disabled={submitting || uploadingFiles}
            className="btn-press w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] disabled:opacity-60 text-white text-xs sm:text-sm font-bold shadow-md"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Đang gửi phiếu...' : 'Gửi phiếu đăng ký ngay'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
