import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
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
} from '../services/firestoreService';
import {
  computePaymentStatus,
  formatBytes,
  formatVnd,
  generateOrderCode,
  normalizeOrderCode,
} from '../lib/utils';
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
} from '../types/domain';
import { DeadlineBadge } from './DeadlineBadge';
import { OrderChatPanel } from './OrderChatPanel';
import { PdfPreviewModal } from './PdfPreviewModal';

interface OrderWorkspaceModalProps {
  isOpen: boolean;
  editingOrder: OrderRecord | null;
  clients: ClientRecord[];
  existingOrderCodes: string[];
  bankSettings: BankSettings;
  nowMs: number;
  onClose: () => void;
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
  existingOrderCodes,
  bankSettings,
  nowMs,
  onClose,
  onToast,
}: OrderWorkspaceModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'files' | 'chat_revisions'>('details');

  // Form states
  const [orderCode, setOrderCode] = useState('');
  const [clientId, setClientId] = useState('');
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<AttachmentItem | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('details');
    if (editingOrder) {
      setOrderCode(editingOrder.orderCode);
      setClientId(editingOrder.clientId);
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
      setAttachments(editingOrder.attachments || []);
      setShowNewClientInline(false);
    } else {
      setOrderCode(generateOrderCode(existingOrderCodes));
      setClientId(clients[0]?.id || '');
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
      setAttachments([]);
    }
  }, [isOpen, editingOrder]);

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
  }, [isOpen, editingOrder?.orderCode]);

  if (!isOpen) return null;

  const paymentStatus = computePaymentStatus(totalAmount, paidAmount);
  const balance = Math.max(0, totalAmount - paidAmount);

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
      const uploaded = await uploadFileToServer(
        file,
        shouldLock && paymentStatus !== 'fully_paid'
      );
      const item: AttachmentItem = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: uploaded.fileName,
        category: attCategory,
        sourceType: 'upload',
        fileIdOrUrl: uploaded.url,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        isPaymentLocked: shouldLock,
        previewMaxPages: shouldLock ? Math.max(1, attPreviewPages) : 999,
        turnitinScorePage:
          attCategory === 'turnitin' ? Math.max(1, attTurnitinScorePage) : undefined,
        uploadedAt: new Date().toISOString(),
      };
      setAttachments((prev) => [...prev, item]);
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

  const handleRemoveAttachment = async (att: AttachmentItem) => {
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    if (att.sourceType === 'upload') {
      await deleteServerFile(att.fileIdOrUrl);
    }
  };

  const handleToggleLock = (attId: string) => {
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === attId ? { ...a, isPaymentLocked: !a.isPaymentLocked } : a
      )
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
        clients.find((c) => c.id === clientId)?.displayName || '';

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
          attachments,
        },
        bankSettings,
        editingOrder?.id,
        editingOrder?.createdAt
      );

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
    }
  };

  const handleCopyTrackingLink = async () => {
    const code = normalizeOrderCode(orderCode);
    const link = `${window.location.origin}/?code=${encodeURIComponent(code)}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    onToast(`Đã sao chép link theo dõi cho #${code}`);
    setTimeout(() => setCopiedLink(false), 1800);
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

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white border border-zinc-200 rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-3">
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
            {editingOrder && (
              <button
                type="button"
                onClick={handleCopyTrackingLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-zinc-200 hover:bg-zinc-100 text-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                    Đã chép link
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Chép link khách
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="p-1.5 text-zinc-500 hover:text-slate-900 hover:bg-zinc-200/70 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace Tabs */}
        <div className="px-6 border-b border-zinc-200 bg-white flex items-center gap-6 text-sm">
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
              Chat 48h & Yêu cầu sửa ({revisions.filter((r) => r.status !== 'resolved').length})
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'details' && (
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
                      disabled={Boolean(editingOrder)}
                      value={orderCode}
                      onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-sm font-mono uppercase bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA] disabled:opacity-70"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Deadline nộp bài
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={deadlineLocal}
                      onChange={(e) => setDeadlineLocal(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                    />
                  </div>
                </div>

                {/* Client Selection or Inline New Client */}
                <div className="border border-zinc-200 rounded-xl p-4 space-y-3 bg-zinc-50/50">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-900">
                      Khách hàng
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewClientInline((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#4338CA] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showNewClientInline ? 'Chọn khách có sẵn' : 'Thêm khách mới nhanh'}
                    </button>
                  </div>

                  {!showNewClientInline ? (
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
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
                        className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                      />
                      <input
                        type="text"
                        placeholder="Số Zalo"
                        value={newClientZalo}
                        onChange={(e) => setNewClientZalo(e.target.value)}
                        className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                      />
                      <input
                        type="text"
                        placeholder="Trường / Chuyên ngành"
                        value={newClientSchool}
                        onChange={(e) => setNewClientSchool(e.target.value)}
                        className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                      />
                      <select
                        value={newClientTier}
                        onChange={(e) => setNewClientTier(e.target.value as ClientTier)}
                        className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Tên môn học *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={FIELD_LIMITS.subjectMax}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="VD: Strategic Management"
                      className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Trích dẫn
                    </label>
                    <select
                      value={citationStyle}
                      onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
                      className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
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
                      maxLength={FIELD_LIMITS.topicMax}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="VD: Porter's Five Forces Analysis of VinFast"
                      className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Số từ (Words)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={wordCount}
                      onChange={(e) => setWordCount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Đề bài, Dàn ý & Hướng dẫn (Hiển thị cho khách đối chiếu)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={FIELD_LIMITS.outlineMax}
                    value={outlineAndInstructions}
                    onChange={(e) => setOutlineAndInstructions(e.target.value)}
                    placeholder="Ghi rõ dàn ý, cấu trúc các phần hoặc hướng dẫn đã thống nhất với khách..."
                    className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Yêu cầu đặc biệt / Rubric
                  </label>
                  <textarea
                    rows={2}
                    maxLength={FIELD_LIMITS.rubricMax}
                    value={rubricNotes}
                    onChange={(e) => setRubricNotes(e.target.value)}
                    placeholder="VD: Turnitin < 15%, AI 0%, dùng ít nhất 12 peer-reviewed journals..."
                    className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
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
                      value={orderStatus}
                      onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                      className="text-xs font-medium px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg"
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
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg border transition-colors flex items-center justify-between ${
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
                      className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
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
                      className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                    />
                  </div>
                </div>

                {/* Finance & VND Deposit */}
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
                        className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg"
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
                        className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg"
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
                        className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg"
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
                      className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-[#D97706] border border-amber-200 rounded-md hover:bg-amber-100"
                    >
                      Xác nhận đã cọc ({formatVnd(depositAmount)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaidAmount(totalAmount)}
                      className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-[#16A34A] border border-emerald-200 rounded-md hover:bg-emerald-100"
                    >
                      Đã thanh toán đủ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="space-y-6">
              <div className="border border-zinc-200 rounded-xl p-5 bg-zinc-50/50 space-y-4">
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
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg"
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
                  <div className="bg-white border border-zinc-200 rounded-lg p-3.5 space-y-2">
                    <span className="text-xs font-semibold text-slate-800 block">
                      Cách 1: Tải file từ máy (PDF, DOCX, Ảnh...)
                    </span>
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] cursor-pointer">
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
                  <div className="bg-white border border-zinc-200 rounded-lg p-3.5 space-y-2">
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
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 shrink-0"
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
                      className="p-4 bg-white flex flex-wrap items-center justify-between gap-3"
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
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 rounded-lg"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleLock(att.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded-lg ${
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
                          className="p-1.5 text-zinc-400 hover:text-[#DC2626] rounded-lg"
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

          {activeTab === 'chat_revisions' && editingOrder && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OrderChatPanel
                orderCode={editingOrder.orderCode}
                senderRole="admin"
                senderName="Admin"
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
                        className="border border-zinc-200 rounded-lg p-3.5 space-y-2.5 text-sm"
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
                          className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateRev(rev, 'in_progress')}
                            className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-[#D97706] border border-amber-200 rounded-md"
                          >
                            Đang sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateRev(rev, 'resolved')}
                            className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-[#16A34A] border border-emerald-200 rounded-md"
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
          <div className="pt-4 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
            {editingOrder ? (
              <button
                type="button"
                onClick={handleDeleteOrder}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#DC2626] hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa đơn
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-slate-900"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] disabled:opacity-50 transition-colors"
              >
                {saving
                  ? 'Đang lưu...'
                  : editingOrder
                  ? 'Lưu thay đổi & Đồng bộ'
                  : 'Tạo đơn & Sinh mã theo dõi'}
              </button>
            </div>
          </div>
        </form>
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
