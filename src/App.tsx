import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { CheckCircle2, X } from 'lucide-react';
import { AdminPortalView } from './components/admin/AdminPortalView';
import { ClientPortalView } from './components/client/ClientPortalView';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { RoleSelectionGate } from './components/shared/RoleSelectionGate';
import {
  auth,
  clearAllSensitiveBrowserStorage,
  testConnection,
} from './lib/firebase';
import { normalizeOrderCode } from './lib/utils';
import {
  ensureOwnerOrReadProfile,
  subscribeUserProfile,
} from './services/firestoreService';
import { UserProfile } from './types/domain';

const PORTAL_MODE_STORAGE_KEY = 'assigntrack_portal_mode_v1';

function resolveInitialPortalMode(): 'select' | 'admin' | 'client' {
  const params = new URLSearchParams(window.location.search);
  if (params.get('code')) return 'client';
  const urlPortal = params.get('portal');
  if (urlPortal === 'admin' || urlPortal === 'client' || urlPortal === 'select') {
    return urlPortal;
  }
  try {
    const saved = localStorage.getItem(PORTAL_MODE_STORAGE_KEY);
    if (saved === 'admin' || saved === 'client') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'select';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const initialCodeParam = new URLSearchParams(window.location.search).get('code') || '';
  const [mode, setMode] = useState<'select' | 'admin' | 'client'>(
    resolveInitialPortalMode
  );
  const [clientInitialCode, setClientInitialCode] = useState(() =>
    normalizeOrderCode(initialCodeParam)
  );

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        clearAllSensitiveBrowserStorage();
      }
      setUser(u);
      setEmailVerified(Boolean(u?.emailVerified));
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const refreshProfile = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setUserProfile(null);
      setEmailVerified(false);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      await current.reload().catch(() => undefined);
      await current.getIdToken(true).catch(() => undefined);
      setEmailVerified(Boolean(current.emailVerified));
      const prof = await ensureOwnerOrReadProfile(current);
      setUserProfile(prof);
    } catch {
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setUserProfile(null);
      setEmailVerified(false);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);

    ensureOwnerOrReadProfile(user)
      .then((prof) => {
        if (!cancelled) {
          setUserProfile(prof);
          setProfileLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUserProfile(null);
          setProfileLoading(false);
        }
      });

    const unsubProfile = subscribeUserProfile(user.uid, (prof) => {
      if (!cancelled) {
        setUserProfile(prof);
        setProfileLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubProfile();
    };
  }, [authReady, user, emailVerified]);

  // Update countdowns every 15 seconds
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const persistPortalMode = useCallback((nextMode: 'select' | 'admin' | 'client') => {
    try {
      localStorage.setItem(PORTAL_MODE_STORAGE_KEY, nextMode);
    } catch {
      // ignore
    }
    const url = new URL(window.location.href);
    if (nextMode === 'select') {
      url.searchParams.delete('portal');
      url.searchParams.delete('tab');
      url.searchParams.delete('code');
    } else {
      url.searchParams.set('portal', nextMode);
      if (nextMode === 'client') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.delete('code');
      }
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  const handleSwitchToClient = (orderCode?: string) => {
    const normalized = orderCode ? normalizeOrderCode(orderCode) : '';
    setClientInitialCode(normalized);
    setMode('client');
    persistPortalMode('client');
    if (normalized) {
      const url = new URL(window.location.href);
      url.searchParams.set('code', normalized);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleSwitchToAdmin = () => {
    setMode('admin');
    persistPortalMode('admin');
  };

  const handleBackToRoleSelect = () => {
    setClientInitialCode('');
    setMode('select');
    persistPortalMode('select');
  };

  let activeContent = (
    <RoleSelectionGate
      onSelectClient={() => handleSwitchToClient()}
      onSelectAdmin={handleSwitchToAdmin}
    />
  );

  if (mode === 'client') {
    activeContent = (
      <ClientPortalView
        user={user}
        userProfile={userProfile}
        authReady={authReady}
        initialOrderCode={clientInitialCode}
        nowMs={nowMs}
        onSwitchToAdmin={handleSwitchToAdmin}
        onBackToRoleSelect={handleBackToRoleSelect}
        onToast={showToast}
      />
    );
  } else if (mode === 'admin') {
    activeContent = (
      <AdminPortalView
        user={user}
        emailVerified={emailVerified}
        userProfile={userProfile}
        profileLoading={profileLoading}
        authReady={authReady}
        nowMs={nowMs}
        onSwitchToClientPortal={handleSwitchToClient}
        onBackToRoleSelect={handleBackToRoleSelect}
        onRefreshProfile={refreshProfile}
        onToast={showToast}
      />
    );
  }

  return (
    <ErrorBoundary>
      {activeContent}

      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="toast-enter fixed bottom-5 right-5 z-50 max-w-sm bg-[#0F172A] text-white text-xs font-medium pl-3.5 pr-2.5 py-2.5 rounded-xl border border-slate-800 shadow-[0_8px_28px_rgb(15,23,42,0.2)] flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Đóng thông báo"
            className="btn-press p-1 text-slate-400 hover:text-white rounded-md shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </ErrorBoundary>
  );
}
