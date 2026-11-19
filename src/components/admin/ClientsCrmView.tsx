import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, User, X } from 'lucide-react';
import { deleteClient, saveClient } from '../../services/firestoreService';
import { formatVnd } from '../../lib/utils';
import {
  CLIENT_TIERS,
  ClientRecord,
  ClientTier,
  FIELD_LIMITS,
  OrderRecord,
} from '../../types/domain';

interface ClientsCrmViewProps {
  clients: ClientRecord[];
  orders: OrderRecord[];
  onToast: (msg: string) => void;
}

export function ClientsCrmView({
  clients,
  orders,
  onToast,
}: ClientsCrmViewProps) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | ClientTier>('all');
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [zaloNumber, setZaloNumber] = useState('');
  const [socialLink, setSocialLink] = useState('');
  const [schoolMajor, setSchoolMajor] = useState('');
  const [tier, setTier] = useState<ClientTier>('new');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!showForm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowForm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showForm]);

  const openNew = () => {
    setEditing(null);
    setDisplayName('');
    setZaloNumber('');
    setSocialLink('');
    setSchoolMajor('');
    setTier('new');
    setNotes('');
    setShowForm(true);
  };

  const openEdit = (c: ClientRecord) => {
    setEditing(c);
    setDisplayName(c.displayName);
    setZaloNumber(c.zaloNumber || '');
    setSocialLink(c.socialLink || '');
    setSchoolMajor(c.schoolMajor || '');
    setTier(c.tier);
    setNotes(c.notes || '');
    setShowForm(true);
  };

  const clientStats = useMemo(() => {
    const map = new Map<
      string,
      { count: number; totalSpent: number; debt: number }
    >();
    for (const o of orders) {
      if (o.orderStatus === 'cancelled') continue;
      const cur = map.get(o.clientId) || { count: 0, totalSpent: 0, debt: 0 };
      cur.count += 1;
      cur.totalSpent += o.paidAmount;
      cur.debt += Math.max(0, o.totalAmount - o.paidAmount);
      map.set(o.clientId, cur);
    }
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.displayName.toLowerCase().includes(q) ||
        (c.zaloNumber || '').toLowerCase().includes(q) ||
        (c.schoolMajor || '').toLowerCase().includes(q)
      );
    });
  }, [clients, tierFilter, search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await saveClient(
        {
          displayName: displayName.trim(),
          zaloNumber: zaloNumber.trim(),
          socialLink: socialLink.trim(),
          schoolMajor: schoolMajor.trim(),
          tier,
          notes: notes.trim(),
        },
        editing?.id,
        editing?.createdAt
      );
      onToast(editing ? 'Đã cập nhật hồ sơ khách.' : 'Đã thêm khách hàng mới.');
      setShowForm(false);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Lưu khách hàng thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: ClientRecord) => {
    const hasOrders = orders.some((o) => o.clientId === c.id);
    if (hasOrders) {
      onToast('Khách hàng đang có đơn hàng liên kết, không thể xóa.');
      return;
    }
    try {
      await deleteClient(c.id);
      onToast(`Đã xóa khách ${c.displayName}`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Xóa thất bại.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Hồ sơ Khách hàng (CRM)</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Lưu thông tin Zalo, trường học và phân loại để kiểm soát chính sách cọc.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm khách hàng
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên, số Zalo, trường học..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg overflow-x-auto">
          {(['all', 'new', 'vip', 'watchlist'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTierFilter(key)}
              className={`btn-press px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                tierFilter === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-zinc-600 hover:text-slate-900'
              }`}
            >
              {key === 'all'
                ? 'Tất cả'
                : CLIENT_TIERS.find((t) => t.key === key)?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <User className="w-6 h-6 text-zinc-400 mx-auto" />
            <p className="text-sm font-medium text-slate-900">Chưa có khách hàng phù hợp</p>
            <p className="text-xs text-zinc-500">
              Nhấn &quot;Thêm khách hàng&quot; để lưu hồ sơ Zalo và lịch sử đặt bài.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-semibold text-zinc-600">
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-4">Số Zalo / Liên hệ</th>
                  <th className="py-3 px-4">Trường / Ngành</th>
                  <th className="py-3 px-4">Phân loại</th>
                  <th className="py-3 px-4 text-right">Số bài</th>
                  <th className="py-3 px-4 text-right">Đã thu</th>
                  <th className="py-3 px-4 text-right">Công nợ</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((c) => {
                  const st = clientStats.get(c.id) || {
                    count: 0,
                    totalSpent: 0,
                    debt: 0,
                  };
                  const tierLabel =
                    CLIENT_TIERS.find((t) => t.key === c.tier)?.label || c.tier;
                  const tierColorMap: Record<ClientTier, string> = {
                    vip: 'text-[#16A34A]',
                    watchlist: 'text-[#DC2626]',
                    new: 'text-zinc-700',
                  };
                  return (
                    <tr key={c.id} className="hover-row">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {c.displayName}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-zinc-700 tabular-nums">
                        {c.zaloNumber || c.socialLink || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-zinc-600">
                        {c.schoolMajor || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className={`font-medium ${tierColorMap[c.tier]}`}>
                          {tierLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {st.count}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {formatVnd(st.totalSpent)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-[#DC2626]">
                        {formatVnd(st.debt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            className="btn-press text-xs font-medium text-[#12489B] hover:underline"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            aria-label="Xóa khách hàng"
                            className="btn-press p-1 text-zinc-400 hover:text-[#DC2626]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Modal Form */}
      {showForm && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-backdrop fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="modal-panel bg-white border border-zinc-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-[0_24px_60px_rgb(15,23,42,0.2)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {editing ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Đóng"
                className="btn-press p-1 text-zinc-400 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Tên / Nickname *
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.clientNameMax}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Số Zalo
                  </label>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.zaloMax}
                    value={zaloNumber}
                    onChange={(e) => setZaloNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Phân loại
                  </label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as ClientTier)}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                  >
                    {CLIENT_TIERS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Link MXH (Facebook / IG)
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.socialLinkMax}
                  value={socialLink}
                  onChange={(e) => setSocialLink(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Trường học / Chuyên ngành
                </label>
                <input
                  type="text"
                  maxLength={FIELD_LIMITS.schoolMax}
                  value={schoolMajor}
                  onChange={(e) => setSchoolMajor(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Ghi chú về khách
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.clientNotesMax}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-press px-4 py-2 text-xs font-medium text-zinc-600 hover:text-slate-900"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-press px-4 py-2 text-xs font-medium bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] disabled:opacity-45"
              >
                {saving ? 'Đang lưu...' : 'Lưu khách hàng'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
