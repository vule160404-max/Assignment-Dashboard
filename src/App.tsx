import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { CheckCircle2, X } from 'lucide-react';
import { AdminPortalView } from './components/admin/AdminPortalView';
import {
  ClientPortalTab,
  ClientPortalView,
} from './components/client/ClientPortalView';
import { QuickOrderModal } from './components/client/QuickOrderModal';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { FloatingSupportDock } from './components/shared/FloatingSupportDock';
import {
  ClientPortalLaunchOptions,
  RoleSelectionGate,
} from './components/shared/RoleSelectionGate';
import {
  auth,
  clearAllSensitiveBrowserStorage,
  testConnection,
} from './lib/firebase';
import {
  parseSampleRouteFromLocation,
  type OrderPrefillData,
} from './lib/sampleSeo';
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
  // Always honor direct SEO landings (/samples, /samples/<slug>, /uni/<school>, ?sample=...)
  if (parseSampleRouteFromLocation(window.location).isSamplesRoute) {
    return 'select';
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
  const [clientInitialTab, setClientInitialTab] = useState<ClientPortalTab>('lookup');
  const [clientInitialServiceType, setClientInitialServiceType] = useState<string | undefined>(undefined);
  const [roleGatePage, setRoleGatePage] = useState<'home' | 'samples'>(() =>
    parseSampleRouteFromLocation(window.location).isSamplesRoute ? 'samples' : 'home'
  );
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [quickOrderServiceType, setQuickOrderServiceType] = useState<string | undefined>(undefined);
  const [quickOrderPrefill, setQuickOrderPrefill] = useState<OrderPrefillData | undefined>(undefined);

  const isAdminSession = Boolean(
    user &&
      emailVerified &&
      userProfile &&
      (userProfile.role === 'owner' || userProfile.role === 'admin')
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

  // Support native browser Back / Forward button across public, SEO & client views
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code') || '';
      const portalParam = params.get('portal');
      const tabParam = params.get('tab');
      const sampleRoute = parseSampleRouteFromLocation(window.location);

      setQuickOrderOpen(false);

      if (code) {
        setClientInitialCode(normalizeOrderCode(code));
        setClientInitialTab('lookup');
        setMode('client');
        return;
      }

      if (portalParam === 'admin') {
        setMode('admin');
        return;
      }

      if (portalParam === 'client') {
        setClientInitialCode('');
        if (tabParam === 'order' || tabParam === 'lookup' || tabParam === 'checker') {
          setClientInitialTab(tabParam);
        }
        setMode('client');
        return;
      }

      setClientInitialCode('');
      setRoleGatePage(sampleRoute.isSamplesRoute ? 'samples' : 'home');
      setMode('select');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const persistPortalMode = useCallback(
    (
      nextMode: 'select' | 'admin' | 'client',
      extraParams?: { tab?: ClientPortalTab; code?: string; page?: 'home' | 'samples' }
    ) => {
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
        url.searchParams.delete('page');
        url.searchParams.delete('sample');
        url.searchParams.delete('uni');
        url.pathname = extraParams?.page === 'samples' ? '/samples' : '/';
      } else {
        url.pathname = '/';
        url.searchParams.set('portal', nextMode);
        url.searchParams.delete('page');
        url.searchParams.delete('sample');
        url.searchParams.delete('uni');
        if (nextMode === 'client') {
          if (extraParams?.code) {
            url.searchParams.set('code', extraParams.code);
            url.searchParams.delete('tab');
          } else {
            url.searchParams.delete('code');
            if (extraParams?.tab) {
              url.searchParams.set('tab', extraParams.tab);
            }
          }
        } else {
          url.searchParams.delete('code');
          url.searchParams.delete('tab');
        }
      }
      window.history.pushState({}, '', url.toString());
    },
    []
  );

  const openQuickOrderModal = (
    serviceType?: string,
    orderPrefill?: OrderPrefillData
  ) => {
    setQuickOrderServiceType(serviceType);
    setQuickOrderPrefill(orderPrefill);
    setQuickOrderOpen(true);
  };

  const handleSwitchToClient = (
    orderCode?: string,
    options?: ClientPortalLaunchOptions
  ) => {
    const normalized = orderCode ? normalizeOrderCode(orderCode) : '';

    // Opening "Đặt bài mới" / "ORDER NOW" opens the lightweight QuickOrderModal
    // so the user stays right on their current page and closes with 1 click / ESC.
    if (!normalized && (!options?.tab || options.tab === 'order')) {
      openQuickOrderModal(options?.serviceType, options?.orderPrefill);
      return;
    }

    setQuickOrderOpen(false);
    setClientInitialCode(normalized);
    const nextTab: ClientPortalTab = normalized
      ? 'lookup'
      : options?.tab || 'lookup';
    setClientInitialTab(nextTab);
    setClientInitialServiceType(options?.serviceType);
    setMode('client');
    persistPortalMode('client', {
      code: normalized || undefined,
      tab: normalized ? undefined : nextTab,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSwitchToAdmin = () => {
    setQuickOrderOpen(false);
    setMode('admin');
    persistPortalMode('admin');
  };

  const handleBackToRoleSelect = (page: 'home' | 'samples' = 'home') => {
    setQuickOrderOpen(false);
    setClientInitialCode('');
    setRoleGatePage(page);
    setMode('select');
    persistPortalMode('select', { page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  let activeContent = (
    <RoleSelectionGate
      key={`role-gate-${roleGatePage}`}
      initialPage={roleGatePage}
      isAdmin={isAdminSession}
      onPageChange={(page) => {
        setRoleGatePage(page);
        persistPortalMode('select', { page });
      }}
      onSelectClient={(options) => handleSwitchToClient(undefined, options)}
      onSelectAdmin={handleSwitchToAdmin}
    />
  );

  if (mode === 'client') {
    activeContent = (
      <ClientPortalView
        initialOrderCode={clientInitialCode}
        initialTab={clientInitialTab}
        initialServiceType={clientInitialServiceType}
        nowMs={nowMs}
        onSwitchToAdmin={handleSwitchToAdmin}
        onBackToRoleSelect={() => handleBackToRoleSelect('home')}
        onOpenSamples={() => handleBackToRoleSelect('samples')}
        onOpenOrderModal={(svc) => openQuickOrderModal(svc, undefined)}
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
        onSwitchToClientPortal={(code) => handleSwitchToClient(code)}
        onBackToRoleSelect={() => handleBackToRoleSelect('home')}
        onRefreshProfile={refreshProfile}
        onToast={showToast}
      />
    );
  }

  return (
    <ErrorBoundary>
      {activeContent}
      {mode !== 'admin' && <FloatingSupportDock />}
      {mode !== 'admin' && (
        <QuickOrderModal
          isOpen={quickOrderOpen}
          defaultServiceType={quickOrderServiceType}
          orderPrefill={quickOrderPrefill}
          onClose={() => setQuickOrderOpen(false)}
          onGoToLookup={() => handleSwitchToClient(undefined, { tab: 'lookup' })}
          onToast={showToast}
        />
      )}

      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="toast-enter fixed bottom-5 right-5 z-[120] max-w-sm bg-[#0F172A] text-white text-xs font-medium pl-3.5 pr-2.5 py-2.5 rounded-xl border border-slate-800 shadow-[0_8px_28px_rgb(15,23,42,0.2)] flex items-center gap-2.5"
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
