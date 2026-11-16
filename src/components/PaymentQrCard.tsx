import { useState } from 'react';
import { Check, Copy, QrCode } from 'lucide-react';
import { buildVietQrUrl, formatVnd } from '../lib/utils';
import { PaymentStatus, TrackingPortalRecord } from '../types/domain';

interface PaymentQrCardProps {
  orderCode: string;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  bankSnapshot: TrackingPortalRecord['bankSnapshot'];
  onToast?: (msg: string) => void;
}

export function PaymentQrCard({
  orderCode,
  totalAmount,
  depositAmount,
  paidAmount,
  paymentStatus,
  bankSnapshot,
  onToast,
}: PaymentQrCardProps) {
  const [copiedKey, setCopiedKey] = useState<string>('');
  const [imgError, setImgError] = useState(false);

  const remainingTotal = Math.max(0, totalAmount - paidAmount);
  const depositRemaining = Math.max(0, depositAmount - paidAmount);
  const amountToPayNow =
    paymentStatus === 'unpaid' && depositAmount > 0
      ? depositRemaining
      : remainingTotal;

  const memoPrefix =
    paymentStatus === 'unpaid' && depositAmount > 0 ? 'COC' : 'THANH TOAN';
  const transferMemo = `${memoPrefix} ${orderCode.replace(/-/g, '')}`;

  const qrImageSrc =
    bankSnapshot.qrMode === 'vietqr_dynamic' &&
    bankSnapshot.vietqrBankBin &&
    bankSnapshot.accountNumber
      ? buildVietQrUrl({
          bankBin: bankSnapshot.vietqrBankBin,
          accountNumber: bankSnapshot.accountNumber,
          template: bankSnapshot.vietqrTemplate || 'compact2',
          amount: amountToPayNow,
          addInfo: transferMemo,
          accountName: bankSnapshot.accountName,
        })
      : bankSnapshot.uploadedQrUrl;

  const copyValue = async (key: string, value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    onToast?.(`Đã sao chép ${label}`);
    setTimeout(() => setCopiedKey(''), 1800);
  };

  const statusText =
    paymentStatus === 'fully_paid'
      ? 'Đã thanh toán đủ'
      : paymentStatus === 'deposit_paid'
      ? `Đã cọc ${formatVnd(paidAmount)}`
      : 'Chưa cọc';

  const statusColor =
    paymentStatus === 'fully_paid'
      ? 'text-[#16A34A] bg-emerald-50 border-emerald-200'
      : paymentStatus === 'deposit_paid'
      ? 'text-[#D97706] bg-amber-50 border-amber-200'
      : 'text-[#DC2626] bg-red-50 border-red-200';

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Thanh toán & Công nợ
        </h3>
        <span
          className={`px-2.5 py-0.5 text-xs font-medium border rounded-md whitespace-nowrap ${statusColor}`}
        >
          {statusText}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 py-3 border-y border-zinc-100 text-sm">
        <div>
          <p className="text-xs text-zinc-500">Tổng giá trị</p>
          <p className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
            {formatVnd(totalAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Đã thanh toán</p>
          <p className="font-mono font-semibold text-[#16A34A] tabular-nums mt-0.5">
            {formatVnd(paidAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Còn lại</p>
          <p className="font-mono font-semibold text-[#DC2626] tabular-nums mt-0.5">
            {formatVnd(remainingTotal)}
          </p>
        </div>
      </div>

      {paymentStatus !== 'fully_paid' && (
        <div className="space-y-4">
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 flex flex-col sm:flex-row gap-4 items-center">
            <div className="w-40 h-40 bg-white border border-zinc-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
              {qrImageSrc && !imgError ? (
                <img
                  src={qrImageSrc}
                  alt="Mã QR chuyển khoản ngân hàng"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <div className="text-center p-3 text-zinc-400 space-y-1.5">
                  <QrCode className="w-8 h-8 mx-auto text-zinc-400" />
                  <p className="text-[11px] leading-snug text-zinc-500">
                    Chưa có ảnh QR mặc định
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 w-full space-y-2 text-xs">
              <div>
                <span className="text-zinc-500">Số tiền cần chuyển đợt này:</span>
                <p className="text-base font-mono font-bold text-[#4338CA] tabular-nums">
                  {formatVnd(amountToPayNow)}
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-500">Ngân hàng:</span>
                  <span className="font-medium text-slate-900">
                    {bankSnapshot.bankName || 'Chưa cấu hình'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-500">Số tài khoản:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyValue('acc', bankSnapshot.accountNumber, 'số tài khoản')
                    }
                    className="inline-flex items-center gap-1 font-mono font-semibold text-slate-900 hover:text-[#4338CA] tabular-nums"
                  >
                    {bankSnapshot.accountNumber || '—'}
                    {bankSnapshot.accountNumber &&
                      (copiedKey === 'acc' ? (
                        <Check className="w-3 h-3 text-[#16A34A]" />
                      ) : (
                        <Copy className="w-3 h-3 text-zinc-400" />
                      ))}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-500">Chủ tài khoản:</span>
                  <span className="font-medium text-slate-900 uppercase">
                    {bankSnapshot.accountName || '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-500">Nội dung CK:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyValue('memo', transferMemo, 'nội dung chuyển khoản')
                    }
                    className="inline-flex items-center gap-1 font-mono font-semibold text-[#4338CA] hover:underline"
                  >
                    {transferMemo}
                    {copiedKey === 'memo' ? (
                      <Check className="w-3 h-3 text-[#16A34A]" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
