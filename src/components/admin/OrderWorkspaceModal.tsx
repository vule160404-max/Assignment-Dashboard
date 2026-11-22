import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  Plus,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  deleteOrder,
  deleteServerFile,
  saveClient,
  saveOrder,
  subscribeOrderRevisions,
  updateRevisionStatus,
  uploadFileToServer,
} from '../../services/firestoreService';
import {
  ZaloTemplateType,
  buildClientZaloMessage,
  computePaymentStatus,
  copyTextToClipboard,
  generateOrderCode,
  getSafeExternalUrl,
  normalizeOrderCode,
} from '../../lib/utils';
import {
  AttachmentCategory,
  AttachmentItem,
  BankSettings,
  CITATION_STYLES,
  CitationStyle,
  CLIENT_TIERS,
  ClientRecord,
  ClientTier,
  FIELD_LIMITS,
  ORDER_STAGES,
  OrderInquiry,
  OrderRecord,
  OrderStage,
  OrderStatus,
  RevisionRequest,
  StaffPayoutStatus,
  UserProfile,
  UserRole,
} from '../../types/domain';
import { DeadlineBadge } from '../shared/DeadlineBadge';
import { PdfPreviewModal } from '../shared/PdfPreviewModal';
import { OrderAttachmentsTab } from './order/OrderAttachmentsTab';
import { OrderFinanceSidebar } from './order/OrderFinanceSidebar';
import { OrderRevisionsTab } from './order/OrderRevisionsTab';

interface OrderWorkspaceModalProps {
  isOpen: boolean;
  editingOrder: OrderRecord | null;
  prefillInquiry?: OrderInquiry | null;
  clients: ClientRecord[];
  teamMembers?: UserProfile[];
  userRole?: UserRole;
  editorDisplayName?: string;
  existingOrderCodes: string[];
  bankSettings: BankSettings;
  nowMs: number;
  onClose: () => void;
  onOrderCreatedFromInquiry?: (inquiryId: string, orderCode: string) => void;
  onOpenWordHumanizer?: (orderCode: string) => void;
  onOpenAiWriter?: (orderCode: string) => void;
  onToast: (msg: string) => void;
}

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function OrderWorkspaceModal({
  isOpen,
  editingOrder,
  prefillInquiry = null,
  clients,
  teamMembers = [],
  userRole = 'admin',
  editorDisplayName = 'Admin',
  existingOrderCodes,
  bankSettings,
  nowMs,
  onClose,
  onOrderCreatedFromInquiry,
  onOpenWordHumanizer,
  onOpenAiWriter,
  onToast,
}: OrderWorkspaceModalProps) {
  const isStaffMode = userRole === 'staff';
  const [activeTab, setActiveTab] = useState<'details' | 'files' | 'chat_revisions'>('details');

  // Form states
  const [orderCode, setOrderCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [assignedStaffUid, setAssignedStaffUid] = useState('');
  const [assignedStaffName, setAssignedStaffName] = useState('');
  const [showNewClientInline, setShowNewClientInline] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientZalo, setNewClientZalo] = useState('');
  const [newClientSchool, setNewClientSchool] = useState('');
  const [newClientMajor, setNewClientMajor] = useState('');
  const [newClientTier, setNewClientTier] = useState<ClientTier>('new');

  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [wordCount, setWordCount] = useState(2000);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA');
  const [deadlineLocal, setDeadlineLocal] = useState('');
  const [outlineAndInstructions, setOutlineAndInstructions] = useState('');
  const [rubricNotes, setRubricNotes] = useState('');

  const [stage, setStage] = useState<OrderStage>('quoted');
  const [progressPercent, setProgressPercent] = useState(10);
  const [publicStatusNote, setPublicStatusNote] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('active');

  const [totalAmount, setTotalAmount] = useState(1000000);
  const [depositAmount, setDepositAmount] = useState(500000);
  const [paidAmount, setPaidAmount] = useState(0);
  const [staffPayoutAmount, setStaffPayoutAmount] = useState(0);
  const [staffPayoutStatus, setStaffPayoutStatus] = useState<StaffPayoutStatus>('unpaid');
  const [staffPayoutPaidAt, setStaffPayoutPaidAt] = useState('');
  const [copiedZaloTpl, setCopiedZaloTpl] = useState<ZaloTemplateType | ''>('');

  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [attCategory, setAttCategory] = useState<AttachmentCategory>('brief');
  const [attLocked, setAttLocked] = useState(false);
  const [attPreviewPages, setAttPreviewPages] = useState(2);
  const [attTurnitinScorePage, setAttTurnitinScorePage] = useState(1);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalName, setExternalName] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [revReplies, setRevReplies] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingDeleteUrls, setPendingDeleteUrls] = useState<string[]>([]);
  const [unsavedUploadedUrls, setUnsavedUploadedUrls] = useState<string[]>([]);
  const [previewAtt, setPreviewAtt] = useState<AttachmentItem | null>(null);
  const initializedSessionRef = useRef<string>('');
  const copyTimerRef = useRef<number | null>(null);
  const zaloCopyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (zaloCopyTimerRef.current !== null) {
        window.clearTimeout(zaloCopyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      initializedSessionRef.current = '';
      setConfirmDelete(false);
      setPendingDeleteUrls([]);
      setUnsavedUploadedUrls([]);
      return;
    }

    const sessionKey = editingOrder
      ? editingOrder.id
      : prefillInquiry
      ? `inq_${prefillInquiry.id}`
      : '__new__';
    if (initializedSessionRef.current === sessionKey) {
      return;
    }
    initializedSessionRef.current = sessionKey;

    setActiveTab('details');
    setConfirmDelete(false);
    setPendingDeleteUrls([]);
    setUnsavedUploadedUrls([]);

    if (editingOrder) {
      setOrderCode(editingOrder.orderCode);
      setClientId(editingOrder.clientId);
      setAssignedStaffUid(editingOrder.assignedStaffUid || '');
      setAssignedStaffName(editingOrder.assignedStaffName || '');
      setSubject(editingOrder.subject);
      setTopic(editingOrder.topic);
      setWordCount(editingOrder.wordCount);
      setCitationStyle(editingOrder.citationStyle);
      setDeadlineLocal(toDatetimeLocal(editingOrder.deadlineAt));
      setOutlineAndInstructions(editingOrder.outlineAndInstructions || '');
      setRubricNotes(editingOrder.rubricNotes || '');
      setStage(editingOrder.stage);
      setProgressPercent(editingOrder.progressPercent);
      setPublicStatusNote(editingOrder.publicStatusNote || '');
      setInternalNotes(editingOrder.internalNotes || '');
      setOrderStatus(editingOrder.orderStatus);
      setTotalAmount(editingOrder.totalAmount);
      setDepositAmount(editingOrder.depositAmount);
      setPaidAmount(editingOrder.paidAmount);
      setStaffPayoutAmount(editingOrder.staffPayoutAmount || 0);
      setStaffPayoutStatus(editingOrder.staffPayoutStatus === 'paid' ? 'paid' : 'unpaid');
      setStaffPayoutPaidAt(editingOrder.staffPayoutPaidAt || '');
      setAttachments(editingOrder.attachments || []);
      setShowNewClientInline(false);
    } else if (prefillInquiry) {
      const contactLower = prefillInquiry.contactInfo.trim().toLowerCase();
      const matchedClient = clients.find(
        (c) =>
          (c.zaloNumber && c.zaloNumber.trim().toLowerCase() === contactLower) ||
          (c.socialLink && c.socialLink.trim().toLowerCase() === contactLower)
      );
      setOrderCode(generateOrderCode(existingOrderCodes));
      if (matchedClient) {
        setClientId(matchedClient.id);
        setShowNewClientInline(false);
        setNewClientName('');
        setNewClientZalo('');
      } else {
        setClientId('');
        setShowNewClientInline(true);
        setNewClientName(prefillInquiry.customerName);
        setNewClientZalo(prefillInquiry.contactInfo.slice(0, FIELD_LIMITS.zaloMax));
      }
      setAssignedStaffUid('');
      setAssignedStaffName('');
      setNewClientSchool('');
      setNewClientMajor('');
      setNewClientTier('new');
      setSubject(prefillInquiry.subject);
      setTopic(prefillInquiry.topic);
      setWordCount(prefillInquiry.wordCount || 2000);
      setCitationStyle(prefillInquiry.citationStyle || 'APA');
      setDeadlineLocal(
        toDatetimeLocal(
          prefillInquiry.deadlineAt > Date.now()
            ? prefillInquiry.deadlineAt
            : Date.now() + 3 * 24 * 60 * 60 * 1000
        )
      );
      setOutlineAndInstructions(
        [
          `Dịch vụ đăng ký: ${prefillInquiry.serviceType}`,
          prefillInquiry.notes ? `Ghi chú khách hàng:\n${prefillInquiry.notes}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
      );
      setRubricNotes('');
      setStage('quoted');
      setProgressPercent(10);
      setPublicStatusNote('');
      setInternalNotes(
        `Tạo từ phiếu đăng ký #${prefillInquiry.inquiryCode} · Liên hệ: ${prefillInquiry.contactInfo}`
      );
      setOrderStatus('active');
      setTotalAmount(1000000);
      setDepositAmount(500000);
      setPaidAmount(0);
      setStaffPayoutAmount(0);
      setStaffPayoutStatus('unpaid');
      setStaffPayoutPaidAt('');
      setAttachments(prefillInquiry.attachments || []);
    } else {
      setOrderCode(generateOrderCode(existingOrderCodes));
      setClientId(clients[0]?.id || '');
      setAssignedStaffUid('');
      setAssignedStaffName('');
      setShowNewClientInline(clients.length === 0);
      setNewClientName('');
      setNewClientZalo('');
      setNewClientSchool('');
      setNewClientMajor('');
      setNewClientTier('new');
      setSubject('');
      setTopic('');
      setWordCount(2000);
      setCitationStyle('APA');
      setDeadlineLocal(toDatetimeLocal(Date.now() + 4 * 24 * 60 * 60 * 1000));
      setOutlineAndInstructions('');
      setRubricNotes('');
      setStage('quoted');
      setProgressPercent(10);
      setPublicStatusNote('');
      setInternalNotes('');
      setOrderStatus('active');
      setTotalAmount(1000000);
      setDepositAmount(500000);
      setPaidAmount(0);
      setStaffPayoutAmount(0);
      setStaffPayoutStatus('unpaid');
      setStaffPayoutPaidAt('');
      setAttachments([]);
    }
  }, [isOpen, editingOrder, prefillInquiry, clients, existingOrderCodes]);

  useEffect(() => {
    if (!isOpen || !editingOrder) {
      setRevisions([]);
      return;
    }
    const unsub = subscribeOrderRevisions(editingOrder.orderCode, (list) => {
      setRevisions(list);
      const map: Record<string, string> = {};
      list.forEach((r) => {
        map[r.id] = r.adminReply || '';
      });
      setRevReplies(map);
    });
    return () => unsub();
  }, [isOpen, editingOrder]);

  const handleCloseModal = useCallback(async () => {
    if (unsavedUploadedUrls.length > 0) {
      await Promise.allSettled(unsavedUploadedUrls.map((u) => deleteServerFile(u)));
      setUnsavedUploadedUrls([]);
    }
    onClose();
  }, [onClose, unsavedUploadedUrls]);

  if (!isOpen) return null;

  const paymentStatus = computePaymentStatus(totalAmount, paidAmount);
  const openRevisionsCount = revisions.filter((r) => r.status !== 'resolved').length;

  const handleStageSelect = (newStage: OrderStage) => {
    setStage(newStage);
    const meta = ORDER_STAGES.find((s) => s.key === newStage);
    if (meta && progressPercent < meta.defaultPercent) {
      setProgressPercent(meta.defaultPercent);
    }
    if (newStage === 'delivered_revision' && paymentStatus === 'fully_paid') {
      setOrderStatus('completed');
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (attachments.length >= FIELD_LIMITS.attachmentsMax) {
      onToast(`Tối đa ${FIELD_LIMITS.attachmentsMax} tệp cho mỗi đơn.`);
      return;
    }
    setUploadingFile(true);
    try {
      const shouldLock =
        (attCategory === 'draft' || attCategory === 'final') && attLocked;
      const previewPages = shouldLock ? Math.max(1, attPreviewPages) : 999;
      const scorePage =
        attCategory === 'turnitin' ? Math.max(1, attTurnitinScorePage) : undefined;
      const uploaded = await uploadFileToServer(file, {
        isLocked: shouldLock && paymentStatus !== 'fully_paid',
        category: attCategory,
        previewMaxPages: previewPages,
        turnitinScorePage: scorePage,
        orderCode: normalizeOrderCode(orderCode) || undefined,
        versionRole:
          attCategory === 'draft' || attCategory === 'final'
            ? 'latest'
            : 'attachment',
      });
      const item: AttachmentItem = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: uploaded.fileName,
        category: attCategory,
        sourceType: 'upload',
        fileIdOrUrl: uploaded.url,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        isPaymentLocked: shouldLock,
        previewMaxPages: previewPages,
        turnitinScorePage: scorePage,
        uploadedAt: new Date().toISOString(),
        isBackup: false,
        ...(uploaded.r2Key ? { r2Key: uploaded.r2Key } : {}),
      };
      setAttachments((prev) => [...prev, item]);
      setUnsavedUploadedUrls((prev) => [...prev, uploaded.url]);
      onToast('Đã tải tệp lên thành công.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Tải tệp thất bại.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleAddExternalUrl = () => {
    if (!externalUrl.trim()) return;
    const safeUrl = getSafeExternalUrl(externalUrl);
    if (!safeUrl || (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://'))) {
      onToast('Liên kết ngoài không hợp lệ. Chỉ chấp nhận đường dẫn http:// hoặc https://.');
      return;
    }
    if (attachments.length >= FIELD_LIMITS.attachmentsMax) {
      onToast(`Tối đa ${FIELD_LIMITS.attachmentsMax} tệp cho mỗi đơn.`);
      return;
    }
    const shouldLock =
      (attCategory === 'draft' || attCategory === 'final') && attLocked;
    const item: AttachmentItem = {
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: externalName.trim() || safeUrl,
      category: attCategory,
      sourceType: 'url',
      fileIdOrUrl: safeUrl,
      mimeType: 'text/uri-list',
      sizeBytes: 0,
      isPaymentLocked: shouldLock,
      previewMaxPages: shouldLock ? Math.max(1, attPreviewPages) : 999,
      turnitinScorePage:
        attCategory === 'turnitin' ? Math.max(1, attTurnitinScorePage) : undefined,
      uploadedAt: new Date().toISOString(),
    };
    setAttachments((prev) => [...prev, item]);
    setExternalUrl('');
    setExternalName('');
    onToast('Đã thêm liên kết tài liệu.');
  };

  const handleRemoveAttachment = (att: AttachmentItem) => {
    if (isStaffMode && att.isPaymentLocked) {
      onToast('Chỉ Admin mới có quyền xóa tài liệu đang khóa thanh toán.');
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    if (att.sourceType === 'upload' && att.fileIdOrUrl.startsWith('/api/files/')) {
      setPendingDeleteUrls((prev) => [...prev, att.fileIdOrUrl]);
    }
  };

  const handleToggleLock = (attId: string) => {
    setAttachments((prev) =>
      prev.map((a) => {
        if (a.id !== attId) return a;
        if (isStaffMode && a.isPaymentLocked) {
          onToast('Chỉ Admin mới có quyền mở khóa tải xuống.');
          return a;
        }
        return { ...a, isPaymentLocked: !a.isPaymentLocked };
      })
    );
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const normCode = normalizeOrderCode(orderCode);
    if (!normCode || normCode.length < 4) {
      onToast('Mã đơn hàng phải có ít nhất 4 ký tự (chữ in hoa, số, dấu -).');
      return;
    }
    if (!subject.trim() || !topic.trim()) {
      onToast('Vui lòng nhập Tên môn học và Chủ đề.');
      return;
    }

    setSaving(true);
    try {
      let resolvedClientId = clientId;
      let resolvedClientName =
        editingOrder?.clientDisplayName ||
        clients.find((c) => c.id === clientId)?.displayName ||
        '';

      if (!isStaffMode) {
        if (showNewClientInline) {
          if (!newClientName.trim()) {
            onToast('Vui lòng nhập tên khách hàng mới.');
            setSaving(false);
            return;
          }
          const combinedSchoolMajor = [newClientSchool.trim(), newClientMajor.trim()]
            .filter(Boolean)
            .join(' · ')
            .slice(0, FIELD_LIMITS.schoolMax);
          resolvedClientId = await saveClient({
            displayName: newClientName.trim(),
            zaloNumber: newClientZalo.trim(),
            schoolMajor: combinedSchoolMajor,
            tier: newClientTier,
            socialLink: '',
            notes: '',
          });
          resolvedClientName = newClientName.trim();
        } else if (!resolvedClientId) {
          onToast('Vui lòng chọn hoặc tạo khách hàng.');
          setSaving(false);
          return;
        }
      }

      const deadlineMs = new Date(deadlineLocal).getTime();
      if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) {
        onToast('Deadline không hợp lệ.');
        setSaving(false);
        return;
      }

      await saveOrder(
        {
          orderCode: normCode,
          subject: subject.trim(),
          topic: topic.trim(),
          wordCount: Math.max(0, Number(wordCount) || 0),
          citationStyle,
          outlineAndInstructions: outlineAndInstructions.trim(),
          rubricNotes: rubricNotes.trim(),
          deadlineAt: deadlineMs,
          stage,
          progressPercent,
          publicStatusNote: publicStatusNote.trim(),
          internalNotes: internalNotes.trim(),
          orderStatus,
          totalAmount: Math.max(0, Number(totalAmount) || 0),
          depositAmount: Math.max(0, Number(depositAmount) || 0),
          paidAmount: Math.max(0, Number(paidAmount) || 0),
          paymentStatus,
          clientId: resolvedClientId,
          clientDisplayName: resolvedClientName,
          assignedStaffUid,
          assignedStaffName,
          staffPayoutAmount: Math.max(0, Number(staffPayoutAmount) || 0),
          staffPayoutStatus,
          staffPayoutPaidAt:
            staffPayoutStatus === 'paid'
              ? staffPayoutPaidAt || new Date().toISOString()
              : '',
          attachments,
        },
        bankSettings,
        editingOrder?.id,
        editingOrder?.createdAt,
        isStaffMode ? 'staff' : 'admin'
      );

      if (pendingDeleteUrls.length > 0) {
        const remainingUrls = new Set(attachments.map((a) => a.fileIdOrUrl));
        const toDelete = pendingDeleteUrls.filter((u) => !remainingUrls.has(u));
        await Promise.allSettled(toDelete.map((u) => deleteServerFile(u)));
      }
      setPendingDeleteUrls([]);
      setUnsavedUploadedUrls([]);

      if (!editingOrder && prefillInquiry && onOrderCreatedFromInquiry) {
        onOrderCreatedFromInquiry(prefillInquiry.id, normCode);
      }

      onToast(
        editingOrder
          ? `Đã cập nhật đơn #${normCode}`
          : `Đã tạo đơn mới #${normCode}`
      );
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Lưu đơn hàng thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!editingOrder) return;
    setSaving(true);
    try {
      await deleteOrder(editingOrder);
      onToast(`Đã xóa đơn #${editingOrder.orderCode}`);
      onClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Xóa đơn thất bại.');
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const handleCopyOrderCode = async () => {
    const code = normalizeOrderCode(orderCode);
    const ok = await copyTextToClipboard(code);
    if (!ok) {
      onToast('Không thể sao chép mã đơn vào clipboard.');
      return;
    }
    setCopiedCode(true);
    onToast(`Đã sao chép mã đơn #${code}`);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleCopyZaloTemplate = async (template: ZaloTemplateType) => {
    const resolvedClientDisplay =
      editingOrder?.clientDisplayName ||
      (showNewClientInline
        ? newClientName.trim()
        : clients.find((c) => c.id === clientId)?.displayName || '') ||
      'bạn';
    const deadlineMs = new Date(deadlineLocal).getTime();
    const message = buildClientZaloMessage(
      template,
      {
        orderCode: normalizeOrderCode(orderCode) || 'ORDER',
        subject: subject.trim() || 'Assignment',
        topic: topic.trim() || 'Bài làm',
        wordCount: Math.max(0, Number(wordCount) || 0),
        deadlineAt: Number.isFinite(deadlineMs) && deadlineMs > 0 ? deadlineMs : Date.now(),
        totalAmount: Math.max(0, Number(totalAmount) || 0),
        depositAmount: Math.max(0, Number(depositAmount) || 0),
        paidAmount: Math.max(0, Number(paidAmount) || 0),
        progressPercent,
        clientDisplayName: resolvedClientDisplay,
      },
      bankSettings
    );
    const ok = await copyTextToClipboard(message);
    if (!ok) {
      onToast('Không thể sao chép mẫu tin nhắn vào clipboard.');
      return;
    }
    setCopiedZaloTpl(template);
    const labelMap: Record<ZaloTemplateType, string> = {
      quote_deposit: 'Báo giá & Mời cọc',
      final_payment: 'Nhắc tất toán',
      handover: 'Bàn giao Final',
    };
    onToast(`Đã chép mẫu tin "${labelMap[template]}" cho #${normalizeOrderCode(orderCode)}`);
    if (zaloCopyTimerRef.current !== null) {
      window.clearTimeout(zaloCopyTimerRef.current);
    }
    zaloCopyTimerRef.current = window.setTimeout(() => {
      setCopiedZaloTpl((prev) => (prev === template ? '' : prev));
    }, 1800);
  };

  const handleUpdateRev = async (rev: RevisionRequest, status: RevisionRequest['status']) => {
    try {
      await updateRevisionStatus({
        orderCode: rev.orderCode,
        revisionId: rev.id,
        status,
        adminReply: revReplies[rev.id] || '',
      });
      onToast('Đã cập nhật trạng thái yêu cầu sửa.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Cập nhật thất bại.');
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]';

  const submitLabel = (() => {
    if (saving) return 'Đang lưu...';
    return editingOrder ? 'Lưu thay đổi & Đồng bộ' : 'Tạo đơn & Sinh mã theo dõi';
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5"
    >
      <div
        className="modal-panel bg-white border border-zinc-200 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-[0_24px_60px_rgb(15,23,42,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200/80 bg-zinc-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base font-bold text-slate-900">
              {editingOrder ? `Đơn #${editingOrder.orderCode}` : 'Tạo đơn Assignment mới'}
            </h2>
            {editingOrder && (
              <DeadlineBadge
                deadlineAt={new Date(deadlineLocal).getTime() || editingOrder.deadlineAt}
                nowMs={nowMs}
                orderStatus={orderStatus}
                compact
              />
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {editingOrder && onOpenAiWriter && (
              <button
                type="button"
                onClick={() => {
                  const code = editingOrder.orderCode;
                  void handleCloseModal();
                  onOpenAiWriter(code);
                }}
                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#12489B] hover:bg-[#0B2559] text-white rounded-lg whitespace-nowrap shadow-2xs"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Mở AI Writer Studio</span>
              </button>
            )}
            {editingOrder && onOpenWordHumanizer && (
              <button
                type="button"
                onClick={() => {
                  const code = editingOrder.orderCode;
                  void handleCloseModal();
                  onOpenWordHumanizer(code);
                }}
                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 border border-blue-200 hover:bg-blue-100 text-[#12489B] rounded-lg whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Humanize bài Word</span>
              </button>
            )}
            {editingOrder && (
              <button
                type="button"
                onClick={handleCopyOrderCode}
                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-zinc-200 hover:bg-zinc-100 text-slate-800 rounded-lg whitespace-nowrap"
              >
                {copiedCode ? (
                  <>
                    <Check key="check" className="icon-morph w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Đã chép mã</span>
                  </>
                ) : (
                  <>
                    <Copy key="copy" className="icon-morph w-3.5 h-3.5" />
                    <span>Chép mã đơn</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleCloseModal}
              aria-label="Đóng"
              className="btn-press p-1.5 text-zinc-500 hover:text-slate-900 hover:bg-zinc-200/70 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace Tabs */}
        <div className="px-6 border-b border-zinc-200/80 bg-white flex items-center gap-6 text-sm overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`py-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'details'
                ? 'border-[#12489B] text-[#12489B]'
                : 'border-transparent text-zinc-500 hover:text-slate-900'
            }`}
          >
            Thông tin & Tiến độ / Công nợ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`py-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'files'
                ? 'border-[#12489B] text-[#12489B]'
                : 'border-transparent text-zinc-500 hover:text-slate-900'
            }`}
          >
            Tài liệu & Khóa file ({attachments.length})
          </button>
          {editingOrder && (
            <button
              type="button"
              onClick={() => setActiveTab('chat_revisions')}
              className={`py-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'chat_revisions'
                  ? 'border-[#12489B] text-[#12489B]'
                  : 'border-transparent text-zinc-500 hover:text-slate-900'
              }`}
            >
              Chat 48h & Yêu cầu sửa ({openRevisionsCount})
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab !== 'chat_revisions' && (
            <form id="order-workspace-form" onSubmit={handleSave} className="space-y-6">
              {activeTab === 'details' && (
            <div className="space-y-4">
              {isStaffMode && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-[#12489B]">
                  <span className="font-semibold">Chế độ Nhân sự:</span> Bạn có thể cập nhật giai đoạn, tiến độ (%), ghi chú, tải tệp đính kèm, chat 48h và phản hồi yêu cầu sửa. Thông tin đề bài, giá tiền và khách hàng do Admin quản lý.
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 cols: Order specs & outline */}
              <div className="lg:col-span-7 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Mã đơn hàng
                    </label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingOrder) || isStaffMode}
                      value={orderCode}
                      onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                      className={`${inputCls} font-mono uppercase disabled:opacity-70`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Deadline nộp bài
                    </label>
                    <input
                      type="datetime-local"
                      required
                      disabled={isStaffMode}
                      value={deadlineLocal}
                      onChange={(e) => setDeadlineLocal(e.target.value)}
                      className={`${inputCls} font-mono disabled:opacity-70`}
                    />
                  </div>
                </div>

                {/* Staff Assignee Selector (Admin Only) */}
                {!isStaffMode && (
                  <div className="border border-zinc-200 rounded-xl p-4 space-y-2 bg-white">
                    <label className="block text-xs font-semibold text-slate-900">
                      Nhân sự phụ trách đơn này
                    </label>
                    <select
                      value={assignedStaffUid}
                      onChange={(e) => {
                        const uid = e.target.value;
                        const matched = teamMembers.find((m) => m.uid === uid);
                        setAssignedStaffUid(uid);
                        setAssignedStaffName(matched ? matched.displayName : '');
                      }}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                    >
                      <option value="">-- Chưa phân công (Admin tự xử lý) --</option>
                      {teamMembers
                        .filter(
                          (m) =>
                            m.status === 'active' &&
                            (m.role === 'staff' || m.role === 'admin' || m.role === 'owner')
                        )
                        .map((m) => (
                          <option key={m.uid} value={m.uid}>
                            {m.displayName} ({m.role === 'staff' ? 'Nhân sự' : 'Admin'})
                            {m.specialty ? ` · ${m.specialty}` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Client Selection or Inline New Client */}
                {!isStaffMode ? (
                  <div className="border border-zinc-200 rounded-xl p-4 space-y-3 bg-zinc-50/60">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-900">
                        Khách hàng
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowNewClientInline((v) => !v)}
                        className="btn-press inline-flex items-center gap-1 text-xs font-medium text-[#12489B] hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {showNewClientInline ? 'Chọn khách có sẵn' : 'Thêm khách mới nhanh'}
                      </button>
                    </div>

                    {!showNewClientInline ? (
                      <div className="space-y-2">
                        <select
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                        >
                          <option value="">-- Chọn khách hàng --</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.displayName} {c.zaloNumber ? `(${c.zaloNumber})` : ''}
                            </option>
                          ))}
                        </select>
                        {(() => {
                          const selectedClient = clients.find((c) => c.id === clientId);
                          const raw = selectedClient?.schoolMajor?.trim();
                          if (!raw) return null;
                          const parts = raw.includes(' · ')
                            ? raw.split(' · ')
                            : raw.includes(' / ')
                              ? raw.split(' / ')
                              : raw.includes(' - ')
                                ? raw.split(' - ')
                                : [raw];
                          const schoolLabel = parts[0]?.trim() || '';
                          const majorLabel = parts.slice(1).join(' · ').trim();
                          return (
                            <div className="bg-white border border-zinc-200/80 rounded-lg px-3 py-2 text-xs space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-zinc-500">Trường học:</span>
                                <span className="font-medium text-slate-900">{schoolLabel || '—'}</span>
                              </div>
                              {majorLabel && (
                                <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-1">
                                  <span className="text-zinc-500">Tên ngành:</span>
                                  <span className="font-medium text-slate-900">{majorLabel}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                              Tên / Nickname *
                            </label>
                            <input
                              type="text"
                              placeholder="VD: Minh Anh"
                              value={newClientName}
                              onChange={(e) => setNewClientName(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                              Số Zalo
                            </label>
                            <input
                              type="text"
                              placeholder="VD: 0912345678"
                              value={newClientZalo}
                              onChange={(e) => setNewClientZalo(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                            Trường học
                          </label>
                          <input
                            type="text"
                            placeholder="VD: Đại học Kinh tế Quốc dân (NEU)"
                            value={newClientSchool}
                            onChange={(e) => setNewClientSchool(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                            Tên ngành / Chuyên ngành
                          </label>
                          <input
                            type="text"
                            placeholder="VD: Quản trị kinh doanh / International Business"
                            value={newClientMajor}
                            onChange={(e) => setNewClientMajor(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                            Phân loại khách hàng
                          </label>
                          <select
                            value={newClientTier}
                            onChange={(e) => setNewClientTier(e.target.value as ClientTier)}
                            className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                          >
                            {CLIENT_TIERS.map((t) => (
                              <option key={t.key} value={t.key}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-zinc-200 rounded-xl px-4 py-3 bg-zinc-50/60 flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-600">Khách hàng:</span>
                    <span className="font-semibold text-slate-900">
                      {editingOrder?.clientDisplayName || 'Khách hàng'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Tên môn học *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isStaffMode}
                      maxLength={FIELD_LIMITS.subjectMax}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="VD: Strategic Management"
                      className={`${inputCls} disabled:opacity-70`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Trích dẫn
                    </label>
                    <select
                      disabled={isStaffMode}
                      value={citationStyle}
                      onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
                      className={`${inputCls} disabled:opacity-70`}
                    >
                      {CITATION_STYLES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Chủ đề (Topic) *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isStaffMode}
                      maxLength={FIELD_LIMITS.topicMax}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="VD: Porter's Five Forces Analysis of VinFast"
                      className={`${inputCls} disabled:opacity-70`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Số từ (Words)
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={isStaffMode}
                      value={wordCount}
                      onChange={(e) => setWordCount(Number(e.target.value))}
                      className={`${inputCls} font-mono tabular-nums disabled:opacity-70`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Đề bài, Dàn ý & Hướng dẫn (Hiển thị cho khách đối chiếu)
                  </label>
                  <textarea
                    rows={3}
                    disabled={isStaffMode}
                    maxLength={FIELD_LIMITS.outlineMax}
                    value={outlineAndInstructions}
                    onChange={(e) => setOutlineAndInstructions(e.target.value)}
                    placeholder="Ghi rõ dàn ý, cấu trúc các phần hoặc hướng dẫn đã thống nhất với khách..."
                    className={`${inputCls} disabled:opacity-70`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Yêu cầu đặc biệt / Rubric
                  </label>
                  <textarea
                    rows={2}
                    disabled={isStaffMode}
                    maxLength={FIELD_LIMITS.rubricMax}
                    value={rubricNotes}
                    onChange={(e) => setRubricNotes(e.target.value)}
                    placeholder="VD: Turnitin < 15%, AI 0%, dùng ít nhất 12 peer-reviewed journals..."
                    className={`${inputCls} disabled:opacity-70`}
                  />
                </div>
              </div>

              {/* Right 5 cols: Pipeline, Slider, Finance */}
              <div className="lg:col-span-5 space-y-5">
                <div className="border border-zinc-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Tiến độ thực hiện
                    </h3>
                    <select
                      disabled={isStaffMode}
                      value={orderStatus}
                      onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                      className="text-xs font-medium px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B] disabled:opacity-70"
                    >
                      <option value="active">Đang làm</option>
                      <option value="completed">Hoàn thành</option>
                      <option value="cancelled">Đã hủy</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    {ORDER_STAGES.map((st) => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => handleStageSelect(st.key)}
                        className={`btn-press w-full text-left px-3 py-2 text-xs rounded-lg border flex items-center justify-between ${
                          stage === st.key
                            ? 'bg-blue-50 border-[#12489B] text-[#12489B] font-semibold'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        <span>
                          {st.step}. {st.label}
                        </span>
                        {stage === st.key && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-zinc-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-700">
                        Thanh kéo tiến độ (10% – 100%)
                      </span>
                      <span className="font-mono font-bold text-[#12489B] tabular-nums">
                        {progressPercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={progressPercent}
                      onChange={(e) => setProgressPercent(Number(e.target.value))}
                      className="w-full accent-[#12489B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Ghi chú công khai cho khách
                    </label>
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.publicNoteMax}
                      value={publicStatusNote}
                      onChange={(e) => setPublicStatusNote(e.target.value)}
                      placeholder="VD: Đã xong phần Literature Review, đang phân tích số liệu"
                      className={inputCls}
                    />
                  </div>

                  {!isStaffMode && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Ghi chú nội bộ (chỉ Admin thấy)
                      </label>
                      <input
                        type="text"
                        maxLength={FIELD_LIMITS.internalNoteMax}
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        placeholder="Ghi chú riêng cho bạn..."
                        className={inputCls}
                      />
                    </div>
                  )}
                </div>

                {/* Finance, CTV Payout & 1-Tap Zalo Templates (Admin Only) */}
                {!isStaffMode && (
                  <OrderFinanceSidebar
                    totalAmount={totalAmount}
                    depositAmount={depositAmount}
                    paidAmount={paidAmount}
                    staffPayoutAmount={staffPayoutAmount}
                    staffPayoutStatus={staffPayoutStatus}
                    staffPayoutPaidAt={staffPayoutPaidAt}
                    copiedZaloTpl={copiedZaloTpl}
                    onChangeTotalAmount={setTotalAmount}
                    onChangeDepositAmount={setDepositAmount}
                    onChangePaidAmount={setPaidAmount}
                    onConfirmDepositStageCheck={() => {
                      if (stage === 'quoted') handleStageSelect('research');
                    }}
                    onChangeStaffPayoutAmount={setStaffPayoutAmount}
                    onChangeStaffPayoutStatus={(status, paidAt) => {
                      setStaffPayoutStatus(status);
                      setStaffPayoutPaidAt(paidAt);
                    }}
                    onCopyZaloTemplate={(tpl) => void handleCopyZaloTemplate(tpl)}
                  />
                )}
              </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <OrderAttachmentsTab
              attachments={attachments}
              attCategory={attCategory}
              attLocked={attLocked}
              attPreviewPages={attPreviewPages}
              attTurnitinScorePage={attTurnitinScorePage}
              externalUrl={externalUrl}
              externalName={externalName}
              uploadingFile={uploadingFile}
              isStaffMode={isStaffMode}
              onChangeCategory={setAttCategory}
              onChangeLocked={setAttLocked}
              onChangePreviewPages={setAttPreviewPages}
              onChangeTurnitinScorePage={setAttTurnitinScorePage}
              onChangeExternalName={setExternalName}
              onChangeExternalUrl={setExternalUrl}
              onUploadAttachment={handleUploadAttachment}
              onAddExternalUrl={handleAddExternalUrl}
              onPreviewAttachment={setPreviewAtt}
              onToggleLock={handleToggleLock}
              onRemoveAttachment={handleRemoveAttachment}
            />
          )}
            </form>
          )}

          {activeTab === 'chat_revisions' && editingOrder && (
            <OrderRevisionsTab
              orderCode={editingOrder.orderCode}
              editorDisplayName={editorDisplayName}
              revisions={revisions}
              revReplies={revReplies}
              onChangeReply={(revId, value) =>
                setRevReplies((prev) => ({
                  ...prev,
                  [revId]: value,
                }))
              }
              onUpdateRevision={(rev, status) => void handleUpdateRev(rev, status)}
            />
          )}

          {/* Footer Bar */}
          <div className="pt-4 border-t border-zinc-200/80 flex flex-wrap items-center justify-between gap-3">
            {editingOrder && !isStaffMode ? (
              <div className="flex items-center gap-2">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={saving}
                    className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#DC2626] hover:bg-red-50 border border-red-200 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa đơn
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleDeleteOrder}
                      disabled={saving}
                      className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#DC2626] text-white hover:bg-red-700 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xác nhận xóa vĩnh viễn
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={saving}
                      className="btn-press px-3 py-2 text-xs font-medium text-zinc-600 hover:text-slate-900"
                    >
                      Hủy
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCloseModal}
                className="btn-press px-4 py-2 text-sm font-medium text-zinc-600 hover:text-slate-900"
              >
                Đóng
              </button>
              <button
                type={activeTab === 'chat_revisions' ? 'button' : 'submit'}
                form={activeTab === 'chat_revisions' ? undefined : 'order-workspace-form'}
                onClick={activeTab === 'chat_revisions' ? () => void handleSave() : undefined}
                disabled={saving}
                className="btn-press px-5 py-2 text-sm font-medium bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] disabled:opacity-45"
              >
                {submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>

      <PdfPreviewModal
        attachment={previewAtt}
        isFullyPaid={paymentStatus === 'fully_paid'}
        isAdmin={true}
        onClose={() => setPreviewAtt(null)}
      />
    </div>
  );
}
