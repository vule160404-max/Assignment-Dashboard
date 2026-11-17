import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { CheckCircle2, X } from 'lucide-react';
import { AdminPortalView } from './components/admin/AdminPortalView';
import { ClientPortalView } from './components/client/ClientPortalView';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { RoleSelectionGate } from './components/shared/RoleSelectionGate';
import { auth, testConnection } from './lib/firebase';
import { normalizeOrderCode } from './lib/utils';
import {
  ensureOwnerOrReadProfile,
  subscribeUserProfile,
} from './services/firestoreService';
import { UserProfile } from './types/domain';

const REMOVED_LEGACY_EMAIL = 'cycloneielts@gmail.com';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const initialCodeParam = new URLSearchParams(window.location.search).get('code') || '';
  const [mode, setMode] = useState<'select' | 'admin' | 'client'>(() =>
    initialCodeParam ? 'client' : 'select'
  );
  const [clientInitialCode, setClientInitialCode] = useState(() =>
    normalizeOrderCode(initialCodeParam)
  );

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && (u.email || '').trim().toLowerCase() === REMOVED_LEGACY_EMAIL) {
        signOut(auth).catch(() => undefined);
        setUser(null);
        setAuthReady(true);
        return;
      }
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const refreshProfile = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setUserProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
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
  }, [authReady, user]);

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

  const handleSwitchToClient = (orderCode?: string) => {
    setClientInitialCode(orderCode ? normalizeOrderCode(orderCode) : '');
    setMode('client');
  };

  const handleSwitchToAdmin = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.toString());
    setMode('admin');
  };

  const handleBackToRoleSelect = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.toString());
    setClientInitialCode('');
    setMode('select');
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
