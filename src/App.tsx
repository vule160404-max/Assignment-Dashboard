import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { AdminPortalView } from './components/AdminPortalView';
import { ClientPortalView } from './components/ClientPortalView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { auth, testConnection } from './lib/firebase';
import { normalizeOrderCode } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState('');

  const initialCodeParam = new URLSearchParams(window.location.search).get('code') || '';
  const [mode, setMode] = useState<'admin' | 'client'>(() =>
    initialCodeParam ? 'client' : 'admin'
  );
  const [clientInitialCode, setClientInitialCode] = useState(() =>
    normalizeOrderCode(initialCodeParam)
  );

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Update countdowns every 15 seconds
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3000);
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

  return (
    <ErrorBoundary>
      {mode === 'client' ? (
        <ClientPortalView
          initialOrderCode={clientInitialCode}
          nowMs={nowMs}
          onSwitchToAdmin={handleSwitchToAdmin}
          onToast={showToast}
        />
      ) : (
        <AdminPortalView
          user={user}
          authReady={authReady}
          nowMs={nowMs}
          onSwitchToClientPortal={handleSwitchToClient}
          onToast={showToast}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 bg-[#0F172A] text-white text-xs font-medium px-4 py-2.5 rounded-lg border border-slate-700 shadow-lg"
        >
          {toast}
        </div>
      )}
    </ErrorBoundary>
  );
}
