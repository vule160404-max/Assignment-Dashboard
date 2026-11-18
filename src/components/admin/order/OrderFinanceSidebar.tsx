import { Check, Copy } from 'lucide-react';
import { ZaloTemplateType, formatVnd } from '../../../lib/utils';
import { StaffPayoutStatus } from '../../../types/domain';

interface OrderFinanceSidebarProps {
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  staffPayoutAmount: number;
  staffPayoutStatus: StaffPayoutStatus;
  staffPayoutPaidAt: string;
  copiedZaloTpl: ZaloTemplateType | '';
  onChangeTotalAmount: (val: number) => void;
  onChangeDepositAmount: (val: number) => void;
  onChangePaidAmount: (val: number) => void;
  onConfirmDepositStageCheck: () => void;
  onChangeStaffPayoutAmount: (val: number) => void;
  onChangeStaffPayoutStatus: (status: StaffPayoutStatus, paidAt: string) => void;
  onCopyZaloTemplate: (tpl: ZaloTemplateType) => void;
}

const ZALO_TEMPLATES: ReadonlyArray<readonly [ZaloTemplateType, string]> = [
  ['quote_deposit', 'Báo giá & Mời cọc'],
  ['final_payment', 'Nhắc tất toán'],
  ['handover', 'Bàn giao Final'],
];

export function OrderFinanceSidebar({
  totalAmount,
  depositAmount,
  paidAmount,
  staffPayoutAmount,
  staffPayoutStatus,
  staffPayoutPaidAt,
  copiedZaloTpl,
  onChangeTotalAmount,
  onChangeDepositAmount,
  onChangePaidAmount,
  onConfirmDepositStageCheck,
  onChangeStaffPayoutAmount,
  onChangeStaffPayoutStatus,
  onCopyZaloTemplate,
}: OrderFinanceSidebarProps) {
  const balance = Math.max(0, totalAmount - paidAmount);
  const netProfit =
    Math.max(0, Number(totalAmount) || 0) -
    Math.max(0, Number(staffPayoutAmount) || 0);

  return (
    <>
      {/* Finance & VND Deposit (Admin Only) */}
      <div className="border border-zinc-200 rounded-xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Tài chính & Công nợ (VNĐ)
          </h3>
          <span className="text-xs font-mono font-semibold text-[#DC2626] tabular-nums">
            Còn thiếu: {formatVnd(balance)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 mb-1">
              Tổng giá trị
            </label>
            <input
              type="number"
              min={0}
              step={10000}
              value={totalAmount}
              onChange={(e) => onChangeTotalAmount(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 mb-1">
              Mức cọc yêu cầu
            </label>
            <input
              type="number"
              min={0}
              step={10000}
              value={depositAmount}
              onChange={(e) => onChangeDepositAmount(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-600 mb-1">
              Đã nhận (VNĐ)
            </label>
            <input
              type="number"
              min={0}
              step={10000}
              value={paidAmount}
              onChange={(e) => onChangePaidAmount(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onChangePaidAmount(depositAmount);
              onConfirmDepositStageCheck();
            }}
            className="btn-press px-2.5 py-1 text-xs font-medium bg-amber-50 text-[#D97706] border border-amber-200 rounded-md hover:bg-amber-100"
          >
            Xác nhận đã cọc ({formatVnd(depositAmount)})
          </button>
          <button
            type="button"
            onClick={() => onChangePaidAmount(totalAmount)}
            className="btn-press px-2.5 py-1 text-xs font-medium bg-emerald-50 text-[#16A34A] border border-emerald-200 rounded-md hover:bg-emerald-100"
          >
            Đã thanh toán đủ
          </button>
        </div>

        {/* Staff Payout & Net Profit */}
        <div className="pt-3.5 border-t border-zinc-100 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-900">
              Tiền công CTV & Lợi nhuận ròng
            </span>
            <span
              className={`text-xs font-mono font-semibold tabular-nums ${
                netProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
              }`}
            >
              Lãi ròng: {netProfit < 0 ? '-' : ''}
              {formatVnd(Math.abs(netProfit))}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                Tiền công CTV / Nhân sự (VNĐ)
              </label>
              <input
                type="number"
                min={0}
                step={10000}
                value={staffPayoutAmount}
                onChange={(e) => onChangeStaffPayoutAmount(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {[30, 40, 50, 60].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() =>
                    onChangeStaffPayoutAmount(
                      Math.round(
                        ((Math.max(0, Number(totalAmount) || 0) * pct) / 100) /
                          1000
                      ) * 1000
                    )
                  }
                  className="btn-press px-2 py-1.5 text-[11px] font-mono font-medium bg-zinc-100 hover:bg-zinc-200 text-slate-700 rounded-md whitespace-nowrap"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer pt-0.5">
            <input
              type="checkbox"
              checked={staffPayoutStatus === 'paid'}
              onChange={(e) => {
                const next: StaffPayoutStatus = e.target.checked
                  ? 'paid'
                  : 'unpaid';
                onChangeStaffPayoutStatus(
                  next,
                  next === 'paid' ? new Date().toISOString() : ''
                );
              }}
              className="w-4 h-4 accent-[#16A34A]"
            />
            <span>
              Đã thanh toán tiền công cho CTV
              {staffPayoutStatus === 'paid' && staffPayoutPaidAt
                ? ` (${new Date(staffPayoutPaidAt).toLocaleDateString('vi-VN')})`
                : ''}
            </span>
          </label>
        </div>
      </div>

      {/* 1-Tap Zalo / Messenger Message Templates */}
      <div className="border border-zinc-200 rounded-xl p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Chép nhanh tin nhắn Zalo / Messenger
          </h3>
          <span className="text-[11px] text-zinc-500">1 chạm</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ZALO_TEMPLATES.map(([tplKey, label]) => {
            const isCopied = copiedZaloTpl === tplKey;
            return (
              <button
                key={tplKey}
                type="button"
                onClick={() => onCopyZaloTemplate(tplKey)}
                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-slate-800 rounded-lg whitespace-nowrap"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
