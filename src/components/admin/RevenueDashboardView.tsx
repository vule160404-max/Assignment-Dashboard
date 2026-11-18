import { useMemo, useState } from 'react';
import { formatVnd } from '../../lib/utils';
import { updateOrderStaffPayout } from '../../services/firestoreService';
import { OrderRecord, StaffPayoutStatus } from '../../types/domain';

interface RevenueDashboardViewProps {
  orders: OrderRecord[];
  onToast?: (msg: string) => void;
}

export function RevenueDashboardView({ orders, onToast }: RevenueDashboardViewProps) {
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const [updatingOrderId, setUpdatingOrderId] = useState('');

  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let totalCollected = 0;
    let totalReceivable = 0;
    let periodRevenue = 0;
    let totalPayoutAllocated = 0;
    let totalPayoutPaid = 0;
    let totalPayoutUnpaid = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let activeCount = 0;

    const monthlyBuckets = new Map<
      string,
      { label: string; collected: number; payout: number; orders: number }
    >();
    const staffBuckets = new Map<
      string,
      {
        staffName: string;
        orderCount: number;
        totalValue: number;
        totalPayout: number;
        paidPayout: number;
        unpaidPayout: number;
      }
    >();
    const payoutOrders: OrderRecord[] = [];

    for (const o of orders) {
      if (o.orderStatus === 'cancelled') {
        cancelledCount += 1;
        continue;
      }

      if (o.orderStatus === 'completed') completedCount += 1;
      else activeCount += 1;

      const payoutAmt = Math.max(0, o.staffPayoutAmount || 0);
      const isPayoutPaid = o.staffPayoutStatus === 'paid';

      totalCollected += o.paidAmount;
      totalReceivable += Math.max(0, o.totalAmount - o.paidAmount);
      totalPayoutAllocated += payoutAmt;
      if (isPayoutPaid) {
        totalPayoutPaid += payoutAmt;
      } else {
        totalPayoutUnpaid += payoutAmt;
      }

      const createdMs = new Date(o.createdAt).getTime();
      if (period === 'week' && createdMs >= weekAgo) {
        periodRevenue += o.paidAmount;
      } else if (period === 'month' && createdMs >= monthStart.getTime()) {
        periodRevenue += o.paidAmount;
      }

      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
      const existing = monthlyBuckets.get(key) || {
        label,
        collected: 0,
        payout: 0,
        orders: 0,
      };
      existing.collected += o.paidAmount;
      existing.payout += payoutAmt;
      existing.orders += 1;
      monthlyBuckets.set(key, existing);

      if (o.assignedStaffName || payoutAmt > 0) {
        const staffName = o.assignedStaffName?.trim() || 'Chưa phân công';
        const sb = staffBuckets.get(staffName) || {
          staffName,
          orderCount: 0,
          totalValue: 0,
          totalPayout: 0,
          paidPayout: 0,
          unpaidPayout: 0,
        };
        sb.orderCount += 1;
        sb.totalValue += o.totalAmount;
        sb.totalPayout += payoutAmt;
        if (isPayoutPaid) sb.paidPayout += payoutAmt;
        else sb.unpaidPayout += payoutAmt;
        staffBuckets.set(staffName, sb);
      }

      if (payoutAmt > 0) {
        payoutOrders.push(o);
      }
    }

    const totalNonCancelled = completedCount + activeCount;
    const totalAll = totalNonCancelled + cancelledCount;
    const cancelRate = totalAll > 0 ? Math.round((cancelledCount / totalAll) * 100) : 0;
    const successRate = totalAll > 0 ? Math.round((completedCount / totalAll) * 100) : 0;
    const netProfit = totalCollected - totalPayoutAllocated;

    const chartRows = Array.from(monthlyBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, val]) => val);

    const maxCollected = Math.max(1, ...chartRows.map((r) => r.collected));

    const staffRows = Array.from(staffBuckets.values()).sort(
      (a, b) => b.unpaidPayout - a.unpaidPayout || b.totalPayout - a.totalPayout
    );

    const sortedPayoutOrders = [...payoutOrders].sort((a, b) => {
      const aPaid = a.staffPayoutStatus === 'paid' ? 1 : 0;
      const bPaid = b.staffPayoutStatus === 'paid' ? 1 : 0;
      if (aPaid !== bPaid) return aPaid - bPaid;
      return b.deadlineAt - a.deadlineAt;
    });

    return {
      totalCollected,
      totalReceivable,
      periodRevenue,
      totalPayoutAllocated,
      totalPayoutPaid,
      totalPayoutUnpaid,
      netProfit,
      completedCount,
      cancelledCount,
      cancelRate,
      successRate,
      chartRows,
      maxCollected,
      staffRows,
      payoutOrders: sortedPayoutOrders,
    };
  }, [orders, period]);

  const handleTogglePayoutStatus = async (order: OrderRecord) => {
    const nextStatus: StaffPayoutStatus =
      order.staffPayoutStatus === 'paid' ? 'unpaid' : 'paid';
    setUpdatingOrderId(order.id);
    try {
      await updateOrderStaffPayout({
        orderId: order.id,
        staffPayoutAmount: order.staffPayoutAmount || 0,
        staffPayoutStatus: nextStatus,
      });
      onToast?.(
        nextStatus === 'paid'
          ? `Đã đánh dấu trả công CTV đơn #${order.orderCode}`
          : `Đã chuyển trạng thái công CTV đơn #${order.orderCode} sang chờ trả`
      );
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : 'Không thể cập nhật trạng thái chi CTV.'
      );
    } finally {
      setUpdatingOrderId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Báo cáo Doanh thu, Công CTV & Lợi nhuận ròng
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Theo dõi dòng tiền đã thu, công nợ khách, tiền công cộng tác viên và lợi nhuận ròng thực tế.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`btn-press px-3 py-1 text-xs font-medium rounded-md ${
              period === 'week'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-zinc-600 hover:text-slate-900'
            }`}
          >
            7 ngày qua
          </button>
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`btn-press px-3 py-1 text-xs font-medium rounded-md ${
              period === 'month'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-zinc-600 hover:text-slate-900'
            }`}
          >
            Tháng này
          </button>
        </div>
      </div>

      {/* Cohesive 4-KPI Strip */}
      <div className="bg-white border border-zinc-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x divide-zinc-200/80">
        <div className="p-5">
          <p className="text-xs text-zinc-500">
            Tổng đã thu · {period === 'week' ? '7d' : 'Tháng'}:{' '}
            <span className="font-mono tabular-nums text-slate-700">
              {formatVnd(stats.periodRevenue)}
            </span>
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {formatVnd(stats.totalCollected)}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs text-zinc-500">Công nợ khách chờ thu</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#D97706] mt-1.5">
            {formatVnd(stats.totalReceivable)}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs text-zinc-500">
            Chi phí CTV (Chờ trả:{' '}
            <span className="font-mono tabular-nums text-[#D97706]">
              {formatVnd(stats.totalPayoutUnpaid)}
            </span>
            )
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {formatVnd(stats.totalPayoutAllocated)}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs text-zinc-500">
            Lợi nhuận ròng · {stats.completedCount} xong · {stats.cancelRate}% hủy
          </p>
          <p
            className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${
              stats.netProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
            }`}
          >
            {stats.netProfit < 0 ? '-' : ''}
            {formatVnd(Math.abs(stats.netProfit))}
          </p>
        </div>
      </div>

      {/* Monthly Bar Breakdown */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Biểu đồ thu nhập & lãi ròng theo tháng
          </h3>
          <span className="text-xs text-zinc-500 font-mono tabular-nums">
            Tỷ lệ hoàn thành: {stats.successRate}%
          </span>
        </div>

        {stats.chartRows.length === 0 ? (
          <p className="text-xs text-zinc-500 py-8 text-center">
            Chưa có dữ liệu doanh thu để thống kê.
          </p>
        ) : (
          <div className="space-y-3.5">
            {stats.chartRows.map((row) => {
              const pct = Math.max(4, Math.round((row.collected / stats.maxCollected) * 100));
              const monthNet = row.collected - row.payout;
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800">
                      {row.label} · {row.orders} đơn
                    </span>
                    <span className="font-mono tabular-nums text-zinc-600">
                      Thu{' '}
                      <span className="font-semibold text-slate-900">
                        {formatVnd(row.collected)}
                      </span>
                      {row.payout > 0 && (
                        <>
                          {' '}· Chi CTV {formatVnd(row.payout)} · Ròng{' '}
                          <span
                            className={`font-semibold ${
                              monthNet >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                            }`}
                          >
                            {monthNet < 0 ? '-' : ''}
                            {formatVnd(Math.abs(monthNet))}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="progress-fill h-full w-full bg-[#4338CA] rounded-full"
                      style={{ transform: `scaleX(${pct / 100})` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Staff Payout Summary Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Tổng hợp Tiền công & Công nợ CTV theo nhân sự
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Đã chi: <span className="font-mono tabular-nums">{formatVnd(stats.totalPayoutPaid)}</span> · Chờ quyết toán:{' '}
              <span className="font-mono tabular-nums text-[#D97706]">
                {formatVnd(stats.totalPayoutUnpaid)}
              </span>
            </p>
          </div>
        </div>

        {stats.staffRows.length === 0 ? (
          <p className="text-xs text-zinc-500 py-8 text-center">
            Chưa có đơn hàng nào ghi nhận tiền công CTV hoặc nhân sự phụ trách.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-600 font-semibold">
                  <th className="py-2.5 px-5">Nhân sự / CTV</th>
                  <th className="py-2.5 px-4 text-right">Số đơn</th>
                  <th className="py-2.5 px-4 text-right">Tổng giá trị đơn</th>
                  <th className="py-2.5 px-4 text-right">Tổng tiền công</th>
                  <th className="py-2.5 px-4 text-right">Đã trả</th>
                  <th className="py-2.5 px-5 text-right">Còn nợ CTV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {stats.staffRows.map((row) => (
                  <tr key={row.staffName} className="hover-row">
                    <td className="py-3 px-5 font-medium text-slate-900">
                      {row.staffName}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-600">
                      {row.orderCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatVnd(row.totalValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatVnd(row.totalPayout)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#16A34A]">
                      {formatVnd(row.paidPayout)}
                    </td>
                    <td
                      className={`py-3 px-5 text-right font-mono tabular-nums font-semibold ${
                        row.unpaidPayout > 0 ? 'text-[#D97706]' : 'text-zinc-400'
                      }`}
                    >
                      {formatVnd(row.unpaidPayout)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actionable Per-Order Settlement List */}
      {stats.payoutOrders.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200/80 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Quyết toán tiền công CTV từng đơn ({stats.payoutOrders.length})
            </h3>
            <span className="text-xs text-zinc-500">
              Đơn chờ trả được ưu tiên hiển thị trước
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-600 font-semibold">
                  <th className="py-2.5 px-5">Đơn hàng</th>
                  <th className="py-2.5 px-4">Người phụ trách</th>
                  <th className="py-2.5 px-4 text-right">Tiền công</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                  <th className="py-2.5 px-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {stats.payoutOrders.map((ord) => {
                  const isPaid = ord.staffPayoutStatus === 'paid';
                  const isBusy = updatingOrderId === ord.id;
                  return (
                    <tr key={ord.id} className="hover-row">
                      <td className="py-3 px-5">
                        <span className="font-mono font-semibold text-[#4338CA]">
                          #{ord.orderCode}
                        </span>
                        <span className="text-zinc-600 ml-2">
                          {ord.subject} · {ord.orderStatus === 'completed' ? 'Đã xong' : 'Đang làm'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800">
                        {ord.assignedStaffName || 'Chưa phân công'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatVnd(ord.staffPayoutAmount || 0)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-medium ${
                            isPaid ? 'text-[#16A34A]' : 'text-[#D97706]'
                          }`}
                        >
                          {isPaid ? 'Đã trả' : 'Chờ trả'}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleTogglePayoutStatus(ord)}
                          className={`btn-press px-2.5 py-1 text-xs font-medium rounded-md border whitespace-nowrap disabled:opacity-45 ${
                            isPaid
                              ? 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                              : 'bg-emerald-50 border-emerald-200 text-[#16A34A] hover:bg-emerald-100'
                          }`}
                        >
                          {isBusy
                            ? 'Đang lưu...'
                            : isPaid
                            ? 'Chuyển về chờ trả'
                            : 'Đánh dấu đã trả'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

