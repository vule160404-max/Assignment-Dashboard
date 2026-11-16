export type CitationStyle = 'APA' | 'Harvard' | 'IEEE' | 'MLA' | 'Chicago' | 'Other';

export type OrderStage =
  | 'quoted'
  | 'research'
  | 'drafting'
  | 'turnitin_check'
  | 'awaiting_final_payment'
  | 'delivered_revision';

export type OrderStatus = 'active' | 'completed' | 'cancelled';

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'fully_paid';

export type ClientTier = 'new' | 'vip' | 'watchlist';

export type AttachmentCategory = 'brief' | 'turnitin' | 'draft' | 'final';

export type AttachmentSourceType = 'upload' | 'url';

export interface AttachmentItem {
  id: string;
  name: string;
  category: AttachmentCategory;
  sourceType: AttachmentSourceType;
  fileIdOrUrl: string;
  mimeType: string;
  sizeBytes: number;
  isPaymentLocked: boolean;
  previewMaxPages: number;
  turnitinScorePage?: number;
  uploadedAt: string;
}

export interface OrderRecord {
  id: string;
  orderCode: string;
  subject: string;
  topic: string;
  wordCount: number;
  citationStyle: CitationStyle;
  outlineAndInstructions?: string;
  rubricNotes?: string;
  deadlineAt: number;
  stage: OrderStage;
  progressPercent: number;
  publicStatusNote?: string;
  internalNotes?: string;
  orderStatus: OrderStatus;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  clientId: string;
  clientDisplayName: string;
  attachments: AttachmentItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientRecord {
  id: string;
  displayName: string;
  zaloNumber?: string;
  socialLink?: string;
  schoolMajor?: string;
  tier: ClientTier;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankSettings {
  qrMode: 'uploaded_default' | 'vietqr_dynamic';
  uploadedQrUrl?: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  vietqrBankBin?: string;
  vietqrTemplate?: 'compact2' | 'compact' | 'qr_only' | 'print';
  updatedAt: string;
}

export interface TrackingPortalRecord {
  orderId: string;
  orderCode: string;
  subject: string;
  topic: string;
  wordCount: number;
  citationStyle: CitationStyle;
  outlineAndInstructions?: string;
  rubricNotes?: string;
  deadlineAt: number;
  stage: OrderStage;
  progressPercent: number;
  publicStatusNote?: string;
  orderStatus: OrderStatus;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  attachments: AttachmentItem[];
  bankSnapshot: {
    qrMode: 'uploaded_default' | 'vietqr_dynamic';
    uploadedQrUrl: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    vietqrBankBin: string;
    vietqrTemplate: 'compact2' | 'compact' | 'qr_only' | 'print';
  };
  updatedAt: string;
}

export interface OrderMessage {
  id: string;
  orderCode: string;
  senderRole: 'admin' | 'client';
  senderName: string;
  body: string;
  createdAtMs: number;
  expiresAtMs: number;
  createdAt: string;
}

export interface RevisionRequest {
  id: string;
  orderCode: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  adminReply?: string;
  createdAt: string;
  updatedAt: string;
}

export const CHAT_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export const ORDER_CODE_PATTERN = /^[A-Z0-9-]+$/;

export const FIELD_LIMITS = {
  orderCodeMax: 32,
  subjectMax: 120,
  topicMax: 240,
  outlineMax: 4000,
  rubricMax: 4000,
  publicNoteMax: 1000,
  internalNoteMax: 2000,
  clientNameMax: 120,
  zaloMax: 40,
  socialLinkMax: 300,
  schoolMax: 160,
  clientNotesMax: 2000,
  messageBodyMax: 1000,
  senderNameMax: 60,
  revisionMessageMax: 1500,
  revisionReplyMax: 1000,
  attachmentsMax: 20,
} as const;

export const ORDER_STAGES: {
  key: OrderStage;
  step: number;
  label: string;
  shortLabel: string;
  defaultPercent: number;
}[] = [
  {
    key: 'quoted',
    step: 1,
    label: 'Đã nhận yêu cầu & Báo giá',
    shortLabel: 'Báo giá',
    defaultPercent: 10,
  },
  {
    key: 'research',
    step: 2,
    label: 'Đã cọc / Đang nghiên cứu tài liệu',
    shortLabel: 'Nghiên cứu',
    defaultPercent: 25,
  },
  {
    key: 'drafting',
    step: 3,
    label: 'Đang viết bản nháp',
    shortLabel: 'Viết nháp',
    defaultPercent: 55,
  },
  {
    key: 'turnitin_check',
    step: 4,
    label: 'Kiểm tra đạo văn & AI (Turnitin)',
    shortLabel: 'Turnitin / AI',
    defaultPercent: 80,
  },
  {
    key: 'awaiting_final_payment',
    step: 5,
    label: 'Hoàn thành - Chờ thanh toán nốt',
    shortLabel: 'Chờ thanh toán',
    defaultPercent: 95,
  },
  {
    key: 'delivered_revision',
    step: 6,
    label: 'Đã bàn giao & Bảo hành chỉnh sửa',
    shortLabel: 'Bàn giao',
    defaultPercent: 100,
  },
];

export const CITATION_STYLES: CitationStyle[] = [
  'APA',
  'Harvard',
  'IEEE',
  'MLA',
  'Chicago',
  'Other',
];

export const CLIENT_TIERS: { key: ClientTier; label: string }[] = [
  { key: 'new', label: 'Khách mới' },
  { key: 'vip', label: 'Khách quen / VIP' },
  { key: 'watchlist', label: 'Cần lưu ý / Hay nợ' },
];
