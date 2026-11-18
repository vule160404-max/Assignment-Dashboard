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
  Lock,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
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
import { PaymentQrCard } from './PaymentQrCard';

interface ClientPortalViewProps {
  user: User | null;
  userProfile: UserProfile | null;
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

  // Client home tab state ('lookup' | 'checker' | 'auth')
  const [homeTab, setHomeTabState] = useState<'lookup' | 'checker' | 'auth'>(() => {
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (urlTab === 'checker' || urlTab === 'auth' || urlTab === 'lookup') {
      return urlTab;
    }
    return 'lookup';
  });

  const setHomeTab = (nextTab: 'lookup' | 'checker' | 'auth') => {
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
    if (!activeCode) {
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
  }, [activeCode]);

  const openOrderByCode = async (rawCode: string) => {
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
        setHomeTab('lookup');
        onToast('Đã đăng ký và đăng nhập tài khoản Khách hàng thành công!');
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, authPassword);
        await registerClientProfile(cred.user);
        setHomeTab('lookup');
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
    'w-full px-3.5 py-2.5 text-sm bg-zinc-50/90 border border-zinc-200 rounded-xl text-slate-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA] transition-colors';

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A]">
      {/* Top Bar Contract: 1-row, 3 clean translucent zones separated by gap-8 */}
      <header className="sticky top-0 z-20 sticky-glass border-b border-zinc-200/80 px-4 sm:px-8 h-14 flex items-center">
        <div className="max-w-5xl w-full mx-auto flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 shrink-0">
            {onBackToRoleSelect && (
              <button
                type="button"
                onClick={onBackToRoleSelect}
                className="btn-press inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900 bg-zinc-100 hover:bg-zinc-200/80 rounded-lg"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Chọn vai trò</span>
              </button>
            )}
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                handleResetLookup();
                setHomeTab('lookup');
              }}
              className="whitespace-nowrap shrink-0"
            >
              <BrandLogo />
            </a>
          </div>

          <nav className="hidden sm:flex items-center gap-6 text-xs font-medium text-zinc-600">
            <button
              type="button"
              onClick={() => {
                handleResetLookup();
                setHomeTab('lookup');
              }}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                homeTab === 'lookup' && !portal
                  ? 'text-[#4338CA] font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Tra cứu đơn hàng
            </button>
            <button
              type="button"
              onClick={() => {
                handleResetLookup();
                setHomeTab('checker');
              }}
              className={`whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1 ${
                homeTab === 'checker' && !portal
                  ? 'text-[#4338CA] font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Check Đạo văn &amp; AI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleResetLookup();
                setHomeTab('auth');
              }}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                homeTab === 'auth' && !portal
                  ? 'text-[#4338CA] font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Tài khoản Khách hàng
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 rounded-lg text-xs text-slate-800">
                <span className="max-w-[120px] truncate font-medium">
                  {userProfile?.displayName || user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={handleClientSignOut}
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                  className="btn-press p-1 text-zinc-500 hover:text-[#DC2626] rounded"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  handleResetLookup();
                  setHomeTab('auth');
                }}
                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#4338CA] bg-indigo-50 hover:bg-indigo-100 rounded-lg whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                Đăng nhập
              </button>
            )}

            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="btn-press px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 rounded-lg whitespace-nowrap shrink-0"
            >
              Cổng Admin / Nhân sự
            </button>
          </div>
        </div>
      </header>

      <main
        className={`${
          !portal && homeTab === 'checker' ? 'max-w-6xl' : 'max-w-5xl'
        } mx-auto px-4 sm:px-8 py-8 sm:py-10`}
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
            const segmentedBar = (
              <div className="bg-zinc-100 p-1 rounded-xl grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setHomeTab('lookup')}
                  className={`btn-press py-2.5 px-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 ${
                    homeTab === 'lookup'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-zinc-600 hover:text-slate-900'
                  }`}
                >
                  <Search className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Tra cứu đơn</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHomeTab('checker')}
                  className={`btn-press py-2.5 px-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 ${
                    homeTab === 'checker'
                      ? 'bg-white text-[#4338CA] shadow-xs'
                      : 'text-zinc-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Check Đạo văn &amp; AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHomeTab('auth')}
                  className={`btn-press py-2.5 px-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 ${
                    homeTab === 'auth'
                      ? 'bg-white text-[#4338CA] shadow-xs'
                      : 'text-zinc-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {user ? 'Tài khoản' : 'Đăng nhập'}
                  </span>
                </button>
              </div>
            );

            if (homeTab === 'checker') {
              return (
                <div className="surface-enter space-y-6">
                  <div className="max-w-xl mx-auto">{segmentedBar}</div>
                  <ClientIntegrityCheckerView onToast={onToast} />
                </div>
              );
            }

            return (
              <div className="surface-enter max-w-xl w-full mx-auto">
                <section className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-[0_8px_28px_rgb(15,23,42,0.03)] space-y-6">
                  <div className="space-y-6">
                    {/* Segmented Mode Switcher */}
                    {segmentedBar}

                    {homeTab === 'lookup' && (
                      <div className="space-y-6">
                        <div className="space-y-1.5">
                          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Tra cứu tiến độ đơn hàng
                          </h1>
                          <p className="text-xs text-zinc-600 leading-relaxed max-w-[65ch]">
                            Nhập mã đơn hàng được cung cấp (không bắt buộc đăng nhập) để xem tiến độ thời gian thực, tải tài liệu và thanh toán.
                          </p>
                        </div>

                        <form onSubmit={handleLookup} className="space-y-3.5">
                          <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                              Mã đơn hàng *
                            </label>
                            <div className="relative">
                              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                value={codeInput}
                                onChange={(e) => setCodeInput(e.target.value)}
                                placeholder="Ví dụ: ASG-2026-001"
                                className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono uppercase bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA] transition-colors"
                              />
                            </div>
                          </div>

                          {lookupError && (
                            <p className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                              {lookupError}
                            </p>
                          )}

                          <button
                            type="submit"
                            disabled={loading || !codeInput.trim()}
                            className="btn-press w-full py-2.5 px-4 text-sm font-semibold bg-[#4338CA] text-white rounded-xl hover:bg-[#3730A3] disabled:opacity-45"
                          >
                            {loading ? 'Đang kiểm tra...' : 'Xem tiến độ đơn hàng'}
                          </button>
                        </form>

                        {/* Saved Orders for Signed-In Client */}
                        {user && userProfile && (
                          <div className="pt-4 border-t border-zinc-100 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                                <Bookmark className="w-3.5 h-3.5 text-[#4338CA]" />
                                Đơn hàng đã lưu của {userProfile.displayName}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                                {(userProfile.savedOrderCodes || []).length} đơn
                              </span>
                            </div>

                            {(userProfile.savedOrderCodes || []).length === 0 ? (
                              <p className="text-xs text-zinc-500">
                                Mỗi khi bạn tra cứu một mã đơn hợp lệ, mã đó sẽ tự động lưu tại đây để mở lại nhanh chóng.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {(userProfile.savedOrderCodes || []).map((savedCode) => (
                                  <div
                                    key={savedCode}
                                    className="inline-flex items-center bg-zinc-50 border border-zinc-200 rounded-lg overflow-hidden"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => void openOrderByCode(savedCode)}
                                      className="btn-press px-2.5 py-1.5 text-xs font-mono font-semibold text-[#4338CA] hover:bg-indigo-50"
                                    >
                                      #{savedCode}
                                    </button>
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
                                      className="px-1.5 py-1.5 text-zinc-400 hover:text-[#DC2626] hover:bg-red-50 border-l border-zinc-200"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {homeTab === 'auth' && (
                      <div className="space-y-5">
                        {user && userProfile ? (
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#16A34A]">
                                Đã đăng nhập
                              </p>
                              <h2 className="text-xl font-bold text-slate-900">
                                Xin chào, {userProfile.displayName}
                              </h2>
                              <p className="text-xs font-mono text-zinc-500">
                                {userProfile.email}
                                {userProfile.phoneNumber ? ` · ${userProfile.phoneNumber}` : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2.5">
                              <button
                                type="button"
                                onClick={() => setHomeTab('lookup')}
                                className="btn-press px-4 py-2 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3]"
                              >
                                Tra cứu & Xem đơn đã lưu
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
                        ) : (
                          <>
                            <div className="space-y-1">
                              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                                {authMode === 'login'
                                  ? 'Đăng nhập Khách hàng'
                                  : 'Đăng ký tài khoản Khách hàng'}
                              </h2>
                              <p className="text-xs text-zinc-600 leading-relaxed">
                                Lưu danh sách mã đơn hàng đã đặt, đồng bộ tên hiển thị khi chat 48h với người viết và quản lý lịch sử bảo hành.
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
                                    ? 'border-[#4338CA] text-[#4338CA]'
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
                                    ? 'border-[#4338CA] text-[#4338CA]'
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
                                      className="text-xs font-medium text-[#4338CA] hover:underline"
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
                                className="btn-press w-full py-2.5 px-4 text-sm font-semibold bg-[#4338CA] text-white rounded-xl hover:bg-[#3730A3] disabled:opacity-45"
                              >
                                {(() => {
                                  if (authLoading) return 'Đang xử lý...';
                                  return authMode === 'login'
                                    ? 'Đăng nhập bằng Email'
                                    : 'Tạo tài khoản Khách hàng';
                                })()}
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                    <span>Chỉ sử dụng Email & Mật khẩu nội bộ.</span>
                    {homeTab === 'lookup' && !user && (
                      <button
                        type="button"
                        onClick={() => setHomeTab('auth')}
                        className="btn-press font-medium text-[#4338CA] hover:underline"
                      >
                        Đăng nhập / Đăng ký để lưu mã đơn →
                      </button>
                    )}
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
                    <span className="font-mono font-semibold text-[#4338CA]">
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
                  <span className="font-mono text-sm font-bold text-[#4338CA] tabular-nums">
                    {portal.progressPercent}%
                  </span>
                </div>

                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="progress-fill h-full w-full bg-[#4338CA]"
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
                        'bg-indigo-50/70 border-[#4338CA]/40 text-[#4338CA] font-semibold';
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
                <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Tài liệu & Bài làm ({portal.attachments.length})
                    </h2>
                    <span className="text-xs text-zinc-500">
                      Nhấn Xem trước để kiểm tra nội dung
                    </span>
                  </div>

                  {portal.attachments.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-5 text-center">
                      Chưa có tài liệu nào được đính kèm.
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
                      {portal.attachments.map((att) => {
                        const locked = att.isPaymentLocked && !isFullyPaid;
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
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {att.name}
                                </p>
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
                                  className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] whitespace-nowrap"
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
                        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
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
                          className="btn-press inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] disabled:opacity-45"
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
                          open: 'bg-indigo-50 text-[#4338CA] border-indigo-200',
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
