import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { evaluateDeadline } from '../../lib/utils';
import { OrderRecord } from '../../types/domain';

interface CalendarViewProps {
  orders: OrderRecord[];
  nowMs: number;
  onSelectOrder: (order: OrderRecord) => void;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function CalendarView({
  orders,
  nowMs,
  onSelectOrder,
}: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { day: number | null; dateKey: string; dayOrders: OrderRecord[] }[] = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push({ day: null, dateKey: `empty-${i}`, dayOrders: [] });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayOrders = orders.filter((o) => {
        if (o.orderStatus === 'cancelled') return false;
        const d = new Date(o.deadlineAt);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
      });
      cells.push({
        day,
        dateKey: `${year}-${month}-${day}`,
        dayOrders,
      });
    }

    return cells;
  }, [orders, year, month]);

  const monthTitle = new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(cursor);

  const today = new Date();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 capitalize">
            Lịch Deadline — {monthTitle}
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Theo dõi mật độ bài theo ngày để tránh nhận chồng chéo dẫn đến quá tải.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="btn-press p-2 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50"
            aria-label="Tháng trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="btn-press px-3 py-1.5 text-xs font-medium bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50"
          >
            Hôm nay
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="btn-press p-2 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50"
            aria-label="Tháng sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/80">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="py-2.5 text-center text-xs font-semibold text-zinc-600"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-100">
          {calendarCells.map((cell) => {
            const isToday =
              cell.day !== null &&
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === cell.day;
            const overloaded = cell.dayOrders.filter((o) => o.orderStatus === 'active').length >= 2;

            let cellBgClass = 'bg-white';
            if (cell.day === null) {
              cellBgClass = 'bg-zinc-50/60';
            } else if (overloaded) {
              cellBgClass = 'bg-amber-50/40';
            }

            return (
              <div
                key={cell.dateKey}
                className={`min-h-[115px] p-2 flex flex-col gap-1.5 ${cellBgClass}`}
              >
                {cell.day !== null && (
                  <>
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded ${
                          isToday
                            ? 'bg-[#4338CA] text-white font-semibold'
                            : 'text-zinc-600'
                        }`}
                      >
                        {cell.day}
                      </span>
                      {overloaded && (
                        <span className="text-[10px] font-medium text-[#D97706]">
                          Dày bài ({cell.dayOrders.length})
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {cell.dayOrders.map((ord) => {
                        const badge = evaluateDeadline(
                          ord.deadlineAt,
                          nowMs,
                          ord.orderStatus
                        );
                        return (
                          <button
                            key={ord.id}
                            type="button"
                            onClick={() => onSelectOrder(ord)}
                            className={`btn-press w-full text-left px-2 py-1 text-[11px] border rounded-md truncate hover:opacity-90 ${badge.surfaceClass}`}
                          >
                            <span className="font-mono font-semibold">
                              {ord.orderCode}
                            </span>{' '}
                            <span className="opacity-85">· {ord.subject}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
