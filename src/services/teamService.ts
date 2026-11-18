import {
  collection,
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
import { normalizeOrderCode } from '../lib/utils';
import {
  AccountStatus,
  FIELD_LIMITS,
  TeamInvite,
  UserProfile,
} from '../types/domain';

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
      if (email === ADMIN_EMAIL.toLowerCase() && user.emailVerified) {
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

    if (email && email === ADMIN_EMAIL.toLowerCase() && user.emailVerified) {
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
    const isBootOwner = email === ADMIN_EMAIL.toLowerCase() && user.emailVerified;
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
