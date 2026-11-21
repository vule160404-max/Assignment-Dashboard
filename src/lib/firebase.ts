import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Pass firestoreDatabaseId from firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : 'Database access error',
    operationType,
    path,
  };
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Purges any sensitive admin, writer, or client workspace caches from browser storage
 * so nothing remains inspectable via DevTools LocalStorage / SessionStorage.
 */
export function clearAllSensitiveBrowserStorage(): void {
  if (typeof window === 'undefined') return;
  const sensitiveKeys = [
    'assigntrack_ai_writer_settings_v1',
    'assigntrack_ai_skill_library_v1',
    'assigntrack_ai_writer_sessions_v1',
    'assigntrack_ai_writer_active_session_v1',
    'assigntrack_ai_writer_left_tab_v1',
    'assigntrack_humanizer_checkpoints_v2',
    'assigntrack_hix_checkpoints_v1',
    'assigntrack_admin_active_tab_v1',
    'assigntrack_telegram_deadline_alerts_v1',
  ];
  try {
    for (const k of sensitiveKeys) {
      window.localStorage.removeItem(k);
      window.sessionStorage.removeItem(k);
    }
  } catch {
    // ignore storage restrictions
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (client offline).');
      return false;
    }
    return true;
  }
}

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTH_PROVIDERS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

export function mapFirebaseAuthError(error: unknown): {
  message: string;
  isProviderDisabled: boolean;
} {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  if (code === 'auth/operation-not-allowed') {
    return {
      message:
        'Phương thức xác thực Email/Mật khẩu hiện chưa được bật trên dự án Firebase. Vui lòng mở Firebase Console → Authentication → Sign-in method → bật "Email/Password" rồi thử lại.',
      isProviderDisabled: true,
    };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return {
      message: 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.',
      isProviderDisabled: false,
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      message: 'Email này đã có tài khoản trên hệ thống. Vui lòng chuyển sang tab Đăng nhập.',
      isProviderDisabled: false,
    };
  }
  if (code === 'auth/weak-password') {
    return {
      message: 'Mật khẩu quá yếu (cần tối thiểu 6 ký tự).',
      isProviderDisabled: false,
    };
  }
  if (code === 'auth/invalid-email') {
    return {
      message: 'Địa chỉ email không đúng định dạng.',
      isProviderDisabled: false,
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      message: 'Thử quá nhiều lần liên tiếp. Vui lòng đợi ít phút rồi thử lại.',
      isProviderDisabled: false,
    };
  }
  return {
    message: error instanceof Error ? error.message : 'Xác thực thất bại. Vui lòng thử lại.',
    isProviderDisabled: false,
  };
}
