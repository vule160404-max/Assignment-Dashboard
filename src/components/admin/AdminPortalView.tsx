import { useEffect, useMemo, useRef, useState } from 'react';
import { User, signOut } from 'firebase/auth';
import {
  AlertCircle,
  Calendar,
  Check,
  Copy,
  CreditCard,
  FileSpreadsheet,
  FileText,
  LayoutList,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { ADMIN_EMAIL, auth } from '../../lib/firebase';
import {
  DEFAULT_BANK_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  saveOrder,
  sendTelegramAdminAlert,
  subscribeAllRevisionsAdmin,
  subscribeAllUsersAdmin,
  subscribeBankSettings,
  subscribeClients,
  subscribeNotificationSettings,
  subscribeOrders,
  subscribeTeamInvitesAdmin,
  syncTelegramPreferencesToServer,
  uploadFileToServer,
} from '../../services/firestoreService';
import {
  ZaloTemplateType,
  buildClientZaloMessage,
  copyTextToClipboard,
  evaluateDeadline,
  formatDateTime,
  formatVnd,
  getStageMeta,
} from '../../lib/utils';
import {
  AttachmentItem,
  BankSettings,
  ClientRecord,
  FIELD_LIMITS,
  NotificationSettings,
  OrderRecord,
  RevisionRequest,
  TeamInvite,
  UserProfile,
} from '../../types/domain';
import { DeadlineBadge } from '../shared/DeadlineBadge';
import { BrandLogo } from '../shared/BrandLogo';
import { AdminAuthGate } from './AdminAuthGate';
import { AiWriterStudioView } from './AiWriterStudioView';
import { BankSettingsView } from './BankSettingsView';
import { CalendarView } from './CalendarView';
import { ClientsCrmView } from './ClientsCrmView';
import { OrderWorkspaceModal } from './OrderWorkspaceModal';
import { RevenueDashboardView } from './RevenueDashboardView';
import { TeamManagementView } from './TeamManagementView';
import { WordHumanizerView } from './WordHumanizerView';

type AdminTab = 'orders' | 'calendar' | 'ai_writer' | 'humanizer' | 'clients' | 'revenue' | 'team' | 'settings';
type OrderFilter = 'all' | 'active' | 'urgent' | 'unpaid_balance' | 'completed';

const ZALO_TPL_LABELS: Record<ZaloTemplateType, string> = {
  quote_deposit: 'Mời cọc',
  final_payment: 'Nhắc tất toán',
  handover: 'Bàn giao Final',
};

interface AdminPortalViewProps {
  user: User | null;
  emailVerified: boolean;
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
  emailVerified,
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
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
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
  const [writerOrderCode, setWriterOrderCode] = useState('');
  const syncedNotifKeyRef = useRef('');

  const isBootstrappedOwner = Boolean(
    user && emailVerified && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
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

  // Real-time role-scoped Firestore subscriptions (strictly gated on emailVerified)
  useEffect(() => {
    if (!authReady || profileLoading || !user || !emailVerified || !isTeamMember) {
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
    const unsubNotif = subscribeNotificationSettings((cfg) => {
      setNotificationSettings(cfg);
      const syncKey = `${cfg.telegramNotifyRevision}:${cfg.telegramNotifyMessage}:${cfg.telegramNotifyDeadline}`;
      if (syncedNotifKeyRef.current !== syncKey) {
        syncedNotifKeyRef.current = syncKey;
        void syncTelegramPreferencesToServer({
          telegramNotifyRevision: cfg.telegramNotifyRevision,
          telegramNotifyMessage: cfg.telegramNotifyMessage,
          telegramNotifyDeadline: cfg.telegramNotifyDeadline,
        }).catch(() => undefined);
      }
    });
    const unsubRevs = subscribeAllRevisionsAdmin((list) => setRevisions(list));
    const unsubUsers = subscribeAllUsersAdmin((list) => setTeamUsers(list));
    const unsubInvites = subscribeTeamInvitesAdmin((list) => setTeamInvites(list));

    return () => {
      unsubOrders();
      unsubClients();
      unsubBank();
      unsubNotif();
      unsubRevs();
      unsubUsers();
      unsubInvites();
    };
  }, [authReady, profileLoading, user, emailVerified, isTeamMember, isAdmin]);

  // Automatic Admin session-deduplicated Telegram deadline alerts (<24h, <6h, overdue)
  useEffect(() => {
    if (
      !isAdmin ||
      !emailVerified ||
      dataLoading ||
      orders.length === 0 ||
      !notificationSettings.telegramNotifyDeadline
    ) {
      return;
    }

    const storageKey = 'assigntrack_tg_deadline_sent_v1';
    const now = Date.now();
    let sentMap: Record<string, number> = {};
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) sentMap = JSON.parse(raw) as Record<string, number>;
    } catch {
      sentMap = {};
    }

    // Prune entries older than 72 hours
    for (const [k, ts] of Object.entries(sentMap)) {
      if (typeof ts !== 'number' || now - ts > 72 * 60 * 60 * 1000) {
        delete sentMap[k];
      }
    }

    const alertsToSend: { key: string; line: string }[] = [];
    for (const o of orders) {
      if (o.orderStatus !== 'active') continue;
      const diffMs = o.deadlineAt - now;
      let tier: 'overdue' | 'under_6h' | 'under_24h' | null = null;
      let tierLabel = '';
      if (diffMs <= 0) {
        tier = 'overdue';
        tierLabel = 'QUÁ HẠN';
      } else if (diffMs <= 6 * 60 * 60 * 1000) {
        tier = 'under_6h';
        tierLabel = 'Còn dưới 6 giờ';
      } else if (diffMs <= 24 * 60 * 60 * 1000) {
        tier = 'under_24h';
        tierLabel = 'Sắp hạn (<24h)';
      }

      if (!tier) continue;
      const dedupeKey = `${o.orderCode}:${tier}`;
      if (sentMap[dedupeKey]) continue;

      const badge = evaluateDeadline(o.deadlineAt, now, o.orderStatus);
      alertsToSend.push({
        key: dedupeKey,
        line: `• #${o.orderCode} (${o.subject}) — ${tierLabel} (${badge.countdownText}) · Hạn: ${formatDateTime(
          o.deadlineAt
        )}`,
      });
    }

    if (alertsToSend.length === 0) return;

    alertsToSend.forEach((a) => {
      sentMap[a.key] = now;
    });
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(sentMap));
    } catch {
      // Ignore storage quota issues
    }

    void sendTelegramAdminAlert({
      title: `Cảnh báo Deadline tự động (${alertsToSend.length} đơn)`,
      lines: alertsToSend.slice(0, 12).map((a) => a.line),
    });
  }, [isAdmin, dataLoading, orders, notificationSettings.telegramNotifyDeadline]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
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

  const handleOpenAiWriterForOrder = (code: string) => {
    setWorkspaceOpen(false);
    setWriterOrderCode(code);
    setActiveTab('ai_writer');
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
        staffPayoutAmount: order.staffPayoutAmount || 0,
        staffPayoutStatus: order.staffPayoutStatus === 'paid' ? 'paid' : 'unpaid',
        staffPayoutPaidAt: order.staffPayoutPaidAt || '',
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

  const handleQuickCopyZaloMessage = async (order: OrderRecord) => {
    let tpl: ZaloTemplateType = 'handover';
    if (order.paymentStatus === 'unpaid') {
      tpl = 'quote_deposit';
    } else if (order.paymentStatus !== 'fully_paid') {
      tpl = 'final_payment';
    }
    const text = buildClientZaloMessage(tpl, order, bankSettings);
    const ok = await copyTextToClipboard(text);
    if (!ok) {
      onToast('Không thể sao chép tin nhắn Zalo vào clipboard.');
      return;
    }
    onToast(`Đã chép tin nhắn Zalo (${ZALO_TPL_LABELS[tpl]}) cho #${order.orderCode}`);
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

  // --- Auth / Verification / Role Gate ---
  if (
    !authReady ||
    (user && profileLoading && !(isBootstrappedOwner && emailVerified)) ||
    !user ||
    !emailVerified ||
    isSuspended ||
    effectiveRole === 'client' ||
    !isTeamMember
  ) {
    return (
      <AdminAuthGate
        user={user}
        emailVerified={emailVerified}
        userProfile={userProfile}
        profileLoading={profileLoading}
        authReady={authReady}
        isBootstrappedOwner={isBootstrappedOwner}
        isSuspended={isSuspended}
        effectiveRole={effectiveRole}
        onSwitchToClientPortal={() => onSwitchToClientPortal()}
        onBackToRoleSelect={onBackToRoleSelect}
        onRefreshProfile={onRefreshProfile}
        onSignOut={handleSignOut}
        onToast={onToast}
      />
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
    { key: 'ai_writer', label: 'AI Writer Studio', icon: Wand2 },
    { key: 'humanizer', label: 'Humanize Word (HIX)', icon: FileText },
    { key: 'clients', label: 'Khách hàng (CRM)', icon: Users, adminOnly: true },
    { key: 'revenue', label: 'Doanh thu & Công CTV', icon: TrendingUp, adminOnly: true },
    { key: 'team', label: 'Nhân sự & Phân quyền', icon: ShieldCheck, adminOnly: true },
    { key: 'settings', label: 'Thanh toán & Cảnh báo', icon: CreditCard, adminOnly: true },
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
        <div className="px-4 h-14 border-b border-zinc-200/80 flex items-center justify-between gap-2">
          <BrandLogo className="min-w-0" />
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
                <BrandLogo />
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

        <main
          className={`p-5 sm:p-6 w-full mx-auto space-y-6 ${
            activeTab === 'ai_writer' ? 'max-w-[1440px]' : 'max-w-6xl'
          }`}
        >
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
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleQuickCopyZaloMessage(ord);
                                      }}
                                      title="Chép nhanh tin nhắn Zalo gửi khách"
                                      aria-label={`Chép tin nhắn Zalo cho đơn ${ord.orderCode}`}
                                      className="btn-press p-1.5 text-zinc-500 hover:text-[#4338CA] hover:bg-indigo-50 rounded-md"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditOrder(ord);
                                    }}
                                    className="btn-press px-2.5 py-1 text-xs font-medium text-[#4338CA] bg-indigo-50 hover:bg-indigo-100 rounded-md whitespace-nowrap"
                                  >
                                    Chi tiết
                                  </button>
                                </div>
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

          {activeTab === 'ai_writer' && (
            <AiWriterStudioView
              orders={orders}
              initialOrderCode={writerOrderCode}
              onAttachDocxToOrder={async (ord, file) => {
                await handleAttachHumanizedDocx(ord, file);
                onToast(`Đã đính kèm bản thảo Word (${file.name}) vào đơn #${ord.orderCode}!`);
              }}
              onSendDocxToHumanizer={(orderCode, file) => {
                // Download file and switch directly to humanizer tab
                const url = URL.createObjectURL(file);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setHumanizerOrderCode(orderCode);
                setActiveTab('humanizer');
                onToast(
                  `Đã xuất "${file.name}" và chuyển sang tab Word Humanizer!`
                );
              }}
              onToast={onToast}
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
            <RevenueDashboardView orders={orders} onToast={onToast} />
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
              notificationSettings={notificationSettings}
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
        onOpenAiWriter={handleOpenAiWriterForOrder}
        onToast={onToast}
      />
    </div>
  );
}
