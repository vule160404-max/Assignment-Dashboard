import { useEffect, useMemo, useRef, useState } from 'react';
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
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  KeyRound,
  LayoutList,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  FIREBASE_AUTH_PROVIDERS_URL,
  auth,
  mapFirebaseAuthError,
} from '../../lib/firebase';
import {
  DEFAULT_BANK_SETTINGS,
  acceptTeamInviteAndCreateProfile,
  ensureOwnerOrReadProfile,
  findPendingInvitesForEmail,
  saveOrder,
  subscribeAllRevisionsAdmin,
  subscribeAllUsersAdmin,
  subscribeBankSettings,
  subscribeClients,
  subscribeOrders,
  subscribeTeamInvitesAdmin,
  uploadFileToServer,
  verifyTeamInviteBeforeSignup,
} from '../../services/firestoreService';
import {
  copyTextToClipboard,
  evaluateDeadline,
  formatVnd,
  getStageMeta,
  normalizeOrderCode,
} from '../../lib/utils';
import {
  AttachmentItem,
  BankSettings,
  ClientRecord,
  FIELD_LIMITS,
  OrderRecord,
  RevisionRequest,
  TeamInvite,
  UserProfile,
} from '../../types/domain';
import { DeadlineBadge } from '../shared/DeadlineBadge';
import { BankSettingsView } from './BankSettingsView';
import { CalendarView } from './CalendarView';
import { ClientsCrmView } from './ClientsCrmView';
import { OrderWorkspaceModal } from './OrderWorkspaceModal';
import { RevenueDashboardView } from './RevenueDashboardView';
import { TeamManagementView } from './TeamManagementView';
import { WordHumanizerView } from './WordHumanizerView';

type AdminTab = 'orders' | 'calendar' | 'humanizer' | 'clients' | 'revenue' | 'team' | 'settings';
type OrderFilter = 'all' | 'active' | 'urgent' | 'unpaid_balance' | 'completed';

interface AdminPortalViewProps {
  user: User | null;
  userProfile: UserProfile | null;
  profileLoading: boolean;
  authReady: boolean;
  nowMs: number;
  onSwitchToClientPortal: (orderCode?: string) => void;
  onBackToRoleSelect?: () => void;
  onRefreshProfile: () => Promise<void>;
  onToast: (msg: string) => void;
}

export function AdminPortalView({
  user,
  userProfile,
  profileLoading,
  authReady,
  nowMs,
  onSwitchToClientPortal,
  onBackToRoleSelect,
  onRefreshProfile,
  onToast,
}: AdminPortalViewProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [bankSettings, setBankSettings] = useState<BankSettings>(DEFAULT_BANK_SETTINGS);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [teamUsers, setTeamUsers] = useState<UserProfile[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Orders filter & search
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<OrderFilter>('all');

  // Row copy feedback
  const [copiedOrderCode, setCopiedOrderCode] = useState('');
  const copyTimerRef = useRef<number | null>(null);

  // Workspace modal
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [humanizerOrderCode, setHumanizerOrderCode] = useState('');

  // Auth gate states (Email & Password only — no Google Sign-In)
  const [authTab, setAuthTab] = useState<'login' | 'staff_register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Staff Registration 6 required fields + optional specialty
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regInviteCode, setRegInviteCode] = useState('');
  const [regSpecialty, setRegSpecialty] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Pre-signup live invite verification state
  const [verifiedInvite, setVerifiedInvite] = useState<TeamInvite | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(false);

  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [providerDisabledError, setProviderDisabledError] = useState(false);

  // Pending invites discovery for already-signed-in user without team role
  const [discoveredInvites, setDiscoveredInvites] = useState<TeamInvite[]>([]);
  const [claimInviteCode, setClaimInviteCode] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimSpecialty, setClaimSpecialty] = useState('');
  const [claimingInvite, setClaimingInvite] = useState(false);

  const isBootstrappedOwner = Boolean(
    user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  let effectiveRole = userProfile?.role || null;
  if (isBootstrappedOwner) {
    effectiveRole = 'owner';
  }

  const isSuspended = userProfile?.status === 'suspended' && !isBootstrappedOwner;
  const isAdmin =
    !isSuspended && (effectiveRole === 'owner' || effectiveRole === 'admin');
  const isStaff = !isSuspended && effectiveRole === 'staff';
  const isTeamMember = isAdmin || isStaff;

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  // Reset tab if staff lands on an admin-only tab
  useEffect(() => {
    if (
      isStaff &&
      activeTab !== 'orders' &&
      activeTab !== 'calendar' &&
      activeTab !== 'humanizer'
    ) {
      setActiveTab('orders');
    }
  }, [isStaff, activeTab]);

  // Discover pending invites if a user is signed in without a profile yet
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
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, userProfile, isBootstrappedOwner, claimInviteCode]);

  // Real-time role-scoped Firestore subscriptions
  useEffect(() => {
    if (!authReady || profileLoading || !user || !isTeamMember) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    const unsubOrders = subscribeOrders({ uid: user.uid, isAdmin }, (list) => {
      setOrders(list);
      setDataLoading(false);
    });

    if (!isAdmin) {
      setClients([]);
      setRevisions([]);
      setTeamUsers([]);
      setTeamInvites([]);
      return () => {
        unsubOrders();
      };
    }

    const unsubClients = subscribeClients((list) => setClients(list));
    const unsubBank = subscribeBankSettings((cfg) => setBankSettings(cfg));
    const unsubRevs = subscribeAllRevisionsAdmin((list) => setRevisions(list));
    const unsubUsers = subscribeAllUsersAdmin((list) => setTeamUsers(list));
    const unsubInvites = subscribeTeamInvitesAdmin((list) => setTeamInvites(list));

    return () => {
      unsubOrders();
      unsubClients();
      unsubBank();
      unsubRevs();
      unsubUsers();
      unsubInvites();
    };
  }, [authReady, profileLoading, user, isTeamMember, isAdmin]);

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
      // CRITICAL STEP 1: Pre-verify inviteCode AND exact invited email in Firestore BEFORE creating Auth user
      const matchedInvite = await verifyTeamInviteBeforeSignup({
        inviteCode: code,
        email: normalizedEmail,
      });
      setVerifiedInvite(matchedInvite);

      // STEP 2: Create Firebase Auth account with Email & Password
      const cred = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        regPassword
      );
      await updateProfile(cred.user, { displayName: trimmedName });

      // STEP 3: Atomically claim invite & create active /users/{uid} profile with phoneNumber
      await acceptTeamInviteAndCreateProfile({
        user: cred.user,
        inviteCode: code,
        displayName: trimmedName,
        phoneNumber: trimmedPhone,
        specialty: regSpecialty.trim() || matchedInvite.specialty || '',
      });

      await onRefreshProfile();
      onToast(`Đăng ký thành công! Chào mừng ${trimmedName} gia nhập đội ngũ.`);
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

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAuthError('');
      onToast('Đã đăng xuất khỏi cổng Điều hành.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Đăng xuất thất bại.');
    }
  };

  const openNewOrder = () => {
    setEditingOrder(null);
    setWorkspaceOpen(true);
  };

  const openEditOrder = (order: OrderRecord) => {
    setEditingOrder(order);
    setWorkspaceOpen(true);
  };

  const handleOpenHumanizerForOrder = (code: string) => {
    setWorkspaceOpen(false);
    setHumanizerOrderCode(code);
    setActiveTab('humanizer');
  };

  const handleAttachHumanizedDocx = async (order: OrderRecord, file: File) => {
    const existingAttachments = order.attachments || [];
    if (existingAttachments.length >= FIELD_LIMITS.attachmentsMax) {
      throw new Error(`Đơn #${order.orderCode} đã đạt giới hạn ${FIELD_LIMITS.attachmentsMax} tệp đính kèm.`);
    }

    const uploaded = await uploadFileToServer(file, {
      isLocked: false,
      category: 'draft',
    });

    const newItem: AttachmentItem = {
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: uploaded.fileName,
      category: 'draft',
      sourceType: 'upload',
      fileIdOrUrl: uploaded.url,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      isPaymentLocked: false,
      previewMaxPages: 999,
      uploadedAt: new Date().toISOString(),
    };

    await saveOrder(
      {
        orderCode: order.orderCode,
        subject: order.subject,
        topic: order.topic,
        wordCount: order.wordCount,
        citationStyle: order.citationStyle,
        outlineAndInstructions: order.outlineAndInstructions,
        rubricNotes: order.rubricNotes,
        deadlineAt: order.deadlineAt,
        stage: order.stage,
        progressPercent: order.progressPercent,
        publicStatusNote: order.publicStatusNote,
        internalNotes: order.internalNotes,
        orderStatus: order.orderStatus,
        totalAmount: order.totalAmount,
        depositAmount: order.depositAmount,
        paidAmount: order.paidAmount,
        paymentStatus: order.paymentStatus,
        clientId: order.clientId,
        clientDisplayName: order.clientDisplayName,
        assignedStaffUid: order.assignedStaffUid,
        assignedStaffName: order.assignedStaffName,
        attachments: [...existingAttachments, newItem],
      },
      bankSettings,
      order.id,
      order.createdAt,
      effectiveRole === 'staff' ? 'staff' : 'admin'
    );
  };

  const handleCopyOrderCode = async (orderCode: string) => {
    const ok = await copyTextToClipboard(orderCode);
    if (!ok) {
      onToast('Không thể sao chép mã đơn vào clipboard.');
      return;
    }
    setCopiedOrderCode(orderCode);
    onToast(`Đã sao chép mã đơn #${orderCode}`);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopiedOrderCode(''), 1800);
  };

  const metrics = useMemo(() => {
    const activeOrders = orders.filter((o) => o.orderStatus === 'active');
    const completedCount = orders.filter((o) => o.orderStatus === 'completed').length;
    const urgentCount = activeOrders.filter((o) => {
      const info = evaluateDeadline(o.deadlineAt, nowMs, o.orderStatus);
      return info.level === 'urgent' || info.level === 'overdue';
    }).length;
    const openRevisionsCount = revisions.filter((r) => r.status !== 'resolved').length;
    const receivable = orders
      .filter((o) => o.orderStatus !== 'cancelled')
      .reduce((acc, o) => acc + Math.max(0, o.totalAmount - o.paidAmount), 0);

    return {
      activeCount: activeOrders.length,
      completedCount,
      urgentCount,
      openRevisionsCount,
      receivable,
    };
  }, [orders, revisions, nowMs]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (filter === 'active' && o.orderStatus !== 'active') return false;
      if (filter === 'completed' && o.orderStatus !== 'completed') return false;
      if (filter === 'urgent') {
        const info = evaluateDeadline(o.deadlineAt, nowMs, o.orderStatus);
        if (info.level !== 'urgent' && info.level !== 'overdue') return false;
      }
      if (filter === 'unpaid_balance') {
        if (o.orderStatus === 'cancelled' || o.paymentStatus === 'fully_paid') {
          return false;
        }
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        o.orderCode.toLowerCase().includes(q) ||
        o.subject.toLowerCase().includes(q) ||
        o.topic.toLowerCase().includes(q) ||
        o.clientDisplayName.toLowerCase().includes(q) ||
        (o.assignedStaffName || '').toLowerCase().includes(q)
      );
    });
  }, [orders, filter, search, nowMs]);

  const existingOrderCodes = useMemo(() => orders.map((o) => o.orderCode), [orders]);

  // --- Auth Loading / Sign-In Gate ---
  if (!authReady || (user && profileLoading && !isBootstrappedOwner)) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center text-sm text-zinc-500">
        Đang kiểm tra phiên đăng nhập & phân quyền...
      </div>
    );
  }

  if (!user) {
    const inputFieldCls =
      'w-full px-3.5 py-2.5 text-sm bg-zinc-50/90 border border-zinc-200 rounded-xl text-slate-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA] transition-colors';

    const loginSubmitLabel = authBusy
      ? 'Đang xác thực...'
      : 'Đăng nhập vào Hệ thống';

    return (
      <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A] flex flex-col">
        {/* Top Bar Contract: 1-row, 3 distinct zones separated by gap-8 */}
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
              <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                AssignTrack
              </span>
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
                    ? 'text-[#4338CA] font-semibold'
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
                    ? 'text-[#4338CA] font-semibold'
                    : 'hover:text-slate-900'
                }`}
              >
                Đăng ký Nhân sự (Mã mời)
              </button>
            </nav>

            <button
              type="button"
              onClick={() => onSwitchToClientPortal()}
              className="btn-press px-3.5 py-1.5 text-xs font-medium text-[#4338CA] bg-indigo-50 hover:bg-indigo-100 rounded-lg whitespace-nowrap shrink-0"
            >
              Cổng Khách hàng →
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8 sm:py-12">
          <div className="surface-enter max-w-xl w-full mx-auto">
            <section className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-[0_8px_28px_rgb(15,23,42,0.03)]">
              <div className="space-y-6">
                {/* Segmented Mode Switcher */}
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
                        ? 'bg-white text-[#4338CA] shadow-xs'
                        : 'text-zinc-600 hover:text-slate-900'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>Đăng ký Nhân sự (Mã mời)</span>
                  </button>
                </div>

                {/* Actionable Firebase Console Email/Password Provider Guide if not enabled yet */}
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
                            className="text-xs font-medium text-[#4338CA] hover:underline"
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
                        className="btn-press w-full py-2.5 px-4 text-sm font-semibold bg-[#4338CA] text-white rounded-xl hover:bg-[#3730A3] disabled:opacity-45"
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
                        className="btn-press font-semibold text-[#4338CA] hover:underline"
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
                              className="btn-press px-3 py-2.5 text-xs font-semibold bg-indigo-50 text-[#4338CA] border border-indigo-200 rounded-xl hover:bg-indigo-100 whitespace-nowrap shrink-0 disabled:opacity-45"
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
                        className="btn-press w-full py-2.5 px-4 text-sm font-semibold bg-[#4338CA] text-white rounded-xl hover:bg-[#3730A3] disabled:opacity-45"
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
                  onClick={() => onSwitchToClientPortal()}
                  className="btn-press font-medium text-[#4338CA] hover:underline"
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

  // Suspended team account
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
            onClick={handleSignOut}
            className="btn-press px-4 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-lg"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  // Client account trying to enter Admin Portal
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
              onClick={() => onSwitchToClientPortal()}
              className="btn-press px-4 py-2 text-xs font-medium bg-[#4338CA] text-white rounded-lg"
            >
              Mở Cổng Khách hàng
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="btn-press px-4 py-2 text-xs font-medium bg-zinc-100 text-slate-900 rounded-lg"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Signed in user without profile yet -> claim invite code or switch to Client Portal
  if (!isTeamMember) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="surface-enter max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 sm:p-7 space-y-5 shadow-[0_12px_32px_rgb(15,23,42,0.04)]">
          <div className="space-y-1.5">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#4338CA]">
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
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
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
              className="btn-press w-full py-2.5 px-4 text-sm font-medium bg-[#4338CA] text-white rounded-xl hover:bg-[#3730A3] disabled:opacity-45"
            >
              {claimingInvite ? 'Đang kích hoạt...' : 'Xác nhận kích hoạt Nhân sự'}
            </button>
          </form>

          <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onSwitchToClientPortal()}
              className="btn-press text-xs font-medium text-[#4338CA] hover:underline"
            >
              Sang Cổng Khách hàng →
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="btn-press text-xs font-medium text-zinc-500 hover:text-slate-900"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allNavItems: {
    key: AdminTab;
    label: string;
    icon: typeof LayoutList;
    badge?: number;
    adminOnly?: boolean;
  }[] = [
    {
      key: 'orders',
      label: isStaff ? 'Đơn được giao' : 'Đơn hàng',
      icon: LayoutList,
      badge: metrics.urgentCount > 0 ? metrics.urgentCount : undefined,
    },
    { key: 'calendar', label: 'Lịch Deadline', icon: Calendar },
    { key: 'humanizer', label: 'Humanize Word (HIX)', icon: FileText },
    { key: 'clients', label: 'Khách hàng (CRM)', icon: Users, adminOnly: true },
    { key: 'revenue', label: 'Doanh thu', icon: TrendingUp, adminOnly: true },
    { key: 'team', label: 'Nhân sự & Phân quyền', icon: ShieldCheck, adminOnly: true },
    { key: 'settings', label: 'Thanh toán & QR', icon: CreditCard, adminOnly: true },
  ];

  const navItems = allNavItems.filter((item) => !item.adminOnly || isAdmin);
  const openRevisions = revisions.filter((r) => r.status !== 'resolved');

  let roleLabel = 'Admin';
  if (effectiveRole === 'owner') {
    roleLabel = 'Chủ hệ thống';
  } else if (effectiveRole === 'staff') {
    roleLabel = 'Nhân sự';
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A] flex">
      {/* Desktop 240px Sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-zinc-200/80">
        <div className="px-5 h-14 border-b border-zinc-200/80 flex items-center justify-between gap-2">
          <span className="text-base font-bold tracking-tight text-slate-900 truncate">
            AssignTrack
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-[#4338CA] shrink-0">
            {roleLabel}
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`btn-press w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
                  active
                    ? 'bg-indigo-50 text-[#4338CA]'
                    : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span className="font-mono text-[11px] font-semibold text-[#DC2626] tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-200/80 space-y-2">
          <button
            type="button"
            onClick={() => onSwitchToClientPortal()}
            className="btn-press w-full px-3 py-2 text-xs font-medium text-left text-zinc-700 bg-zinc-100 hover:bg-zinc-200/80 rounded-lg"
          >
            Xem cổng Khách hàng →
          </button>

          <div className="px-2 py-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-800 truncate">
                {userProfile?.displayName || user.displayName || roleLabel}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Đăng xuất"
              className="btn-press p-1.5 text-zinc-400 hover:text-slate-900 rounded-md shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-40 md:hidden bg-slate-950/45 backdrop-blur-[1px]"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="drawer-panel w-64 h-full bg-white border-r border-zinc-200 p-4 flex flex-col justify-between shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-base font-bold text-slate-900">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#4338CA]" aria-hidden="true" />
                  AssignTrack
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Đóng menu"
                  className="btn-press p-1 text-zinc-500 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.key);
                        setMobileMenuOpen(false);
                      }}
                      className={`btn-press w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg ${
                        activeTab === item.key
                          ? 'bg-indigo-50 text-[#4338CA]'
                          : 'text-zinc-600'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSwitchToClientPortal();
                }}
                className="btn-press w-full px-3 py-2 text-xs font-medium bg-zinc-100 rounded-lg text-left"
              >
                Xem cổng Khách hàng →
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleSignOut();
                }}
                className="btn-press w-full px-3 py-2 text-xs font-medium text-[#DC2626] bg-red-50 rounded-lg text-left"
              >
                Đăng xuất ({user.email})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:pl-60 flex flex-col min-w-0">
        {/* Translucent Contextual Top Header */}
        <header className="sticky-glass border-b border-zinc-200/80 px-5 h-14 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="btn-press md:hidden p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-slate-900 truncate">
              {navItems.find((n) => n.key === activeTab)?.label}
            </span>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={openNewOrder}
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo đơn mới
            </button>
          )}
        </header>

        <main className="p-5 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
          {activeTab === 'orders' && (
            <>
              {/* Cohesive Operational Strip */}
              <div className="bg-white border border-zinc-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200/80">
                <div className="p-4 sm:px-5">
                  <p className="text-xs text-zinc-500">Đơn đang thực hiện</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {metrics.activeCount}
                  </p>
                </div>
                <div className="p-4 sm:px-5">
                  <p className="text-xs text-zinc-500">Sắp hạn (&lt;24h) / Quá hạn</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-[#DC2626] mt-1">
                    {metrics.urgentCount}
                  </p>
                </div>
                {isAdmin ? (
                  <>
                    <div className="p-4 sm:px-5">
                      <p className="text-xs text-zinc-500">Yêu cầu sửa chưa xong</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-[#4338CA] mt-1">
                        {metrics.openRevisionsCount}
                      </p>
                    </div>
                    <div className="p-4 sm:px-5">
                      <p className="text-xs text-zinc-500">Công nợ cần thu</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-[#D97706] mt-1">
                        {formatVnd(metrics.receivable)}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 sm:px-5">
                      <p className="text-xs text-zinc-500">Đơn đã hoàn thành</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-[#16A34A] mt-1">
                        {metrics.completedCount}
                      </p>
                    </div>
                    <div className="p-4 sm:px-5">
                      <p className="text-xs text-zinc-500">Tổng đơn được phân công</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-[#4338CA] mt-1">
                        {orders.length}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Open Revision Alerts (Admin Only) */}
              {isAdmin && openRevisions.length > 0 && (
                <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#D97706]">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Có {openRevisions.length} yêu cầu chỉnh sửa từ khách hàng cần xử lý
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {openRevisions.slice(0, 5).map((rev) => {
                      const matched = orders.find((o) => o.orderCode === rev.orderCode);
                      return (
                        <button
                          key={rev.id}
                          type="button"
                          onClick={() => matched && openEditOrder(matched)}
                          className="btn-press text-xs bg-amber-50/80 hover:bg-amber-100/80 text-slate-800 border border-amber-200 rounded-lg px-3 py-1.5 text-left"
                        >
                          <span className="font-mono font-semibold">
                            #{rev.orderCode}
                          </span>
                          : {rev.message.slice(0, 60)}
                          {rev.message.length > 60 ? '...' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search & Segmented Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm mã đơn, môn học, chủ đề, người làm..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg overflow-x-auto">
                  {(
                    [
                      ['all', 'Tất cả'],
                      ['active', 'Đang làm'],
                      ['urgent', 'Gấp <24h'],
                      ...(isAdmin ? [['unpaid_balance', 'Còn công nợ'] as const] : []),
                      ['completed', 'Hoàn thành'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`btn-press px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                        filter === key
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-zinc-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orders Data Grid */}
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                {dataLoading ? (
                  <div className="p-6 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-zinc-100 rounded-lg" />
                    ))}
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="py-16 px-4 text-center space-y-3">
                    <FileSpreadsheet className="w-7 h-7 text-zinc-400 mx-auto" />
                    <p className="text-sm font-semibold text-slate-900">
                      {isStaff
                        ? 'Bạn chưa được phân công đơn hàng nào'
                        : 'Chưa có đơn hàng nào phù hợp'}
                    </p>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                      {isStaff
                        ? 'Khi Admin giao đơn hàng mới cho bạn, đơn sẽ tự động xuất hiện tại đây.'
                        : 'Tạo ticket đơn hàng đầu tiên để theo dõi deadline, tạo mã tra cứu cho khách và quản lý công nợ.'}
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={openNewOrder}
                        className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tạo đơn hàng đầu tiên
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-semibold text-zinc-600">
                          <th className="py-3 px-4">Mã đơn</th>
                          <th className="py-3 px-4">Bài làm & Khách hàng</th>
                          <th className="py-3 px-4">Deadline</th>
                          <th className="py-3 px-4">Tiến độ</th>
                          {isAdmin && <th className="py-3 px-4 text-right">Công nợ (VNĐ)</th>}
                          <th className="py-3 px-4 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {filteredOrders.map((ord) => {
                          const stageMeta = getStageMeta(ord.stage);
                          const rem = Math.max(0, ord.totalAmount - ord.paidAmount);
                          const isCopied = copiedOrderCode === ord.orderCode;
                          return (
                            <tr
                              key={ord.id}
                              onClick={() => openEditOrder(ord)}
                              className="hover-row cursor-pointer"
                            >
                              <td
                                className="py-3 px-4 align-top whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditOrder(ord)}
                                    className="font-mono text-xs font-semibold text-[#4338CA] hover:underline"
                                  >
                                    #{ord.orderCode}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyOrderCode(ord.orderCode)}
                                    title="Chép mã đơn hàng"
                                    aria-label={`Chép mã đơn ${ord.orderCode}`}
                                    className="btn-press p-1 text-zinc-400 hover:text-slate-900 rounded"
                                  >
                                    {isCopied ? (
                                      <Check key="check" className="icon-morph w-3.5 h-3.5 text-[#16A34A]" />
                                    ) : (
                                      <Copy key="copy" className="icon-morph w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              <td className="py-3 px-4 max-w-xs">
                                <p className="font-medium text-slate-900 truncate">
                                  {ord.topic}
                                </p>
                                <p className="text-xs text-zinc-500 truncate mt-0.5">
                                  {ord.clientDisplayName} · {ord.subject} ·{' '}
                                  <span className="font-mono tabular-nums">
                                    {ord.wordCount.toLocaleString('vi-VN')}w
                                  </span>{' '}
                                  · {ord.citationStyle}
                                </p>
                                {ord.assignedStaffName && (
                                  <p className="text-[11px] text-[#4338CA] font-medium mt-0.5 truncate">
                                    Phụ trách: {ord.assignedStaffName}
                                  </p>
                                )}
                              </td>

                              <td className="py-3 px-4 whitespace-nowrap">
                                <DeadlineBadge
                                  deadlineAt={ord.deadlineAt}
                                  nowMs={nowMs}
                                  orderStatus={ord.orderStatus}
                                  compact
                                />
                              </td>

                              <td className="py-3 px-4 min-w-[160px]">
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                  <span className="text-zinc-700 truncate">
                                    {stageMeta.step}. {stageMeta.shortLabel}
                                  </span>
                                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                    {ord.progressPercent}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                  <div
                                    className="progress-fill h-full w-full bg-[#4338CA]"
                                    style={{ transform: `scaleX(${ord.progressPercent / 100})` }}
                                  />
                                </div>
                              </td>

                              {isAdmin && (
                                <td className="py-3 px-4 text-right whitespace-nowrap font-mono tabular-nums text-xs">
                                  <div className="font-semibold text-slate-900">
                                    {formatVnd(ord.paidAmount)} / {formatVnd(ord.totalAmount)}
                                  </div>
                                  <div
                                    className={
                                      rem > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                                    }
                                  >
                                    {rem > 0 ? `Thiếu ${formatVnd(rem)}` : 'Đã đủ'}
                                  </div>
                                </td>
                              )}

                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditOrder(ord);
                                  }}
                                  className="btn-press px-2.5 py-1 text-xs font-medium text-[#4338CA] bg-indigo-50 hover:bg-indigo-100 rounded-md"
                                >
                                  Chi tiết
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              orders={orders}
              nowMs={nowMs}
              onSelectOrder={openEditOrder}
            />
          )}

          {activeTab === 'humanizer' && (
            <WordHumanizerView
              orders={orders}
              initialOrderCode={humanizerOrderCode}
              onAttachDocxToOrder={handleAttachHumanizedDocx}
              onToast={onToast}
            />
          )}

          {activeTab === 'clients' && isAdmin && (
            <ClientsCrmView clients={clients} orders={orders} onToast={onToast} />
          )}

          {activeTab === 'revenue' && isAdmin && (
            <RevenueDashboardView orders={orders} />
          )}

          {activeTab === 'team' && isAdmin && (
            <TeamManagementView
              currentUserUid={user.uid}
              users={teamUsers}
              invites={teamInvites}
              orders={orders}
              onToast={onToast}
            />
          )}

          {activeTab === 'settings' && isAdmin && (
            <BankSettingsView
              bankSettings={bankSettings}
              orders={orders}
              onToast={onToast}
            />
          )}
        </main>
      </div>

      <OrderWorkspaceModal
        isOpen={workspaceOpen}
        editingOrder={editingOrder}
        clients={clients}
        teamMembers={teamUsers}
        userRole={effectiveRole || 'staff'}
        editorDisplayName={userProfile?.displayName || user.displayName || 'Admin'}
        existingOrderCodes={existingOrderCodes}
        bankSettings={bankSettings}
        nowMs={nowMs}
        onClose={() => setWorkspaceOpen(false)}
        onOpenWordHumanizer={handleOpenHumanizerForOrder}
        onToast={onToast}
      />
    </div>
  );
}
