import { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, QrCode } from 'lucide-react';
import { buildVietQrUrl, copyTextToClipboard, formatVnd } from '../../lib/utils';
import { PaymentStatus, TrackingPortalRecord } from '../../types/domain';

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
  const copyTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    setImgError(false);
  }, [qrImageSrc]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const copyValue = async (key: string, value: string, label: string) => {
    if (!value) return;
    const ok = await copyTextToClipboard(value);
    if (!ok) {
      onToast?.(`Không thể sao chép ${label}`);
      return;
    }
    setCopiedKey(key);
    onToast?.(`Đã sao chép ${label}`);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopiedKey(''), 1800);
  };

  const statusTextMap: Record<PaymentStatus, string> = {
    fully_paid: 'Đã thanh toán đủ',
    deposit_paid: `Đã cọc ${formatVnd(paidAmount)}`,
    unpaid: 'Chưa cọc',
  };

  const statusColorMap: Record<PaymentStatus, string> = {
    fully_paid: 'text-[#16A34A] bg-emerald-50 border-emerald-200',
    deposit_paid: 'text-[#D97706] bg-amber-50 border-amber-200',
    unpaid: 'text-[#DC2626] bg-red-50 border-red-200',
  };

  const statusText = statusTextMap[paymentStatus];
  const statusColor = statusColorMap[paymentStatus];

  const renderCopyIcon = (key: string, accent = false) => {
    if (copiedKey === key) {
      return <Check key="check" className="icon-morph w-3.5 h-3.5 text-[#16A34A] shrink-0" />;
    }
    return (
      <Copy
        key="copy"
        className={`icon-morph w-3.5 h-3.5 shrink-0 ${
          accent ? 'text-[#4338CA]' : 'text-zinc-400'
        }`}
      />
    );
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
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

      <div className="grid grid-cols-3 divide-x divide-zinc-100 py-3 border-y border-zinc-100 text-sm">
        <div className="pr-2">
          <p className="text-[11px] text-zinc-500">Tổng giá trị</p>
          <p className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5 text-xs sm:text-sm">
            {formatVnd(totalAmount)}
          </p>
        </div>
        <div className="px-2">
          <p className="text-[11px] text-zinc-500">Đã thanh toán</p>
          <p className="font-mono font-semibold text-[#16A34A] tabular-nums mt-0.5 text-xs sm:text-sm">
            {formatVnd(paidAmount)}
          </p>
        </div>
        <div className="pl-2">
          <p className="text-[11px] text-zinc-500">Còn lại</p>
          <p className="font-mono font-semibold text-[#DC2626] tabular-nums mt-0.5 text-xs sm:text-sm">
            {formatVnd(remainingTotal)}
          </p>
        </div>
      </div>

      {paymentStatus === 'fully_paid' ? (
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-[#16A34A]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            Đơn hàng đã hoàn tất thanh toán. Toàn bộ tài liệu đã được mở khóa.
          </span>
        </div>
      ) : (
        <div className="bg-zinc-50/90 border border-zinc-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-40 h-40 bg-white border border-zinc-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
            {qrImageSrc && !imgError ? (
              <img
                src={qrImageSrc}
                alt="Mã QR chuyển khoản ngân hàng"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-contain p-1.5"
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

          <div className="flex-1 w-full space-y-2.5 text-xs">
            <div>
              <span className="text-zinc-500 block">Số tiền cần chuyển đợt này</span>
              <p className="text-lg font-mono font-bold text-[#4338CA] tabular-nums mt-0.5">
                {formatVnd(amountToPayNow)}
              </p>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-zinc-200/70">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">Ngân hàng</span>
                <span className="font-medium text-slate-900">
                  {bankSnapshot.bankName || 'Chưa cấu hình'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">Số tài khoản</span>
                <button
                  type="button"
                  onClick={() =>
                    copyValue('acc', bankSnapshot.accountNumber, 'số tài khoản')
                  }
                  className="btn-press inline-flex items-center gap-1.5 font-mono font-semibold text-slate-900 hover:text-[#4338CA] tabular-nums"
                >
                  <span>{bankSnapshot.accountNumber || '—'}</span>
                  {bankSnapshot.accountNumber && renderCopyIcon('acc')}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">Chủ tài khoản</span>
                <span className="font-medium text-slate-900 uppercase truncate">
                  {bankSnapshot.accountName || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">Nội dung CK</span>
                <button
                  type="button"
                  onClick={() =>
                    copyValue('memo', transferMemo, 'nội dung chuyển khoản')
                  }
                  className="btn-press inline-flex items-center gap-1.5 font-mono font-semibold text-[#4338CA] hover:underline"
                >
                  <span>{transferMemo}</span>
                  {renderCopyIcon('memo', true)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
