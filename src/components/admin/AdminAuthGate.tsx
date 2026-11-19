import { useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  UserPlus,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  FIREBASE_AUTH_PROVIDERS_URL,
  auth,
  mapFirebaseAuthError,
} from '../../lib/firebase';
import { normalizeOrderCode } from '../../lib/utils';
import {
  acceptTeamInviteAndCreateProfile,
  ensureOwnerOrReadProfile,
  findPendingInvitesForEmail,
  verifyTeamInviteBeforeSignup,
} from '../../services/firestoreService';
import { FIELD_LIMITS, TeamInvite, UserProfile, UserRole } from '../../types/domain';
import { BrandLogo } from '../shared/BrandLogo';
import { EmailVerificationBanner } from '../shared/EmailVerificationBanner';

interface AdminAuthGateProps {
  user: User | null;
  emailVerified: boolean;
  userProfile: UserProfile | null;
  profileLoading: boolean;
  authReady: boolean;
  isBootstrappedOwner: boolean;
  isSuspended: boolean;
  effectiveRole: UserRole | null;
  onSwitchToClientPortal: () => void;
  onBackToRoleSelect?: () => void;
  onRefreshProfile: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onToast: (msg: string) => void;
}

export function AdminAuthGate({
  user,
  emailVerified,
  userProfile,
  profileLoading,
  authReady,
  isBootstrappedOwner,
  isSuspended,
  effectiveRole,
  onSwitchToClientPortal,
  onBackToRoleSelect,
  onRefreshProfile,
  onSignOut,
  onToast,
}: AdminAuthGateProps) {
  const [authTab, setAuthTab] = useState<'login' | 'staff_register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regInviteCode, setRegInviteCode] = useState('');
  const [regSpecialty, setRegSpecialty] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  const [verifiedInvite, setVerifiedInvite] = useState<TeamInvite | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(false);

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [providerDisabledError, setProviderDisabledError] = useState(false);

  const [discoveredInvites, setDiscoveredInvites] = useState<TeamInvite[]>([]);
  const [claimInviteCode, setClaimInviteCode] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimSpecialty, setClaimSpecialty] = useState('');
  const [claimingInvite, setClaimingInvite] = useState(false);

  useEffect(() => {
    if (!user || userProfile || isBootstrappedOwner) {
      setDiscoveredInvites([]);
      return;
    }
    let cancelled = false;
    findPendingInvitesForEmail(user.email || '')
      .then((list) => {
        if (cancelled) return;
        setDiscoveredInvites(list);
        if (list.length > 0 && !claimInviteCode) {
          setClaimInviteCode(list[0].inviteCode);
          setClaimName(user.displayName || list[0].displayName);
          setClaimPhone(list[0].phoneNumber || '');
          setClaimSpecialty(list[0].specialty || '');
        }
      })
      .catch((err) => {
        console.warn('Unable to look up pending invites for user:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [user, userProfile, isBootstrappedOwner, claimInviteCode]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setProviderDisabledError(false);

    const normalizedEmail = loginEmail.trim().toLowerCase();
    if (!normalizedEmail || !loginPassword) {
      setAuthError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setAuthBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, normalizedEmail, loginPassword);
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user).catch(() => undefined);
        await onRefreshProfile();
        onToast('Vui lòng xác minh email qua liên kết vừa gửi vào hộp thư của bạn.');
        return;
      }
      await ensureOwnerOrReadProfile(cred.user);
      await onRefreshProfile();
      onToast('Đăng nhập hệ thống Điều hành thành công.');
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';

      if (
        normalizedEmail === ADMIN_EMAIL.toLowerCase() &&
        (code === 'auth/user-not-found' || code === 'auth/invalid-credential')
      ) {
        try {
          const verifyRes = await fetch('/api/auth/verify-owner-bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, password: loginPassword }),
          });
          if (verifyRes.ok) {
            const verifyData = (await verifyRes.json()) as { allowed?: boolean };
            if (verifyData.allowed) {
              const created = await createUserWithEmailAndPassword(
                auth,
                normalizedEmail,
                loginPassword
              );
              await updateProfile(created.user, { displayName: 'Chủ hệ thống' });
              if (!created.user.emailVerified) {
                await sendEmailVerification(created.user).catch(() => undefined);
                await onRefreshProfile();
                onToast('Đã khởi tạo Chủ hệ thống. Vui lòng kiểm tra email để xác minh tài khoản.');
                return;
              }
              await ensureOwnerOrReadProfile(created.user);
              await onRefreshProfile();
              onToast('Đăng nhập hệ thống Điều hành thành công.');
              return;
            }
          }
        } catch (createErr) {
          const mappedCreate = mapFirebaseAuthError(createErr);
          setAuthError(mappedCreate.message);
          setProviderDisabledError(mappedCreate.isProviderDisabled);
          return;
        }
      }

      const mapped = mapFirebaseAuthError(err);
      setAuthError(mapped.message);
      setProviderDisabledError(mapped.isProviderDisabled);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      setAuthError('Vui lòng nhập địa chỉ email của bạn ở ô bên trên trước khi lấy lại mật khẩu.');
      return;
    }
    setAuthBusy(true);
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
      setAuthBusy(false);
    }
  };

  const handleVerifyInvitePreview = async () => {
    setAuthError('');
    setVerifiedInvite(null);
    const code = normalizeOrderCode(regInviteCode);
    const email = regEmail.trim().toLowerCase();
    if (!code || code.length < 4) {
      setAuthError('Vui lòng nhập Mã mời (VD: TEAM-XXXXXX) để kiểm tra.');
      return;
    }
    if (!email || !email.includes('@')) {
      setAuthError('Vui lòng nhập Email được Admin mời trước khi bấm Kiểm tra mã.');
      return;
    }

    setCheckingInvite(true);
    try {
      const invite = await verifyTeamInviteBeforeSignup({
        inviteCode: code,
        email,
      });
      setVerifiedInvite(invite);
      if (!regName.trim() && invite.displayName) {
        setRegName(invite.displayName);
      }
      if (!regPhone.trim() && invite.phoneNumber) {
        setRegPhone(invite.phoneNumber);
      }
      if (!regSpecialty.trim() && invite.specialty) {
        setRegSpecialty(invite.specialty);
      }
      onToast(`Mã mời #${invite.inviteCode} hợp lệ cho ${invite.email}!`);
    } catch (err) {
      setVerifiedInvite(null);
      setAuthError(err instanceof Error ? err.message : 'Không thể kiểm tra mã mời.');
    } finally {
      setCheckingInvite(false);
    }
  };

  const handleStaffEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setProviderDisabledError(false);

    const trimmedName = regName.trim();
    const normalizedEmail = regEmail.trim().toLowerCase();
    const trimmedPhone = regPhone.trim();
    const code = normalizeOrderCode(regInviteCode);

    if (!trimmedName) {
      setAuthError('Vui lòng nhập Họ và tên nhân sự.');
      return;
    }
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setAuthError('Vui lòng nhập đúng địa chỉ Email được Admin mời.');
      return;
    }
    if (!trimmedPhone || trimmedPhone.length < 8) {
      setAuthError('Vui lòng nhập Số điện thoại liên hệ hợp lệ (tối thiểu 8 ký tự).');
      return;
    }
    if (!code || code.length < 4) {
      setAuthError('Vui lòng nhập Mã mời do Admin cung cấp (VD: TEAM-XXXXXX).');
      return;
    }
    if (regPassword.length < 6) {
      setAuthError('Mật khẩu cần có tối thiểu 6 ký tự.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setAuthError('Mật khẩu và Nhập lại mật khẩu không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    setAuthBusy(true);
    try {
      const matchedInvite = await verifyTeamInviteBeforeSignup({
        inviteCode: code,
        email: normalizedEmail,
      });
      setVerifiedInvite(matchedInvite);

      const cred = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        regPassword
      );
      await updateProfile(cred.user, { displayName: trimmedName });

      await acceptTeamInviteAndCreateProfile({
        user: cred.user,
        inviteCode: code,
        displayName: trimmedName,
        phoneNumber: trimmedPhone,
        specialty: regSpecialty.trim() || matchedInvite.specialty || '',
      });

      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user).catch(() => undefined);
      }

      await onRefreshProfile();
      onToast(
        cred.user.emailVerified
          ? `Đăng ký thành công! Chào mừng ${trimmedName} gia nhập đội ngũ.`
          : `Đã tạo tài khoản cho ${trimmedName}. Vui lòng xác minh email để bắt đầu.`
      );
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      setAuthError(mapped.message);
      setProviderDisabledError(mapped.isProviderDisabled);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleClaimInviteAfterSignIn = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) return;
    const code = normalizeOrderCode(claimInviteCode);
    if (!code || code.length < 4) {
      onToast('Vui lòng nhập Mã mời hợp lệ.');
      return;
    }
    setClaimingInvite(true);
    try {
      await acceptTeamInviteAndCreateProfile({
        user,
        inviteCode: code,
        displayName: claimName.trim() || user.displayName || undefined,
        phoneNumber: claimPhone.trim() || undefined,
        specialty: claimSpecialty.trim(),
      });
      await onRefreshProfile();
      onToast('Đã kích hoạt tài khoản Nhân sự thành công!');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Không thể kích hoạt mã mời.');
    } finally {
      setClaimingInvite(false);
    }
  };

  if (!authReady || (user && profileLoading && !(isBootstrappedOwner && emailVerified))) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center text-sm text-zinc-500">
        Đang kiểm tra phiên đăng nhập & phân quyền...
      </div>
    );
  }

  if (!user) {
    const inputFieldCls =
      'w-full px-3.5 py-2.5 text-sm bg-zinc-50/90 border border-zinc-200 rounded-xl text-slate-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B] transition-colors';

    const loginSubmitLabel = authBusy
      ? 'Đang xác thực...'
      : 'Đăng nhập vào Hệ thống';

    return (
      <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A] flex flex-col">
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
              <BrandLogo />
            </div>

            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-600">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setAuthError('');
                }}
                className={`whitespace-nowrap shrink-0 transition-colors ${
                  authTab === 'login'
                    ? 'text-[#12489B] font-semibold'
                    : 'hover:text-slate-900'
                }`}
              >
                Đăng nhập Điều hành
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('staff_register');
                  setAuthError('');
                }}
                className={`whitespace-nowrap shrink-0 transition-colors ${
                  authTab === 'staff_register'
                    ? 'text-[#12489B] font-semibold'
                    : 'hover:text-slate-900'
                }`}
              >
                Đăng ký Nhân sự (Mã mời)
              </button>
            </nav>

            <button
              type="button"
              onClick={onSwitchToClientPortal}
              className="btn-press px-3.5 py-1.5 text-xs font-medium text-[#12489B] bg-blue-50 hover:bg-blue-100 rounded-lg whitespace-nowrap shrink-0"
            >
              Cổng Khách hàng →
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8 sm:py-12">
          <div className="surface-enter max-w-xl w-full mx-auto">
            <section className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-[0_8px_28px_rgb(15,23,42,0.03)]">
              <div className="space-y-6">
                <div className="bg-zinc-100 p-1 rounded-xl grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setAuthError('');
                    }}
                    className={`btn-press py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 ${
                      authTab === 'login'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-zinc-600 hover:text-slate-900'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5 shrink-0" />
                    <span>Đăng nhập Admin / Nhân sự</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('staff_register');
                      setAuthError('');
                    }}
                    className={`btn-press py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 ${
                      authTab === 'staff_register'
                        ? 'bg-white text-[#12489B] shadow-xs'
                        : 'text-zinc-600 hover:text-slate-900'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>Đăng ký Nhân sự (Mã mời)</span>
                  </button>
                </div>

                {providerDisabledError && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2.5 text-xs text-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-[#D97706]">
                        Cần bật phương thức Email/Password trong Firebase Console (1 lần duy nhất)
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
                    <ol className="list-decimal list-inside space-y-1 text-zinc-700 leading-relaxed">
                      <li>
                        Nhấn nút <span className="font-semibold">Mở Firebase Console</span> bên trên (vào mục <span className="font-mono">Authentication → Sign-in method</span>).
                      </li>
                      <li>
                        Chọn <span className="font-semibold">Email/Password</span> → Gạt nút <span className="font-semibold">Enable</span> → Nhấn <span className="font-semibold">Save</span>.
                      </li>
                      <li>
                        Quay lại trang này và nhấn Đăng ký / Đăng nhập lại.
                      </li>
                    </ol>
                  </div>
                )}

                {authError && (
                  <div
                    role="alert"
                    className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5 leading-relaxed"
                  >
                    <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                {authTab === 'login' ? (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        Đăng nhập Điều hành
                      </h1>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        Nhập Email và Mật khẩu tài khoản Chủ hệ thống, Admin quản lý hoặc Nhân sự.
                      </p>
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                          Địa chỉ Email *
                        </label>
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="name@company.com"
                          className={inputFieldCls}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-zinc-700">
                            Mật khẩu *
                          </label>
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="text-xs font-medium text-[#12489B] hover:underline"
                          >
                            Quên mật khẩu?
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type={showLoginPassword ? 'text' : 'password'}
                            required
                            minLength={6}
                            autoComplete="current-password"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
                            className={`${inputFieldCls} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword((v) => !v)}
                            aria-label={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            className="p-1.5 text-zinc-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2"
                          >
                            {showLoginPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={authBusy}
                        className="btn-press w-full py-2.5 px-4 text-sm font-semibold bg-[#12489B] text-white rounded-xl hover:bg-[#0B2559] disabled:opacity-45"
                      >
                        {loginSubmitLabel}
                      </button>
                    </form>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-end text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthTab('staff_register');
                          setAuthError('');
                        }}
                        className="btn-press font-semibold text-[#12489B] hover:underline"
                      >
                        Có mã mời nhân sự? Đăng ký ngay →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        Tạo tài khoản Nhân sự
                      </h1>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        Điền đầy đủ thông tin bên dưới. Hệ thống chỉ cho phép đăng ký khi{' '}
                        <span className="font-semibold text-slate-900">Email</span> và{' '}
                        <span className="font-semibold text-slate-900">Mã mời</span> khớp với lời mời do Admin phát hành.
                      </p>
                    </div>

                    <form onSubmit={handleStaffEmailRegister} className="space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            1. Tên nhân sự *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={FIELD_LIMITS.displayNameMax}
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            placeholder="VD: Nguyễn Minh Anh"
                            className={inputFieldCls}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            2. Số điện thoại *
                          </label>
                          <input
                            type="tel"
                            required
                            maxLength={FIELD_LIMITS.phoneMax}
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="VD: 0912 345 678"
                            className={`${inputFieldCls} font-mono tabular-nums`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                        <div className="sm:col-span-6">
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            3. Email được Admin mời *
                          </label>
                          <input
                            type="email"
                            required
                            maxLength={FIELD_LIMITS.emailMax}
                            value={regEmail}
                            onChange={(e) => {
                              setRegEmail(e.target.value);
                              setVerifiedInvite(null);
                            }}
                            placeholder="writer@gmail.com"
                            className={inputFieldCls}
                          />
                        </div>

                        <div className="sm:col-span-6">
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            4. Mã mời (TEAM-XXXXXX) *
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              required
                              maxLength={FIELD_LIMITS.inviteCodeMax}
                              value={regInviteCode}
                              onChange={(e) => {
                                setRegInviteCode(e.target.value.toUpperCase());
                                setVerifiedInvite(null);
                              }}
                              placeholder="TEAM-8F3K9A"
                              className={`${inputFieldCls} font-mono uppercase`}
                            />
                            <button
                              type="button"
                              disabled={checkingInvite || authBusy}
                              onClick={handleVerifyInvitePreview}
                              className="btn-press px-3 py-2.5 text-xs font-semibold bg-blue-50 text-[#12489B] border border-blue-200 rounded-xl hover:bg-blue-100 whitespace-nowrap shrink-0 disabled:opacity-45"
                            >
                              {checkingInvite ? 'Đang kiểm...' : 'Kiểm tra mã'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {verifiedInvite && (
                        <div className="surface-enter bg-emerald-50/90 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                            <span className="text-slate-800 truncate">
                              Đã xác thực lời mời{' '}
                              <span className="font-mono font-bold text-[#16A34A]">
                                #{verifiedInvite.inviteCode}
                              </span>{' '}
                              · Vai trò:{' '}
                              <span className="font-semibold">
                                {verifiedInvite.role === 'admin'
                                  ? 'Admin quản lý'
                                  : 'Nhân sự / Writer'}
                              </span>
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-[#16A34A] shrink-0">
                            Khớp Email
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            5. Mật khẩu *
                          </label>
                          <div className="relative">
                            <input
                              type={showRegPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              autoComplete="new-password"
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              placeholder="Tối thiểu 6 ký tự"
                              className={`${inputFieldCls} pr-10`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegPassword((v) => !v)}
                              aria-label={showRegPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                              className="p-1.5 text-zinc-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2"
                            >
                              {showRegPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">
                            6. Nhập lại mật khẩu *
                          </label>
                          <div className="relative">
                            <input
                              type={showRegConfirmPassword ? 'text' : 'password'}
                              required
                              minLength={6}
                              autoComplete="new-password"
                              value={regConfirmPassword}
                              onChange={(e) => setRegConfirmPassword(e.target.value)}
                              placeholder="Nhập lại mật khẩu"
                              className={`${inputFieldCls} pr-10`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegConfirmPassword((v) => !v)}
                              aria-label={
                                showRegConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                              }
                              className="p-1.5 text-zinc-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2"
                            >
                              {showRegConfirmPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Chuyên môn phụ trách (Tùy chọn)
                        </label>
                        <input
                          type="text"
                          maxLength={FIELD_LIMITS.specialtyMax}
                          value={regSpecialty}
                          onChange={(e) => setRegSpecialty(e.target.value)}
                          placeholder="VD: Finance, Econometrics, SPSS, Law..."
                          className={inputFieldCls}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={authBusy}
                        className="btn-press w-full py-2.5 px-4 text-sm font-semibold bg-[#12489B] text-white rounded-xl hover:bg-[#0B2559] disabled:opacity-45"
                      >
                        {authBusy
                          ? 'Đang kiểm tra Mã mời & Tạo tài khoản...'
                          : 'Hoàn tất Đăng ký Nhân sự'}
                      </button>
                    </form>
                  </div>
                )}
              </div>

              <div className="pt-5 mt-6 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                <span>Chỉ sử dụng tài khoản nội bộ (Email & Mật khẩu).</span>
                <button
                  type="button"
                  onClick={onSwitchToClientPortal}
                  className="btn-press font-medium text-[#12489B] hover:underline"
                >
                  Bạn là Khách hàng? Mở cổng Tra cứu & Đăng nhập Khách hàng →
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  if (!emailVerified) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <EmailVerificationBanner
          user={user}
          onVerified={onRefreshProfile}
          onToast={onToast}
        />
      </div>
    );
  }

  if (isSuspended) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="surface-enter max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-[#DC2626]">
            Tài khoản Nhân sự đang bị tạm khóa
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Tài khoản <span className="font-mono">{user.email}</span> hiện đã bị Quản trị viên tạm khóa quyền truy cập. Vui lòng liên hệ Admin để mở lại.
          </p>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="btn-press px-4 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-lg"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  if (effectiveRole === 'client') {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="surface-enter max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Đây là tài khoản Khách hàng
          </h2>
          <p className="text-sm text-zinc-600 leading-relaxed">
            Bạn đang đăng nhập bằng <span className="font-mono">{user.email}</span> (vai trò Khách hàng). Nếu bạn là nhân sự mới, hãy nhờ Admin nâng cấp tài khoản hoặc dùng Cổng Khách hàng bên dưới.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onSwitchToClientPortal}
              className="btn-press px-4 py-2 text-xs font-medium bg-[#12489B] text-white rounded-lg"
            >
              Mở Cổng Khách hàng
            </button>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="btn-press px-4 py-2 text-xs font-medium bg-zinc-100 text-slate-900 rounded-lg"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
      <div className="surface-enter max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 sm:p-7 space-y-5 shadow-[0_12px_32px_rgb(15,23,42,0.04)]">
        <div className="space-y-1.5">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#12489B]">
            Kích hoạt quyền Nhân sự
          </p>
          <h2 className="text-lg font-bold text-slate-900">
            Nhập Mã mời để vào hệ thống
          </h2>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Bạn đang đăng nhập với <span className="font-mono font-semibold">{user.email}</span>.
            {discoveredInvites.length > 0
              ? ' Hệ thống đã tìm thấy lời mời khớp với email của bạn!'
              : ' Tài khoản này chưa được gán vai trò Nhân sự / Admin.'}
          </p>
        </div>

        <form onSubmit={handleClaimInviteAfterSignIn} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Mã mời (TEAM-XXXXXX) *
            </label>
            <input
              type="text"
              required
              value={claimInviteCode}
              onChange={(e) => setClaimInviteCode(e.target.value.toUpperCase())}
              placeholder="TEAM-XXXXXX"
              className="w-full px-3 py-2 text-sm font-mono uppercase bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              required
              placeholder="Họ và tên *"
              value={claimName}
              onChange={(e) => setClaimName(e.target.value)}
              className="px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl"
            />
            <input
              type="tel"
              required
              placeholder="Số điện thoại *"
              value={claimPhone}
              onChange={(e) => setClaimPhone(e.target.value)}
              className="px-3 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-xl"
            />
          </div>

          <input
            type="text"
            placeholder="Chuyên môn (Tùy chọn)"
            value={claimSpecialty}
            onChange={(e) => setClaimSpecialty(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl"
          />

          <button
            type="submit"
            disabled={claimingInvite}
            className="btn-press w-full py-2.5 px-4 text-sm font-medium bg-[#12489B] text-white rounded-xl hover:bg-[#0B2559] disabled:opacity-45"
          >
            {claimingInvite ? 'Đang kích hoạt...' : 'Xác nhận kích hoạt Nhân sự'}
          </button>
        </form>

        <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSwitchToClientPortal}
            className="btn-press text-xs font-medium text-[#12489B] hover:underline"
          >
            Sang Cổng Khách hàng →
          </button>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="btn-press text-xs font-medium text-zinc-500 hover:text-slate-900"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
