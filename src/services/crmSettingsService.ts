import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { sanitizeOrderForTracking } from '../lib/utils';
import {
  BankSettings,
  ClientRecord,
  FIELD_LIMITS,
  NotificationSettings,
  OrderRecord,
} from '../types/domain';
import { syncTelegramPreferencesToServer } from './apiClient';

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

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  telegramNotifyRevision: true,
  telegramNotifyMessage: true,
  telegramNotifyDeadline: true,
  updatedAt: new Date().toISOString(),
};

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
  allOrders: OrderRecord[]
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

  const targetOrders = allOrders.filter((o) => o.orderStatus !== 'cancelled');

  try {
    const firstBatch = writeBatch(db);
    firstBatch.set(doc(db, 'settings', 'bankConfig'), full);
    const firstChunk = targetOrders.slice(0, 449);
    firstChunk.forEach((ord) => {
      firstBatch.set(
        doc(db, 'trackingPortals', ord.orderCode),
        sanitizeOrderForTracking(ord, full)
      );
    });
    await firstBatch.commit();

    for (let i = 449; i < targetOrders.length; i += 450) {
      const batch = writeBatch(db);
      targetOrders.slice(i, i + 450).forEach((ord) => {
        batch.set(
          doc(db, 'trackingPortals', ord.orderCode),
          sanitizeOrderForTracking(ord, full)
        );
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/bankConfig');
  }
}

export function subscribeNotificationSettings(
  onData: (settings: NotificationSettings) => void
): () => void {
  const ref = doc(db, 'settings', 'notifications');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as NotificationSettings);
      } else {
        onData(DEFAULT_NOTIFICATION_SETTINGS);
      }
    },
    (error) => handleFirestoreError(error, OperationType.GET, 'settings/notifications')
  );
}

export async function saveNotificationSettings(
  settings: Omit<NotificationSettings, 'updatedAt'>
): Promise<void> {
  const payload: NotificationSettings = {
    telegramNotifyRevision: Boolean(settings.telegramNotifyRevision),
    telegramNotifyMessage: Boolean(settings.telegramNotifyMessage),
    telegramNotifyDeadline: Boolean(settings.telegramNotifyDeadline),
    updatedAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'settings', 'notifications'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/notifications');
  }

  await syncTelegramPreferencesToServer({
    telegramNotifyRevision: payload.telegramNotifyRevision,
    telegramNotifyMessage: payload.telegramNotifyMessage,
    telegramNotifyDeadline: payload.telegramNotifyDeadline,
  });
}
