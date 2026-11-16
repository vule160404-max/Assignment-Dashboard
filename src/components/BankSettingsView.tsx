import { useEffect, useState } from 'react';
import { QrCode, Upload } from 'lucide-react';
import { saveBankSettings, uploadFileToServer } from '../services/firestoreService';
import { buildVietQrUrl } from '../lib/utils';
import { BankSettings, OrderRecord } from '../types/domain';

interface BankSettingsViewProps {
  bankSettings: BankSettings;
  orders: OrderRecord[];
  onToast: (msg: string) => void;
}

export function BankSettingsView({
  bankSettings,
  orders,
  onToast,
}: BankSettingsViewProps) {
  const [qrMode, setQrMode] = useState<'uploaded_default' | 'vietqr_dynamic'>(
    bankSettings.qrMode || 'uploaded_default'
  );
  const [uploadedQrUrl, setUploadedQrUrl] = useState(bankSettings.uploadedQrUrl || '');
  const [bankName, setBankName] = useState(bankSettings.bankName || '');
  const [accountNumber, setAccountNumber] = useState(bankSettings.accountNumber || '');
  const [accountName, setAccountName] = useState(bankSettings.accountName || '');
  const [vietqrBankBin, setVietqrBankBin] = useState(bankSettings.vietqrBankBin || '');
  const [vietqrTemplate, setVietqrTemplate] = useState<
    'compact2' | 'compact' | 'qr_only' | 'print'
  >(bankSettings.vietqrTemplate || 'compact2');
  const [uploadingQr, setUploadingQr] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQrMode(bankSettings.qrMode || 'uploaded_default');
    setUploadedQrUrl(bankSettings.uploadedQrUrl || '');
    setBankName(bankSettings.bankName || '');
    setAccountNumber(bankSettings.accountNumber || '');
    setAccountName(bankSettings.accountName || '');
    setVietqrBankBin(bankSettings.vietqrBankBin || '');
    setVietqrTemplate(bankSettings.vietqrTemplate || 'compact2');
  }, [bankSettings]);

  const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const res = await uploadFileToServer(file, false);
      setUploadedQrUrl(res.url);
      onToast('Đã tải ảnh mã QR ngân hàng lên.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Tải ảnh QR thất bại.');
    } finally {
      setUploadingQr(false);
      e.target.value = '';
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
      onToast('Đã lưu cấu hình ngân hàng & đồng bộ lên các trang theo dõi.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Lưu cấu hình thất bại.');
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
          Cài đặt Thanh toán & Mã QR Ngân hàng
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Tải lên ảnh mã QR mặc định cùng số tài khoản và tên chủ tài khoản để hiển thị cho khách hàng.
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
              className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
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
              className="w-full px-3 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
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
              className="w-full px-3 py-2 text-sm uppercase bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
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
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                Tải lên ảnh QR chuyển khoản ngân hàng hoặc ví điện tử của bạn (PNG/JPG). Khách hàng sẽ nhìn thấy ảnh QR này kèm số tiền cần chuyển.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 cursor-pointer">
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

      {/* Future-Ready VietQR API Configuration (Toggleable for later) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Tích hợp VietQR.io tự động (Dự phòng dùng sau)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Hiện đang tắt mặc định theo cấu hình. Khi nào cần tự động nhúng số tiền vào mã QR, bạn có thể chuyển chế độ tại đây.
            </p>
          </div>

          <select
            value={qrMode}
            onChange={(e) =>
              setQrMode(e.target.value as 'uploaded_default' | 'vietqr_dynamic')
            }
            className="px-3 py-1.5 text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-lg"
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
              className="w-full px-3 py-2 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-lg"
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
              className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg"
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

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 text-sm font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] disabled:opacity-50"
        >
          {saving ? 'Đang lưu...' : 'Lưu cài đặt thanh toán'}
        </button>
      </div>
    </form>
  );
}
