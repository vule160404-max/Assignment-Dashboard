import { useCallback, useEffect, useState } from 'react';
import { Bell, QrCode, RefreshCw, Send, Upload } from 'lucide-react';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  TelegramServerStatus,
  deleteServerFile,
  fetchTelegramServerStatus,
  saveBankSettings,
  saveNotificationSettings,
  sendTelegramAdminAlert,
  sendTelegramTestAlert,
  uploadFileToServer,
} from '../../services/firestoreService';
import { buildVietQrUrl, evaluateDeadline, formatDateTime } from '../../lib/utils';
import {
  BankSettings,
  NotificationSettings,
  OrderRecord,
} from '../../types/domain';

interface BankSettingsViewProps {
  bankSettings: BankSettings;
  notificationSettings?: NotificationSettings;
  orders: OrderRecord[];
  onToast: (msg: string) => void;
}

export function BankSettingsView({
  bankSettings,
  notificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
  orders,
  onToast,
}: BankSettingsViewProps) {
  const [qrMode, setQrMode] = useState<'uploaded_default' | 'vietqr_dynamic'>(
    bankSettings.qrMode || 'uploaded_default'
  );
  const [uploadedQrUrl, setUploadedQrUrl] = useState(bankSettings.uploadedQrUrl || '');
  const [replacedQrUrls, setReplacedQrUrls] = useState<string[]>([]);
  const [bankName, setBankName] = useState(bankSettings.bankName || '');
  const [accountNumber, setAccountNumber] = useState(bankSettings.accountNumber || '');
  const [accountName, setAccountName] = useState(bankSettings.accountName || '');
  const [vietqrBankBin, setVietqrBankBin] = useState(bankSettings.vietqrBankBin || '');
  const [vietqrTemplate, setVietqrTemplate] = useState<
    'compact2' | 'compact' | 'qr_only' | 'print'
  >(bankSettings.vietqrTemplate || 'compact2');
  const [uploadingQr, setUploadingQr] = useState(false);
  const [saving, setSaving] = useState(false);

  // Telegram Bot notification preferences (tokens strictly live on server env vars)
  const [tgStatus, setTgStatus] = useState<TelegramServerStatus | null>(null);
  const [checkingTg, setCheckingTg] = useState(false);
  const [tgTestError, setTgTestError] = useState('');
  const [tgNotifyRevision, setTgNotifyRevision] = useState(
    notificationSettings.telegramNotifyRevision
  );
  const [tgNotifyMessage, setTgNotifyMessage] = useState(
    notificationSettings.telegramNotifyMessage
  );
  const [tgNotifyDeadline, setTgNotifyDeadline] = useState(
    notificationSettings.telegramNotifyDeadline
  );
  const [testingTg, setTestingTg] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);

  useEffect(() => {
    setQrMode(bankSettings.qrMode || 'uploaded_default');
    setUploadedQrUrl(bankSettings.uploadedQrUrl || '');
    setReplacedQrUrls([]);
    setBankName(bankSettings.bankName || '');
    setAccountNumber(bankSettings.accountNumber || '');
    setAccountName(bankSettings.accountName || '');
    setVietqrBankBin(bankSettings.vietqrBankBin || '');
    setVietqrTemplate(bankSettings.vietqrTemplate || 'compact2');
  }, [bankSettings]);

  useEffect(() => {
    setTgNotifyRevision(notificationSettings.telegramNotifyRevision);
    setTgNotifyMessage(notificationSettings.telegramNotifyMessage);
    setTgNotifyDeadline(notificationSettings.telegramNotifyDeadline);
  }, [notificationSettings]);

  const checkTelegramConnection = useCallback(async () => {
    setCheckingTg(true);
    try {
      const res = await fetchTelegramServerStatus();
      setTgStatus(res);
    } catch (err) {
      setTgStatus({
        configured: false,
        error:
          err instanceof Error
            ? err.message
            : 'Không thể kết nối tới API kiểm tra Telegram.',
      });
    } finally {
      setCheckingTg(false);
    }
  }, []);

  useEffect(() => {
    void checkTelegramConnection();
  }, [checkTelegramConnection]);

  const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const res = await uploadFileToServer(file, { isLocked: false, category: 'brief' });
      if (uploadedQrUrl && uploadedQrUrl.startsWith('/api/files/')) {
        setReplacedQrUrls((prev) => [...prev, uploadedQrUrl]);
      }
      setUploadedQrUrl(res.url);
      onToast('Đã tải ảnh mã QR ngân hàng lên.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Tải ảnh QR thất bại.');
    } finally {
      setUploadingQr(false);
      e.target.value = '';
    }
  };

  const handleToggleNotifPref = async (
    field: 'revision' | 'message' | 'deadline',
    checked: boolean
  ) => {
    const prevRevision = tgNotifyRevision;
    const prevMessage = tgNotifyMessage;
    const prevDeadline = tgNotifyDeadline;

    const nextRevision = field === 'revision' ? checked : tgNotifyRevision;
    const nextMessage = field === 'message' ? checked : tgNotifyMessage;
    const nextDeadline = field === 'deadline' ? checked : tgNotifyDeadline;

    setTgNotifyRevision(nextRevision);
    setTgNotifyMessage(nextMessage);
    setTgNotifyDeadline(nextDeadline);

    try {
      await saveNotificationSettings({
        telegramNotifyRevision: nextRevision,
        telegramNotifyMessage: nextMessage,
        telegramNotifyDeadline: nextDeadline,
      });
      onToast('Đã cập nhật tùy chọn cảnh báo Telegram.');
    } catch (err) {
      setTgNotifyRevision(prevRevision);
      setTgNotifyMessage(prevMessage);
      setTgNotifyDeadline(prevDeadline);
      onToast(err instanceof Error ? err.message : 'Không thể lưu tùy chọn thông báo.');
    }
  };

  const handleTestTelegram = async () => {
    setTestingTg(true);
    setTgTestError('');
    try {
      await sendTelegramTestAlert();
      onToast('Đã gửi tin thử nghiệm tới Telegram thành công!');
      void checkTelegramConnection();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gửi tin thử nghiệm Telegram thất bại.';
      setTgTestError(msg);
      onToast(msg);
    } finally {
      setTestingTg(false);
    }
  };

  const handleSendDeadlineDigest = async () => {
    const now = Date.now();
    const urgentOrders = orders.filter((o) => {
      if (o.orderStatus !== 'active') return false;
      const info = evaluateDeadline(o.deadlineAt, now, o.orderStatus);
      return info.level === 'urgent' || info.level === 'overdue';
    });

    setSendingDigest(true);
    try {
      const lines =
        urgentOrders.length > 0
          ? urgentOrders.slice(0, 12).map((o) => {
              const info = evaluateDeadline(o.deadlineAt, now, o.orderStatus);
              return `• #${o.orderCode} (${o.subject}) — ${info.label} (${info.countdownText}) · Hạn: ${formatDateTime(
                o.deadlineAt
              )}`;
            })
          : ['Hiện không có đơn nào sắp hạn dưới 24h hoặc quá hạn.'];

      const res = await sendTelegramAdminAlert({
        title: `Tổng hợp Deadline khẩn (${urgentOrders.length} đơn)`,
        lines,
      });
      if (!res.ok) {
        throw new Error(res.error || 'Không thể gửi tổng hợp Deadline qua Telegram.');
      }
      onToast(
        urgentOrders.length > 0
          ? `Đã gửi tổng hợp ${urgentOrders.length} đơn sắp hạn lên Telegram.`
          : 'Đã gửi báo cáo (hiện không có đơn khẩn) lên Telegram.'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gửi tổng hợp Telegram thất bại.');
    } finally {
      setSendingDigest(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveBankSettings(
        {
          qrMode,
          uploadedQrUrl,
          bankName,
          accountNumber,
          accountName,
          vietqrBankBin,
          vietqrTemplate,
        },
        orders
      );
      if (replacedQrUrls.length > 0) {
        await Promise.allSettled(
          replacedQrUrls
            .filter((u) => u !== uploadedQrUrl)
            .map((u) => deleteServerFile(u))
        );
        setReplacedQrUrls([]);
      }
      onToast('Đã lưu cài đặt thanh toán & QR ngân hàng.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Lưu cài đặt thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const previewVietQr =
    vietqrBankBin && accountNumber
      ? buildVietQrUrl({
          bankBin: vietqrBankBin,
          accountNumber,
          template: vietqrTemplate,
          amount: 500000,
          addInfo: 'THANH TOAN ASG2026001',
          accountName,
        })
      : '';

  return (
    <form onSubmit={handleSave} className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          Cài đặt Thanh toán, QR & Cảnh báo Telegram
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Cấu hình tài khoản nhận tiền, ảnh QR mặc định và quy tắc gửi thông báo tự động về Telegram.
        </p>
      </div>

      {/* Bank Account Info + Uploaded Default QR */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Tên ngân hàng
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="VD: Vietcombank / MB Bank"
              className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Số tài khoản
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="VD: 1029384756"
              className="w-full px-3 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Tên chủ tài khoản
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="VD: NGUYEN VAN A"
              className="w-full px-3 py-2 text-sm uppercase bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row gap-5 items-start">
          <div className="w-44 h-44 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
            {uploadedQrUrl ? (
              <img
                src={uploadedQrUrl}
                alt="QR mặc định của bạn"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <div className="text-center p-4 space-y-1.5 text-zinc-400">
                <QrCode className="w-8 h-8 mx-auto" />
                <p className="text-[11px] text-zinc-500">Chưa có ảnh QR</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Ảnh mã QR mặc định (Đang dùng chính)
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed max-w-[60ch]">
                Tải lên ảnh QR chuyển khoản ngân hàng hoặc ví điện tử của bạn (PNG/JPG). Khách hàng sẽ nhìn thấy ảnh QR này kèm số tiền cần chuyển.
              </p>
            </div>
            <label className="btn-press inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              {uploadingQr ? 'Đang tải ảnh QR...' : 'Tải lên ảnh mã QR'}
              <input
                type="file"
                accept="image/*"
                disabled={uploadingQr}
                onChange={handleUploadQrImage}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Future-Ready VietQR API Configuration */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Tích hợp VietQR.io tự động (Dự phòng dùng sau)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5 max-w-[60ch]">
              Hiện đang tắt mặc định theo cấu hình. Khi nào cần tự động nhúng số tiền vào mã QR, bạn có thể chuyển chế độ tại đây.
            </p>
          </div>

          <select
            value={qrMode}
            onChange={(e) =>
              setQrMode(e.target.value as 'uploaded_default' | 'vietqr_dynamic')
            }
            className="px-3 py-1.5 text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
          >
            <option value="uploaded_default">Dùng ảnh QR mặc định đã tải lên</option>
            <option value="vietqr_dynamic">Bật VietQR.io tự động theo số tiền</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Mã Ngân hàng / Bank BIN (VietQR.io)
            </label>
            <input
              type="text"
              value={vietqrBankBin}
              onChange={(e) => setVietqrBankBin(e.target.value)}
              placeholder="VD: VCB, MB, TCB, ICB hoặc 970436"
              className="w-full px-3 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Mẫu giao diện VietQR
            </label>
            <select
              value={vietqrTemplate}
              onChange={(e) =>
                setVietqrTemplate(
                  e.target.value as 'compact2' | 'compact' | 'qr_only' | 'print'
                )
              }
              className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            >
              <option value="compact2">compact2 (Đầy đủ thông tin)</option>
              <option value="compact">compact</option>
              <option value="qr_only">qr_only</option>
              <option value="print">print</option>
            </select>
          </div>
        </div>

        {qrMode === 'vietqr_dynamic' && previewVietQr && (
          <div className="text-xs text-zinc-500">
            Xem trước link VietQR động: <span className="font-mono break-all">{previewVietQr}</span>
          </div>
        )}
      </div>

      {/* Telegram Bot Alerts */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Bell className="w-4 h-4 text-[#4338CA] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Cảnh báo tự động qua Telegram Bot
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5 max-w-[62ch]">
                Gửi thông báo tức thời tới Telegram khi khách hàng nhắn tin, gửi yêu cầu sửa hoặc đơn sắp đến hạn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(() => {
              let tgStatusClass = 'text-[#D97706]';
              let tgStatusLabel = 'Chưa cấu hình biến môi trường';
              if (!tgStatus || checkingTg) {
                tgStatusClass = 'text-zinc-500';
                tgStatusLabel = 'Đang kiểm tra máy chủ...';
              } else if (tgStatus.configured && tgStatus.botReachable) {
                tgStatusClass = 'text-[#16A34A]';
                tgStatusLabel = tgStatus.botUsername
                  ? `Đã kết nối Bot @${tgStatus.botUsername}`
                  : 'Đã kết nối Telegram Bot';
              } else if (tgStatus.configured && tgStatus.botReachable === false) {
                tgStatusClass = 'text-[#DC2626]';
                tgStatusLabel = 'Biến có sẵn nhưng Bot lỗi kết nối';
              }
              return (
                <span className={`text-xs font-medium whitespace-nowrap ${tgStatusClass}`}>
                  {tgStatusLabel}
                </span>
              );
            })()}
            <button
              type="button"
              disabled={checkingTg}
              onClick={() => void checkTelegramConnection()}
              title="Kiểm tra lại kết nối máy chủ Telegram"
              className="btn-press inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-700 rounded-md disabled:opacity-45"
            >
              <RefreshCw className={`w-3 h-3 ${checkingTg ? 'animate-spin' : ''}`} />
              <span>Kiểm tra</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-100 space-y-2.5 text-xs">
          <label className="flex items-center gap-2.5 text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={tgNotifyRevision}
              onChange={(e) => handleToggleNotifPref('revision', e.target.checked)}
              className="w-4 h-4 accent-[#4338CA]"
            />
            <span>Thông báo ngay khi khách hàng gửi Yêu cầu chỉnh sửa (Revision)</span>
          </label>
          <label className="flex items-center gap-2.5 text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={tgNotifyMessage}
              onChange={(e) => handleToggleNotifPref('message', e.target.checked)}
              className="w-4 h-4 accent-[#4338CA]"
            />
            <span>Thông báo ngay khi khách hàng nhắn tin mới trong Chat 48h</span>
          </label>
          <label className="flex items-center gap-2.5 text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={tgNotifyDeadline}
              onChange={(e) => handleToggleNotifPref('deadline', e.target.checked)}
              className="w-4 h-4 accent-[#4338CA]"
            />
            <span>Tự động nhắc đơn sắp hạn (&lt;24h, &lt;6h hoặc quá hạn) khi mở cổng Admin</span>
          </label>
        </div>

        {tgStatus && (!tgStatus.configured || !tgStatus.botReachable) && (
          <div className="text-xs text-zinc-700 bg-amber-50/70 border border-amber-200 px-3.5 py-3 rounded-lg leading-relaxed space-y-1.5">
            {tgStatus.error && (
              <p className="font-semibold text-amber-900">{tgStatus.error}</p>
            )}
            <p>
              Hãy kiểm tra lại 3 điểm sau khi khai báo{' '}
              <span className="font-mono font-semibold text-slate-900">TELEGRAM_BOT_TOKEN</span> và{' '}
              <span className="font-mono font-semibold text-slate-900">TELEGRAM_CHAT_ID</span> trên Vercel:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-zinc-700">
              <li>
                <strong>Bắt buộc bấm Redeploy</strong> trên Vercel sau khi thêm/sửa Environment Variables (bản deploy cũ không tự nạp biến mới), và kiểm tra đã tick chọn cả <strong>Production</strong> lẫn <strong>Preview</strong>.
              </li>
              <li>
                Đảm bảo bạn đang mở <strong>đúng tên miền Vercel</strong> (link xem trước của AI Studio không dùng biến môi trường của Vercel).
              </li>
              <li>
                Dán giá trị thô (không bọc dấu ngoặc kép, không gõ dư chữ <span className="font-mono">bot</span> phía trước token), và đã bấm <span className="font-mono font-semibold">/start</span> với Bot trên Telegram.
              </li>
            </ul>
          </div>
        )}

        {tgTestError && (
          <p
            role="alert"
            className="text-xs text-[#DC2626] bg-red-50 border border-red-200 px-3.5 py-2.5 rounded-lg"
          >
            {tgTestError}
          </p>
        )}

        <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={testingTg}
            onClick={handleTestTelegram}
            className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 whitespace-nowrap disabled:opacity-45"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testingTg ? 'Đang gửi thử...' : 'Gửi tin test Telegram'}</span>
          </button>

          <button
            type="button"
            disabled={sendingDigest}
            onClick={handleSendDeadlineDigest}
            className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-indigo-50 text-[#4338CA] border border-indigo-200 rounded-lg hover:bg-indigo-100 whitespace-nowrap disabled:opacity-45"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>
              {sendingDigest ? 'Đang gửi tổng hợp...' : 'Gửi tổng hợp đơn sắp hạn ngay'}
            </span>
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="btn-press px-5 py-2.5 text-sm font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] disabled:opacity-45"
        >
          {saving ? 'Đang lưu...' : 'Lưu cài đặt thanh toán'}
        </button>
      </div>
    </form>
  );
}

