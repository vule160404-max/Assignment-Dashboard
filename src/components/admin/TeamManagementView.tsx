import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Check,
  Copy,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import {
  createTeamInvite,
  deleteUserProfileAdmin,
  revokeTeamInvite,
  updateTeamMemberProfile,
} from '../../services/firestoreService';
import { copyTextToClipboard } from '../../lib/utils';
import {
  FIELD_LIMITS,
  OrderRecord,
  TeamInvite,
  UserProfile,
  UserRole,
} from '../../types/domain';

interface TeamManagementViewProps {
  currentUserUid: string;
  users: UserProfile[];
  invites: TeamInvite[];
  orders: OrderRecord[];
  onToast: (msg: string) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Chủ hệ thống',
  admin: 'Admin quản lý',
  staff: 'Nhân sự / Writer',
  client: 'Khách hàng',
};

function getRoleBadgeStyle(role: UserRole): string {
  if (role === 'owner') return 'bg-blue-50 text-[#12489B] border-blue-200';
  if (role === 'admin') return 'bg-emerald-50 text-[#16A34A] border-emerald-200';
  if (role === 'staff') return 'bg-amber-50 text-[#D97706] border-amber-200';
  return 'bg-zinc-100 text-zinc-600 border-zinc-200';
}

export function TeamManagementView({
  currentUserUid,
  users,
  invites,
  orders,
  onToast,
}: TeamManagementViewProps) {
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<'staff' | 'admin'>('staff');
  const [inviteSpecialty, setInviteSpecialty] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [latestCreatedCode, setLatestCreatedCode] = useState('');
  const [updatingUid, setUpdatingUid] = useState('');
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const teamMembers = useMemo(
    () =>
      users.filter(
        (u) => u.role === 'owner' || u.role === 'admin' || u.role === 'staff'
      ),
    [users]
  );

  const clientAccounts = useMemo(
    () => users.filter((u) => u.role === 'client'),
    [users]
  );

  const assignedCountByUid = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      if (o.assignedStaffUid && o.orderStatus === 'active') {
        map[o.assignedStaffUid] = (map[o.assignedStaffUid] || 0) + 1;
      }
    });
    return map;
  }, [orders]);

  const activeTeamCount = teamMembers.filter((m) => m.status === 'active').length;
  const pendingInvites = invites.filter((i) => i.status === 'pending');

  const handleCopyInvite = async (code: string) => {
    const ok = await copyTextToClipboard(code);
    if (!ok) {
      onToast('Không thể sao chép mã mời.');
      return;
    }
    setCopiedCode(code);
    onToast(`Đã sao chép mã mời #${code}`);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopiedCode(''), 1800);
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    const displayName = inviteName.trim();
    if (!displayName || !email.includes('@')) {
      onToast('Vui lòng nhập họ tên và email hợp lệ của nhân sự.');
      return;
    }
    setCreating(true);
    try {
      const created = await createTeamInvite({
        email,
        displayName,
        phoneNumber: invitePhone.trim(),
        role: inviteRole,
        specialty: inviteSpecialty.trim(),
        createdByUid: currentUserUid,
      });
      setLatestCreatedCode(created.inviteCode);
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      setInviteSpecialty('');
      setInviteRole('staff');
      onToast(`Đã tạo mã mời ${created.inviteCode} cho ${email}`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Tạo lời mời thất bại.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeInvite = async (inviteCode: string) => {
    try {
      await revokeTeamInvite(inviteCode);
      onToast(`Đã thu hồi mã mời #${inviteCode}`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Thu hồi thất bại.');
    }
  };

  const handleRoleChange = async (member: UserProfile, nextRole: UserRole) => {
    if (member.role === 'owner') return;
    setUpdatingUid(member.uid);
    try {
      await updateTeamMemberProfile({
        uid: member.uid,
        role: nextRole,
        status: member.status,
        displayName: member.displayName,
        phoneNumber: member.phoneNumber,
        specialty: member.specialty,
      });
      onToast(`Đã cập nhật vai trò cho ${member.displayName}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Không thể đổi vai trò.');
    } finally {
      setUpdatingUid('');
    }
  };

  const handleToggleStatus = async (member: UserProfile) => {
    if (member.role === 'owner' || member.uid === currentUserUid) return;
    const nextStatus = member.status === 'active' ? 'suspended' : 'active';
    setUpdatingUid(member.uid);
    try {
      await updateTeamMemberProfile({
        uid: member.uid,
        role: member.role,
        status: nextStatus,
        displayName: member.displayName,
        phoneNumber: member.phoneNumber,
        specialty: member.specialty,
      });
      onToast(
        nextStatus === 'active'
          ? `Đã kích hoạt lại tài khoản ${member.displayName}.`
          : `Đã tạm khóa tài khoản ${member.displayName}.`
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại.');
    } finally {
      setUpdatingUid('');
    }
  };

  const handleDeleteMember = async (member: UserProfile) => {
    if (member.role === 'owner' || member.uid === currentUserUid) return;
    setUpdatingUid(member.uid);
    try {
      await deleteUserProfileAdmin(member.uid);
      onToast(`Đã xóa tài khoản ${member.email} khỏi hệ thống.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Xóa tài khoản thất bại.');
    } finally {
      setUpdatingUid('');
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]';

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="bg-white border border-zinc-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/80">
        <div className="p-4 sm:px-5">
          <p className="text-xs text-zinc-500">Nhân sự & Quản lý đang hoạt động</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {activeTeamCount}
          </p>
        </div>
        <div className="p-4 sm:px-5">
          <p className="text-xs text-zinc-500">Lời mời đang chờ kích hoạt</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#12489B] mt-1">
            {pendingInvites.length}
          </p>
        </div>
        <div className="p-4 sm:px-5">
          <p className="text-xs text-zinc-500">Tài khoản Khách hàng đã đăng ký</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#16A34A] mt-1">
            {clientAccounts.length}
          </p>
        </div>
      </div>

      {/* Create Invite Card */}
      <section className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#12489B]" />
              Mời người làm cùng / Nhân sự mới
            </h2>
            <p className="text-xs text-zinc-500 mt-1 max-w-[65ch]">
              Tạo mã mời gắn với đúng email của cộng tác viên. Người được mời chỉ cần vào tab
              {' '}<span className="font-semibold text-slate-700">Đăng ký Nhân sự</span>{' '}
              và nhập mã này để vào làm việc ngay.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateInvite} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Tên nhân sự *
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.displayNameMax}
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="VD: Minh Anh (Writer)"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Email được mời *
            </label>
            <input
              type="email"
              required
              maxLength={FIELD_LIMITS.emailMax}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="writer@gmail.com"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Số điện thoại
            </label>
            <input
              type="tel"
              maxLength={FIELD_LIMITS.phoneMax}
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
              placeholder="0912 345 678"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Vai trò phân quyền
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'staff' | 'admin')}
              className={inputCls}
            >
              <option value="staff">Nhân sự / Writer (Chỉ xem đơn được giao)</option>
              <option value="admin">Admin quản lý (Toàn quyền vận hành)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Chuyên môn phụ trách
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.specialtyMax}
              value={inviteSpecialty}
              onChange={(e) => setInviteSpecialty(e.target.value)}
              placeholder="VD: Finance, SPSS, Law..."
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-zinc-500">
              Chỉ khi nhân sự nhập đúng <span className="font-semibold text-slate-700">Email được mời</span> và <span className="font-semibold text-slate-700">Mã mời (TEAM-XXXXXX)</span> thì việc đăng ký mới thành công.
            </p>
            <button
              type="submit"
              disabled={creating}
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] disabled:opacity-45 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {creating ? 'Đang tạo mã...' : 'Tạo mã mời nhân sự'}
            </button>
          </div>
        </form>

        {latestCreatedCode && (
          <div className="surface-enter bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[#12489B]">
                Mã mời nhân sự mới đã sẵn sàng — Gửi mã này cho cộng tác viên:
              </p>
              <p className="font-mono text-base font-bold text-slate-900">
                {latestCreatedCode}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopyInvite(latestCreatedCode)}
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-blue-200 text-[#12489B] rounded-lg hover:bg-blue-50"
            >
              {copiedCode === latestCreatedCode ? (
                <>
                  <Check key="check" className="icon-morph w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy key="copy" className="icon-morph w-3.5 h-3.5" />
                  <span>Chép mã mời</span>
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {/* Active Team Table */}
      <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#12489B]" />
            Đội ngũ Quản trị & Nhân sự ({teamMembers.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-semibold text-zinc-600">
                <th className="py-3 px-4">Thành viên</th>
                <th className="py-3 px-4">Số điện thoại</th>
                <th className="py-3 px-4">Chuyên môn</th>
                <th className="py-3 px-4">Đơn đang nhận</th>
                <th className="py-3 px-4">Vai trò</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {teamMembers.map((member) => {
                const isOwnerRow = member.role === 'owner';
                const isSelf = member.uid === currentUserUid;
                const activeAssigned = assignedCountByUid[member.uid] || 0;
                const isBusy = updatingUid === member.uid;

                return (
                  <tr key={member.uid} className="hover-row">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">
                        {member.displayName}
                        {isSelf && (
                          <span className="ml-1.5 text-[11px] font-mono text-zinc-400">
                            (Bạn)
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-mono text-zinc-500">{member.email}</p>
                    </td>

                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-zinc-600">
                      {member.phoneNumber || '—'}
                    </td>

                    <td className="py-3 px-4 text-xs text-zinc-600">
                      {member.specialty || '—'}
                    </td>

                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-800">
                      {activeAssigned} đơn
                    </td>

                    <td className="py-3 px-4">
                      {isOwnerRow ? (
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md border ${getRoleBadgeStyle(
                            member.role
                          )}`}
                        >
                          {ROLE_LABELS[member.role]}
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          disabled={isBusy || isSelf}
                          onChange={(e) =>
                            handleRoleChange(member, e.target.value as UserRole)
                          }
                          className="text-xs font-medium px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 disabled:opacity-60"
                        >
                          <option value="staff">Nhân sự / Writer</option>
                          <option value="admin">Admin quản lý</option>
                          <option value="client">Hạ xuống Khách hàng</option>
                        </select>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {member.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border bg-emerald-50 text-[#16A34A] border-emerald-200">
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border bg-red-50 text-[#DC2626] border-red-200">
                          Đã khóa
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {(() => {
                        if (isOwnerRow || isSelf) {
                          return <span className="text-xs text-zinc-400">Mặc định</span>;
                        }
                        return (
                          <div className="inline-flex items-center gap-1.5">
                            {member.status === 'active' ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleToggleStatus(member)}
                                className="btn-press inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-lg disabled:opacity-45 text-[#D97706] bg-white border-amber-200 hover:bg-amber-50"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                Khóa quyền
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleToggleStatus(member)}
                                className="btn-press inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-lg disabled:opacity-45 text-[#16A34A] bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                Mở lại
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteMember(member)}
                              title="Xóa tài khoản khỏi hệ thống"
                              aria-label="Xóa tài khoản"
                              className="btn-press p-1.5 text-zinc-400 hover:text-[#DC2626] hover:bg-red-50 border border-zinc-200 hover:border-red-200 rounded-lg disabled:opacity-45"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invites History */}
      <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200/80">
          <h3 className="text-sm font-bold text-slate-900">
            Danh sách Mã mời đã phát hành ({invites.length})
          </h3>
        </div>

        {invites.length === 0 ? (
          <p className="p-8 text-center text-xs text-zinc-500">
            Chưa có lời mời nhân sự nào được tạo.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {invites.map((inv) => {
              const isCopied = copiedCode === inv.inviteCode;
              let statusBadge = (
                <span className="px-2 py-0.5 text-xs font-medium rounded-md border bg-zinc-100 text-zinc-500 border-zinc-200">
                  Đã thu hồi
                </span>
              );
              if (inv.status === 'pending') {
                statusBadge = (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-md border bg-blue-50 text-[#12489B] border-blue-200">
                    Đang chờ kích hoạt
                  </span>
                );
              } else if (inv.status === 'accepted') {
                statusBadge = (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-md border bg-emerald-50 text-[#16A34A] border-emerald-200">
                    Đã kích hoạt
                  </span>
                );
              }

              return (
                <div
                  key={inv.inviteCode}
                  className="hover-row p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#12489B]">
                        #{inv.inviteCode}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {inv.displayName}
                      </span>
                      {statusBadge}
                    </div>
                    <p className="text-xs text-zinc-500 font-mono">
                      {inv.email}
                      {inv.phoneNumber ? ` · ${inv.phoneNumber}` : ''}
                      {` · Vai trò: ${inv.role === 'admin' ? 'Admin' : 'Nhân sự'}`}
                      {inv.specialty ? ` · ${inv.specialty}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {inv.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopyInvite(inv.inviteCode)}
                          className="btn-press inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-900 rounded-lg"
                        >
                          {isCopied ? (
                            <>
                              <Check key="check" className="icon-morph w-3.5 h-3.5 text-[#16A34A]" />
                              <span>Đã chép</span>
                            </>
                          ) : (
                            <>
                              <Copy key="copy" className="icon-morph w-3.5 h-3.5" />
                              <span>Chép mã</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.inviteCode)}
                          className="btn-press inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#DC2626] bg-white border border-red-200 hover:bg-red-50 rounded-lg"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Thu hồi
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Registered Clients Promotion List (optional utility if someone registered as client first) */}
      {clientAccounts.length > 0 && (
        <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200/80">
            <h3 className="text-sm font-bold text-slate-900">
              Tài khoản Khách hàng đã đăng ký ({clientAccounts.length})
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Nếu nhân sự đã lỡ đăng ký ở cổng Khách hàng trước đó, bạn có thể nâng cấp trực tiếp thành Nhân sự tại đây.
            </p>
          </div>
          <div className="divide-y divide-zinc-100">
            {clientAccounts.map((cli) => (
              <div
                key={cli.uid}
                className="hover-row p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{cli.displayName}</p>
                  <p className="text-xs font-mono text-zinc-500">{cli.email}</p>
                </div>
                <button
                  type="button"
                  disabled={updatingUid === cli.uid}
                  onClick={() => handleRoleChange(cli, 'staff')}
                  className="btn-press px-3 py-1.5 text-xs font-medium bg-blue-50 text-[#12489B] hover:bg-blue-100 rounded-lg"
                >
                  Chuyển thành Nhân sự (Staff)
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
