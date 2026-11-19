import { useState } from 'react';
import { User, sendEmailVerification, signOut } from 'firebase/auth';
import { MailCheck, RefreshCw } from 'lucide-react';
import { auth } from '../../lib/firebase';

interface EmailVerificationBannerProps {
  user: User;
  onVerified: () => Promise<void> | void;
  onToast: (msg: string) => void;
}

export function EmailVerificationBanner({
  user,
  onVerified,
  onToast,
}: EmailVerificationBannerProps) {
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  const handleCheckVerified = async () => {
    setChecking(true);
    try {
      await user.reload();
      await user.getIdToken(true);
      if (auth.currentUser?.emailVerified) {
        onToast('Email đã được xác minh thành công.');
        await onVerified();
      } else {
        onToast('Email chưa được xác nhận. Vui lòng nhấn vào liên kết trong hộp thư của bạn.');
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Không thể kiểm tra trạng thái email.');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendEmailVerification(user);
      onToast(`Đã gửi lại email xác minh tới ${user.email}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gửi lại email thất bại. Vui lòng đợi ít phút.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="surface-enter max-w-md w-full bg-white border border-amber-200 rounded-2xl p-6 sm:p-7 space-y-5 shadow-[0_12px_32px_rgb(15,23,42,0.04)]">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[#D97706] shrink-0">
          <MailCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">
            Xác minh địa chỉ email để tiếp tục
          </h2>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Chúng tôi đã gửi liên kết xác nhận tới{' '}
            <span className="font-mono font-semibold text-slate-900">{user.email}</span>.
            Hãy mở hộp thư (hoặc thư rác), nhấn liên kết xác minh rồi bấm nút bên dưới.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleCheckVerified}
          disabled={checking}
          className="btn-press w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium bg-[#12489B] text-white rounded-xl hover:bg-[#0B2559] disabled:opacity-45"
        >
          <RefreshCw className="w-4 h-4" />
          {checking ? 'Đang kiểm tra...' : 'Tôi đã xác minh, tiếp tục'}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="btn-press py-2 px-3 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-900 rounded-lg disabled:opacity-45"
          >
            {resending ? 'Đang gửi...' : 'Gửi lại email'}
          </button>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="btn-press py-2 px-3 text-xs font-medium bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg"
          >
            Đổi tài khoản khác
          </button>
        </div>
      </div>
    </div>
  );
}
