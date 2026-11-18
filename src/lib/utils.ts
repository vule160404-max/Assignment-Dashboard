import {
  AttachmentItem,
  BankSettings,
  FIELD_LIMITS,
  ORDER_CODE_PATTERN,
  ORDER_STAGES,
  OrderRecord,
  OrderStage,
  PaymentStatus,
  TrackingPortalRecord,
} from '../types/domain';

export function formatVnd(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `${new Intl.NumberFormat('vi-VN').format(safe)} đ`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type UrgencyLevel = 'on_track' | 'due_soon' | 'urgent' | 'overdue' | 'completed';

export interface DeadlineBadgeInfo {
  level: UrgencyLevel;
  label: string;
  countdownText: string;
  colorClass: string;
  surfaceClass: string;
}

export function evaluateDeadline(
  deadlineAt: number,
  nowMs: number,
  orderStatus: OrderRecord['orderStatus']
): DeadlineBadgeInfo {
  if (orderStatus === 'completed') {
    return {
      level: 'completed',
      label: 'Hoàn thành',
      countdownText: 'Đã xong',
      colorClass: 'text-[#16A34A]',
      surfaceClass: 'bg-emerald-50 text-[#16A34A] border-emerald-200',
    };
  }
  if (orderStatus === 'cancelled') {
    return {
      level: 'completed',
      label: 'Đã hủy',
      countdownText: 'Đã hủy',
      colorClass: 'text-slate-500',
      surfaceClass: 'bg-slate-100 text-slate-600 border-slate-200',
    };
  }

  const diffMs = deadlineAt - nowMs;
  if (diffMs <= 0) {
    const overdueHrs = Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60)));
    const days = Math.floor(overdueHrs / 24);
    const hrs = overdueHrs % 24;
    return {
      level: 'overdue',
      label: 'Quá hạn',
      countdownText: days > 0 ? `Quá ${days}d ${hrs}h` : `Quá ${hrs}h`,
      colorClass: 'text-[#DC2626]',
      surfaceClass: 'bg-red-50 text-[#DC2626] border-red-200',
    };
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;

  let countdownText = `${Math.max(1, minutes)}m`;
  if (days >= 1) {
    countdownText = `${days}d ${remHours}h`;
  } else if (totalHours >= 1) {
    countdownText = `${totalHours}h ${minutes}m`;
  }

  if (totalHours < 24) {
    return {
      level: 'urgent',
      label: 'Dưới 24h',
      countdownText,
      colorClass: 'text-[#DC2626]',
      surfaceClass: 'bg-red-50 text-[#DC2626] border-red-200',
    };
  }

  if (totalHours <= 72) {
    return {
      level: 'due_soon',
      label: 'Còn 24–72h',
      countdownText,
      colorClass: 'text-[#D97706]',
      surfaceClass: 'bg-amber-50 text-[#D97706] border-amber-200',
    };
  }

  return {
    level: 'on_track',
    label: 'An toàn (>72h)',
    countdownText,
    colorClass: 'text-[#16A34A]',
    surfaceClass: 'bg-emerald-50 text-[#16A34A] border-emerald-200',
  };
}

export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function formatDateShort(ms: number): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(ms));
}

export function normalizeOrderCode(raw: string): string {
  return raw.trim().replace(/^#/, '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

export function getSafeExternalUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/files/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function isValidOrderCode(code: string): boolean {
  return code.length >= 4 && code.length <= FIELD_LIMITS.orderCodeMax && ORDER_CODE_PATTERN.test(code);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCodeSuffix(length = 4): string {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function generateOrderCode(existingCodes: string[]): string {
  const year = new Date().getFullYear();
  const prefix = `ASG-${year}-`;
  let maxSeq = 0;
  for (const c of existingCodes) {
    if (c.startsWith(prefix)) {
      const rest = c.slice(prefix.length).split('-')[0];
      const n = Number.parseInt(rest, 10);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  const next = String(maxSeq + 1).padStart(3, '0');
  let candidate = `${prefix}${next}-${randomCodeSuffix(4)}`;
  while (existingCodes.includes(candidate)) {
    candidate = `${prefix}${next}-${randomCodeSuffix(4)}`;
  }
  return candidate;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback to textarea copy below
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export function computePaymentStatus(totalAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount >= totalAmount && totalAmount > 0) return 'fully_paid';
  return 'deposit_paid';
}

export function getStageMeta(stage: OrderStage) {
  return ORDER_STAGES.find((s) => s.key === stage) || ORDER_STAGES[0];
}

export function buildVietQrUrl(params: {
  bankBin: string;
  accountNumber: string;
  template?: string;
  amount: number;
  addInfo: string;
  accountName: string;
}): string {
  const bin = encodeURIComponent(params.bankBin.trim());
  const acc = encodeURIComponent(params.accountNumber.trim());
  const tpl = encodeURIComponent(params.template || 'compact2');
  const qs = new URLSearchParams();
  if (params.amount > 0) qs.set('amount', String(Math.round(params.amount)));
  if (params.addInfo.trim()) qs.set('addInfo', params.addInfo.trim());
  if (params.accountName.trim()) qs.set('accountName', params.accountName.trim());
  return `https://img.vietqr.io/image/${bin}-${acc}-${tpl}.png?${qs.toString()}`;
}

export function sanitizeOrderForTracking(
  order: OrderRecord,
  bankSettings: BankSettings
): TrackingPortalRecord {
  const isFullyPaid = order.paymentStatus === 'fully_paid';
  const sanitizedAttachments: AttachmentItem[] = (order.attachments || [])
    .slice(0, FIELD_LIMITS.attachmentsMax)
    .map((att) => ({
      ...att,
      // Mask direct URL on external links when payment-locked and unpaid;
      // uploaded files still keep preview handle for page-windowed PDF.js rendering
      fileIdOrUrl:
        att.isPaymentLocked && !isFullyPaid && att.sourceType === 'url'
          ? ''
          : att.fileIdOrUrl,
    }));

  return {
    orderId: order.id,
    orderCode: order.orderCode,
    subject: order.subject.slice(0, FIELD_LIMITS.subjectMax),
    topic: order.topic.slice(0, FIELD_LIMITS.topicMax),
    wordCount: Math.max(0, Math.round(order.wordCount)),
    citationStyle: order.citationStyle,
    outlineAndInstructions: (order.outlineAndInstructions || '').slice(0, FIELD_LIMITS.outlineMax),
    rubricNotes: (order.rubricNotes || '').slice(0, FIELD_LIMITS.rubricMax),
    deadlineAt: order.deadlineAt,
    stage: order.stage,
    progressPercent: Math.min(100, Math.max(0, Math.round(order.progressPercent))),
    publicStatusNote: (order.publicStatusNote || '').slice(0, FIELD_LIMITS.publicNoteMax),
    orderStatus: order.orderStatus,
    totalAmount: Math.max(0, Math.round(order.totalAmount)),
    depositAmount: Math.max(0, Math.round(order.depositAmount)),
    paidAmount: Math.max(0, Math.round(order.paidAmount)),
    paymentStatus: order.paymentStatus,
    attachments: sanitizedAttachments,
    bankSnapshot: {
      qrMode: bankSettings.qrMode || 'uploaded_default',
      uploadedQrUrl: bankSettings.uploadedQrUrl || '',
      bankName: bankSettings.bankName || '',
      accountNumber: bankSettings.accountNumber || '',
      accountName: bankSettings.accountName || '',
      vietqrBankBin: bankSettings.vietqrBankBin || '',
      vietqrTemplate: bankSettings.vietqrTemplate || 'compact2',
    },
    updatedAt: order.updatedAt,
  };
}

export type ZaloTemplateType = 'quote_deposit' | 'final_payment' | 'handover';

export function buildClientZaloMessage(
  template: ZaloTemplateType,
  order: Pick<
    OrderRecord,
    | 'orderCode'
    | 'subject'
    | 'topic'
    | 'wordCount'
    | 'deadlineAt'
    | 'totalAmount'
    | 'depositAmount'
    | 'paidAmount'
    | 'progressPercent'
    | 'clientDisplayName'
  >,
  bankSettings: BankSettings,
  originUrl?: string
): string {
  const baseUrl =
    (originUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
      /\/$/,
      ''
    );
  const trackingUrl = baseUrl
    ? `${baseUrl}/?code=${encodeURIComponent(order.orderCode)}`
    : `?code=${encodeURIComponent(order.orderCode)}`;
  const remaining = Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0));
  const bankLine =
    bankSettings.bankName && bankSettings.accountNumber
      ? `\nThông tin chuyển khoản:\n• Ngân hàng: ${bankSettings.bankName}\n• STK: ${bankSettings.accountNumber}\n• Chủ TK: ${bankSettings.accountName || ''}\n• Nội dung CK: ${order.orderCode}`
      : '';

  if (template === 'quote_deposit') {
    return [
      `Chào ${order.clientDisplayName || 'bạn'}, mình gửi thông tin xác nhận đơn & link theo dõi tiến độ bài làm:`,
      `• Mã đơn: #${order.orderCode}`,
      `• Môn / Chủ đề: ${order.subject} — ${order.topic} (${order.wordCount.toLocaleString('vi-VN')} từ)`,
      `• Deadline: ${formatDateTime(order.deadlineAt)}`,
      `• Tổng chi phí: ${formatVnd(order.totalAmount)} | Cần cọc trước: ${formatVnd(order.depositAmount)}`,
      `• Link theo dõi tiến độ & xem QR cọc: ${trackingUrl}`,
      bankLine.trim(),
      `Sau khi chuyển khoản cọc xong bạn nhắn lại để bên mình bắt đầu triển khai ngay nhé!`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (template === 'final_payment') {
    return [
      `Chào ${order.clientDisplayName || 'bạn'}, bài #${order.orderCode} (${order.subject}) hiện đã hoàn thiện ${order.progressPercent}% và sẵn sàng bàn giao.`,
      `• Tổng phí: ${formatVnd(order.totalAmount)} | Đã thanh toán: ${formatVnd(order.paidAmount)}`,
      `• Số tiền còn lại cần tất toán: ${formatVnd(remaining)}`,
      `• Bạn vào link sau để xem trước bản Turnitin/Draft và mở khóa tải bài Final: ${trackingUrl}`,
      bankLine.trim(),
      `Chuyển xong bạn báo mình xác nhận mở khóa tải file đầy đủ nhé!`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Chào ${order.clientDisplayName || 'bạn'}, bên mình đã mở khóa toàn bộ file bài Final cho đơn #${order.orderCode} (${order.subject}).`,
    `• Link tải bài hoàn chỉnh: ${trackingUrl}`,
    `Nếu giảng viên có góp ý hoặc cần điều chỉnh điểm nào, bạn có thể nhắn trực tiếp hoặc bấm nút "Yêu cầu chỉnh sửa" ngay trên link theo dõi để team hỗ trợ nhanh nhất nhé!`,
  ].join('\n');
}

