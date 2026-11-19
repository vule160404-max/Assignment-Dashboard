import { Download, ExternalLink, Plus, RefreshCw } from 'lucide-react';
import {
  EXPECTED_EXTENSION_VERSION,
  HixBridgeStatus,
} from '../../../lib/hixBridgeClient';

interface HixConnectionHeaderProps {
  bridgeStatus: HixBridgeStatus;
  busyTabIds: Set<number>;
  checkingBridge: boolean;
  downloadingExt: boolean;
  showInstallGuide: boolean;
  onRefreshBridge: () => void;
  onDownloadExtension: () => void;
  onToggleInstallGuide: () => void;
}

export function HixConnectionHeader({
  bridgeStatus,
  busyTabIds,
  checkingBridge,
  downloadingExt,
  showInstallGuide,
  onRefreshBridge,
  onDownloadExtension,
  onToggleInstallGuide,
}: HixConnectionHeaderProps) {
  const isOutdatedExtension =
    bridgeStatus.extensionInstalled &&
    bridgeStatus.extensionVersion !== EXPECTED_EXTENSION_VERSION;

  let extStatusClass = 'font-medium text-[#D97706]';
  let extStatusLabel = 'Extension: Chưa cài đặt trên Chrome';
  if (bridgeStatus.extensionInstalled && isOutdatedExtension) {
    extStatusLabel = `Extension: Bản cũ (${bridgeStatus.extensionVersion || '1.0.0'}) — cập nhật lên ${EXPECTED_EXTENSION_VERSION} để chạy nhiều tab & chống khựng`;
  } else if (bridgeStatus.extensionInstalled) {
    extStatusClass = 'font-medium text-[#16A34A]';
    extStatusLabel = `Extension: Đã kết nối (v${bridgeStatus.extensionVersion})`;
  }

  const hixCount = bridgeStatus.hixTabs.length;
  let tabStatusClass = 'font-medium text-zinc-500';
  let tabStatusLabel = 'Tab HIX Bypass: Chưa mở trong Chrome';
  if (hixCount === 1) {
    tabStatusClass = 'font-medium text-[#16A34A]';
    tabStatusLabel = 'Tab HIX Bypass: Đang mở 1 tab (mở thêm tab để chạy song song)';
  } else if (hixCount > 1) {
    tabStatusClass = 'font-medium text-[#16A34A]';
    tabStatusLabel = `Tab HIX Bypass: Đang mở ${hixCount} tab (sẵn sàng chạy ${hixCount} bài song song)`;
  }

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">
            Trình chiếu Word & Tự động Humanize qua HIX Bypass
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className={extStatusClass}>{extStatusLabel}</span>
            <span aria-hidden="true" className="text-zinc-300">
              ·
            </span>
            <span className={tabStatusClass}>{tabStatusLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefreshBridge}
            disabled={checkingBridge}
            className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-800 rounded-lg whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingBridge ? 'animate-spin' : ''}`} />
            <span>Kiểm tra kết nối</span>
          </button>

          <a
            href="https://hixbypass.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-[#12489B] rounded-lg whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{hixCount > 0 ? 'Mở thêm tab HIX' : 'Mở HIX Bypass'}</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            disabled={downloadingExt}
            onClick={onDownloadExtension}
            className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0F172A] hover:bg-slate-800 text-white rounded-lg whitespace-nowrap disabled:opacity-45"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {downloadingExt
                ? 'Đang đóng gói...'
                : `Tải Chrome Extension (v${EXPECTED_EXTENSION_VERSION})`}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleInstallGuide}
            className="btn-press px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900"
          >
            {showInstallGuide ? 'Ẩn hướng dẫn' : 'Cách cài Extension'}
          </button>
        </div>
      </div>

      {bridgeStatus.hixTabs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 text-[11px]">
          <span className="text-zinc-500 font-medium">Các tab HIX Bypass đang nhận diện:</span>
          {bridgeStatus.hixTabs.map((t, index) => {
            const isBusy = busyTabIds.has(t.tabId);
            return (
              <span
                key={`${t.tabId}_${index}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-200 bg-zinc-50 text-slate-700 font-mono tabular-nums"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isBusy ? 'bg-[#12489B]' : 'bg-[#16A34A]'
                  }`}
                />
                <span>Tab #{index + 1}</span>
                <span className="text-zinc-400">·</span>
                <span>{isBusy ? 'Đang chạy' : 'Sẵn sàng'}</span>
              </span>
            );
          })}
        </div>
      )}

      {showInstallGuide && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-700 space-y-2">
          <p className="font-semibold text-slate-900">
            Hướng dẫn cài / cập nhật Extension v{EXPECTED_EXTENSION_VERSION} (chỉ làm 1 lần, 30 giây):
          </p>
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li>
              Nhấn nút <span className="font-semibold text-slate-900">Tải Chrome Extension</span> ở trên rồi giải nén ra thư mục trên máy tính (có thể ghi đè thư mục cũ).
            </li>
            <li>
              Mở tab Chrome mới truy cập{' '}
              <span className="font-mono font-semibold text-slate-900">chrome://extensions</span>, bật{' '}
              <span className="font-semibold">Developer mode</span> rồi bấm <span className="font-semibold">Load unpacked</span> (hoặc bấm biểu tượng <span className="font-semibold">Reload ↻</span> nếu đã cài sẵn).
            </li>
            <li>
              Bấm <span className="font-semibold">F5</span> tải lại trang AssignTrack này. Muốn chạy nhiều bài song song, chỉ cần bấm <span className="font-semibold">Mở thêm tab HIX</span> để mở 2–3 tab <span className="font-mono">hixbypass.com</span> cùng tài khoản.
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}
