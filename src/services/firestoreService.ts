import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { sanitizeOrderForTracking } from '../lib/utils';
import {
  BankSettings,
  CHAT_TTL_MS,
  ClientRecord,
  FIELD_LIMITS,
  OrderMessage,
  OrderRecord,
  RevisionRequest,
  TrackingPortalRecord,
} from '../types/domain';

export const DEFAULT_BANK_SETTINGS: BankSettings = {
  qrMode: 'uploaded_default',
  uploadedQrUrl: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
  vietqrBankBin: '',
  vietqrTemplate: 'compact2',
  updatedAt: new Date().toISOString(),
};

// --- Express File Storage Helpers ---
export async function uploadFileToServer(
  file: File,
  isLocked = false
): Promise<{
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('isLocked', String(isLocked));

  const res = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Tải tệp lên thất bại.');
  }
  return res.json();
}

export async function syncServerFileLock(fileIdOrUrl: string, isLocked: boolean): Promise<void> {
  if (!fileIdOrUrl.startsWith('/api/files/')) return;
  const fileId = fileIdOrUrl.replace('/api/files/', '').split('?')[0];
  if (!fileId) return;
  await fetch(`/api/files/${encodeURIComponent(fileId)}/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isLocked }),
  }).catch(() => undefined);
}

export async function deleteServerFile(fileIdOrUrl: string): Promise<void> {
  if (!fileIdOrUrl.startsWith('/api/files/')) return;
  const fileId = fileIdOrUrl.replace('/api/files/', '').split('?')[0];
  if (!fileId) return;
  await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}

// --- Clients CRM ---
export function subscribeClients(
  onData: (clients: ClientRecord[]) => void
): () => void {
  const q = query(collection(db, 'clients'), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: ClientRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ClientRecord, 'id'>),
      }));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'clients')
  );
}

export async function saveClient(
  client: Omit<ClientRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
  existingCreatedAt?: string
): Promise<string> {
  const now = new Date().toISOString();
  const id = existingId || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `clients/${id}`;
  const payload: Omit<ClientRecord, 'id'> = {
    displayName: client.displayName.trim().slice(0, FIELD_LIMITS.clientNameMax),
    zaloNumber: (client.zaloNumber || '').trim().slice(0, FIELD_LIMITS.zaloMax),
    socialLink: (client.socialLink || '').trim().slice(0, FIELD_LIMITS.socialLinkMax),
    schoolMajor: (client.schoolMajor || '').trim().slice(0, FIELD_LIMITS.schoolMax),
    tier: client.tier,
    notes: (client.notes || '').trim().slice(0, FIELD_LIMITS.clientNotesMax),
    createdAt: existingCreatedAt || now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'clients', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteClient(clientId: string): Promise<void> {
  const path = `clients/${clientId}`;
  try {
    await deleteDoc(doc(db, 'clients', clientId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Bank & QR Settings ---
export function subscribeBankSettings(
  onData: (settings: BankSettings) => void
): () => void {
  const ref = doc(db, 'settings', 'bankConfig');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as BankSettings);
      } else {
        onData(DEFAULT_BANK_SETTINGS);
      }
    },
    (error) => handleFirestoreError(error, OperationType.GET, 'settings/bankConfig')
  );
}

export async function saveBankSettings(
  settings: Omit<BankSettings, 'updatedAt'>,
  activeOrders: OrderRecord[]
): Promise<void> {
  const now = new Date().toISOString();
  const full: BankSettings = {
    qrMode: settings.qrMode || 'uploaded_default',
    uploadedQrUrl: (settings.uploadedQrUrl || '').slice(0, 500),
    bankName: settings.bankName.trim().slice(0, 100),
    accountNumber: settings.accountNumber.trim().slice(0, 40),
    accountName: settings.accountName.trim().slice(0, 120),
    vietqrBankBin: (settings.vietqrBankBin || '').trim().slice(0, 20),
    vietqrTemplate: settings.vietqrTemplate || 'compact2',
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'settings', 'bankConfig'), full);
    // Propagate updated bankSnapshot to tracking portals
    await Promise.all(
      activeOrders.map(async (ord) => {
        const portalPayload = sanitizeOrderForTracking(ord, full);
        await setDoc(doc(db, 'trackingPortals', ord.orderCode), portalPayload);
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/bankConfig');
  }
}

// --- Orders & Tracking Portal Sync ---
export function subscribeOrders(onData: (orders: OrderRecord[]) => void): () => void {
  const q = query(collection(db, 'orders'), orderBy('deadlineAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: OrderRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<OrderRecord, 'id'>),
      }));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
  );
}

export async function saveOrder(
  orderInput: Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt'>,
  bankSettings: BankSettings,
  existingId?: string,
  existingCreatedAt?: string
): Promise<string> {
  const now = new Date().toISOString();
  const id = existingId || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const isFullyPaid = orderInput.paymentStatus === 'fully_paid';

  // Sync Express file lock state before persisting
  await Promise.all(
    orderInput.attachments.map((att) =>
      syncServerFileLock(
        att.fileIdOrUrl,
        att.sourceType === 'upload' && att.isPaymentLocked && !isFullyPaid
      )
    )
  );

  const payload: Omit<OrderRecord, 'id'> = {
    orderCode: orderInput.orderCode.trim().toUpperCase().slice(0, FIELD_LIMITS.orderCodeMax),
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
    attachments: orderInput.attachments.slice(0, FIELD_LIMITS.attachmentsMax),
    createdAt: existingCreatedAt || now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'orders', id), payload);
    const fullRecord: OrderRecord = { id, ...payload };
    const portalPayload = sanitizeOrderForTracking(fullRecord, bankSettings);
    await setDoc(doc(db, 'trackingPortals', payload.orderCode), portalPayload);
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, `orders/${id}`);
  }
}

export async function deleteOrder(order: OrderRecord): Promise<void> {
  try {
    await deleteDoc(doc(db, 'orders', order.id));
    await deleteDoc(doc(db, 'trackingPortals', order.orderCode));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `orders/${order.id}`);
  }
}

// --- Client Public Tracking Portal ---
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

// --- 48-Hour Expiring Live Chat ---
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
          // Purge expired (>48h) messages automatically when Admin views the thread
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
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, colPath);
  }
}

// --- Revision Requests ---
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

// Helper to verify collection existence cleanly if needed
export async function checkOrderCodeAvailable(orderCode: string): Promise<boolean> {
  try {
    const snap = await getDocs(
      query(collection(db, 'orders'), where('orderCode', '==', orderCode))
    );
    return snap.empty;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
  }
}
