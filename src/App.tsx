import { useCallback, useEffect, useRef, useState } from 'react';
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
  PortalMode,
  buildPortalUrl,
  parseAppRoute,
} from './lib/routes';
import { type OrderPrefillData } from './lib/sampleSeo';
import { normalizeOrderCode } from './lib/utils';
import {
  ensureOwnerOrReadProfile,
  subscribeUserProfile,
} from './services/firestoreService';
import { UserProfile } from './types/domain';

const PORTAL_MODE_STORAGE_KEY = 'assigntrack_portal_mode_v1';

function resolveInitialPortalState(): {
  mode: PortalMode;
  rolePage: 'home' | 'samples';
  clientTab: ClientPortalTab;
  orderCode: string;
} {
  const parsed = parseAppRoute(window.location);
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const hasExplicitRoute =
    pathname !== '/' || window.location.search.length > 0;

  if (hasExplicitRoute) {
    return {
      mode: parsed.mode,
      rolePage: parsed.rolePage,
      clientTab: parsed.clientTab,
      orderCode: parsed.orderCode,
    };
  }

  try {
    const saved = localStorage.getItem(PORTAL_MODE_STORAGE_KEY);
    if (saved === 'admin' || saved === 'client') {
      return {
        mode: saved,
        rolePage: 'home',
        clientTab: 'lookup',
        orderCode: '',
      };
    }
  } catch {
    // ignore storage errors
  }

  return {
    mode: 'select',
    rolePage: 'home',
    clientTab: 'lookup',
    orderCode: '',
  };
}

export default function App() {
  const [initialRoute] = useState(resolveInitialPortalState);
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  const [mode, setMode] = useState<PortalMode>(initialRoute.mode);
  const [clientInitialCode, setClientInitialCode] = useState(initialRoute.orderCode);
  const [clientInitialTab, setClientInitialTab] = useState<ClientPortalTab>(
    initialRoute.clientTab
  );
  const [clientInitialServiceType, setClientInitialServiceType] = useState<string | undefined>(undefined);
  const [roleGatePage, setRoleGatePage] = useState<'home' | 'samples'>(
    initialRoute.rolePage
  );
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [quickOrderServiceType, setQuickOrderServiceType] = useState<string | undefined>(undefined);
  const [quickOrderPrefill, setQuickOrderPrefill] = useState<OrderPrefillData | undefined>(undefined);
  const quickOrderReturnUrlRef = useRef<string>('/');

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

  // Support native browser Back / Forward button across dedicated tab URLs
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseAppRoute(window.location);

      setQuickOrderOpen(false);

      if (parsed.mode === 'admin') {
        setMode('admin');
        return;
      }

      if (parsed.mode === 'client') {
        setClientInitialCode(parsed.orderCode);
        setClientInitialTab(parsed.clientTab);
        setMode('client');
        return;
      }

      setClientInitialCode('');
      setRoleGatePage(parsed.rolePage);
      setMode('select');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const persistPortalMode = useCallback(
    (
      nextMode: PortalMode,
      extraParams?: { tab?: ClientPortalTab; code?: string; page?: 'home' | 'samples' }
    ) => {
      try {
        localStorage.setItem(PORTAL_MODE_STORAGE_KEY, nextMode);
      } catch {
        // ignore
      }
      const nextUrl = buildPortalUrl({
        mode: nextMode,
        page: extraParams?.page,
        clientTab: extraParams?.tab,
        orderCode: extraParams?.code,
      });
      const currentFullUrl = window.location.pathname + window.location.search;
      if (currentFullUrl !== nextUrl) {
        window.history.pushState({}, '', nextUrl);
      }
    },
    []
  );

  const openQuickOrderModal = (
    serviceType?: string,
    orderPrefill?: OrderPrefillData
  ) => {
    const currentPath =
      window.location.pathname + window.location.search + window.location.hash;
    if (window.location.pathname !== '/dat-bai') {
      quickOrderReturnUrlRef.current = currentPath || '/';
      window.history.pushState({ quickOrderModal: true }, '', '/dat-bai');
    }
    setQuickOrderServiceType(serviceType);
    setQuickOrderPrefill(orderPrefill);
    setQuickOrderOpen(true);
  };

  const closeQuickOrderModal = () => {
    setQuickOrderOpen(false);
    if (window.location.pathname === '/dat-bai' && mode === 'select') {
      const fallback = quickOrderReturnUrlRef.current || '/';
      window.history.replaceState(
        {},
        '',
        fallback === '/dat-bai' ? '/' : fallback
      );
    }
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
          onClose={closeQuickOrderModal}
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
