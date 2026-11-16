import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Download, ExternalLink, Eye, Lock, X } from 'lucide-react';
import { AttachmentItem } from '../types/domain';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfPreviewModalProps {
  attachment: AttachmentItem | null;
  isFullyPaid: boolean;
  isAdmin: boolean;
  onClose: () => void;
}

interface RenderedPage {
  pageNumber: number;
  dataUrl: string;
  blurred: boolean;
}

export function PdfPreviewModal({
  attachment,
  isFullyPaid,
  isAdmin,
  onClose,
}: PdfPreviewModalProps) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cancelledRef = useRef(false);

  const isPaymentLockedForViewer =
    !isAdmin && Boolean(attachment?.isPaymentLocked) && !isFullyPaid;

  const isTurnitinCappedForViewer =
    !isAdmin && attachment?.category === 'turnitin';

  useEffect(() => {
    if (!attachment) return;
    cancelledRef.current = false;
    setPages([]);
    setTotalPages(0);
    setError('');

    const isPdf =
      attachment.sourceType === 'upload' &&
      (attachment.mimeType.includes('pdf') ||
        attachment.name.toLowerCase().endsWith('.pdf'));

    if (!isPdf) return;

    const loadPdf = async () => {
      setLoading(true);
      try {
        const loadingTask = pdfjsLib.getDocument({ url: attachment.fileIdOrUrl });
        const pdf = await loadingTask.promise;
        if (cancelledRef.current) return;

        const numPages = pdf.numPages;
        setTotalPages(numPages);

        // Determine clear page cap based on PRD rules:
        // 1) Turnitin / AI Check: Page 1 through (scorePage + 2)
        // 2) Payment-locked Draft/Final: Page 1..2 (previewMaxPages)
        let clearLimit = numPages;
        if (isTurnitinCappedForViewer) {
          const scorePage = Math.max(1, attachment.turnitinScorePage || 1);
          clearLimit = Math.min(numPages, scorePage + 2);
        }
        if (isPaymentLockedForViewer) {
          const draftLimit = Math.max(1, attachment.previewMaxPages || 2);
          clearLimit = Math.min(clearLimit, draftLimit);
        }

        // Render clear pages + up to 2 blurred teaser pages if truncated
        const renderUntil =
          clearLimit < numPages ? Math.min(numPages, clearLimit + 2) : numPages;

        const rendered: RenderedPage[] = [];
        for (let pageNum = 1; pageNum <= renderUntil; pageNum++) {
          if (cancelledRef.current) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          rendered.push({
            pageNumber: pageNum,
            dataUrl: canvas.toDataURL('image/png'),
            blurred: pageNum > clearLimit,
          });
        }

        if (!cancelledRef.current) {
          setPages(rendered);
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể hiển thị bản xem trước PDF.'
          );
        }
      } finally {
        if (!cancelledRef.current) {
          setLoading(false);
        }
      }
    };

    loadPdf();
    return () => {
      cancelledRef.current = true;
    };
  }, [attachment, isPaymentLockedForViewer, isTurnitinCappedForViewer]);

  if (!attachment) return null;

  const isPdf =
    attachment.sourceType === 'upload' &&
    (attachment.mimeType.includes('pdf') ||
      attachment.name.toLowerCase().endsWith('.pdf'));
  const isImage =
    attachment.sourceType === 'upload' && attachment.mimeType.startsWith('image/');

  const canDownload = isAdmin || (!attachment.isPaymentLocked || isFullyPaid);

  const handleDownload = () => {
    if (!canDownload) return;
    if (attachment.sourceType === 'url') {
      window.open(attachment.fileIdOrUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const a = document.createElement('a');
    a.href = `${attachment.fileIdOrUrl}?download=1`;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4"
      onContextMenu={(e) => {
        if (!canDownload) e.preventDefault();
      }}
    >
      <div className="bg-white border border-zinc-200 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {attachment.name}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isTurnitinCappedForViewer
                ? `Báo cáo Turnitin/AI · Hiển thị từ trang 1 đến trang ${(attachment.turnitinScorePage || 1) + 2}`
                : isPaymentLockedForViewer
                ? `Bản xem trước có giới hạn (${attachment.previewMaxPages || 2} trang đầu rõ nét · các trang sau bị làm mờ)`
                : 'Toàn bộ tài liệu'}
              {totalPages > 0 && ` · Tổng ${totalPages} trang`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canDownload && attachment.fileIdOrUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] transition-colors whitespace-nowrap"
              >
                {attachment.sourceType === 'url' ? (
                  <>
                    <ExternalLink className="w-3.5 h-3.5" />
                    Mở liên kết
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Tải xuống
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng xem trước"
              className="p-1.5 text-zinc-500 hover:text-slate-900 hover:bg-zinc-200/70 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-zinc-100 space-y-5">
          {isPdf && loading && (
            <div className="py-16 text-center text-sm text-zinc-500">
              Đang dựng các trang xem trước...
            </div>
          )}

          {isPdf && error && (
            <div className="bg-white border border-red-200 rounded-lg p-4 text-sm text-[#DC2626]">
              {error}
            </div>
          )}

          {isPdf &&
            !loading &&
            pages.map((p) => (
              <div
                key={p.pageNumber}
                className="relative bg-white border border-zinc-200 rounded-lg overflow-hidden mx-auto max-w-3xl"
              >
                <div className="px-3 py-1.5 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500 font-mono tabular-nums">
                  <span>Trang {p.pageNumber}</span>
                  {p.blurred && (
                    <span className="inline-flex items-center gap-1 text-[#D97706] font-sans font-medium">
                      <Lock className="w-3 h-3" />
                      Nội dung được bảo vệ
                    </span>
                  )}
                </div>
                <div className="relative select-none">
                  <img
                    src={p.dataUrl}
                    alt={`Trang ${p.pageNumber}`}
                    draggable={false}
                    className={`w-full block ${
                      p.blurred ? 'blur-md opacity-60 pointer-events-none' : ''
                    }`}
                  />
                  {p.blurred && (
                    <div className="absolute inset-0 bg-white/45 flex flex-col items-center justify-center p-6 text-center">
                      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 max-w-sm space-y-2">
                        <Lock className="w-5 h-5 text-[#4338CA] mx-auto" />
                        <p className="text-sm font-semibold text-slate-900">
                          {isTurnitinCappedForViewer && !isPaymentLockedForViewer
                            ? 'Giới hạn xem báo cáo Turnitin / AI'
                            : 'Trang này đang được làm mờ'}
                        </p>
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          {isTurnitinCappedForViewer && !isPaymentLockedForViewer
                            ? 'Hệ thống chỉ hiển thị đến trang chứa tỷ lệ % và 2 trang kế tiếp để bảo mật báo cáo.'
                            : 'Vui lòng hoàn tất thanh toán số tiền còn lại để mở khóa toàn bộ bài làm và tải tệp gốc.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

          {isImage && (
            <div className="relative bg-white border border-zinc-200 rounded-lg overflow-hidden max-w-2xl mx-auto">
              <img
                src={attachment.fileIdOrUrl}
                alt={attachment.name}
                draggable={false}
                className={`w-full block ${
                  isPaymentLockedForViewer ? 'blur-md opacity-60 pointer-events-none' : ''
                }`}
              />
              {isPaymentLockedForViewer && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center p-6">
                  <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 text-center max-w-sm space-y-1.5">
                    <Lock className="w-5 h-5 text-[#4338CA] mx-auto" />
                    <p className="text-sm font-semibold text-slate-900">
                      Tệp đang khóa tải xuống
                    </p>
                    <p className="text-xs text-zinc-600">
                      Hoàn tất thanh toán phần còn lại để xem rõ và tải xuống.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isPdf && !isImage && (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 max-w-lg mx-auto text-center space-y-3">
              <Eye className="w-6 h-6 text-zinc-400 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-900">
                {attachment.name}
              </h4>
              {isPaymentLockedForViewer ? (
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Tệp định dạng tài liệu này đang ở chế độ khóa tải xuống cho tới khi hoàn tất thanh toán. (Mẹo: Tải lên file PDF để khách xem trước 1–2 trang đầu trực tiếp trên web).
                </p>
              ) : (
                <p className="text-xs text-zinc-600">
                  Nhấn nút ở góc trên để {attachment.sourceType === 'url' ? 'mở liên kết ngoài' : 'tải tệp xuống'}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
