import { useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Home,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  FIREBASE_AUTH_PROVIDERS_URL,
  auth,
  mapFirebaseAuthError,
} from '../../lib/firebase';
import {
  createRevisionRequest,
  fetchTrackingPortalOnce,
  registerClientProfile,
  removeClientOrderBookmark,
  saveClientOrderBookmark,
  subscribeOrderRevisions,
  subscribeTrackingPortal,
} from '../../services/firestoreService';
import {
  formatBytes,
  formatDateTime,
  getSafeExternalUrl,
  getStageMeta,
  isValidOrderCode,
  normalizeOrderCode,
} from '../../lib/utils';
import {
  AttachmentItem,
  FIELD_LIMITS,
  ORDER_STAGES,
  RevisionRequest,
  TrackingPortalRecord,
  UserProfile,
} from '../../types/domain';
import { DeadlineBadge } from '../shared/DeadlineBadge';
import { BrandLogo } from '../shared/BrandLogo';
import { OrderChatPanel } from '../shared/OrderChatPanel';
import { PdfPreviewModal } from '../shared/PdfPreviewModal';
import { ClientIntegrityCheckerView } from './ClientIntegrityCheckerView';
import { ClientIntentHubView } from './ClientIntentHubView';
import {
  ClientLandingSections,
  ClientValuePropCard,
} from './ClientLandingSections';
import { PaymentQrCard } from './PaymentQrCard';

interface ClientPortalViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  authReady?: boolean;
  initialOrderCode?: string;
  nowMs: number;
  onSwitchToAdmin: () => void;
  onBackToRoleSelect?: () => void;
  onToast: (msg: string) => void;
}

const CATEGORY_LABELS: Record<AttachmentItem['category'], string> = {
  brief: 'Đề bài & Tài liệu',
  turnitin: 'Báo cáo Turnitin / AI',
  draft: 'Bản nháp',
  final: 'Bài hoàn chỉnh',
};

export function ClientPortalView({
  user,
  userProfile,
  authReady = true,
  initialOrderCode = '',
  nowMs,
  onSwitchToAdmin,
  onBackToRoleSelect,
  onToast,
}: ClientPortalViewProps) {
  const [codeInput, setCodeInput] = useState(initialOrderCode);
  const [activeCode, setActiveCode] = useState(
    initialOrderCode ? normalizeOrderCode(initialOrderCode) : ''
  );
  const [portal, setPortal] = useState<TrackingPortalRecord | null>(null);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(null);

  // Client home tab state ('hub' | 'lookup' | 'checker' | 'auth')
  const [homeTab, setHomeTabState] = useState<'hub' | 'lookup' | 'checker' | 'auth'>(() => {
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (urlTab === 'hub' || urlTab === 'lookup' || urlTab === 'checker' || urlTab === 'auth') {
      return urlTab;
    }
    return 'hub';
  });

  const setHomeTab = (nextTab: 'hub' | 'lookup' | 'checker' | 'auth') => {
    setHomeTabState(nextTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', nextTab);
    window.history.replaceState({}, '', url.toString());
  };
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [showAuthConfirmPassword, setShowAuthConfirmPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [providerDisabledError, setProviderDisabledError] = useState(false);

  // Revision form state
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionMsg, setRevisionMsg] = useState('');
  const [submittingRev, setSubmittingRev] = useState(false);

  useEffect(() => {
    if (!activeCode || !user) {
      setPortal(null);
      setRevisions([]);
      return;
    }

    setLoading(true);
    setLookupError('');

    const unsubPortal = subscribeTrackingPortal(activeCode, (data) => {
      setPortal(data);
      setLoading(false);
      if (!data) {
        setLookupError(`Không tìm thấy đơn hàng với mã "${activeCode}". Vui lòng kiểm tra lại.`);
      }
    });

    const unsubRevs = subscribeOrderRevisions(activeCode, (list) => {
      setRevisions(list);
    });

    return () => {
      unsubPortal();
      unsubRevs();
    };
  }, [activeCode, user]);

  const openOrderByCode = async (rawCode: string) => {
    if (!user) {
      onToast('Vui lòng đăng nhập tài khoản Khách hàng để tra cứu tiến độ đơn hàng.');
      return;
    }
    const normalized = normalizeOrderCode(rawCode);
    if (!isValidOrderCode(normalized)) {
      setLookupError('Mã đơn hàng không hợp lệ (ví dụ: ASG-2026-001).');
      return;
    }
    setCodeInput(normalized);
    setLoading(true);
    setLookupError('');
    try {
      const found = await fetchTrackingPortalOnce(normalized);
      if (!found) {
        setLookupError(`Không tìm thấy đơn hàng với mã "${normalized}".`);
        setLoading(false);
        return;
      }
      setActiveCode(normalized);
      const url = new URL(window.location.href);
      url.searchParams.set('code', normalized);
      window.history.replaceState({}, '', url.toString());

      if (user && userProfile) {
        saveClientOrderBookmark(user.uid, userProfile.savedOrderCodes, normalized).catch(
          (err) => {
            console.warn('Could not save order bookmark:', err);
          }
        );
      }
    } catch {
      setLookupError('Không thể tra cứu mã đơn lúc này.');
      setLoading(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    await openOrderByCode(codeInput);
  };

  const handleResetLookup = () => {
    setActiveCode('');
    setPortal(null);
    setLookupError('');
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.toString());
  };

  const handleClientEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setProviderDisabledError(false);

    const email = authEmail.trim().toLowerCase();
    if (!email || !authPassword) {
      setAuthError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    if (authMode === 'register') {
      if (!authName.trim()) {
        setAuthError('Vui lòng nhập họ tên hoặc nickname hiển thị của bạn.');
        return;
      }
      if (!authPhone.trim() || authPhone.trim().length < 8) {
        setAuthError('Vui lòng nhập số điện thoại liên hệ hợp lệ.');
        return;
      }
      if (authPassword.length < 6) {
        setAuthError('Mật khẩu cần tối thiểu 6 ký tự.');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        setAuthError('Mật khẩu và Nhập lại mật khẩu không khớp.');
        return;
      }
    }

    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, authPassword);
        await updateProfile(cred.user, { displayName: authName.trim() });
        await registerClientProfile(cred.user, authName.trim(), authPhone.trim());
        if (!activeCode) {
          setHomeTab('hub');
        }
        onToast('Đã đăng ký và đăng nhập tài khoản Khách hàng thành công!');
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, authPassword);
        await registerClientProfile(cred.user);
        if (!activeCode) {
          setHomeTab('hub');
        }
        onToast('Đã đăng nhập tài khoản Khách hàng.');
      }
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      setAuthError(mapped.message);
      setProviderDisabledError(mapped.isProviderDisabled);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = authEmail.trim().toLowerCase();
    if (!email) {
      setAuthError('Nhập email của bạn ở ô bên trên trước khi yêu cầu đặt lại mật khẩu.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    setProviderDisabledError(false);
    try {
      await sendPasswordResetEmail(auth, email);
      onToast(`Đã gửi liên kết đặt lại mật khẩu tới ${email}.`);
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      setAuthError(mapped.message);
      setProviderDisabledError(mapped.isProviderDisabled);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleClientSignOut = async () => {
    try {
      handleResetLookup();
      setHomeTab('hub');
      await signOut(auth);
      onToast('Đã đăng xuất tài khoản Khách hàng.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Đăng xuất thất bại.');
    }
  };

  const handleSubmitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal || !revisionMsg.trim() || submittingRev) return;
    setSubmittingRev(true);
    try {
      await createRevisionRequest(portal.orderCode, revisionMsg.trim());
      setRevisionMsg('');
      setShowRevisionForm(false);
      onToast('Đã gửi yêu cầu chỉnh sửa tới Admin.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gửi yêu cầu thất bại.');
    } finally {
      setSubmittingRev(false);
    }
  };

  const isFullyPaid = portal?.paymentStatus === 'fully_paid';
  const currentStageMeta = portal ? getStageMeta(portal.stage) : null;
  const inputFieldCls =
    'w-full px-3.5 py-2.5 text-sm bg-zinc-50/90 border border-zinc-200 rounded-xl text-slate-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B] transition-colors';

  const displayName =
    userProfile?.displayName || user?.displayName || user?.email || 'Khách hàng';
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || 'K';

  const authGateHeader = (
    <header className="sticky top-0 z-20 sticky-glass border-b border-slate-200/80">
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        <BrandLogo />
        <div className="flex items-center gap-2 shrink-0">
          {onBackToRoleSelect && (
            <button
              type="button"
              onClick={onBackToRoleSelect}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900 bg-zinc-100/90 hover:bg-zinc-200/80 rounded-xl whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Chọn vai trò</span>
            </button>
          )}
          <button
            type="button"
            onClick={onSwitchToAdmin}
            className="btn-press hidden sm:inline-flex items-center px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-slate-800 hover:bg-zinc-100 rounded-lg whitespace-nowrap border-l border-zinc-200/80 ml-0.5 pl-3"
            title="Chuyển sang cổng dành cho Admin / Nhân sự"
          >
            Quản trị
          </button>
        </div>
      </div>
    </header>
  );

  if (!authReady) {
    return (
      <div className="min-h-screen client-ambient-bg text-[#0F172A] flex flex-col">
        {authGateHeader}
        <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-12">
          <div className="surface-enter max-w-sm w-full bg-white border border-slate-200/90 rounded-2xl p-8 text-center shadow-[0_8px_28px_rgb(11,37,89,0.06)] space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              Đang kiểm tra trạng thái đăng nhập...
            </p>
            <p className="text-xs text-zinc-500">Vui lòng chờ trong giây lát.</p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen client-ambient-bg text-[#0F172A] flex flex-col">
        {authGateHeader}
        <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8 sm:py-12">
          <section className="surface-enter relative overflow-hidden max-w-md w-full bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-[0_14px_38px_-14px_rgba(11,37,89,0.14)] space-y-5">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#0B2559] via-[#12489B] to-[#F5B700]"
            />

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#0B2559] text-[11px] font-semibold">
                <Lock className="w-3 h-3 text-[#12489B]" />
                Yêu cầu đăng nhập Khách hàng
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {authMode === 'login'
                  ? 'Đăng nhập tài khoản Khách hàng'
                  : 'Đăng ký tài khoản Khách hàng'}
              </h1>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {activeCode
                  ? `Vui lòng đăng nhập hoặc tạo tài khoản Khách hàng để xem tiến độ đơn #${activeCode} và sử dụng các dịch vụ của AssignTrack.`
                  : 'Vui lòng đăng nhập hoặc tạo tài khoản Khách hàng để nhận tư vấn, check đạo văn – AI và kiểm tra tiến độ bài làm.'}
              </p>
            </div>

            {/* Auth Mode Sub-tabs */}
            <div className="flex border-b border-zinc-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`pb-2.5 px-3 border-b-2 transition-colors ${
                  authMode === 'login'
                    ? 'border-[#12489B] text-[#12489B]'
                    : 'border-transparent text-zinc-500 hover:text-slate-900'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
                className={`pb-2.5 px-3 border-b-2 transition-colors ${
                  authMode === 'register'
                    ? 'border-[#12489B] text-[#12489B]'
                    : 'border-transparent text-zinc-500 hover:text-slate-900'
                }`}
              >
                Tạo tài khoản mới
              </button>
            </div>

            {providerDisabledError && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-xs text-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-[#D97706]">
                    Cần bật Email/Password trong Firebase Console
                  </p>
                  <a
                    href={FIREBASE_AUTH_PROVIDERS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-press inline-flex items-center gap-1 px-2.5 py-1 font-semibold bg-[#D97706] text-white rounded-lg shrink-0"
                  >
                    <span>Mở Firebase Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-zinc-600 leading-relaxed">
                  Vào Authentication → Sign-in method → bật Email/Password rồi nhấn Save.
                </p>
              </div>
            )}

            {authError && (
              <div className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleClientEmailSubmit} className="space-y-3.5">
              {authMode === 'register' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Họ tên / Nickname *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={FIELD_LIMITS.displayNameMax}
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="VD: Hoàng Anh"
                      className={inputFieldCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Số điện thoại *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={FIELD_LIMITS.phoneMax}
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="0912 345 678"
                      className={`${inputFieldCls} font-mono tabular-nums`}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Địa chỉ Email *
                </label>
                <input
                  type="email"
                  required
                  maxLength={FIELD_LIMITS.emailMax}
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="email@example.com"
                  className={inputFieldCls}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-zinc-700">
                    Mật khẩu *
                  </label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs font-medium text-[#12489B] hover:underline"
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showAuthPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className={`${inputFieldCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword((v) => !v)}
                    aria-label={showAuthPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="p-1.5 text-zinc-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    {showAuthPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Nhập lại mật khẩu *
                  </label>
                  <div className="relative">
                    <input
                      type={showAuthConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={authConfirmPassword}
                      onChange={(e) => setAuthConfirmPassword(e.target.value)}
                      placeholder="Nhập lại đúng mật khẩu"
                      className={`${inputFieldCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthConfirmPassword((v) => !v)}
                      aria-label={
                        showAuthConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                      }
                      className="p-1.5 text-zinc-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      {showAuthConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="btn-press w-full py-2.5 px-4 text-sm font-semibold bg-gradient-to-r from-[#0B2559] to-[#12489B] hover:from-[#081B42] hover:to-[#0E3A7D] text-white rounded-xl shadow-[0_6px_16px_-6px_rgba(11,37,89,0.5)] disabled:opacity-45"
              >
                {(() => {
                  if (authLoading) return 'Đang xử lý...';
                  return authMode === 'login'
                    ? 'Đăng nhập & Tiếp tục'
                    : 'Tạo tài khoản Khách hàng';
                })()}
              </button>
            </form>

            <div className="pt-3 border-t border-zinc-100 text-[11px] text-zinc-500 text-center">
              Tài khoản giúp bảo mật thông tin đơn hàng và đồng bộ lịch sử tra cứu của bạn.
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen client-ambient-bg text-[#0F172A]">
      {/* Signed-In Client Sticky Header */}
      <header className="sticky top-0 z-20 sticky-glass border-b border-slate-200/80">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Clean Brand Logo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleResetLookup();
              setHomeTab('hub');
            }}
            className="whitespace-nowrap shrink-0"
          >
            <BrandLogo />
          </a>

          {/* Center: Single Clear Pill Switcher for Client Views (Desktop) */}
          <nav
            aria-label="Chức năng chính"
            className="hidden md:inline-flex items-center bg-slate-100/90 border border-slate-200/80 p-1 rounded-xl gap-1"
          >
            <button
              type="button"
              onClick={() => {
                handleResetLookup();
                setHomeTab('hub');
              }}
              className={`btn-press px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap ${
                homeTab === 'hub' && !portal
                  ? 'bg-white text-[#0B2559] shadow-xs ring-1 ring-slate-900/5'
                  : 'text-zinc-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Trang chủ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleResetLookup();
                setHomeTab('lookup');
              }}
              className={`btn-press px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap ${
                homeTab === 'lookup' && !portal
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-900/5'
                  : 'text-zinc-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Tra cứu tiến độ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleResetLookup();
                setHomeTab('checker');
              }}
              className={`btn-press px-3.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap ${
                homeTab === 'checker' && !portal
                  ? 'bg-white text-[#12489B] shadow-xs ring-1 ring-[#12489B]/15'
                  : 'text-zinc-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Check Đạo văn &amp; AI</span>
            </button>
          </nav>

          {/* Right: Unified Account Control + Subtle Admin Link */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="inline-flex items-center bg-white border border-zinc-200/90 rounded-xl p-1 pl-1.5 gap-1.5 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  handleResetLookup();
                  setHomeTab('auth');
                }}
                className={`btn-press inline-flex items-center gap-2 pr-1.5 py-0.5 rounded-lg text-xs ${
                  homeTab === 'auth' && !portal
                    ? 'text-[#12489B] font-semibold'
                    : 'text-slate-800 hover:text-[#12489B] font-medium'
                }`}
                title="Xem tài khoản & đơn hàng đã lưu"
              >
                <span className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-200/80 text-[#0B2559] text-[11px] font-bold flex items-center justify-center shrink-0">
                  {avatarInitial}
                </span>
                <span className="max-w-[110px] sm:max-w-[140px] truncate">
                  {displayName}
                </span>
              </button>
              <button
                type="button"
                onClick={handleClientSignOut}
                title="Đăng xuất"
                aria-label="Đăng xuất"
                className="btn-press p-1.5 text-zinc-400 hover:text-[#DC2626] hover:bg-red-50 rounded-lg border-l border-zinc-100"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="btn-press hidden sm:inline-flex items-center px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-slate-800 hover:bg-zinc-100 rounded-lg whitespace-nowrap border-l border-zinc-200/80 ml-0.5 pl-3"
              title="Chuyển sang cổng dành cho Admin / Nhân sự"
            >
              Quản trị
            </button>
          </div>
        </div>

        {/* Mobile Compact 3-Tab Bar (Only visible below md) */}
        <div className="md:hidden px-4 pb-2.5">
          <div className="bg-zinc-100/90 border border-zinc-200/70 p-1 rounded-xl grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => {
                handleResetLookup();
                setHomeTab('hub');
              }}
              className={`btn-press py-2 px-2 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1 ${
                homeTab === 'hub' && !portal
                  ? 'bg-white text-[#0B2559] shadow-2xs'
                  : 'text-zinc-600'
              }`}
            >
              <Home className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Trang chủ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleResetLookup();
                setHomeTab('lookup');
              }}
              className={`btn-press py-2 px-2 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1 ${
                homeTab === 'lookup' && !portal
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-zinc-600'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Tra cứu</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleResetLookup();
                setHomeTab('checker');
              }}
              className={`btn-press py-2 px-2 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1 ${
                homeTab === 'checker' && !portal
                  ? 'bg-white text-[#12489B] shadow-2xs'
                  : 'text-zinc-600'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Check AI</span>
            </button>
          </div>
        </div>
      </header>

      <main
        className={`${
          !portal && (homeTab === 'hub' || homeTab === 'checker' || homeTab === 'lookup')
            ? 'max-w-6xl'
            : 'max-w-5xl'
        } mx-auto px-4 sm:px-8 ${
          !portal && (homeTab === 'hub' || homeTab === 'lookup')
            ? 'py-5 sm:py-6'
            : 'py-8 sm:py-10'
        }`}
      >
        {(() => {
          if (activeCode && loading && !portal) {
            return (
              <div className="surface-enter max-w-md mx-auto mt-10 bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-900">
                  Đang tải thông tin đơn hàng #{activeCode}...
                </p>
                <p className="text-xs text-zinc-500">Vui lòng chờ trong giây lát.</p>
              </div>
            );
          }

          if (!activeCode || !portal) {
            if (homeTab === 'hub') {
              return (
                <ClientIntentHubView
                  displayName={displayName}
                  savedOrderCount={(userProfile?.savedOrderCodes || []).length}
                  onSelectLookup={() => setHomeTab('lookup')}
                  onSelectChecker={() => setHomeTab('checker')}
                />
              );
            }

            if (homeTab === 'checker') {
              return (
                <div className="surface-enter">
                  <ClientIntegrityCheckerView onToast={onToast} />
                </div>
              );
            }

            if (homeTab === 'lookup') {
              return (
                <div className="surface-enter space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setHomeTab('hub')}
                      className="btn-press inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-[#0B2559]"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Quay lại trang lựa chọn
                    </button>
                  </div>

                  {/* Row 1: 2-Column Hero Split — Tra cứu đơn hàng (Left) + Cam kết cốt lõi (Right) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    <section className="relative overflow-hidden lg:col-span-7 bg-white/95 backdrop-blur-xs border border-slate-200/85 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-[0_12px_34px_-14px_rgba(11,37,89,0.1)] space-y-4">
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#0B2559] via-[#12489B] to-[#F5B700]"
                      />

                      <div className="space-y-3.5">
                        <div className="space-y-1.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#12489B] text-[11px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Tra cứu thời gian thực · 24/7
                          </span>
                          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                            Tra cứu tiến độ{' '}
                            <span className="bg-gradient-to-r from-[#0B2559] via-[#12489B] to-[#D97706] bg-clip-text text-transparent">
                              đơn hàng
                            </span>
                          </h1>
                          <p className="text-xs text-zinc-600 leading-relaxed">
                            Nhập mã đơn hàng được cung cấp để xem tiến độ thời gian thực, tải tài liệu và thanh toán.
                          </p>
                        </div>

                        <form onSubmit={handleLookup} className="space-y-2">
                          <label className="block text-xs font-medium text-slate-700">
                            Mã đơn hàng *
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2 p-1.5 bg-slate-100/80 border border-slate-200/90 rounded-2xl focus-within:bg-white focus-within:border-[#12489B]/75 focus-within:ring-4 focus-within:ring-[#12489B]/10 transition-colors">
                            <div className="relative flex-1">
                              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                value={codeInput}
                                onChange={(e) => setCodeInput(e.target.value)}
                                placeholder="Ví dụ: ASG-2026-001"
                                className="w-full pl-9 pr-3 py-2 text-sm font-mono uppercase bg-transparent border-0 text-slate-900 placeholder:text-zinc-400 rounded-xl focus:outline-none"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={loading || !codeInput.trim()}
                              className="btn-press sm:w-auto w-full py-2 px-5 text-sm font-semibold bg-gradient-to-r from-[#0B2559] to-[#12489B] hover:from-[#081B42] hover:to-[#0E3A7D] text-white rounded-xl shadow-[0_6px_16px_-6px_rgba(11,37,89,0.5)] disabled:opacity-75 whitespace-nowrap shrink-0"
                            >
                              {loading ? 'Đang kiểm tra...' : 'Xem tiến độ'}
                            </button>
                          </div>

                          {lookupError && (
                            <p className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                              {lookupError}
                            </p>
                          )}
                        </form>
                      </div>

                      {/* Compact Saved Orders for Signed-In Client */}
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                            <Bookmark className="w-3.5 h-3.5 text-[#12489B]" />
                            Đơn hàng đã lưu của {displayName}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                            {(userProfile?.savedOrderCodes || []).length} đơn
                          </span>
                        </div>

                        {(userProfile?.savedOrderCodes || []).length === 0 ? (
                          <p className="text-[11px] text-zinc-500">
                            Mã đơn hợp lệ sau khi tra cứu sẽ tự động lưu tại đây để mở lại nhanh.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {(userProfile?.savedOrderCodes || []).map((savedCode) => (
                              <div
                                key={savedCode}
                                className="inline-flex items-center bg-blue-50/60 border border-blue-200/70 rounded-lg overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => void openOrderByCode(savedCode)}
                                  className="btn-press px-2.5 py-1 text-xs font-mono font-semibold text-[#12489B] hover:bg-blue-100/70"
                                >
                                  #{savedCode}
                                </button>
                                {userProfile && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void removeClientOrderBookmark(
                                        user.uid,
                                        userProfile.savedOrderCodes,
                                        savedCode
                                      )
                                    }
                                    aria-label={`Bỏ lưu ${savedCode}`}
                                    className="px-1.5 py-1 text-blue-400 hover:text-[#DC2626] hover:bg-red-50 border-l border-blue-200/70"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>

                    <div className="lg:col-span-5">
                      <ClientValuePropCard />
                    </div>
                  </div>

                  {/* Row 2 (Social Proof Strip) + Row 3 (3 Service Cards) */}
                  <ClientLandingSections
                    onOpenChecker={(hintToast) => {
                      handleResetLookup();
                      setHomeTab('checker');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      if (hintToast) {
                        onToast(hintToast);
                      }
                    }}
                  />
                </div>
              );
            }

            return (
              <div className="surface-enter max-w-xl w-full mx-auto">
                <section className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-[0_8px_28px_rgb(15,23,42,0.03)] space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#16A34A]">
                        Đã đăng nhập
                      </p>
                      <h2 className="text-xl font-bold text-slate-900">
                        Xin chào, {displayName}
                      </h2>
                      <p className="text-xs font-mono text-zinc-500">
                        {userProfile?.email || user.email}
                        {userProfile?.phoneNumber ? ` · ${userProfile.phoneNumber}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => setHomeTab('hub')}
                        className="btn-press px-4 py-2 text-xs font-semibold bg-gradient-to-r from-[#0B2559] to-[#12489B] text-white rounded-lg hover:from-[#081B42] hover:to-[#0E3A7D]"
                      >
                        Về trang &quot;Bạn muốn làm gì?&quot;
                      </button>
                      <button
                        type="button"
                        onClick={() => setHomeTab('lookup')}
                        className="btn-press px-4 py-2 text-xs font-semibold bg-blue-50 text-[#0B2559] border border-blue-200/80 rounded-lg hover:bg-blue-100"
                      >
                        Tra cứu &amp; Xem đơn đã lưu
                      </button>
                      <button
                        type="button"
                        onClick={handleClientSignOut}
                        className="btn-press px-4 py-2 text-xs font-medium bg-zinc-100 text-slate-900 rounded-lg hover:bg-zinc-200/80"
                      >
                        Đăng xuất
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                    <span>Tài khoản Khách hàng AssignTrack đã kích hoạt đồng bộ lịch sử tra cứu.</span>
                  </div>
                </section>
              </div>
            );
          }

          return (
          <div className="surface-enter space-y-6">
            {/* Back + Update Timestamp */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleResetLookup}
                className="btn-press inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Tra cứu mã khác
              </button>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                Cập nhật: {new Date(portal.updatedAt).toLocaleString('vi-VN')}
              </span>
            </div>

            {/* Order Focal Header & 6-Stage Progress */}
            <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-600">
                    <span className="font-mono font-semibold text-[#12489B]">
                      #{portal.orderCode}
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span>{portal.subject}</span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span className="font-mono tabular-nums">
                      {portal.wordCount.toLocaleString('vi-VN')} từ
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span>Trích dẫn {portal.citationStyle}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {portal.topic}
                  </h1>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                  <DeadlineBadge
                    deadlineAt={portal.deadlineAt}
                    nowMs={nowMs}
                    orderStatus={portal.orderStatus}
                  />
                  <span className="text-xs text-zinc-500 font-mono tabular-nums">
                    Hạn nộp: {formatDateTime(portal.deadlineAt)}
                  </span>
                </div>
              </div>

              {/* GPU-composited Progress Bar & 6-stage Pipeline */}
              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-900">
                    {currentStageMeta?.step}. {currentStageMeta?.label}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#12489B] tabular-nums">
                    {portal.progressPercent}%
                  </span>
                </div>

                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="progress-fill h-full w-full bg-[#12489B]"
                    style={{ transform: `scaleX(${portal.progressPercent / 100})` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                  {ORDER_STAGES.map((st) => {
                    const currentStep = currentStageMeta?.step || 1;
                    const done = st.step <= currentStep;
                    const isCurrent = st.step === currentStep;
                    let stepCardClass = 'bg-white border-zinc-100 text-zinc-400';
                    if (isCurrent) {
                      stepCardClass =
                        'bg-blue-50/80 border-[#12489B]/40 text-[#12489B] font-semibold';
                    } else if (done) {
                      stepCardClass = 'bg-zinc-50 border-zinc-200 text-slate-800';
                    }
                    return (
                      <div
                        key={st.key}
                        className={`px-2.5 py-2 rounded-lg border text-xs transition-colors ${stepCardClass}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {done && !isCurrent && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                          )}
                          <span className="truncate">
                            {st.step}. {st.shortLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {portal.publicStatusNote && (
                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl px-4 py-3 text-sm text-slate-800 max-w-[65ch]">
                    <span className="text-xs font-semibold text-zinc-500 block mb-0.5">
                      Ghi chú tiến độ mới nhất từ người viết
                    </span>
                    {portal.publicStatusNote}
                  </div>
                )}
              </div>
            </section>

            {/* 2-Column Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Brief Verification, Files, Revisions */}
              <div className="lg:col-span-7 space-y-6">
                {(portal.outlineAndInstructions || portal.rubricNotes) && (
                  <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Thông tin đề bài & Dàn ý đã chốt
                    </h2>
                    {portal.outlineAndInstructions && (
                      <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50 border border-zinc-200/80 rounded-lg p-3.5 max-w-[65ch]">
                        {portal.outlineAndInstructions}
                      </div>
                    )}
                    {portal.rubricNotes && (
                      <div className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed max-w-[65ch]">
                        <span className="font-semibold text-zinc-800">
                          Rubric / Yêu cầu đặc biệt:{' '}
                        </span>
                        {portal.rubricNotes}
                      </div>
                    )}
                  </section>
                )}

                {/* Attachments & Page-Windowed Previews */}
                {(() => {
                  const visibleAttachments = portal.attachments.filter(
                    (att) => !att.isBackup
                  );
                  return (
                <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Tài liệu & Bài làm ({visibleAttachments.length})
                    </h2>
                    <span className="text-xs text-zinc-500">
                      Nhấn Xem trước để kiểm tra nội dung
                    </span>
                  </div>

                  {visibleAttachments.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-5 text-center">
                      Chưa có tài liệu nào được đính kèm.
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
                      {visibleAttachments.map((att) => {
                        const locked = att.isPaymentLocked && !isFullyPaid;
                        const isDeliverable =
                          att.category === 'draft' || att.category === 'final';
                        const safeUrl =
                          att.sourceType === 'upload'
                            ? getSafeExternalUrl(att.fileIdOrUrl)
                            : getSafeExternalUrl(att.fileIdOrUrl);
                        const downloadHref =
                          att.sourceType === 'upload' && safeUrl
                            ? `${safeUrl}?download=1`
                            : safeUrl;
                        const downloadTarget =
                          att.sourceType === 'url' ? '_blank' : undefined;
                        const downloadName =
                          att.sourceType === 'upload' ? att.name : undefined;

                        return (
                          <div
                            key={att.id}
                            className="hover-row p-3.5 bg-white flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <FileText className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {att.name}
                                  </p>
                                  {isDeliverable && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                      Bản mới nhất
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                  {CATEGORY_LABELS[att.category]}
                                  {att.sizeBytes > 0 && ` · ${formatBytes(att.sizeBytes)}`}
                                  {att.category === 'turnitin' &&
                                    ` · Xem đến trang ${(att.turnitinScorePage || 1) + 2}`}
                                  {locked &&
                                    ` · Khóa tải (xem trước ${att.previewMaxPages || 2} trang)`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(att)}
                                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-900 rounded-lg whitespace-nowrap"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Xem trước
                              </button>

                              {locked && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#D97706] bg-amber-50 border border-amber-200 rounded-lg whitespace-nowrap">
                                  <Lock className="w-3 h-3" />
                                  Chờ thanh toán
                                </span>
                              )}

                              {!locked && Boolean(downloadHref) && (
                                <a
                                  href={downloadHref}
                                  target={downloadTarget}
                                  rel="noopener noreferrer"
                                  download={downloadName}
                                  className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] whitespace-nowrap"
                                >
                                  {att.sourceType === 'url' ? (
                                    <>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Mở link
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-3.5 h-3.5" />
                                      Tải xuống
                                    </>
                                  )}
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
                  );
                })()}

                {/* Revision Request Section */}
                <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Yêu cầu chỉnh sửa (Revision)
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Gửi phản hồi từ giảng viên trực tiếp tại đây để tránh trôi tin nhắn.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRevisionForm((v) => !v)}
                      className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Yêu cầu sửa
                    </button>
                  </div>

                  {showRevisionForm && (
                    <form
                      onSubmit={handleSubmitRevision}
                      className="surface-enter p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3"
                    >
                      <textarea
                        rows={3}
                        value={revisionMsg}
                        onChange={(e) => setRevisionMsg(e.target.value)}
                        maxLength={FIELD_LIMITS.revisionMessageMax}
                        placeholder="Mô tả chi tiết phần cần chỉnh sửa theo góp ý của giảng viên..."
                        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRevisionForm(false)}
                          className="btn-press px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={revisionMsg.trim().length < 3 || submittingRev}
                          className="btn-press inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] disabled:opacity-45"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Gửi yêu cầu
                        </button>
                      </div>
                    </form>
                  )}

                  {revisions.length > 0 && (
                    <div className="space-y-2.5">
                      {revisions.map((rev) => {
                        const revColorMap: Record<RevisionRequest['status'], string> = {
                          resolved: 'bg-emerald-50 text-[#16A34A] border-emerald-200',
                          in_progress: 'bg-amber-50 text-[#D97706] border-amber-200',
                          open: 'bg-blue-50 text-[#12489B] border-blue-200',
                        };
                        const revLabelMap: Record<RevisionRequest['status'], string> = {
                          resolved: 'Đã sửa xong',
                          in_progress: 'Đang xử lý',
                          open: 'Chờ xử lý',
                        };
                        return (
                          <div
                            key={rev.id}
                            className="border border-zinc-200 rounded-xl p-3.5 space-y-2 text-sm"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono text-zinc-500 tabular-nums">
                                {new Date(rev.createdAt).toLocaleString('vi-VN')}
                              </span>
                              <span
                                className={`px-2 py-0.5 font-medium rounded-md border ${revColorMap[rev.status]}`}
                              >
                                {revLabelMap[rev.status]}
                              </span>
                            </div>
                            <p className="text-slate-800 whitespace-pre-wrap">{rev.message}</p>
                            {rev.adminReply && (
                              <p className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200/80 rounded-lg p-2.5">
                                <span className="font-semibold text-slate-900">Phản hồi: </span>
                                {rev.adminReply}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column: Payment QR & 48h Live Chat */}
              <div className="lg:col-span-5 space-y-6">
                <PaymentQrCard
                  orderCode={portal.orderCode}
                  totalAmount={portal.totalAmount}
                  depositAmount={portal.depositAmount}
                  paidAmount={portal.paidAmount}
                  paymentStatus={portal.paymentStatus}
                  bankSnapshot={portal.bankSnapshot}
                  onToast={onToast}
                />

                <OrderChatPanel
                  orderCode={portal.orderCode}
                  senderRole="client"
                  senderName={userProfile?.displayName || user?.displayName || 'Khách hàng'}
                />
              </div>
            </div>
          </div>
          );
        })()}
      </main>

      <PdfPreviewModal
        attachment={previewAttachment}
        isFullyPaid={isFullyPaid}
        isAdmin={false}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
}
