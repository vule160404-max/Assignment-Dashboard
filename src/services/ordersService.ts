import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  DocumentReference,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { sanitizeOrderForTracking } from '../lib/utils';
import {
  BankSettings,
  CHAT_TTL_MS,
  CitationStyle,
  FIELD_LIMITS,
  OrderInquiry,
  OrderInquiryStatus,
  OrderMessage,
  OrderRecord,
  RevisionRequest,
  StaffPayoutStatus,
  TrackingPortalRecord,
} from '../types/domain';
import {
  deleteServerFile,
  syncServerFileLock,
  triggerClientTelegramNotification,
  triggerNewOrderInquiryTelegramNotification,
} from './apiClient';

async function commitDeletesInChunks(refs: DocumentReference[]): Promise<void> {
  const CHUNK_SIZE = 450;
  for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export function subscribeOrders(
  options: { uid: string; isAdmin: boolean },
  onData: (orders: OrderRecord[]) => void
): () => void {
  const q = options.isAdmin
    ? query(collection(db, 'orders'), orderBy('deadlineAt', 'asc'))
    : query(collection(db, 'orders'), where('assignedStaffUid', '==', options.uid));

  return onSnapshot(
    q,
    (snap) => {
      const list: OrderRecord[] = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrderRecord, 'id'>),
        }))
        .sort((a, b) => a.deadlineAt - b.deadlineAt);
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
  );
}

export async function checkOrderCodeAvailable(orderCode: string): Promise<boolean> {
  try {
    const [orderSnap, portalSnap] = await Promise.all([
      getDocs(query(collection(db, 'orders'), where('orderCode', '==', orderCode))),
      getDoc(doc(db, 'trackingPortals', orderCode)),
    ]);
    return orderSnap.empty && !portalSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
  }
}

export async function saveOrder(
  orderInput: Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt'>,
  bankSettings: BankSettings,
  existingId?: string,
  existingCreatedAt?: string,
  editorRole: 'owner' | 'admin' | 'staff' = 'admin'
): Promise<string> {
  const normalizedCode = orderInput.orderCode
    .trim()
    .toUpperCase()
    .slice(0, FIELD_LIMITS.orderCodeMax);

  if (!existingId) {
    const available = await checkOrderCodeAvailable(normalizedCode);
    if (!available) {
      throw new Error(`Mã đơn hàng #${normalizedCode} đã tồn tại. Vui lòng chọn mã khác.`);
    }
  }

  const now = new Date().toISOString();
  const id = existingId || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const isFullyPaid = orderInput.paymentStatus === 'fully_paid';
  const trimmedAttachments = orderInput.attachments.slice(0, FIELD_LIMITS.attachmentsMax);

  if (editorRole === 'staff') {
    if (!existingId) {
      throw new Error('Nhân sự không có quyền tạo đơn hàng mới.');
    }
    const staffOrderUpdate = {
      stage: orderInput.stage,
      progressPercent: Math.min(100, Math.max(0, Math.round(orderInput.progressPercent))),
      publicStatusNote: (orderInput.publicStatusNote || '').slice(0, FIELD_LIMITS.publicNoteMax),
      attachments: trimmedAttachments,
      updatedAt: now,
    };

    const fullTemp: OrderRecord = {
      id,
      ...orderInput,
      orderCode: normalizedCode,
      ...staffOrderUpdate,
      createdAt: existingCreatedAt || now,
    };
    const sanitizedForPortal = sanitizeOrderForTracking(fullTemp, bankSettings);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', id), staffOrderUpdate);
      batch.update(doc(db, 'trackingPortals', normalizedCode), {
        stage: staffOrderUpdate.stage,
        progressPercent: staffOrderUpdate.progressPercent,
        publicStatusNote: staffOrderUpdate.publicStatusNote,
        attachments: sanitizedForPortal.attachments,
        updatedAt: now,
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
    }

    await Promise.all(
      trimmedAttachments.map((att) =>
        syncServerFileLock(att.fileIdOrUrl, {
          isLocked: att.sourceType === 'upload' && att.isPaymentLocked && !isFullyPaid,
          category: att.category,
          previewMaxPages: att.previewMaxPages,
          turnitinScorePage: att.turnitinScorePage,
        })
      )
    );
    return id;
  }

  const payload: Omit<OrderRecord, 'id'> = {
    orderCode: normalizedCode,
    subject: orderInput.subject.trim().slice(0, FIELD_LIMITS.subjectMax),
    topic: orderInput.topic.trim().slice(0, FIELD_LIMITS.topicMax),
    wordCount: Math.max(0, Math.round(orderInput.wordCount || 0)),
    citationStyle: orderInput.citationStyle,
    outlineAndInstructions: (orderInput.outlineAndInstructions || '').slice(0, FIELD_LIMITS.outlineMax),
    rubricNotes: (orderInput.rubricNotes || '').slice(0, FIELD_LIMITS.rubricMax),
    deadlineAt: orderInput.deadlineAt,
    stage: orderInput.stage,
    progressPercent: Math.min(100, Math.max(0, Math.round(orderInput.progressPercent))),
    publicStatusNote: (orderInput.publicStatusNote || '').slice(0, FIELD_LIMITS.publicNoteMax),
    internalNotes: (orderInput.internalNotes || '').slice(0, FIELD_LIMITS.internalNoteMax),
    orderStatus: orderInput.orderStatus,
    totalAmount: Math.max(0, Math.round(orderInput.totalAmount || 0)),
    depositAmount: Math.max(0, Math.round(orderInput.depositAmount || 0)),
    paidAmount: Math.max(0, Math.round(orderInput.paidAmount || 0)),
    paymentStatus: orderInput.paymentStatus,
    clientId: orderInput.clientId,
    clientDisplayName: orderInput.clientDisplayName.slice(0, FIELD_LIMITS.clientNameMax),
    assignedStaffUid: (orderInput.assignedStaffUid || '').slice(0, 128),
    assignedStaffName: (orderInput.assignedStaffName || '').slice(0, FIELD_LIMITS.displayNameMax),
    staffPayoutAmount: Math.max(0, Math.round(orderInput.staffPayoutAmount || 0)),
    staffPayoutStatus: orderInput.staffPayoutStatus === 'paid' ? 'paid' : 'unpaid',
    staffPayoutPaidAt:
      orderInput.staffPayoutStatus === 'paid'
        ? (orderInput.staffPayoutPaidAt || now).slice(0, 40)
        : '',
    attachments: trimmedAttachments,
    createdAt: existingCreatedAt || now,
    updatedAt: now,
  };

  try {
    const fullRecord: OrderRecord = { id, ...payload };
    const portalPayload = sanitizeOrderForTracking(fullRecord, bankSettings);

    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', id), payload);
    batch.set(doc(db, 'trackingPortals', payload.orderCode), portalPayload);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, `orders/${id}`);
  }

  await Promise.all(
    trimmedAttachments.map((att) =>
      syncServerFileLock(att.fileIdOrUrl, {
        isLocked: att.sourceType === 'upload' && att.isPaymentLocked && !isFullyPaid,
        category: att.category,
        previewMaxPages: att.previewMaxPages,
        turnitinScorePage: att.turnitinScorePage,
      })
    )
  );
  return id;
}

export async function updateOrderStaffPayout(params: {
  orderId: string;
  staffPayoutAmount: number;
  staffPayoutStatus: StaffPayoutStatus;
}): Promise<void> {
  const now = new Date().toISOString();
  const path = `orders/${params.orderId}`;
  try {
    await updateDoc(doc(db, 'orders', params.orderId), {
      staffPayoutAmount: Math.max(0, Math.round(params.staffPayoutAmount || 0)),
      staffPayoutStatus: params.staffPayoutStatus,
      staffPayoutPaidAt: params.staffPayoutStatus === 'paid' ? now : '',
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrder(order: OrderRecord): Promise<void> {
  const uploadedAttachments = (order.attachments || []).filter(
    (att) => att.sourceType === 'upload' && att.fileIdOrUrl.startsWith('/api/files/')
  );

  await Promise.allSettled(
    uploadedAttachments.map((att) => deleteServerFile(att.fileIdOrUrl))
  );

  try {
    const [msgSnap, revSnap] = await Promise.all([
      getDocs(collection(db, 'trackingPortals', order.orderCode, 'messages')),
      getDocs(collection(db, 'trackingPortals', order.orderCode, 'revisions')),
    ]);

    const refsToDelete: DocumentReference[] = [
      ...msgSnap.docs.map((d) => d.ref),
      ...revSnap.docs.map((d) => d.ref),
      doc(db, 'trackingPortals', order.orderCode),
      doc(db, 'orders', order.id),
    ];

    await commitDeletesInChunks(refsToDelete);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `orders/${order.id}`);
  }
}

export async function fetchTrackingPortalOnce(
  orderCode: string
): Promise<TrackingPortalRecord | null> {
  const path = `trackingPortals/${orderCode}`;
  try {
    const snap = await getDoc(doc(db, 'trackingPortals', orderCode));
    if (!snap.exists()) return null;
    return snap.data() as TrackingPortalRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeTrackingPortal(
  orderCode: string,
  onData: (portal: TrackingPortalRecord | null) => void
): () => void {
  const path = `trackingPortals/${orderCode}`;
  return onSnapshot(
    doc(db, 'trackingPortals', orderCode),
    (snap) => {
      onData(snap.exists() ? (snap.data() as TrackingPortalRecord) : null);
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribeOrderMessages(
  orderCode: string,
  isAdminMode: boolean,
  onData: (messages: OrderMessage[]) => void
): () => void {
  const colPath = `trackingPortals/${orderCode}/messages`;
  const q = query(
    collection(db, 'trackingPortals', orderCode, 'messages'),
    where('orderCode', '==', orderCode),
    orderBy('createdAtMs', 'asc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const nowMs = Date.now();
      const active: OrderMessage[] = [];
      for (const d of snap.docs) {
        const msg = d.data() as Omit<OrderMessage, 'id'>;
        if (msg.expiresAtMs > nowMs) {
          active.push({ id: d.id, ...msg });
        } else if (isAdminMode) {
          deleteDoc(doc(db, 'trackingPortals', orderCode, 'messages', d.id)).catch(() => undefined);
        }
      }
      onData(active);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, colPath)
  );
}

export async function sendOrderMessage(params: {
  orderCode: string;
  senderRole: 'admin' | 'client';
  senderName: string;
  body: string;
}): Promise<void> {
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const createdAtMs = Date.now();
  const expiresAtMs = createdAtMs + CHAT_TTL_MS;
  const colPath = `trackingPortals/${params.orderCode}/messages/${msgId}`;

  const payload: Omit<OrderMessage, 'id'> = {
    orderCode: params.orderCode,
    senderRole: params.senderRole,
    senderName: params.senderName.trim().slice(0, FIELD_LIMITS.senderNameMax) || 'Khách hàng',
    body: params.body.trim().slice(0, FIELD_LIMITS.messageBodyMax),
    createdAtMs,
    expiresAtMs,
    createdAt: new Date(createdAtMs).toISOString(),
  };

  try {
    await setDoc(doc(db, 'trackingPortals', params.orderCode, 'messages', msgId), payload);
    if (params.senderRole === 'client') {
      triggerClientTelegramNotification({
        orderCode: params.orderCode,
        eventType: 'message',
        recordId: msgId,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colPath);
  }
}

export function subscribeOrderRevisions(
  orderCode: string,
  onData: (revisions: RevisionRequest[]) => void
): () => void {
  const colPath = `trackingPortals/${orderCode}/revisions`;
  const q = query(
    collection(db, 'trackingPortals', orderCode, 'revisions'),
    where('orderCode', '==', orderCode),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RevisionRequest, 'id'>),
        }))
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, colPath)
  );
}

export function subscribeAllRevisionsAdmin(
  onData: (revisions: RevisionRequest[]) => void
): () => void {
  const q = query(collectionGroup(db, 'revisions'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RevisionRequest, 'id'>),
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'revisions(collectionGroup)')
  );
}

export async function createRevisionRequest(
  orderCode: string,
  message: string
): Promise<void> {
  const reqId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const path = `trackingPortals/${orderCode}/revisions/${reqId}`;

  const payload: Omit<RevisionRequest, 'id'> = {
    orderCode,
    message: message.trim().slice(0, FIELD_LIMITS.revisionMessageMax),
    status: 'open',
    adminReply: '',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'trackingPortals', orderCode, 'revisions', reqId), payload);
    triggerClientTelegramNotification({
      orderCode,
      eventType: 'revision',
      recordId: reqId,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRevisionStatus(params: {
  orderCode: string;
  revisionId: string;
  status: RevisionRequest['status'];
  adminReply: string;
}): Promise<void> {
  const path = `trackingPortals/${params.orderCode}/revisions/${params.revisionId}`;
  try {
    await updateDoc(doc(db, 'trackingPortals', params.orderCode, 'revisions', params.revisionId), {
      status: params.status,
      adminReply: params.adminReply.trim().slice(0, FIELD_LIMITS.revisionReplyMax),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createOrderInquiry(input: {
  customerName: string;
  contactInfo: string;
  serviceType: string;
  subject: string;
  topic: string;
  wordCount: number;
  citationStyle: CitationStyle;
  deadlineAt: number;
  notes?: string;
}): Promise<OrderInquiry> {
  const inquiryId = `inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const year = new Date().getFullYear();
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  const inquiryCode = `REQ-${year}-${suffix}`;
  const now = new Date().toISOString();
  const path = `orderInquiries/${inquiryId}`;

  const payload: Omit<OrderInquiry, 'id'> = {
    inquiryCode,
    customerName: input.customerName.trim().slice(0, 120),
    contactInfo: input.contactInfo.trim().slice(0, 160),
    serviceType: input.serviceType.trim().slice(0, 100) || 'Viết mới Assignment / Essay / Report',
    subject: input.subject.trim().slice(0, 120),
    topic: input.topic.trim().slice(0, 240),
    wordCount: Math.max(0, Math.min(500000, Math.round(Number(input.wordCount) || 0))),
    citationStyle: input.citationStyle || 'APA',
    deadlineAt: input.deadlineAt,
    notes: (input.notes || '').trim().slice(0, 3000),
    status: 'new',
    convertedOrderCode: '',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'orderInquiries', inquiryId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  // Fire-and-forget Telegram notification to Admin
  void triggerNewOrderInquiryTelegramNotification({
    inquiryCode: payload.inquiryCode,
    customerName: payload.customerName,
    contactInfo: payload.contactInfo,
    serviceType: payload.serviceType,
    subject: payload.subject,
    topic: payload.topic,
    wordCount: payload.wordCount,
    citationStyle: payload.citationStyle,
    deadlineAt: payload.deadlineAt,
    notes: payload.notes,
  });

  return {
    id: inquiryId,
    ...payload,
  };
}

export function subscribeOrderInquiriesAdmin(
  onData: (inquiries: OrderInquiry[]) => void
): () => void {
  const q = query(collection(db, 'orderInquiries'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrderInquiry, 'id'>),
        }))
      );
    },
    (error) => {
      console.warn('Could not subscribe orderInquiries:', error);
      onData([]);
    }
  );
}

export async function updateOrderInquiryStatus(params: {
  inquiryId: string;
  status: OrderInquiryStatus;
  convertedOrderCode?: string;
}): Promise<void> {
  const path = `orderInquiries/${params.inquiryId}`;
  try {
    await updateDoc(doc(db, 'orderInquiries', params.inquiryId), {
      status: params.status,
      convertedOrderCode: (params.convertedOrderCode || '').trim().slice(0, 32),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrderInquiry(inquiryId: string): Promise<void> {
  const path = `orderInquiries/${inquiryId}`;
  try {
    await deleteDoc(doc(db, 'orderInquiries', inquiryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
