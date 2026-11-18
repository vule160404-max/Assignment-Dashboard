import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  FileText,
  Link2,
  Lock,
  Plus,
  Trash2,
  Unlock,
  Upload,
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
  formatBytes,
  formatVnd,
  generateOrderCode,
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
  OrderRecord,
  OrderStage,
  OrderStatus,
  RevisionRequest,
  StaffPayoutStatus,
  UserProfile,
  UserRole,
} from '../../types/domain';
import { DeadlineBadge } from '../shared/DeadlineBadge';
import { OrderChatPanel } from '../shared/OrderChatPanel';
import { PdfPreviewModal } from '../shared/PdfPreviewModal';

interface OrderWorkspaceModalProps {
  isOpen: boolean;
  editingOrder: OrderRecord | null;
  clients: ClientRecord[];
  teamMembers?: UserProfile[];
  userRole?: UserRole;
  editorDisplayName?: string;
  existingOrderCodes: string[];
  bankSettings: BankSettings;
  nowMs: number;
  onClose: () => void;
  onOpenWordHumanizer?: (orderCode: string) => void;
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
  clients,
  teamMembers = [],
  userRole = 'admin',
  editorDisplayName = 'Admin',
  existingOrderCodes,
  bankSettings,
  nowMs,
  onClose,
  onOpenWordHumanizer,
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

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
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

    const sessionKey = editingOrder ? editingOrder.id : '__new__';
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
    } else {
      setOrderCode(generateOrderCode(existingOrderCodes));
      setClientId(clients[0]?.id || '');
      setAssignedStaffUid('');
      setAssignedStaffName('');
      setShowNewClientInline(clients.length === 0);
      setNewClientName('');
      setNewClientZalo('');
      setNewClientSchool('');
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
  }, [isOpen, editingOrder, clients, existingOrderCodes]);

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

  useEffect(() => {
    if (!isOpen || previewAtt) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, previewAtt, handleCloseModal]);

  if (!isOpen) return null;

  const paymentStatus = computePaymentStatus(totalAmount, paidAmount);
  const balance = Math.max(0, totalAmount - paidAmount);
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
    if (attachments.length >= FIELD_LIMITS.attachmentsMax) {
      onToast(`Tối đa ${FIELD_LIMITS.attachmentsMax} tệp cho mỗi đơn.`);
      return;
    }
    const shouldLock =
      (attCategory === 'draft' || attCategory === 'final') && attLocked;
    const item: AttachmentItem = {
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: externalName.trim() || externalUrl.trim(),
      category: attCategory,
      sourceType: 'url',
      fileIdOrUrl: externalUrl.trim(),
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
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    if (att.sourceType === 'upload' && att.fileIdOrUrl.startsWith('/api/files/')) {
      setPendingDeleteUrls((prev) => [...prev, att.fileIdOrUrl]);
    }
  };

  const handleToggleLock = (attId: string) => {
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === attId ? { ...a, isPaymentLocked: !a.isPaymentLocked } : a
      )
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
          resolvedClientId = await saveClient({
            displayName: newClientName.trim(),
            zaloNumber: newClientZalo.trim(),
            schoolMajor: newClientSchool.trim(),
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
    window.setTimeout(() => {
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
    'w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]';

  const submitLabel = (() => {
    if (saving) return 'Đang lưu...';
    return editingOrder ? 'Lưu thay đổi & Đồng bộ' : 'Tạo đơn & Sinh mã theo dõi';
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5"
      onClick={handleCloseModal}
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
            {editingOrder && onOpenWordHumanizer && (
              <button
                type="button"
                onClick={() => {
                  const code = editingOrder.orderCode;
                  void handleCloseModal();
                  onOpenWordHumanizer(code);
                }}
                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-[#4338CA] rounded-lg whitespace-nowrap"
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
                ? 'border-[#4338CA] text-[#4338CA]'
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
                ? 'border-[#4338CA] text-[#4338CA]'
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
                  ? 'border-[#4338CA] text-[#4338CA]'
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
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl px-4 py-2.5 text-xs text-[#4338CA]">
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
                      className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
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
                        className="btn-press inline-flex items-center gap-1 text-xs font-medium text-[#4338CA] hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {showNewClientInline ? 'Chọn khách có sẵn' : 'Thêm khách mới nhanh'}
                      </button>
                    </div>

                    {!showNewClientInline ? (
                      <select
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                      >
                        <option value="">-- Chọn khách hàng --</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.displayName} {c.zaloNumber ? `(${c.zaloNumber})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Tên / Nickname *"
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                        />
                        <input
                          type="text"
                          placeholder="Số Zalo"
                          value={newClientZalo}
                          onChange={(e) => setNewClientZalo(e.target.value)}
                          className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                        />
                        <input
                          type="text"
                          placeholder="Trường / Chuyên ngành"
                          value={newClientSchool}
                          onChange={(e) => setNewClientSchool(e.target.value)}
                          className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                        />
                        <select
                          value={newClientTier}
                          onChange={(e) => setNewClientTier(e.target.value as ClientTier)}
                          className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                        >
                          {CLIENT_TIERS.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.label}
                            </option>
                          ))}
                        </select>
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
                      className="text-xs font-medium px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA] disabled:opacity-70"
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
                            ? 'bg-indigo-50 border-[#4338CA] text-[#4338CA] font-semibold'
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
                      <span className="font-mono font-bold text-[#4338CA] tabular-nums">
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
                      className="w-full accent-[#4338CA]"
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
                </div>

                {/* Finance & VND Deposit (Admin Only) */}
                {!isStaffMode && (
                  <div className="border border-zinc-200 rounded-xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Tài chính & Công nợ (VNĐ)
                      </h3>
                      <span className="text-xs font-mono font-semibold text-[#DC2626] tabular-nums">
                        Còn thiếu: {formatVnd(balance)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                          Tổng giá trị
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={10000}
                          value={totalAmount}
                          onChange={(e) => setTotalAmount(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                          Mức cọc yêu cầu
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={10000}
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                          Đã nhận (VNĐ)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={10000}
                          value={paidAmount}
                          onChange={(e) => setPaidAmount(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPaidAmount(depositAmount);
                          if (stage === 'quoted') handleStageSelect('research');
                        }}
                        className="btn-press px-2.5 py-1 text-xs font-medium bg-amber-50 text-[#D97706] border border-amber-200 rounded-md hover:bg-amber-100"
                      >
                        Xác nhận đã cọc ({formatVnd(depositAmount)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaidAmount(totalAmount)}
                        className="btn-press px-2.5 py-1 text-xs font-medium bg-emerald-50 text-[#16A34A] border border-emerald-200 rounded-md hover:bg-emerald-100"
                      >
                        Đã thanh toán đủ
                      </button>
                    </div>

                    {/* Staff Payout & Net Profit */}
                    <div className="pt-3.5 border-t border-zinc-100 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">
                          Tiền công CTV & Lợi nhuận ròng
                        </span>
                        {(() => {
                          const net =
                            Math.max(0, Number(totalAmount) || 0) -
                            Math.max(0, Number(staffPayoutAmount) || 0);
                          return (
                            <span
                              className={`text-xs font-mono font-semibold tabular-nums ${
                                net >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                              }`}
                            >
                              Lãi ròng: {net < 0 ? '-' : ''}
                              {formatVnd(Math.abs(net))}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                            Tiền công CTV / Nhân sự (VNĐ)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={10000}
                            value={staffPayoutAmount}
                            onChange={(e) => setStaffPayoutAmount(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                          />
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {[30, 40, 50, 60].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() =>
                                setStaffPayoutAmount(
                                  Math.round(((Math.max(0, Number(totalAmount) || 0) * pct) / 100) / 1000) * 1000
                                )
                              }
                              className="btn-press px-2 py-1.5 text-[11px] font-mono font-medium bg-zinc-100 hover:bg-zinc-200 text-slate-700 rounded-md whitespace-nowrap"
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer pt-0.5">
                        <input
                          type="checkbox"
                          checked={staffPayoutStatus === 'paid'}
                          onChange={(e) => {
                            const next: StaffPayoutStatus = e.target.checked ? 'paid' : 'unpaid';
                            setStaffPayoutStatus(next);
                            setStaffPayoutPaidAt(next === 'paid' ? new Date().toISOString() : '');
                          }}
                          className="w-4 h-4 accent-[#16A34A]"
                        />
                        <span>
                          Đã thanh toán tiền công cho CTV
                          {staffPayoutStatus === 'paid' && staffPayoutPaidAt
                            ? ` (${new Date(staffPayoutPaidAt).toLocaleDateString('vi-VN')})`
                            : ''}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* 1-Tap Zalo / Messenger Message Templates (Admin Only) */}
                {!isStaffMode && (
                  <div className="border border-zinc-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Chép nhanh tin nhắn Zalo / Messenger
                      </h3>
                      <span className="text-[11px] text-zinc-500">1 chạm</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          ['quote_deposit', 'Báo giá & Mời cọc'],
                          ['final_payment', 'Nhắc tất toán'],
                          ['handover', 'Bàn giao Final'],
                        ] as const
                      ).map(([tplKey, label]) => {
                        const isCopied = copiedZaloTpl === tplKey;
                        return (
                          <button
                            key={tplKey}
                            type="button"
                            onClick={() => handleCopyZaloTemplate(tplKey)}
                            className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-slate-800 rounded-lg whitespace-nowrap"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-zinc-500" />
                            )}
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="space-y-6">
              <div className="border border-zinc-200 rounded-xl p-5 bg-zinc-50/60 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Thêm tài liệu mới (Upload trực tiếp hoặc Liên kết ngoài)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Phân loại tài liệu
                    </label>
                    <select
                      value={attCategory}
                      onChange={(e) => {
                        const cat = e.target.value as AttachmentCategory;
                        setAttCategory(cat);
                        if (cat === 'draft' || cat === 'final') {
                          setAttLocked(true);
                        } else {
                          setAttLocked(false);
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                    >
                      <option value="brief">Đề bài & Tài liệu khách</option>
                      <option value="turnitin">Báo cáo Turnitin / AI Check</option>
                      <option value="draft">Bản nháp (Draft)</option>
                      <option value="final">Bài hoàn chỉnh (Final)</option>
                    </select>
                  </div>

                  {attCategory === 'turnitin' && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Trang chứa % đạo văn/AI
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={attTurnitinScorePage}
                        onChange={(e) =>
                          setAttTurnitinScorePage(Math.max(1, Number(e.target.value)))
                        }
                        className="w-full px-3 py-2 text-sm font-mono bg-white border border-zinc-200 rounded-lg"
                      />
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Khách xem từ trang 1 đến trang {attTurnitinScorePage + 2}
                      </p>
                    </div>
                  )}

                  {(attCategory === 'draft' || attCategory === 'final') && (
                    <>
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          id="lockToggle"
                          type="checkbox"
                          checked={attLocked}
                          onChange={(e) => setAttLocked(e.target.checked)}
                          className="w-4 h-4 accent-[#4338CA]"
                        />
                        <label htmlFor="lockToggle" className="text-xs font-medium text-slate-800">
                          Khóa tải xuống cho tới khi thanh toán đủ
                        </label>
                      </div>
                      {attLocked && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            Số trang xem trước rõ (còn lại làm mờ)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={attPreviewPages}
                            onChange={(e) =>
                              setAttPreviewPages(Math.max(1, Number(e.target.value)))
                            }
                            className="w-full px-3 py-2 text-sm font-mono bg-white border border-zinc-200 rounded-lg"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-200">
                  {/* Direct File Upload */}
                  <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-2">
                    <span className="text-xs font-semibold text-slate-800 block">
                      Cách 1: Tải file từ máy (PDF, DOCX, Ảnh...)
                    </span>
                    <label className="btn-press inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingFile ? 'Đang tải lên...' : 'Chọn tệp để tải lên'}
                      <input
                        type="file"
                        disabled={uploadingFile}
                        onChange={handleUploadAttachment}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* External URL */}
                  <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-2">
                    <span className="text-xs font-semibold text-slate-800 block">
                      Cách 2: Dán liên kết ngoài (Google Drive / Docs)
                    </span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Tên hiển thị (VD: Final Google Doc)"
                        value={externalName}
                        onChange={(e) => setExternalName(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                      />
                      <input
                        type="url"
                        placeholder="https://drive.google.com/..."
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleAddExternalUrl}
                        disabled={!externalUrl.trim()}
                        className="btn-press inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 disabled:opacity-45 shrink-0"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Thêm link
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachment List */}
              <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
                {attachments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    Chưa có tệp đính kèm nào.
                  </div>
                ) : (
                  attachments.map((att) => (
                    <div
                      key={att.id}
                      className="hover-row p-4 bg-white flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {att.name}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Loại: {att.category}
                          {att.sizeBytes > 0 && ` · ${formatBytes(att.sizeBytes)}`}
                          {att.category === 'turnitin' &&
                            ` · Cửa sổ Turnitin: Trang 1–${(att.turnitinScorePage || 1) + 2}`}
                          {att.isPaymentLocked &&
                            ` · Đang khóa tải (xem trước ${att.previewMaxPages || 2} trang)`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewAtt(att)}
                          className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 rounded-lg"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleLock(att.id)}
                          className={`btn-press inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded-lg ${
                            att.isPaymentLocked
                              ? 'bg-amber-50 text-[#D97706] border-amber-200'
                              : 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                          }`}
                        >
                          {att.isPaymentLocked ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              Đang khóa
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              Đang mở
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att)}
                          aria-label="Xóa tệp"
                          className="btn-press p-1.5 text-zinc-400 hover:text-[#DC2626] rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
            </form>
          )}

          {activeTab === 'chat_revisions' && editingOrder && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <OrderChatPanel
                orderCode={editingOrder.orderCode}
                senderRole="admin"
                senderName={editorDisplayName}
              />

              <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Yêu cầu chỉnh sửa từ khách ({revisions.length})
                </h3>
                {revisions.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-8 text-center">
                    Khách hàng chưa gửi yêu cầu chỉnh sửa nào cho đơn này.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {revisions.map((rev) => (
                      <div
                        key={rev.id}
                        className="border border-zinc-200 rounded-xl p-3.5 space-y-2.5 text-sm"
                      >
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span className="font-mono tabular-nums">
                            {new Date(rev.createdAt).toLocaleString('vi-VN')}
                          </span>
                          <span className="font-semibold text-slate-700 uppercase">
                            {rev.status}
                          </span>
                        </div>
                        <p className="text-slate-900 whitespace-pre-wrap">{rev.message}</p>
                        <input
                          type="text"
                          value={revReplies[rev.id] || ''}
                          onChange={(e) =>
                            setRevReplies((prev) => ({
                              ...prev,
                              [rev.id]: e.target.value,
                            }))
                          }
                          placeholder="Phản hồi cho khách (VD: Đã up Final v2)..."
                          className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateRev(rev, 'in_progress')}
                            className="btn-press px-2.5 py-1 text-xs font-medium bg-amber-50 text-[#D97706] border border-amber-200 rounded-md hover:bg-amber-100"
                          >
                            Đang sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateRev(rev, 'resolved')}
                            className="btn-press px-2.5 py-1 text-xs font-medium bg-emerald-50 text-[#16A34A] border border-emerald-200 rounded-md hover:bg-emerald-100"
                          >
                            Đánh dấu đã xong
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
                className="btn-press px-5 py-2 text-sm font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] disabled:opacity-45"
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
