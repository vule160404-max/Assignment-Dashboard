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

interface DocxPreviewRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
}

interface DocxPreviewBlock {
  text: string;
  runs?: DocxPreviewRun[];
  kind: 'h1' | 'h2' | 'h3' | 'toc' | 'p';
  leftText?: string;
  rightText?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  bold?: boolean;
  fontSizePt?: number;
  indentLeftPx?: number;
  firstLineIndentPx?: number;
  spaceBeforePx?: number;
  spaceAfterPx?: number;
  hasBottomBorder?: boolean;
}

interface DocxPreviewPage {
  pageNumber: number;
  blurred: boolean;
  blocks: DocxPreviewBlock[];
}

interface DocxPreviewPayload {
  fileName: string;
  defaultFontFamily?: string;
  hasPageBorder?: boolean;
  totalPages: number;
  totalWords: number;
  isLocked: boolean;
  previewLimit: number;
  hiddenPagesCount: number;
  pages: DocxPreviewPage[];
}

export function PdfPreviewModal({
  attachment,
  isFullyPaid,
  isAdmin,
  onClose,
}: PdfPreviewModalProps) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [docxPreview, setDocxPreview] = useState<DocxPreviewPayload | null>(null);
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

  const isDocx =
    Boolean(attachment) &&
    attachment?.sourceType === 'upload' &&
    attachment.fileIdOrUrl.startsWith('/api/files/') &&
    (attachment.mimeType.includes('wordprocessingml') ||
      attachment.name.toLowerCase().endsWith('.docx'));

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
    setDocxPreview(null);
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
    } else if (isDocx) {
      const loadDocx = async () => {
        setLoading(true);
        try {
          const headers = isAdmin ? await getAdminAuthHeaders() : undefined;
          const cleanUrl = attachment.fileIdOrUrl.split('?')[0];
          const resp = await fetch(`${cleanUrl}/docx-preview`, { headers });
          if (!resp.ok) {
            const errJson = await resp.json().catch(() => null);
            throw new Error(
              errJson?.error || 'Không thể tải bản xem trước tệp Word.'
            );
          }
          const data = (await resp.json()) as DocxPreviewPayload;
          if (!cancelled) {
            setDocxPreview(data);
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? err.message
                : 'Không thể hiển thị bản xem trước tệp Word.'
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };
      loadDocx();
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
  }, [attachment, isAdmin, isDocx, isImage, isPdf, isPaymentLockedForViewer, isTurnitinCappedForViewer]);

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
    const clearPages = isDocx
      ? Math.max(3, attachment.previewMaxPages || 3)
      : attachment.previewMaxPages || 3;
    headerSubtitle = `Bản xem trước có giới hạn (${clearPages} trang đầu rõ nét · các trang sau làm mờ)`;
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
                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] whitespace-nowrap"
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
                        <Lock className="w-5 h-5 text-[#12489B] mx-auto" />
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
              <Lock className="w-6 h-6 text-[#12489B] mx-auto" />
              <p className="text-sm font-semibold text-slate-900">
                Hình ảnh đang được khóa bảo vệ
              </p>
              <p className="text-xs text-zinc-600">
                Hoàn tất thanh toán phần còn lại để xem rõ và tải xuống.
              </p>
            </div>
          )}

          {isDocx && !loading && !error && docxPreview && (
            <div className="space-y-6 max-w-[820px] mx-auto">
              {/* Compact Word Document Meta Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-xl bg-white border border-zinc-200/90 text-xs text-zinc-600 shadow-2xs">
                <div className="flex items-center gap-2 font-medium text-slate-800">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-[#12489B] border border-blue-200/70 font-mono text-[11px] font-semibold">
                    .DOCX
                  </span>
                  <span>
                    ~{docxPreview.totalWords.toLocaleString('vi-VN')} từ ·{' '}
                    {docxPreview.totalPages} trang ·{' '}
                    {docxPreview.defaultFontFamily || 'Times New Roman'}
                  </span>
                </div>
                {docxPreview.isLocked ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" />
                    <span>
                      Xem rõ {Math.min(docxPreview.previewLimit, docxPreview.totalPages)}/{docxPreview.totalPages} trang đầu · Các trang sau làm mờ
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                    Đã mở khóa toàn bộ
                  </span>
                )}
              </div>

              {/* Rendered Authentic A4 Word Sheets (3 clear pages + blurred masked remaining pages) */}
              {docxPreview.pages.map((pageObj, pageIdx) => {
                const blocks = pageObj.blocks || [];
                const isBlurred = Boolean(pageObj.blurred);
                const isCoverSheet =
                  pageIdx === 0 &&
                  blocks.length <= 16 &&
                  blocks.filter((b) => b.align === 'center').length >= 2;
                const docFont = docxPreview.defaultFontFamily
                  ? `"${docxPreview.defaultFontFamily}", "Times New Roman", Georgia, serif`
                  : '"Times New Roman", Georgia, serif';

                const renderRuns = (block: DocxPreviewBlock) => {
                  if (!block.runs || block.runs.length === 0) return block.text;
                  return block.runs.map((run, rIdx) => (
                    <span
                      key={rIdx}
                      style={{
                        fontWeight: run.bold ? 700 : undefined,
                        fontStyle: run.italic ? 'italic' : undefined,
                        textDecoration: run.underline ? 'underline' : undefined,
                        color: run.color || undefined,
                      }}
                    >
                      {run.text}
                    </span>
                  ));
                };

                // Detect cover sheet & split into balanced Top / Middle / Bottom zones
                const coverDateIdx =
                  isCoverSheet && blocks.length >= 3 ? blocks.length - 1 : -1;
                const coverTopBlocks = isCoverSheet
                  ? blocks.slice(
                      0,
                      Math.max(
                        0,
                        blocks.findIndex(
                          (b, idx) =>
                            idx > 0 &&
                            (b.kind === 'h1' ||
                              (b.fontSizePt && b.fontSizePt >= 15) ||
                              b.text.length > 55)
                        )
                      )
                    )
                  : [];
                const coverMiddleBlocks = isCoverSheet
                  ? blocks.slice(
                      coverTopBlocks.length,
                      coverDateIdx > coverTopBlocks.length
                        ? coverDateIdx
                        : blocks.length
                    )
                  : [];
                const coverBottomBlock =
                  isCoverSheet && coverDateIdx > coverTopBlocks.length
                    ? blocks[coverDateIdx]
                    : null;

                const renderBlockNode = (block: DocxPreviewBlock, bIdx: number) => {
                  const alignClass =
                    block.align === 'center'
                      ? 'text-center'
                      : block.align === 'right'
                      ? 'text-right'
                      : block.align === 'justify'
                      ? 'text-justify'
                      : 'text-left';

                  // Table of Contents row with authentic right-aligned dotted leader
                  if (block.kind === 'toc') {
                    return (
                      <div
                        key={bIdx}
                        style={{
                          paddingLeft: block.indentLeftPx
                            ? `${block.indentLeftPx}px`
                            : undefined,
                          marginTop: block.bold ? '8px' : '2px',
                        }}
                        className={`flex items-baseline gap-2 text-[13.5px] sm:text-[14.5px] leading-6 text-slate-900 ${
                          block.bold ? 'font-bold' : 'font-normal'
                        }`}
                      >
                        <span className="shrink-0 max-w-[85%] break-words">
                          {block.leftText}
                        </span>
                        <span className="flex-1 border-b border-dotted border-zinc-400/90 translate-y-[-3px] min-w-[16px]" />
                        <span className="shrink-0 font-mono text-[13px] tabular-nums text-slate-700">
                          {block.rightText}
                        </span>
                      </div>
                    );
                  }

                  const fontPx = block.fontSizePt
                    ? Math.max(
                        12,
                        Math.min(24, Math.round(block.fontSizePt * 1.25))
                      )
                    : block.kind === 'h1'
                    ? 18
                    : block.kind === 'h2'
                    ? 16
                    : 14.5;

                  // On cover page, render "Label: Value" metadata lines cleanly aligned in 2 columns
                  if (
                    isCoverSheet &&
                    block.align !== 'center' &&
                    block.text.includes(':') &&
                    block.text.indexOf(':') < 34
                  ) {
                    const colonIdx = block.text.indexOf(':');
                    const labelPart = block.text.slice(0, colonIdx + 1).trim();
                    const valuePart = block.text.slice(colonIdx + 1).trim();
                    return (
                      <div
                        key={bIdx}
                        style={{ fontSize: `${fontPx}px` }}
                        className="grid grid-cols-[150px_1fr] sm:grid-cols-[180px_1fr] gap-3 text-left text-slate-900 leading-relaxed max-w-xl mx-auto"
                      >
                        <span className="font-semibold text-slate-700">
                          {labelPart}
                        </span>
                        <span className="font-medium text-slate-900">
                          {valuePart}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={bIdx}
                      style={{
                        fontSize: `${fontPx}px`,
                        paddingLeft: block.indentLeftPx
                          ? `${block.indentLeftPx}px`
                          : undefined,
                        textIndent:
                          block.kind === 'p' && block.firstLineIndentPx
                            ? `${block.firstLineIndentPx}px`
                            : undefined,
                        marginTop: block.spaceBeforePx
                          ? `${block.spaceBeforePx}px`
                          : block.kind === 'h1'
                          ? '12px'
                          : undefined,
                        marginBottom: block.spaceAfterPx
                          ? `${block.spaceAfterPx}px`
                          : undefined,
                      }}
                      className={`text-slate-900 ${
                        block.kind === 'h1' || block.kind === 'h2' || block.bold
                          ? 'font-bold leading-snug'
                          : 'leading-[1.75]'
                      } ${
                        block.hasBottomBorder
                          ? 'border-b border-zinc-300 pb-2 mb-3'
                          : ''
                      } ${alignClass}`}
                    >
                      {renderRuns(block)}
                    </div>
                  );
                };

                return (
                  <div
                    key={pageObj.pageNumber || pageIdx}
                    onContextMenu={(e) => {
                      if (docxPreview.isLocked) e.preventDefault();
                    }}
                    className={`relative bg-white border border-zinc-300/90 rounded-sm shadow-md mx-auto flex flex-col justify-between min-h-[760px] sm:min-h-[980px] px-8 sm:px-16 py-10 sm:py-14 overflow-hidden ${
                      docxPreview.isLocked ? 'select-none' : ''
                    }`}
                    style={{ fontFamily: docFont }}
                  >
                    {/* Cover page balanced 3-zone frame OR regular body flow */}
                    <div
                      className={`flex-1 flex flex-col ${
                        isBlurred
                          ? 'blur-[6px] opacity-70 pointer-events-none select-none'
                          : ''
                      } ${
                        isCoverSheet
                          ? `justify-between py-6 ${
                              docxPreview.hasPageBorder
                                ? 'border-[3px] border-double border-[#0B2559]/75 px-6 sm:px-10 py-10'
                                : ''
                            }`
                          : ''
                      }`}
                    >
                      {isCoverSheet ? (
                        <>
                          {/* Top zone: University / Faculty / Doc Type */}
                          <div className="space-y-2.5 text-center">
                            {coverTopBlocks.map((b, i) => renderBlockNode(b, i))}
                          </div>

                          {/* Middle zone: Topic Title & Metadata */}
                          <div className="space-y-5 my-auto py-8">
                            {coverMiddleBlocks.map((b, i) =>
                              renderBlockNode(b, coverTopBlocks.length + i)
                            )}
                          </div>

                          {/* Bottom zone: Location & Date */}
                          {coverBottomBlock && (
                            <div className="pt-4 text-center">
                              {renderBlockNode(coverBottomBlock, coverDateIdx)}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="space-y-2.5">
                          {blocks.map((block, bIdx) =>
                            renderBlockNode(block, bIdx)
                          )}
                        </div>
                      )}
                    </div>

                    {/* Frosted Lock Overlay on Blurred Pages */}
                    {isBlurred && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[1.5px] p-6 font-sans">
                        <div className="bg-white/95 border border-zinc-200/95 rounded-2xl shadow-lg px-6 py-5 max-w-sm text-center space-y-2">
                          <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto">
                            <Lock className="w-4.5 h-4.5 text-[#12489B]" />
                          </div>
                          <p className="text-xs font-bold text-slate-900">
                            Trang {pageIdx + 1} / {docxPreview.totalPages} đang được bảo vệ
                          </p>
                          <p className="text-[11px] text-zinc-500 leading-relaxed">
                            Hoàn tất thanh toán phần còn lại để xem rõ nội dung trang này và tải tệp Word (.DOCX) gốc.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Clean Page Number Footer (no raw filename, omitted on Cover Page) */}
                    {!isCoverSheet && (
                      <div className="pt-5 mt-6 flex items-center justify-center font-sans text-[11px] text-zinc-400">
                        <span className="font-mono font-medium text-zinc-500">
                          Trang {pageIdx + 1} / {docxPreview.totalPages}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Payment Lock Banner for Remaining Hidden Pages */}
              {docxPreview.hiddenPagesCount > 0 && (
                <div className="bg-white border border-zinc-200 rounded-xl p-6 text-center space-y-2.5 shadow-xs">
                  <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto">
                    <Lock className="w-5 h-5 text-[#12489B]" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    Còn {docxPreview.hiddenPagesCount} trang tiếp theo đang được bảo vệ
                  </p>
                  <p className="text-xs text-zinc-600 leading-relaxed max-w-md mx-auto">
                    Hoàn tất thanh toán phần còn lại để tự động mở khóa toàn bộ bài làm và tải tệp Word (.DOCX) gốc.
                  </p>
                </div>
              )}
            </div>
          )}

          {!isPdf && !isDocx && !isImage && (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 max-w-lg mx-auto text-center space-y-3">
              <Eye className="w-6 h-6 text-zinc-400 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-900">
                {attachment.name}
              </h4>
              {isPaymentLockedForViewer ? (
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Tệp tài liệu này đang ở chế độ khóa tải xuống cho tới khi hoàn tất thanh toán.
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
