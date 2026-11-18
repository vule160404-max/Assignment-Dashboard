import { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Download, ExternalLink, Eye, Lock, X } from 'lucide-react';
import { getSafeExternalUrl } from '../../lib/utils';
import { getAdminAuthHeaders } from '../../services/firestoreService';
import { AttachmentItem } from '../../types/domain';

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
  const [originalTotalPages, setOriginalTotalPages] = useState<number>(0);
  const [imageObjectUrl, setImageObjectUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isPaymentLockedForViewer =
    !isAdmin && Boolean(attachment?.isPaymentLocked) && !isFullyPaid;

  const isTurnitinCappedForViewer =
    !isAdmin && attachment?.category === 'turnitin';

  const isPdf =
    Boolean(attachment) &&
    attachment?.sourceType === 'upload' &&
    (attachment.mimeType.includes('pdf') ||
      attachment.name.toLowerCase().endsWith('.pdf'));

  const isImage =
    Boolean(attachment) &&
    attachment?.sourceType === 'upload' &&
    attachment.mimeType.startsWith('image/');

  useEffect(() => {
    if (!attachment) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [attachment, onClose]);

  useEffect(() => {
    if (!attachment) return;
    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let createdObjectUrl = '';

    setPages([]);
    setTotalPages(0);
    setOriginalTotalPages(0);
    setImageObjectUrl('');
    setError('');

    if (isPdf) {
      const loadPdf = async () => {
        setLoading(true);
        try {
          const headers = isAdmin ? await getAdminAuthHeaders() : undefined;
          const resp = await fetch(attachment.fileIdOrUrl, { headers });
          if (!resp.ok) {
            const errJson = await resp.json().catch(() => null);
            throw new Error(errJson?.error || 'Không thể tải bản xem trước PDF.');
          }

          const headerOrig = Number(resp.headers.get('X-Original-Pages') || 0);
          const buffer = await resp.arrayBuffer();
          if (cancelled) return;

          loadingTask = pdfjsLib.getDocument({ data: buffer });
          const pdf = await loadingTask.promise;
          if (cancelled) return;

          const numPages = pdf.numPages;
          setTotalPages(numPages);
          setOriginalTotalPages(headerOrig > numPages ? headerOrig : numPages);

          let clearLimit = numPages;
          if (isTurnitinCappedForViewer) {
            const scorePage = Math.max(1, attachment.turnitinScorePage || 1);
            clearLimit = Math.min(numPages, scorePage + 2);
          }
          if (isPaymentLockedForViewer) {
            const draftLimit = Math.max(1, attachment.previewMaxPages || 2);
            clearLimit = Math.min(clearLimit, draftLimit);
          }

          const renderUntil =
            clearLimit < numPages ? Math.min(numPages, clearLimit + 2) : numPages;

          const rendered: RenderedPage[] = [];
          for (let pageNum = 1; pageNum <= renderUntil; pageNum++) {
            if (cancelled) return;
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

          if (!cancelled) {
            setPages(rendered);
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? err.message
                : 'Không thể hiển thị bản xem trước PDF.'
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      loadPdf();
    } else if (isImage && !isPaymentLockedForViewer) {
      const loadImage = async () => {
        try {
          const headers = isAdmin ? await getAdminAuthHeaders() : undefined;
          const resp = await fetch(attachment.fileIdOrUrl, { headers });
          if (!resp.ok) return;
          const blob = await resp.blob();
          if (cancelled) return;
          createdObjectUrl = URL.createObjectURL(blob);
          setImageObjectUrl(createdObjectUrl);
        } catch {
          // Image load failed silently; fallback handled in UI
        }
      };
      loadImage();
    }

    return () => {
      cancelled = true;
      if (loadingTask) {
        loadingTask.destroy().catch(() => undefined);
      }
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [attachment, isAdmin, isImage, isPdf, isPaymentLockedForViewer, isTurnitinCappedForViewer]);

  if (!attachment) return null;

  const canDownload = isAdmin || !attachment.isPaymentLocked || isFullyPaid;

  const handleDownload = async () => {
    if (!canDownload) return;
    if (attachment.sourceType === 'url') {
      const safeUrl = getSafeExternalUrl(attachment.fileIdOrUrl);
      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    if (isAdmin) {
      try {
        const headers = await getAdminAuthHeaders();
        const resp = await fetch(`${attachment.fileIdOrUrl}?download=1`, { headers });
        if (!resp.ok) return;
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = attachment.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      } catch {
        // Ignore transient download cancel
      }
      return;
    }

    const a = document.createElement('a');
    a.href = `${attachment.fileIdOrUrl}?download=1`;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  let headerSubtitle = 'Toàn bộ tài liệu';
  if (isTurnitinCappedForViewer) {
    headerSubtitle = `Báo cáo Turnitin/AI · Hiển thị từ trang 1 đến trang ${(attachment.turnitinScorePage || 1) + 2}`;
  } else if (isPaymentLockedForViewer) {
    headerSubtitle = `Bản xem trước có giới hạn (${attachment.previewMaxPages || 2} trang đầu rõ nét)`;
  }

  const hiddenPagesCount = Math.max(0, originalTotalPages - pages.length);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={attachment.name}
      className="modal-backdrop fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
      onContextMenu={(e) => {
        if (!canDownload) e.preventDefault();
      }}
    >
      <div
        className="modal-panel bg-white border border-zinc-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-[0_24px_60px_rgb(15,23,42,0.22)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-zinc-200/80 bg-zinc-50/80">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {attachment.name}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {headerSubtitle}
              {originalTotalPages > 0 && ` · Tổng ${originalTotalPages} trang`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canDownload && attachment.fileIdOrUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] whitespace-nowrap"
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
              className="btn-press p-1.5 text-zinc-500 hover:text-slate-900 hover:bg-zinc-200/70 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-zinc-100/90 space-y-5">
          {isPdf && loading && (
            <div className="py-16 text-center text-sm text-zinc-500">
              Đang dựng các trang xem trước...
            </div>
          )}

          {isPdf && error && (
            <div className="bg-white border border-red-200 rounded-xl p-4 text-sm text-[#DC2626]">
              {error}
            </div>
          )}

          {isPdf &&
            !loading &&
            pages.map((p) => (
              <div
                key={p.pageNumber}
                className="relative bg-white border border-zinc-200 rounded-xl overflow-hidden mx-auto max-w-3xl shadow-xs"
              >
                <div className="px-3.5 py-2 border-b border-zinc-100 bg-zinc-50/70 flex items-center justify-between text-xs text-zinc-500 font-mono tabular-nums">
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
                      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 max-w-sm space-y-2 shadow-sm">
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

          {isPdf && !loading && hiddenPagesCount > 0 && (
            <div className="bg-white border border-amber-200 rounded-xl p-6 max-w-3xl mx-auto text-center space-y-2">
              <Lock className="w-5 h-5 text-[#D97706] mx-auto" />
              <p className="text-sm font-semibold text-slate-900">
                Còn {hiddenPagesCount} trang tiếp theo đang được bảo vệ
              </p>
              <p className="text-xs text-zinc-600 leading-relaxed max-w-md mx-auto">
                {isTurnitinCappedForViewer && !isPaymentLockedForViewer
                  ? 'Máy chủ chỉ trả về giới hạn các trang xung quanh tỷ lệ % Turnitin/AI.'
                  : 'Hoàn tất thanh toán số tiền còn lại để mở khóa toàn bộ các trang và tải tệp gốc.'}
              </p>
            </div>
          )}

          {isImage && !isPaymentLockedForViewer && imageObjectUrl && (
            <div className="relative bg-white border border-zinc-200 rounded-xl overflow-hidden max-w-2xl mx-auto shadow-xs">
              <img
                src={imageObjectUrl}
                alt={attachment.name}
                draggable={false}
                className="w-full block"
              />
            </div>
          )}

          {isImage && isPaymentLockedForViewer && (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 max-w-lg mx-auto text-center space-y-2">
              <Lock className="w-6 h-6 text-[#4338CA] mx-auto" />
              <p className="text-sm font-semibold text-slate-900">
                Hình ảnh đang được khóa bảo vệ
              </p>
              <p className="text-xs text-zinc-600">
                Hoàn tất thanh toán phần còn lại để xem rõ và tải xuống.
              </p>
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
