import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { evaluateDeadline } from '../lib/utils';
import { OrderRecord } from '../types/domain';

interface DeadlineBadgeProps {
  deadlineAt: number;
  nowMs: number;
  orderStatus: OrderRecord['orderStatus'];
  compact?: boolean;
}

export function DeadlineBadge({
  deadlineAt,
  nowMs,
  orderStatus,
  compact = false,
}: DeadlineBadgeProps) {
  const info = evaluateDeadline(deadlineAt, nowMs, orderStatus);

  const Icon =
    info.level === 'completed'
      ? CheckCircle2
      : info.level === 'urgent' || info.level === 'overdue'
      ? AlertTriangle
      : Clock;

  const isCritical = info.level === 'urgent' || info.level === 'overdue';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border rounded-md whitespace-nowrap shrink-0 ${info.surfaceClass}`}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${isCritical ? 'animate-pulse' : ''}`} />
      <span className="font-mono tabular-nums">{info.countdownText}</span>
      {!compact && <span className="text-[11px] opacity-80">· {info.label}</span>}
    </span>
  );
}
