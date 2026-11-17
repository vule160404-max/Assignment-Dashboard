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
import { User } from 'firebase/auth';
import {
  ADMIN_EMAIL,
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { normalizeOrderCode, sanitizeOrderForTracking } from '../lib/utils';
import {
  AccountStatus,
  AttachmentCategory,
  BankSettings,
  CHAT_TTL_MS,
  ClientRecord,
  FIELD_LIMITS,
  OrderMessage,
  OrderRecord,
  RevisionRequest,
  TeamInvite,
  TrackingPortalRecord,
  UserProfile,
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

export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Phiên đăng nhập Admin đã hết hạn. Vui lòng đăng nhập lại.');
  }
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// --- Express File Storage Helpers ---
export async function uploadFileToServer(
  file: File,
  options: {
    isLocked?: boolean;
    category?: AttachmentCategory;
    previewMaxPages?: number;
    turnitinScorePage?: number;
  } = {}
): Promise<{
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}> {
  const authHeaders = await getAdminAuthHeaders();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('isLocked', String(Boolean(options.isLocked)));
  if (options.category) formData.append('category', options.category);
  if (options.previewMaxPages !== undefined) {
    formData.append('previewMaxPages', String(options.previewMaxPages));
  }
  if (options.turnitinScorePage !== undefined) {
    formData.append('turnitinScorePage', String(options.turnitinScorePage));
  }

  const res = await fetch('/api/files/upload', {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  });

  if (res.status === 413 && file.size <= 25 * 1024 * 1024) {
    // Fallback for serverless payload limits (>4.5 MB): direct presigned PUT to Cloudflare R2
    const presignRes = await fetch('/api/files/presign-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        isLocked: Boolean(options.isLocked),
        category: options.category || 'brief',
        previewMaxPages: options.previewMaxPages,
        turnitinScorePage: options.turnitinScorePage,
      }),
    });

    if (presignRes.ok) {
      const presigned = (await presignRes.json()) as {
        uploadUrl: string;
        fileId: string;
        storedName: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
      };

      const putRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': presigned.mimeType },
        body: file,
      }).catch(() => null);

      if (!putRes || !putRes.ok) {
        throw new Error(
          'Tệp > 4.5 MB không thể tải trực tiếp lên Cloudflare R2 (kiểm tra lại CORS trên Bucket R2 hoặc nén tệp ≤ 4 MB).'
        );
      }

      const confirmRes = await fetch('/api/files/confirm-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          fileId: presigned.fileId,
          storedName: presigned.storedName,
          fileName: presigned.fileName,
          mimeType: presigned.mimeType,
          sizeBytes: presigned.sizeBytes,
          isLocked: Boolean(options.isLocked),
          category: options.category || 'brief',
          previewMaxPages: options.previewMaxPages,
          turnitinScorePage: options.turnitinScorePage,
        }),
      });

      if (!confirmRes.ok) {
        const err = await confirmRes
          .json()
          .catch(() => ({ error: 'Xác nhận tải tệp lên Cloudflare R2 thất bại.' }));
        throw new Error(err.error || 'Xác nhận tải tệp lên Cloudflare R2 thất bại.');
      }

      return confirmRes.json();
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Tải tệp lên thất bại.' }));
    throw new Error(err.error || 'Tải tệp lên thất bại.');
  }
  return res.json();
}

export async function syncServerFileLock(
  fileIdOrUrl: string,
  params: {
    isLocked: boolean;
    category?: AttachmentCategory;
    previewMaxPages?: number;
    turnitinScorePage?: number;
  }
): Promise<void> {
  if (!fileIdOrUrl.startsWith('/api/files/')) return;
  const fileId = fileIdOrUrl.replace('/api/files/', '').split('?')[0];
  if (!fileId) return;

  const authHeaders = await getAdminAuthHeaders();
  const res = await fetch(`/api/files/${encodeURIComponent(fileId)}/lock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({ error: 'Không thể đồng bộ khóa tệp.' }));
    throw new Error(err.error || 'Không thể đồng bộ khóa tệp.');
  }
}

export async function deleteServerFile(fileIdOrUrl: string): Promise<void> {
  if (!fileIdOrUrl.startsWith('/api/files/')) return;
  const fileId = fileIdOrUrl.replace('/api/files/', '').split('?')[0];
  if (!fileId) return;

  const authHeaders = await getAdminAuthHeaders();
  const res = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({ error: 'Không thể xóa tệp trên máy chủ.' }));
    throw new Error(err.error || 'Không thể xóa tệp trên máy chủ.');
  }
}

// --- Batch Helper (Firestore limit: 500 ops per batch) ---
async function commitDeletesInChunks(refs: DocumentReference[]): Promise<void> {
  const CHUNK_SIZE = 450;
  for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
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

const LEGACY_REMOVED_EMAIL = 'cycloneielts@gmail.com';

async function purgeLegacyRemovedAccount(currentUid: string): Promise<void> {
  try {
    const legacySnap = await getDocs(
      query(collection(db, 'users'), where('email', '==', LEGACY_REMOVED_EMAIL))
    );
    await Promise.all(
      legacySnap.docs
        .filter((d) => d.id !== currentUid)
        .map((d) => deleteDoc(doc(db, 'users', d.id)))
    );
  } catch {
    // Ignore if non-admin or already purged
  }
}

// --- User Profiles, Auth Roles & Team Invites ---
export async function ensureOwnerOrReadProfile(user: User): Promise<UserProfile | null> {
  const path = `users/${user.uid}`;
  try {
    const email = (user.email || '').trim().toLowerCase();
    if (email === LEGACY_REMOVED_EMAIL) {
      return null;
    }

    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const existing = snap.data() as UserProfile;
      if (email === ADMIN_EMAIL.toLowerCase()) {
        await purgeLegacyRemovedAccount(user.uid);
        if (existing.role !== 'owner' || existing.status !== 'active') {
          const updatedOwner: UserProfile = {
            ...existing,
            role: 'owner',
            status: 'active',
            updatedAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', user.uid), updatedOwner);
          return updatedOwner;
        }
      }
      return existing;
    }

    if (email && email === ADMIN_EMAIL.toLowerCase()) {
      const now = new Date().toISOString();
      const ownerProfile: UserProfile = {
        uid: user.uid,
        email: email.slice(0, FIELD_LIMITS.emailMax),
        displayName: (user.displayName || 'Chủ hệ thống').trim().slice(0, FIELD_LIMITS.displayNameMax),
        role: 'owner',
        status: 'active',
        specialty: 'Quản trị hệ thống',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'users', user.uid), ownerProfile);
      await purgeLegacyRemovedAccount(user.uid);
      return ownerProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void
): () => void {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export async function registerClientProfile(
  user: User,
  displayName?: string,
  phoneNumber?: string
): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  try {
    const existingSnap = await getDoc(doc(db, 'users', user.uid));
    if (existingSnap.exists()) {
      return existingSnap.data() as UserProfile;
    }

    const email = (user.email || '').trim().toLowerCase();
    const isBootOwner = email === ADMIN_EMAIL.toLowerCase();
    const now = new Date().toISOString();
    const resolvedName =
      (displayName || user.displayName || email.split('@')[0] || 'Khách hàng')
        .trim()
        .slice(0, FIELD_LIMITS.displayNameMax) || 'Khách hàng';
    const resolvedPhone = (phoneNumber || '').trim().slice(0, FIELD_LIMITS.phoneMax);

    const profile: UserProfile = {
      uid: user.uid,
      email: email.slice(0, FIELD_LIMITS.emailMax),
      displayName: resolvedName,
      phoneNumber: resolvedPhone,
      role: isBootOwner ? 'owner' : 'client',
      status: 'active',
      savedOrderCodes: [],
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'users', user.uid), profile);
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveClientOrderBookmark(
  uid: string,
  currentCodes: string[] | undefined,
  orderCode: string
): Promise<void> {
  const normalized = normalizeOrderCode(orderCode);
  if (!normalized) return;
  const existing = currentCodes || [];
  if (existing.includes(normalized)) return;
  const nextCodes = [normalized, ...existing].slice(0, FIELD_LIMITS.savedOrdersMax);
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      savedOrderCodes: nextCodes,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeClientOrderBookmark(
  uid: string,
  currentCodes: string[] | undefined,
  orderCode: string
): Promise<void> {
  const normalized = normalizeOrderCode(orderCode);
  const nextCodes = (currentCodes || []).filter((c) => c !== normalized);
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      savedOrderCodes: nextCodes,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function findPendingInvitesForEmail(email: string): Promise<TeamInvite[]> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return [];
  try {
    const q = query(collection(db, 'teamInvites'), where('email', '==', normalizedEmail));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as TeamInvite)
      .filter((inv) => inv.status === 'pending');
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'teamInvites');
  }
}

export async function verifyTeamInviteBeforeSignup(params: {
  inviteCode: string;
  email: string;
}): Promise<TeamInvite> {
  const code = normalizeOrderCode(params.inviteCode).slice(0, FIELD_LIMITS.inviteCodeMax);
  if (!code || code.length < 4) {
    throw new Error('Vui lòng nhập Mã mời hợp lệ (ví dụ: TEAM-8F3K9A).');
  }
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Vui lòng nhập đúng địa chỉ Email được Admin mời.');
  }

  let inviteSnap;
  try {
    inviteSnap = await getDoc(doc(db, 'teamInvites', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `teamInvites/${code}`);
  }

  if (!inviteSnap.exists()) {
    throw new Error(`Mã mời #${code} không tồn tại trên hệ thống. Vui lòng kiểm tra lại với Admin.`);
  }

  const invite = inviteSnap.data() as TeamInvite;
  if (invite.status !== 'pending') {
    throw new Error(`Mã mời #${code} đã được sử dụng trước đó hoặc đã bị Admin thu hồi.`);
  }

  if (invite.email.trim().toLowerCase() !== normalizedEmail) {
    throw new Error(
      `Email "${normalizedEmail}" không khớp với email được Admin mời cho mã #${code}. Chỉ đúng email được mời mới có thể đăng ký.`
    );
  }

  return invite;
}

export async function acceptTeamInviteAndCreateProfile(params: {
  user: User;
  inviteCode: string;
  displayName?: string;
  phoneNumber?: string;
  specialty?: string;
}): Promise<UserProfile> {
  const { user } = params;
  const code = normalizeOrderCode(params.inviteCode).slice(0, FIELD_LIMITS.inviteCodeMax);
  if (!code || code.length < 4) {
    throw new Error('Mã mời không hợp lệ.');
  }

  const userEmail = (user.email || '').trim().toLowerCase();
  const userSnap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  if (userSnap && userSnap.exists()) {
    const existingProfile = userSnap.data() as UserProfile;
    if (
      existingProfile.role === 'owner' ||
      existingProfile.role === 'admin' ||
      existingProfile.role === 'staff'
    ) {
      return existingProfile;
    }
    throw new Error(
      'Tài khoản này đang có hồ sơ Khách hàng. Vui lòng nhờ Admin nâng cấp vai trò trong mục Nhân sự & Phân quyền.'
    );
  }

  const invite = await verifyTeamInviteBeforeSignup({
    inviteCode: code,
    email: userEmail,
  });

  const now = new Date().toISOString();
  const resolvedName =
    (params.displayName || user.displayName || invite.displayName || userEmail.split('@')[0])
      .trim()
      .slice(0, FIELD_LIMITS.displayNameMax) || invite.displayName;
  const resolvedPhone = (params.phoneNumber ?? invite.phoneNumber ?? '')
    .trim()
    .slice(0, FIELD_LIMITS.phoneMax);
  const resolvedSpecialty = (params.specialty ?? invite.specialty ?? '')
    .trim()
    .slice(0, FIELD_LIMITS.specialtyMax);

  const profile: UserProfile = {
    uid: user.uid,
    email: userEmail.slice(0, FIELD_LIMITS.emailMax),
    displayName: resolvedName,
    phoneNumber: resolvedPhone,
    role: invite.role,
    status: 'active',
    specialty: resolvedSpecialty,
    inviteId: code,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'teamInvites', code), {
      status: 'accepted',
      acceptedByUid: user.uid,
      updatedAt: now,
    });
    batch.set(doc(db, 'users', user.uid), profile);
    await batch.commit();
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `teamInvites/${code}`);
  }
}

export function subscribeAllUsersAdmin(onData: (users: UserProfile[]) => void): () => void {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const validUsers: UserProfile[] = [];
      for (const d of snap.docs) {
        const data = d.data() as UserProfile;
        if ((data.email || '').trim().toLowerCase() === LEGACY_REMOVED_EMAIL) {
          if (auth.currentUser?.uid && auth.currentUser.uid !== d.id) {
            deleteDoc(doc(db, 'users', d.id)).catch(() => undefined);
          }
          continue;
        }
        validUsers.push(data);
      }
      onData(validUsers);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'users')
  );
}

export async function deleteUserProfileAdmin(uid: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeTeamInvitesAdmin(onData: (invites: TeamInvite[]) => void): () => void {
  const q = query(collection(db, 'teamInvites'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as TeamInvite));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'teamInvites')
  );
}

export function generateTeamInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 6; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `TEAM-${suffix}`;
}

export async function createTeamInvite(params: {
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: 'admin' | 'staff';
  specialty?: string;
  createdByUid: string;
}): Promise<TeamInvite> {
  const inviteCode = generateTeamInviteCode();
  const now = new Date().toISOString();
  const invite: TeamInvite = {
    inviteCode,
    email: params.email.trim().toLowerCase().slice(0, FIELD_LIMITS.emailMax),
    displayName: params.displayName.trim().slice(0, FIELD_LIMITS.displayNameMax),
    phoneNumber: (params.phoneNumber || '').trim().slice(0, FIELD_LIMITS.phoneMax),
    role: params.role,
    specialty: (params.specialty || '').trim().slice(0, FIELD_LIMITS.specialtyMax),
    status: 'pending',
    createdByUid: params.createdByUid,
    createdAt: now,
    updatedAt: now,
  };
  const path = `teamInvites/${inviteCode}`;
  try {
    await setDoc(doc(db, 'teamInvites', inviteCode), invite);
    return invite;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeTeamInvite(inviteCode: string): Promise<void> {
  const path = `teamInvites/${inviteCode}`;
  try {
    await updateDoc(doc(db, 'teamInvites', inviteCode), {
      status: 'revoked',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTeamMemberProfile(params: {
  uid: string;
  role: UserProfile['role'];
  status: AccountStatus;
  displayName: string;
  phoneNumber?: string;
  specialty?: string;
}): Promise<void> {
  const path = `users/${params.uid}`;
  try {
    await updateDoc(doc(db, 'users', params.uid), {
      role: params.role,
      status: params.status,
      displayName: params.displayName.trim().slice(0, FIELD_LIMITS.displayNameMax),
      phoneNumber: (params.phoneNumber || '').trim().slice(0, FIELD_LIMITS.phoneMax),
      specialty: (params.specialty || '').trim().slice(0, FIELD_LIMITS.specialtyMax),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Orders & Tracking Portal Sync ---
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

  // Sync Express file lock & page-window metadata before persisting
  await Promise.all(
    orderInput.attachments.map((att) =>
      syncServerFileLock(att.fileIdOrUrl, {
        isLocked: att.sourceType === 'upload' && att.isPaymentLocked && !isFullyPaid,
        category: att.category,
        previewMaxPages: att.previewMaxPages,
        turnitinScorePage: att.turnitinScorePage,
      })
    )
  );

  const trimmedAttachments = orderInput.attachments.slice(0, FIELD_LIMITS.attachmentsMax);

  if (editorRole === 'staff') {
    if (!existingId) {
      throw new Error('Nhân sự không có quyền tạo đơn hàng mới.');
    }
    const staffOrderUpdate = {
      stage: orderInput.stage,
      progressPercent: Math.min(100, Math.max(0, Math.round(orderInput.progressPercent))),
      publicStatusNote: (orderInput.publicStatusNote || '').slice(0, FIELD_LIMITS.publicNoteMax),
      internalNotes: (orderInput.internalNotes || '').slice(0, FIELD_LIMITS.internalNoteMax),
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
      return id;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
    }
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
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, `orders/${id}`);
  }
}

export async function deleteOrder(order: OrderRecord): Promise<void> {
  const uploadedAttachments = (order.attachments || []).filter(
    (att) => att.sourceType === 'upload' && att.fileIdOrUrl.startsWith('/api/files/')
  );

  // Best-effort cleanup of uploaded files on disk
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
