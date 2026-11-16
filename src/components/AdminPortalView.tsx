import { useEffect, useMemo, useState } from 'react';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import {
  AlertCircle,
  Calendar,
  Copy,
  CreditCard,
  FileSpreadsheet,
  LayoutList,
  LogOut,
  Menu,
  Plus,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { ADMIN_EMAIL, auth, googleProvider } from '../lib/firebase';
import {
  DEFAULT_BANK_SETTINGS,
  subscribeAllRevisionsAdmin,
  subscribeBankSettings,
  subscribeClients,
  subscribeOrders,
} from '../services/firestoreService';
import { evaluateDeadline, formatVnd, getStageMeta } from '../lib/utils';
import {
  BankSettings,
  ClientRecord,
  OrderRecord,
  RevisionRequest,
} from '../types/domain';
import { BankSettingsView } from './BankSettingsView';
import { CalendarView } from './CalendarView';
import { ClientsCrmView } from './ClientsCrmView';
import { DeadlineBadge } from './DeadlineBadge';
import { OrderWorkspaceModal } from './OrderWorkspaceModal';
import { RevenueDashboardView } from './RevenueDashboardView';

type AdminTab = 'orders' | 'calendar' | 'clients' | 'revenue' | 'settings';
type OrderFilter = 'all' | 'active' | 'urgent' | 'unpaid_balance' | 'completed';

interface AdminPortalViewProps {
  user: User | null;
  authReady: boolean;
  nowMs: number;
  onSwitchToClientPortal: (orderCode?: string) => void;
  onToast: (msg: string) => void;
}

export function AdminPortalView({
  user,
  authReady,
  nowMs,
  onSwitchToClientPortal,
  onToast,
}: AdminPortalViewProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [bankSettings, setBankSettings] = useState<BankSettings>(DEFAULT_BANK_SETTINGS);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Orders filter & search
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<OrderFilter>('all');

  // Workspace modal
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [authError, setAuthError] = useState('');

  const isAuthorizedAdmin =
    Boolean(user) &&
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    user?.emailVerified;

  useEffect(() => {
    if (!authReady || !isAuthorizedAdmin) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    const unsubOrders = subscribeOrders((list) => {
      setOrders(list);
      setDataLoading(false);
    });
    const unsubClients = subscribeClients((list) => setClients(list));
    const unsubBank = subscribeBankSettings((cfg) => setBankSettings(cfg));
    const unsubRevs = subscribeAllRevisionsAdmin((list) => setRevisions(list));

    return () => {
      unsubOrders();
      unsubClients();
      unsubBank();
      unsubRevs();
    };
  }, [authReady, isAuthorizedAdmin]);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Đăng nhập Google thất bại.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    onToast('Đã đăng xuất khỏi Admin Portal.');
  };

  const openNewOrder = () => {
    setEditingOrder(null);
    setWorkspaceOpen(true);
  };

  const openEditOrder = (order: OrderRecord) => {
    setEditingOrder(order);
    setWorkspaceOpen(true);
  };

  const handleCopyLink = async (orderCode: string) => {
    const link = `${window.location.origin}/?code=${encodeURIComponent(orderCode)}`;
    await navigator.clipboard.writeText(link);
    onToast(`Đã sao chép link khách cho #${orderCode}`);
  };

  const metrics = useMemo(() => {
    const activeOrders = orders.filter((o) => o.orderStatus === 'active');
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
        o.clientDisplayName.toLowerCase().includes(q)
      );
    });
  }, [orders, filter, search, nowMs]);

  const existingOrderCodes = useMemo(() => orders.map((o) => o.orderCode), [orders]);

  // --- Auth Loading / Sign-In Gate ---
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center text-sm text-zinc-500">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
        <header className="bg-white border-b border-zinc-200 px-6 py-3.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-8">
            <span className="text-lg font-bold tracking-tight text-slate-900">
              AssignTrack
            </span>
            <button
              type="button"
              onClick={() => onSwitchToClientPortal()}
              className="px-3.5 py-1.5 text-xs font-medium text-[#4338CA] bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors whitespace-nowrap"
            >
              Khách hàng tra cứu đơn
            </button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-zinc-200 rounded-xl p-7 space-y-5">
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold text-slate-900">
                AssignTrack Admin Portal
              </h1>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Đăng nhập bằng tài khoản Google Admin để quản lý đơn hàng assignment, deadline, CRM khách hàng và dòng tiền.
              </p>
            </div>

            {authError && (
              <div className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-lg p-3">
                {authError}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 text-sm font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Đăng nhập bằng Google ({ADMIN_EMAIL})
            </button>

            <div className="pt-3 border-t border-zinc-100 text-center">
              <button
                type="button"
                onClick={() => onSwitchToClientPortal()}
                className="text-xs font-medium text-[#4338CA] hover:underline"
              >
                Bạn là khách hàng? Nhập mã đơn hàng để theo dõi tiến độ →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-[#DC2626]">
            Tài khoản không có quyền Admin
          </h2>
          <p className="text-sm text-zinc-600">
            Bạn đang đăng nhập bằng <span className="font-mono">{user.email}</span>. Chỉ tài khoản Admin được cấp quyền ({ADMIN_EMAIL}) mới có thể truy cập Admin Portal.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="px-4 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-lg"
            >
              Đăng xuất
            </button>
            <button
              type="button"
              onClick={() => onSwitchToClientPortal()}
              className="px-4 py-2 text-xs font-medium bg-zinc-100 text-slate-900 rounded-lg"
            >
              Sang trang tra cứu khách hàng
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems: {
    key: AdminTab;
    label: string;
    icon: typeof LayoutList;
    badge?: number;
  }[] = [
    {
      key: 'orders',
      label: 'Đơn hàng',
      icon: LayoutList,
      badge: metrics.urgentCount > 0 ? metrics.urgentCount : undefined,
    },
    { key: 'calendar', label: 'Lịch Deadline', icon: Calendar },
    { key: 'clients', label: 'Khách hàng (CRM)', icon: Users },
    { key: 'revenue', label: 'Doanh thu', icon: TrendingUp },
    { key: 'settings', label: 'Thanh toán & QR', icon: CreditCard },
  ];

  const openRevisions = revisions.filter((r) => r.status !== 'resolved');

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A] flex">
      {/* Desktop 240px Sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-zinc-200">
        <div className="px-5 py-4 border-b border-zinc-200">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            AssignTrack
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
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-indigo-50 text-[#4338CA]'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-slate-900'
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

        <div className="p-3 border-t border-zinc-200 space-y-2">
          <button
            type="button"
            onClick={() => onSwitchToClientPortal()}
            className="w-full px-3 py-2 text-xs font-medium text-left text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
          >
            Xem cổng Khách hàng →
          </button>

          <div className="px-2 py-1.5 flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500 truncate">{user.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Đăng xuất"
              className="p-1.5 text-zinc-400 hover:text-slate-900 rounded-md"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-slate-950/40">
          <div className="w-64 h-full bg-white border-r border-zinc-200 p-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-slate-900">AssignTrack</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-zinc-500"
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
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg ${
                        activeTab === item.key
                          ? 'bg-indigo-50 text-[#4338CA]'
                          : 'text-zinc-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onSwitchToClientPortal();
              }}
              className="w-full px-3 py-2 text-xs font-medium bg-zinc-100 rounded-lg text-left"
            >
              Xem cổng Khách hàng →
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:pl-60 flex flex-col min-w-0">
        {/* Contextual Top Header */}
        <header className="bg-white border-b border-zinc-200 px-5 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-zinc-600 hover:bg-zinc-100 rounded-lg"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-slate-900 truncate">
              {navItems.find((n) => n.key === activeTab)?.label}
            </span>
          </div>

          <button
            type="button"
            onClick={openNewOrder}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo đơn mới
          </button>
        </header>

        <main className="p-5 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
          {activeTab === 'orders' && (
            <>
              {/* 4-Metric Operational Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs text-zinc-500">Đơn đang thực hiện</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                    {metrics.activeCount}
                  </p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs text-zinc-500">Sắp hạn (&lt;24h) / Quá hạn</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-[#DC2626] mt-1">
                    {metrics.urgentCount}
                  </p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs text-zinc-500">Yêu cầu sửa chưa xong</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-[#4338CA] mt-1">
                    {metrics.openRevisionsCount}
                  </p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs text-zinc-500">Công nợ cần thu</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-[#D97706] mt-1">
                    {formatVnd(metrics.receivable)}
                  </p>
                </div>
              </div>

              {/* Open Revision Alerts */}
              {openRevisions.length > 0 && (
                <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-2">
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
                          className="text-xs bg-amber-50 hover:bg-amber-100 text-slate-800 border border-amber-200 rounded-lg px-3 py-1.5 text-left"
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
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm mã đơn, môn học, chủ đề, khách..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg overflow-x-auto">
                  {(
                    [
                      ['all', 'Tất cả'],
                      ['active', 'Đang làm'],
                      ['urgent', 'Gấp <24h'],
                      ['unpaid_balance', 'Còn công nợ'],
                      ['completed', 'Hoàn thành'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        filter === key
                          ? 'bg-white text-slate-900 shadow-sm'
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
                      <div key={i} className="h-12 bg-zinc-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="py-16 px-4 text-center space-y-3">
                    <FileSpreadsheet className="w-7 h-7 text-zinc-400 mx-auto" />
                    <p className="text-sm font-semibold text-slate-900">
                      Chưa có đơn hàng nào phù hợp
                    </p>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Tạo ticket đơn hàng đầu tiên để theo dõi deadline, tạo link cho khách và quản lý công nợ.
                    </p>
                    <button
                      type="button"
                      onClick={openNewOrder}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tạo đơn hàng đầu tiên
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
                          <th className="py-3 px-4">Mã đơn</th>
                          <th className="py-3 px-4">Bài làm & Khách hàng</th>
                          <th className="py-3 px-4">Deadline</th>
                          <th className="py-3 px-4">Tiến độ</th>
                          <th className="py-3 px-4 text-right">Công nợ (VNĐ)</th>
                          <th className="py-3 px-4 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {filteredOrders.map((ord) => {
                          const stageMeta = getStageMeta(ord.stage);
                          const rem = Math.max(0, ord.totalAmount - ord.paidAmount);
                          return (
                            <tr
                              key={ord.id}
                              onClick={() => openEditOrder(ord)}
                              className="hover:bg-zinc-50/80 cursor-pointer transition-colors"
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
                                    onClick={() => handleCopyLink(ord.orderCode)}
                                    title="Chép link theo dõi cho khách"
                                    className="p-1 text-zinc-400 hover:text-slate-900 rounded"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
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
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-zinc-700 truncate">
                                    {stageMeta.step}. {stageMeta.shortLabel}
                                  </span>
                                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                    {ord.progressPercent}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#4338CA]"
                                    style={{ width: `${ord.progressPercent}%` }}
                                  />
                                </div>
                              </td>

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

                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditOrder(ord);
                                  }}
                                  className="px-2.5 py-1 text-xs font-medium text-[#4338CA] bg-indigo-50 hover:bg-indigo-100 rounded-md"
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

          {activeTab === 'clients' && (
            <ClientsCrmView clients={clients} orders={orders} onToast={onToast} />
          )}

          {activeTab === 'revenue' && <RevenueDashboardView orders={orders} />}

          {activeTab === 'settings' && (
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
        existingOrderCodes={existingOrderCodes}
        bankSettings={bankSettings}
        nowMs={nowMs}
        onClose={() => setWorkspaceOpen(false)}
        onToast={onToast}
      />
    </div>
  );
}
