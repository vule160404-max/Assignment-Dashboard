import { useMemo, useState } from 'react';
import { formatVnd } from '../lib/utils';
import { OrderRecord } from '../types/domain';

interface RevenueDashboardViewProps {
  orders: OrderRecord[];
}

export function RevenueDashboardView({ orders }: RevenueDashboardViewProps) {
  const [period, setPeriod] = useState<'week' | 'month'>('month');

  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let totalCollected = 0;
    let totalReceivable = 0;
    let periodRevenue = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let activeCount = 0;

    const monthlyBuckets = new Map<string, { label: string; collected: number; orders: number }>();

    for (const o of orders) {
      if (o.orderStatus === 'cancelled') {
        cancelledCount += 1;
        continue;
      }

      if (o.orderStatus === 'completed') completedCount += 1;
      else activeCount += 1;

      totalCollected += o.paidAmount;
      totalReceivable += Math.max(0, o.totalAmount - o.paidAmount);

      const createdMs = new Date(o.createdAt).getTime();
      if (period === 'week' && createdMs >= weekAgo) {
        periodRevenue += o.paidAmount;
      } else if (period === 'month' && createdMs >= monthStart.getTime()) {
        periodRevenue += o.paidAmount;
      }

      const d = new Date(o.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
      const existing = monthlyBuckets.get(key) || { label, collected: 0, orders: 0 };
      existing.collected += o.paidAmount;
      existing.orders += 1;
      monthlyBuckets.set(key, existing);
    }

    const totalNonCancelled = completedCount + activeCount;
    const totalAll = totalNonCancelled + cancelledCount;
    const cancelRate = totalAll > 0 ? Math.round((cancelledCount / totalAll) * 100) : 0;
    const successRate = totalAll > 0 ? Math.round((completedCount / totalAll) * 100) : 0;

    const chartRows = Array.from(monthlyBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, val]) => val);

    const maxCollected = Math.max(1, ...chartRows.map((r) => r.collected));

    return {
      totalCollected,
      totalReceivable,
      periodRevenue,
      completedCount,
      cancelledCount,
      activeCount,
      cancelRate,
      successRate,
      chartRows,
      maxCollected,
    };
  }, [orders, period]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Báo cáo Doanh thu & Hiệu suất</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Tổng hợp dòng tiền đã thu, công nợ chờ thu và tỷ lệ hoàn thành bài làm.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              period === 'week'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-zinc-600 hover:text-slate-900'
            }`}
          >
            7 ngày qua
          </button>
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              period === 'month'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-zinc-600 hover:text-slate-900'
            }`}
          >
            Tháng này
          </button>
        </div>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500">
            {period === 'week' ? 'Thu nhập 7 ngày qua' : 'Thu nhập tháng này'}
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {formatVnd(stats.periodRevenue)}
          </p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Tổng đã thu (Tất cả)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#16A34A] mt-1.5">
            {formatVnd(stats.totalCollected)}
          </p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Công nợ chờ thu</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#D97706] mt-1.5">
            {formatVnd(stats.totalReceivable)}
          </p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Hoàn thành / Hủy</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {stats.completedCount} xong · {stats.cancelRate}% hủy
          </p>
        </div>
      </div>

      {/* Monthly Bar Breakdown */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Biểu đồ thu nhập theo tháng
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
          <div className="space-y-3">
            {stats.chartRows.map((row) => {
              const pct = Math.max(4, Math.round((row.collected / stats.maxCollected) * 100));
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">
                      {row.label} ({row.orders} đơn)
                    </span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatVnd(row.collected)}
                    </span>
                  </div>
                  <div className="h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#4338CA] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
