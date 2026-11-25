import { ReactNode, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  Check,
  CheckCircle2,
  ImagePlus,
  ListTree,
  Loader2,
  Maximize2,
  Minimize2,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import {
  PaperAuditIssue,
  isReferencesSectionTitle,
  stripMarkdownHashesFromText,
} from '../../../lib/aiWriterClient';
import { countWords } from '../../../lib/wordHumanizer';
import { CoverPageSheetPreview } from './CoverPageSheetPreview';
import {
  compressImageToContextItem,
  findSessionImageByTag,
  getNextImageTag,
  parseFigureMarkerTag,
} from '../../../lib/writerImageUtils';
import {
  COVER_PAGE_TEMPLATES,
  DocumentFormatConfig,
  SectionHeadingLevel,
  SessionContextImage,
  WriterOutlineSection,
  WriterSession,
} from './types';

interface TocPreviewEntry {
  key: string;
  sectionId: string;
  title: string;
  level: SectionHeadingLevel;
  pageNumber: number;
}

export interface SectionAuditVisualState {
  status: 'error' | 'fixing' | 'fixed';
  issueCount: number;
  label?: string;
}

export interface PaperQaBannerState {
  score: number;
  remainingErrorCount: number;
  autoFixableCount: number;
  isFixing: boolean;
  currentStepIndex: number;
  batchTotal: number;
  currentStepTitle?: string;
  onOpenAuditModal: () => void;
  onFixNextBatch?: () => void;
}

interface WriterPaperCanvasProps {
  session: WriterSession;
  currentSectionId: string;
  zoomPercent: number;
  focusPaperMode: boolean;
  containerClassName?: string;
  activeTextareaRef: RefObject<HTMLTextAreaElement | null>;
  sectionAuditStates?: Record<string, SectionAuditVisualState>;
  auditIssues?: PaperAuditIssue[];
  focusedAuditIssueId?: string | null;
  onFixSingleIssue?: (issue: PaperAuditIssue) => void;
  qaBanner?: PaperQaBannerState | null;
  onSelectSection: (sectionId: string) => void;
  onUpdateTopic: (nextTopic: string) => void;
  onUpdateViewMode: (mode: 'sections' | 'full_paper') => void;
  onToggleFocusPaperMode: () => void;
  onUpdateFormat: (patch: Partial<DocumentFormatConfig>) => void;
  onOpenCoverPage?: () => void;
  onUpdateContextImages?: (nextImages: SessionContextImage[]) => void;
  onToast?: (msg: string) => void;
  onUpdateSection: (
    sectionId: string,
    patch: Partial<WriterOutlineSection>,
    pushHistory?: boolean
  ) => void;
}

export function WriterPaperCanvas({
  session,
  currentSectionId,
  zoomPercent,
  focusPaperMode,
  containerClassName,
  activeTextareaRef,
  sectionAuditStates,
  auditIssues = [],
  focusedAuditIssueId = null,
  onFixSingleIssue,
  qaBanner,
  onSelectSection,
  onUpdateTopic,
  onUpdateViewMode,
  onToggleFocusPaperMode,
  onUpdateFormat,
  onOpenCoverPage,
  onUpdateContextImages,
  onToast,
  onUpdateSection,
}: WriterPaperCanvasProps) {
  const { format } = session;
  const pagePaddingPx = Math.round(format.marginInch * 64);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [activeBubbleIssueId, setActiveBubbleIssueId] = useState<string | null>(
    null
  );
  const [imagePickerSectionId, setImagePickerSectionId] = useState<string | null>(
    null
  );
  const [uploadingManualImage, setUploadingManualImage] = useState(false);
  const [manualCaptionDraft, setManualCaptionDraft] = useState('');
  const manualFileInputRef = useRef<HTMLInputElement | null>(null);
  const hideBubbleTimerRef = useRef<number | null>(null);

  const insertMarkerIntoSection = (
    sec: WriterOutlineSection,
    tag: string,
    atCursor?: { start: number; end: number } | null
  ) => {
    const marker = `[FIGURE: ${tag}]`;
    const prevContent = sec.content || '';
    let nextContent: string;
    if (atCursor && atCursor.start >= 0 && atCursor.start <= prevContent.length) {
      const before = prevContent.slice(0, atCursor.start).replace(/\s*$/, '');
      const after = prevContent.slice(atCursor.end).replace(/^\s*/, '');
      nextContent = [before, marker, after].filter(Boolean).join('\n\n');
    } else if (!prevContent.trim()) {
      nextContent = marker;
    } else {
      nextContent = `${prevContent.replace(/\s+$/, '')}\n\n${marker}`;
    }
    onUpdateSection(sec.id, { content: nextContent }, true);
  };

  const removeMarkerFromSection = (sec: WriterOutlineSection, tag: string) => {
    const normTag = tag.trim().toUpperCase();
    const nextLines = (sec.content || '')
      .split(/\r?\n/)
      .filter((line) => parseFigureMarkerTag(line) !== normTag);
    const cleaned = nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    onUpdateSection(sec.id, { content: cleaned }, true);
    onToast?.(`Đã gỡ ảnh [${normTag}] khỏi mục "${sec.title}".`);
  };

  const handleManualImageFiles = async (
    sec: WriterOutlineSection,
    files: File[],
    atCursor?: { start: number; end: number } | null
  ) => {
    if (!onUpdateContextImages || files.length === 0) return;
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      onToast?.('Vui lòng chọn tệp ảnh hợp lệ (PNG, JPG, WebP).');
      return;
    }
    setUploadingManualImage(true);
    try {
      const currentImages = [...(session.contextImages || [])];
      const addedTags: string[] = [];
      for (const file of imageFiles) {
        const tag = getNextImageTag(currentImages);
        const item = await compressImageToContextItem(file, tag);
        if (manualCaptionDraft.trim() && imageFiles.length === 1) {
          item.caption = manualCaptionDraft.trim();
        }
        item.insertIntoPaper = true;
        currentImages.push(item);
        addedTags.push(tag);
      }
      onUpdateContextImages(currentImages);

      // Insert all newly uploaded image markers into the target section
      const markersBlock = addedTags.map((t) => `[FIGURE: ${t}]`).join('\n\n');
      const prevContent = sec.content || '';
      let nextContent: string;
      if (atCursor && atCursor.start >= 0 && atCursor.start <= prevContent.length) {
        const before = prevContent.slice(0, atCursor.start).replace(/\s*$/, '');
        const after = prevContent.slice(atCursor.end).replace(/^\s*/, '');
        nextContent = [before, markersBlock, after].filter(Boolean).join('\n\n');
      } else if (!prevContent.trim()) {
        nextContent = markersBlock;
      } else {
        nextContent = `${prevContent.replace(/\s+$/, '')}\n\n${markersBlock}`;
      }
      onUpdateSection(sec.id, { content: nextContent }, true);
      setManualCaptionDraft('');
      onToast?.(
        `Đã chèn ${addedTags.length} ảnh (${addedTags.join(', ')}) vào mục "${sec.title}"! Ảnh sẽ tự xuất hiện khi tải Word/PDF.`
      );
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : 'Không thể xử lý ảnh tải lên.'
      );
    } finally {
      setUploadingManualImage(false);
      if (manualFileInputRef.current) manualFileInputRef.current.value = '';
    }
  };

  const handleUpdateImageCaption = (imageId: string, nextCaption: string) => {
    if (!onUpdateContextImages) return;
    const nextList = (session.contextImages || []).map((img) =>
      img.id === imageId ? { ...img, caption: nextCaption } : img
    );
    onUpdateContextImages(nextList);
  };

  const openBubble = (issueId: string) => {
    if (hideBubbleTimerRef.current !== null) {
      window.clearTimeout(hideBubbleTimerRef.current);
      hideBubbleTimerRef.current = null;
    }
    setActiveBubbleIssueId(issueId);
  };

  const scheduleHideBubble = () => {
    if (hideBubbleTimerRef.current !== null) {
      window.clearTimeout(hideBubbleTimerRef.current);
    }
    hideBubbleTimerRef.current = window.setTimeout(() => {
      setActiveBubbleIssueId(null);
      hideBubbleTimerRef.current = null;
    }, 220);
  };

  // When user clicks "Mở mục" / "Đến câu lỗi" on a specific audit issue, exit textarea mode and scroll directly to that exact red sentence!
  useEffect(() => {
    if (!focusedAuditIssueId) return;
    setEditingSectionId(null);
    setActiveBubbleIssueId(focusedAuditIssueId);
    const rafId = window.requestAnimationFrame(() => {
      const targetMark = document.querySelector<HTMLElement>(
        `[data-audit-issue-id="${focusedAuditIssueId}"]`
      );
      if (targetMark) {
        targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const matchedIssue = auditIssues.find(
          (i) => i.id === focusedAuditIssueId
        );
        if (matchedIssue?.sectionId) {
          const secEl = document.querySelector<HTMLElement>(
            `[data-writer-section-id="${matchedIssue.sectionId}"]`
          );
          secEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [focusedAuditIssueId, auditIssues]);

  /** Finds exact sentence/line character ranges for each issue inside a section's text */
  const buildHighlightedContentNodes = (
    sec: WriterOutlineSection,
    secIssues: PaperAuditIssue[]
  ): ReactNode => {
    const text = sec.content || '';
    if (!text.trim() || secIssues.length === 0) return text;

    const lowerText = text.toLowerCase();
    const isRef = isReferencesSectionTitle(sec.title);

    const expandToSentenceBounds = (
      matchStart: number,
      matchEnd: number
    ): { start: number; end: number } => {
      if (isRef) {
        // For References, highlight the entire bibliographic entry (bounded by newlines)
        const prevNl = text.lastIndexOf('\n', matchStart - 1);
        const nextNl = text.indexOf('\n', matchEnd);
        return {
          start: prevNl === -1 ? 0 : prevNl + 1,
          end: nextNl === -1 ? text.length : nextNl,
        };
      }
      // For body prose, expand to the exact sentence boundaries (., !, ?, or newline)
      let s = matchStart;
      while (s > 0 && !/[\n.!?]/.test(text[s - 1])) {
        s--;
      }
      while (s < matchStart && /\s/.test(text[s])) s++;

      let e = matchEnd;
      while (e < text.length && !/[\n.!?]/.test(text[e])) {
        e++;
      }
      if (e < text.length && /[.!?]/.test(text[e])) e++;
      return { start: s, end: Math.max(e, matchEnd) };
    };

    const ranges: Array<{ start: number; end: number; issue: PaperAuditIssue }> =
      [];

    for (const issue of secIssues) {
      const candidates: string[] = [];
      if (issue.matchSnippet?.trim()) candidates.push(issue.matchSnippet.trim());
      if (issue.badDoi?.trim()) candidates.push(issue.badDoi.trim());
      const quotedInDetail = issue.detail.match(/"([^"]{8,120})"/);
      if (quotedInDetail?.[1]) {
        candidates.push(quotedInDetail[1].replace(/^\.\.\.|\.\.\.$/g, '').trim());
      }

      let foundIdx = -1;
      let foundLen = 0;
      for (const cand of candidates) {
        if (!cand || cand.length < 4) continue;
        const idx = lowerText.indexOf(cand.toLowerCase());
        if (idx !== -1) {
          foundIdx = idx;
          foundLen = cand.length;
          break;
        }
        // Try first 40 chars if the full snippet was slightly clipped
        if (cand.length > 42) {
          const shortCand = cand.slice(0, 42).toLowerCase();
          const shortIdx = lowerText.indexOf(shortCand);
          if (shortIdx !== -1) {
            foundIdx = shortIdx;
            foundLen = shortCand.length;
            break;
          }
        }
      }

      if (foundIdx !== -1) {
        const bounds = expandToSentenceBounds(foundIdx, foundIdx + foundLen);
        ranges.push({ ...bounds, issue });
      } else {
        // Fallback: highlight last sentence for truncation/completeness, or first sentence otherwise
        const fallbackAnchor =
          issue.category === 'completeness' ? Math.max(0, text.length - 10) : 0;
        const bounds = expandToSentenceBounds(
          fallbackAnchor,
          Math.min(text.length, fallbackAnchor + 1)
        );
        ranges.push({ ...bounds, issue });
      }
    }

    // Sort ranges and avoid overlapping DOM nests
    ranges.sort((a, b) => a.start - b.start || b.end - a.end);
    const nonOverlapping: Array<{
      start: number;
      end: number;
      issues: PaperAuditIssue[];
    }> = [];
    for (const r of ranges) {
      const last = nonOverlapping[nonOverlapping.length - 1];
      if (last && r.start < last.end) {
        last.end = Math.max(last.end, r.end);
        last.issues.push(r.issue);
      } else {
        nonOverlapping.push({ start: r.start, end: r.end, issues: [r.issue] });
      }
    }

    const nodes: ReactNode[] = [];
    let cursor = 0;
    nonOverlapping.forEach((seg, idx) => {
      if (seg.start > cursor) {
        nodes.push(
          <span key={`plain_${idx}`}>{text.slice(cursor, seg.start)}</span>
        );
      }
      const primaryIssue = seg.issues[0];
      const isBubbleOpen = seg.issues.some((i) => i.id === activeBubbleIssueId);
      const isFocused = seg.issues.some((i) => i.id === focusedAuditIssueId);
      const isCritical = seg.issues.some((i) => i.severity === 'critical');

      nodes.push(
        <span
          key={`hl_${primaryIssue.id}_${idx}`}
          data-audit-issue-id={primaryIssue.id}
          onMouseEnter={() => openBubble(primaryIssue.id)}
          onMouseLeave={scheduleHideBubble}
          onClick={(e) => {
            e.stopPropagation();
            openBubble(primaryIssue.id);
          }}
          className={`relative inline rounded px-0.5 cursor-pointer transition-colors ${
            isCritical
              ? 'bg-rose-200/80 hover:bg-rose-300/85 text-rose-950 underline decoration-wavy decoration-rose-600 underline-offset-2'
              : 'bg-amber-200/80 hover:bg-amber-300/85 text-amber-950 underline decoration-wavy decoration-amber-600 underline-offset-2'
          } ${isFocused ? 'ring-2 ring-rose-500 ring-offset-1' : ''}`}
        >
          {text.slice(seg.start, seg.end)}

          {/* Floating Chat Bubble Tooltip on Hover / Click */}
          {isBubbleOpen && (
            <span
              role="tooltip"
              onMouseEnter={() => openBubble(primaryIssue.id)}
              onMouseLeave={scheduleHideBubble}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textIndent: 0,
                textAlign: 'left',
                lineHeight: 1.4,
              }}
              className="popover-enter absolute left-0 bottom-full mb-2.5 z-40 w-[320px] sm:w-[370px] max-w-[85vw] rounded-2xl bg-white border border-rose-200 shadow-xl p-3 text-slate-800 block select-text"
            >
              <span className="flex items-center justify-between gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-rose-700">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>
                    {seg.issues.length > 1
                      ? `${seg.issues.length} lỗi tại câu này`
                      : isCritical
                      ? 'Lỗi nghiêm trọng'
                      : 'Cảnh báo học thuật'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveBubbleIssueId(null)}
                  className="text-[11px] text-zinc-400 hover:text-zinc-700 font-bold px-1"
                >
                  ✕
                </button>
              </span>

              <span className="block space-y-2 max-h-44 overflow-y-auto pr-0.5">
                {seg.issues.map((iss) => (
                  <span key={iss.id} className="block space-y-0.5">
                    <span className="block text-xs font-bold text-slate-900">
                      {iss.title}
                    </span>
                    <span className="block text-[11px] text-slate-600 break-words">
                      {iss.detail}
                    </span>
                    {iss.fixHint && (
                      <span className="block text-[10.5px] text-[#12489B] font-medium">
                        Gợi ý: {iss.fixHint}
                      </span>
                    )}
                  </span>
                ))}
              </span>

              <span className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveBubbleIssueId(null);
                    setEditingSectionId(sec.id);
                    onSelectSection(sec.id);
                  }}
                  className="btn-press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-slate-700 text-[11px] font-semibold"
                >
                  <PencilLine className="w-3 h-3" />
                  <span>Sửa tay</span>
                </button>

                {primaryIssue.autoFixable && onFixSingleIssue && (
                  <button
                    type="button"
                    disabled={qaBanner?.isFixing}
                    onClick={() => {
                      setActiveBubbleIssueId(null);
                      onFixSingleIssue(primaryIssue);
                    }}
                    className="btn-press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#12489B] hover:bg-[#0D387A] text-white text-[11px] font-bold shadow-2xs disabled:opacity-50"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>Sửa lỗi này</span>
                  </button>
                )}
              </span>

              {/* Little speech-bubble arrow */}
              <span className="absolute left-5 top-full w-3 h-3 bg-white border-r border-b border-rose-200 rotate-45 -mt-1.5 block" />
            </span>
          )}
        </span>
      );
      cursor = seg.end;
    });
    if (cursor < text.length) {
      nodes.push(<span key="plain_tail">{text.slice(cursor)}</span>);
    }
    return nodes;
  };
  const hasCoverPage = Boolean(format.coverPage?.enabled);
  const includeToc = format.includeTableOfContents ?? true;
  const tocHeadingTitle =
    session.writingLanguage === 'Vietnamese' ? 'MỤC LỤC' : 'TABLE OF CONTENTS';

  const tocEntries = useMemo<TocPreviewEntry[]>(() => {
    if (!includeToc) return [];
    const entries: TocPreviewEntry[] = [];
    // When Cover Page or TOC is enabled, main content starts after their page breaks
    const bodyStartPage = 1 + (hasCoverPage ? 1 : 0) + (includeToc ? 1 : 0);
    let cumulativeWords = 0;
    const wordsPerPage = format.lineSpacing >= 2.0 ? 275 : 350;

    for (const sec of session.outline) {
      const currentPage = bodyStartPage + Math.floor(cumulativeWords / wordsPerPage);
      if (sec.title.trim()) {
        entries.push({
          key: `sec_${sec.id}`,
          sectionId: sec.id,
          title: sec.title.trim(),
          level: sec.headingLevel || 'h1',
          pageNumber: currentPage,
        });
      }

      if (sec.content.trim()) {
        const lines = sec.content.split(/\r?\n/);
        for (let idx = 0; idx < lines.length; idx++) {
          const trimmed = lines[idx].trim();
          if (!trimmed) continue;
          const pageAtLine = bodyStartPage + Math.floor(cumulativeWords / wordsPerPage);
          const cleanLine = trimmed.replace(/^[ \t]*#{1,6}[ \t]*/, '').trim();
          const isExplicitH3 =
            trimmed.startsWith('### ') ||
            /^\d+\.\d+\.\d+(\.\d+)*\s+[A-Za-zÀ-ỹ0-9]/.test(cleanLine);
          const isExplicitH2 =
            trimmed.startsWith('## ') ||
            /^\d+\.\d+\s+[A-Za-zÀ-ỹ0-9]/.test(cleanLine);
          const isExplicitH1 = trimmed.startsWith('# ');

          if (isExplicitH3) {
            entries.push({
              key: `sub_${sec.id}_${idx}`,
              sectionId: sec.id,
              title: cleanLine,
              level: 'h3',
              pageNumber: pageAtLine,
            });
          } else if (isExplicitH2) {
            entries.push({
              key: `sub_${sec.id}_${idx}`,
              sectionId: sec.id,
              title: cleanLine,
              level: 'h2',
              pageNumber: pageAtLine,
            });
          } else if (isExplicitH1) {
            entries.push({
              key: `sub_${sec.id}_${idx}`,
              sectionId: sec.id,
              title: cleanLine,
              level: 'h1',
              pageNumber: pageAtLine,
            });
          }
          cumulativeWords += countWords(trimmed);
        }
      } else {
        cumulativeWords += sec.targetWords || 250;
      }
    }
    return entries;
  }, [includeToc, hasCoverPage, session.outline, format.lineSpacing]);

  return (
    <div
      className={`${
        containerClassName ||
        (focusPaperMode ? 'lg:col-span-12' : 'lg:col-span-8')
      } bg-zinc-200/65 border border-zinc-300/90 rounded-2xl p-4 sm:p-6 overflow-x-auto`}
    >
        {/* Paper Top Info Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-xs text-zinc-600">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFocusPaperMode}
            className="btn-press px-2.5 py-1 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-slate-800 hover:bg-zinc-50 inline-flex items-center gap-1.5 shadow-2xs"
            title={
              focusPaperMode
                ? 'Hiện lại cột Đề bài & Dàn ý'
                : 'Ẩn cột bên trái để tập trung soạn thảo toàn màn hình'
            }
          >
            {focusPaperMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-[#12489B]" />
                <span>Hiện cột Đề bài & Dàn ý</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#12489B]" />
                <span>Chế độ Tập trung A4</span>
              </>
            )}
          </button>

          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-white/80 border border-zinc-200/80 font-mono text-[11px] text-zinc-600">
            {format.fontFamily} · {format.fontSizePt}pt · Dòng{' '}
            {format.lineSpacing} · Lề {format.marginInch}"
          </span>

          {onUpdateContextImages && session.outline.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const targetId =
                  currentSectionId || session.outline[0]?.id || null;
                if (!targetId) return;
                setImagePickerSectionId((prev) =>
                  prev === targetId ? null : targetId
                );
                onSelectSection(targetId);
                window.requestAnimationFrame(() => {
                  const secEl = document.querySelector<HTMLElement>(
                    `[data-writer-section-id="${targetId}"]`
                  );
                  secEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
              }}
              className="btn-press px-2.5 py-1 text-xs font-semibold bg-blue-50 border border-blue-200/90 rounded-lg text-[#12489B] hover:bg-blue-100 inline-flex items-center gap-1.5 shadow-2xs"
              title="Tải ảnh mới, dán Ctrl+V hoặc chọn từ thư viện ảnh để chèn thủ công vào mục đang chọn"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Chèn ảnh vào bài</span>
              {(session.contextImages?.length || 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#12489B] text-white font-mono text-[10px]">
                  {session.contextImages?.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="inline-flex rounded-lg bg-white border border-zinc-200 p-0.5">
          <button
            type="button"
            onClick={() => onUpdateViewMode('sections')}
            className={`btn-press px-2.5 py-1 text-xs font-medium rounded-md ${
              session.viewMode === 'sections'
                ? 'bg-[#12489B] text-white'
                : 'text-zinc-600 hover:text-slate-900'
            }`}
          >
            Theo từng mục
          </button>
          <button
            type="button"
            onClick={() => onUpdateViewMode('full_paper')}
            className={`btn-press px-2.5 py-1 text-xs font-medium rounded-md ${
              session.viewMode === 'full_paper'
                ? 'bg-[#12489B] text-white'
                : 'text-zinc-600 hover:text-slate-900'
            }`}
          >
            Liền mạch A4
          </button>
        </div>
      </div>

      {/* Live QA Score & Sequential Auto-Fix Walkthrough Banner */}
      {qaBanner && (
        <div
          className={`sticky top-2 z-20 mb-4 px-3.5 py-2.5 rounded-xl border shadow-sm backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5 transition-colors ${
            qaBanner.isFixing
              ? 'bg-blue-50/95 border-blue-300 text-[#0B2559]'
              : qaBanner.remainingErrorCount > 0
              ? 'bg-rose-50/95 border-rose-300 text-rose-900'
              : 'bg-emerald-50/95 border-emerald-300 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`px-2 py-1 rounded-lg font-mono text-xs font-black tabular-nums shrink-0 ${
                qaBanner.remainingErrorCount === 0
                  ? 'bg-emerald-600 text-white'
                  : qaBanner.score < 70
                  ? 'bg-rose-600 text-white'
                  : 'bg-amber-600 text-white'
              }`}
            >
              Điểm QA: {qaBanner.score}/100
            </span>

            <div className="min-w-0">
              <div className="text-xs font-bold flex items-center gap-1.5 truncate">
                {qaBanner.isFixing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#12489B] shrink-0" />
                    <span className="truncate">
                      Đang sửa tuần tự ({qaBanner.currentStepIndex}/
                      {qaBanner.batchTotal}):{' '}
                      {qaBanner.currentStepTitle || 'Đang xử lý...'}
                    </span>
                  </>
                ) : qaBanner.remainingErrorCount > 0 ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>
                      Đang còn {qaBanner.remainingErrorCount} lỗi cần sửa (mục
                      tô đỏ bên dưới)
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Đã sửa sạch lỗi · Các mục tô xanh đã hoàn tất chuẩn học
                      thuật!
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!qaBanner.isFixing &&
              qaBanner.autoFixableCount > 0 &&
              qaBanner.onFixNextBatch && (
                <button
                  type="button"
                  onClick={qaBanner.onFixNextBatch}
                  className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12489B] hover:bg-[#0D387A] text-white text-xs font-bold shadow-2xs"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>
                    {qaBanner.autoFixableCount > 5
                      ? `Sửa tiếp 5 lỗi (${qaBanner.autoFixableCount} lỗi còn lại)`
                      : `Tự động sửa ${qaBanner.autoFixableCount} lỗi còn lại`}
                  </span>
                </button>
              )}
            <button
              type="button"
              onClick={qaBanner.onOpenAuditModal}
              className="btn-press px-2.5 py-1.5 rounded-lg bg-white/90 border border-zinc-200 hover:bg-white text-xs font-semibold text-slate-700"
            >
              Xem báo cáo QA
            </button>
          </div>
        </div>
      )}

      {/* A4 Paper Sheet */}
      <div
        className="mx-auto bg-white shadow-lg border border-zinc-300 rounded-xs"
        style={{
          width: `${Math.round((794 * zoomPercent) / 100)}px`,
          minHeight: `${Math.round((1123 * zoomPercent) / 100)}px`,
          padding: `${Math.round((pagePaddingPx * zoomPercent) / 100)}px`,
          fontFamily: `"${format.fontFamily}", serif`,
          fontSize: `${Number(((format.fontSizePt * zoomPercent) / 100).toFixed(2))}pt`,
          lineHeight: format.lineSpacing,
          textAlign: format.textAlign,
        }}
      >
        {/* Cover Page (Trang bìa) Preview when enabled */}
        {format.coverPage?.enabled && (
          <div className="mb-8 pb-6 border-b-2 border-dashed border-zinc-300">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 select-none">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-sans text-[10px] font-semibold">
                <BookMarked className="w-3 h-3" />
                Trang bìa (Cover Page) ·{' '}
                {COVER_PAGE_TEMPLATES.find(
                  (t) => t.id === format.coverPage?.templateId
                )?.name || 'Chuẩn luận văn'}
              </span>
              <div className="inline-flex items-center gap-2 font-sans text-[10px]">
                {onOpenCoverPage && (
                  <button
                    type="button"
                    onClick={onOpenCoverPage}
                    className="font-semibold text-[#12489B] hover:underline"
                  >
                    Đổi mẫu / Chỉnh trang bìa
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onUpdateFormat({
                      coverPage: {
                        ...format.coverPage!,
                        enabled: false,
                      },
                    })
                  }
                  className="font-medium text-zinc-400 hover:text-slate-700"
                >
                  Ẩn trang bìa
                </button>
              </div>
            </div>

            <CoverPageSheetPreview
              cover={format.coverPage}
              topic={session.topic}
              subject={session.subject}
              targetWordCount={session.targetWordCount}
              writingLanguage={session.writingLanguage}
              fontFamily={format.fontFamily}
            />

            <div className="mt-4 text-center font-sans text-[10px] text-zinc-400 uppercase tracking-widest">
              --- Ngắt trang (Page Break) ---
            </div>
          </div>
        )}

        {/* Running Header & Page Number Simulation */}
        <div className="flex items-center justify-between text-[10pt] text-zinc-400 pb-4 mb-6 border-b border-zinc-100 select-none">
          <input
            type="text"
            value={format.runningHeader}
            onChange={(e) => onUpdateFormat({ runningHeader: e.target.value })}
            placeholder="TIÊU ĐỀ ĐẦU TRANG (RUNNING HEAD)..."
            className="bg-transparent border-none focus:outline-none text-zinc-500 uppercase tracking-wider flex-1 mr-4 min-w-0"
            style={{ fontFamily: `"${format.fontFamily}", serif` }}
          />
          {format.includePageNumbers && <span className="shrink-0 font-mono">Page 1</span>}
        </div>

        {/* Automatic Academic Table of Contents (Mục lục chuẩn luận văn) */}
        {includeToc && tocEntries.length > 0 && (
          <div className="mb-8 pb-6 border-b-2 border-dashed border-zinc-200 select-none">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-[#12489B] border border-blue-200/80 font-sans text-[10px] font-semibold">
                <ListTree className="w-3 h-3" />
                Mục lục tự động (Chuẩn Word TOC · Bấm vào mục để chuyển nhanh)
              </span>
              <button
                type="button"
                onClick={() => onUpdateFormat({ includeTableOfContents: false })}
                className="font-sans text-[10px] font-medium text-zinc-400 hover:text-slate-700"
              >
                Ẩn mục lục
              </button>
            </div>

            <div
              className="text-center font-bold text-slate-900 mb-3 tracking-wide"
              style={{
                fontFamily: `"${format.fontFamily}", serif`,
                fontSize: `${Math.round(
                  ((format.fontSizePt + 2) * zoomPercent) / 100
                )}pt`,
              }}
            >
              {tocHeadingTitle}
            </div>

            <div className="space-y-1.5">
              {tocEntries.map((item) => {
                const indentCls =
                  item.level === 'h3'
                    ? 'pl-8 text-zinc-700 italic'
                    : item.level === 'h2'
                    ? 'pl-4 text-slate-800'
                    : 'font-bold text-slate-900';
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelectSection(item.sectionId)}
                    className={`w-full flex items-baseline gap-2 text-left hover:text-[#12489B] group ${indentCls}`}
                    style={{
                      fontFamily: `"${format.fontFamily}", serif`,
                      fontSize: `${Math.round(
                        (format.fontSizePt * zoomPercent) / 100
                      )}pt`,
                      lineHeight: 1.45,
                    }}
                  >
                    <span className="shrink-0 max-w-[82%] truncate group-hover:underline">
                      {item.title}
                    </span>
                    <span className="flex-1 border-b border-dotted border-zinc-300 mx-1" />
                    <span className="shrink-0 font-mono text-[0.92em] tabular-nums text-zinc-600">
                      {item.pageNumber}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Paper Sections */}
        <div className="space-y-5">
          {session.outline.map((sec) => {
            const isCurrent = currentSectionId === sec.id;
            const headingFontSizePt =
              sec.headingLevel === 'h1'
                ? format.fontSizePt + 2
                : sec.headingLevel === 'h2'
                ? format.fontSizePt + 1
                : format.fontSizePt;

            const lineCount = Math.max(
              5,
              sec.content.split('\n').length +
                Math.ceil(sec.content.length / 85)
            );

            const auditVisual = sectionAuditStates?.[sec.id];
            const secAuditIssues = auditIssues.filter((iss) => {
              if (iss.sectionId === sec.id) return true;
              if (
                isReferencesSectionTitle(sec.title) &&
                (iss.category === 'doi_and_sources' ||
                  iss.category === 'citation_sync')
              ) {
                return true;
              }
              return false;
            });
            const showInlineHighlightMode =
              secAuditIssues.length > 0 &&
              Boolean(sec.content.trim()) &&
              editingSectionId !== sec.id;
            const sectionHighlightClass =
              auditVisual?.status === 'fixing'
                ? 'ring-2 ring-[#12489B] bg-blue-50/75 p-3 -mx-3 shadow-sm'
                : auditVisual?.status === 'error'
                ? 'ring-2 ring-rose-500/80 bg-rose-50/70 p-3 -mx-3'
                : auditVisual?.status === 'fixed'
                ? 'ring-2 ring-emerald-500/80 bg-emerald-50/65 p-3 -mx-3'
                : session.viewMode === 'sections'
                ? isCurrent
                  ? 'ring-1 ring-[#12489B]/35 bg-blue-50/15 p-3 -mx-3'
                  : 'hover:bg-zinc-50/80 p-3 -mx-3'
                : 'py-1';

            return (
              <div
                key={sec.id}
                data-writer-section-id={sec.id}
                onClick={() => onSelectSection(sec.id)}
                className={`rounded-lg transition-all duration-300 ${sectionHighlightClass}`}
              >
                {/* Live Audit Highlight Status Pill (Red Warning / Fixing / Green Fixed) */}
                {auditVisual && (
                  <div
                    className={`mb-2 px-2.5 py-1.5 rounded-lg text-[11px] font-sans font-semibold flex items-center justify-between gap-2 ${
                      auditVisual.status === 'fixing'
                        ? 'bg-blue-100/90 text-[#0B2559] border border-blue-300'
                        : auditVisual.status === 'error'
                        ? 'bg-rose-100/90 text-rose-800 border border-rose-300'
                        : 'bg-emerald-100/90 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      {auditVisual.status === 'fixing' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#12489B] shrink-0" />
                      ) : auditVisual.status === 'error' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span className="truncate">
                        {auditVisual.status === 'fixing'
                          ? `Đang tự động sửa lỗi mục này... ${
                              auditVisual.label ? `(${auditVisual.label})` : ''
                            }`
                          : auditVisual.status === 'error'
                          ? `Cảnh báo lỗi (${auditVisual.issueCount} lỗi) · Chờ sửa${
                              auditVisual.label ? ` — ${auditVisual.label}` : ''
                            }`
                          : `Đã chỉnh sửa xong ✓${
                              auditVisual.label ? ` — ${auditVisual.label}` : ''
                            }`}
                      </span>
                    </span>
                    {secAuditIssues.length > 0 && sec.content.trim() && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSectionId((prev) =>
                            prev === sec.id ? null : sec.id
                          );
                        }}
                        className="btn-press shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/90 border border-rose-200 hover:border-[#12489B] text-[10.5px] font-semibold text-slate-700 hover:text-[#12489B]"
                      >
                        <PencilLine className="w-3 h-3" />
                        <span>
                          {editingSectionId === sec.id
                            ? 'Xem câu tô đỏ'
                            : 'Sửa tay'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
                {/* Section Heading */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <input
                    type="text"
                    value={sec.title}
                    onChange={(e) =>
                      onUpdateSection(sec.id, { title: e.target.value })
                    }
                    className={`w-full font-bold text-slate-900 bg-transparent focus:outline-none ${
                      sec.headingLevel === 'h1' && format.preset === 'APA7'
                        ? 'text-center'
                        : 'text-left'
                    } ${sec.headingLevel === 'h3' ? 'italic' : ''}`}
                    style={{
                      fontFamily: `"${format.fontFamily}", serif`,
                      fontSize: `${Math.round(
                        (headingFontSizePt * zoomPercent) / 100
                      )}pt`,
                    }}
                  />

                  <div className="flex items-center gap-1.5 shrink-0 select-none">
                    {onUpdateContextImages && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSection(sec.id);
                          setImagePickerSectionId((prev) =>
                            prev === sec.id ? null : sec.id
                          );
                        }}
                        className={`btn-press inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-sans text-[11px] font-semibold border transition-colors ${
                          imagePickerSectionId === sec.id
                            ? 'bg-[#12489B] text-white border-[#12489B]'
                            : 'bg-white/90 text-[#12489B] border-blue-200/80 hover:bg-blue-50'
                        }`}
                        title="Chèn ảnh thủ công vào mục này (tải ảnh, dán Ctrl+V hoặc chọn ảnh có sẵn)"
                      >
                        <ImagePlus className="w-3 h-3" />
                        <span>Chèn ảnh</span>
                      </button>
                    )}

                    {session.viewMode === 'sections' && (
                      <span className="text-[11px] font-sans font-mono text-zinc-400 tabular-nums">
                        {isReferencesSectionTitle(sec.title) || sec.targetWords === 0
                          ? `${countWords(sec.content)}w · Không giới hạn`
                          : `${countWords(sec.content)}/${sec.targetWords}w`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Inline Manual Image Inserter Drawer for this section */}
                {imagePickerSectionId === sec.id && onUpdateContextImages && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onPaste={(e) => {
                      const items = Array.from(e.clipboardData?.items || []);
                      const pastedImages = items
                        .filter((it) => it.type.startsWith('image/'))
                        .map((it) => it.getAsFile())
                        .filter((f): f is File => Boolean(f));
                      if (pastedImages.length > 0) {
                        e.preventDefault();
                        void handleManualImageFiles(sec, pastedImages);
                      }
                    }}
                    className="mb-3 p-3.5 rounded-xl bg-[#F4F7FB] border border-blue-200/90 font-sans text-left space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B2559]">
                        <ImagePlus className="w-4 h-4 text-[#12489B]" />
                        <span>Chèn ảnh thủ công vào mục &ldquo;{sec.title}&rdquo;</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setImagePickerSectionId(null)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-slate-700 hover:bg-white"
                        title="Đóng khung chèn ảnh"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Upload new image / Paste Ctrl+V */}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={manualCaptionDraft}
                        onChange={(e) => setManualCaptionDraft(e.target.value)}
                        placeholder="Chú thích ảnh (VD: Biểu đồ kết quả hồi quy OLS) — tùy chọn..."
                        className="flex-1 min-w-[200px] px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white focus:outline-none focus:border-[#12489B]"
                      />
                      <input
                        ref={manualFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const list = Array.from(e.target.files || []);
                          void handleManualImageFiles(sec, list);
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingManualImage}
                        onClick={() => manualFileInputRef.current?.click()}
                        className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#12489B] hover:bg-[#0D387A] text-white text-xs font-bold disabled:opacity-60"
                      >
                        {uploadingManualImage ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>Tải ảnh từ máy</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-zinc-500">
                      Mẹo: Bạn có thể bấm <strong>Ctrl+V</strong> ngay tại khung này hoặc trực tiếp tại vị trí con trỏ trong đoạn văn để dán ảnh chụp màn hình (SPSS, Excel, biểu đồ...). Ảnh chèn vào sẽ tự xuất hiện khi xuất Word (.docx) &amp; PDF.
                    </p>

                    {/* Existing session images library */}
                    {(session.contextImages?.length || 0) > 0 && (
                      <div className="pt-2 border-t border-blue-200/70 space-y-2">
                        <div className="text-[11px] font-bold text-slate-700">
                          Hoặc chọn nhanh ảnh đã có trong phiên ({session.contextImages?.length}):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(session.contextImages || []).map((img) => {
                            const alreadyInserted = sec.content
                              .split(/\r?\n/)
                              .some(
                                (line) =>
                                  parseFigureMarkerTag(line) === img.tag.toUpperCase()
                              );
                            return (
                              <div
                                key={img.id}
                                className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-zinc-200/90"
                              >
                                <img
                                  src={img.dataUrl}
                                  alt={img.caption || img.name}
                                  className="w-12 h-10 rounded object-cover border border-zinc-200 shrink-0 bg-zinc-50"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    <span className="px-1.5 py-0.2 rounded bg-blue-50 text-[#12489B] font-mono text-[10px] font-bold">
                                      {img.tag}
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-800 truncate">
                                      {img.caption || img.name}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    {img.width}×{img.height}px
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (alreadyInserted) {
                                      removeMarkerFromSection(sec, img.tag);
                                    } else {
                                      insertMarkerIntoSection(sec, img.tag);
                                      onToast?.(
                                        `Đã chèn [${img.tag}] vào mục "${sec.title}".`
                                      );
                                    }
                                  }}
                                  className={`btn-press shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                    alreadyInserted
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                                      : 'bg-[#0B2559] text-white hover:bg-[#12489B]'
                                  }`}
                                  title={
                                    alreadyInserted
                                      ? 'Bấm để gỡ ảnh này khỏi mục hiện tại'
                                      : 'Chèn ảnh này vào mục hiện tại'
                                  }
                                >
                                  {alreadyInserted ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span>Đã chèn</span>
                                    </>
                                  ) : (
                                    <span>+ Chèn</span>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Editable Section Prose OR Interactive Inline Red-Highlighted Sentences */}
                {showInlineHighlightMode ? (
                  <div
                    onDoubleClick={() => setEditingSectionId(sec.id)}
                    className="w-full text-slate-900 rounded p-1 whitespace-pre-wrap break-words"
                    style={{
                      fontFamily: `"${format.fontFamily}", serif`,
                      fontSize: `${Math.round(
                        (format.fontSizePt * zoomPercent) / 100
                      )}pt`,
                      lineHeight: format.lineSpacing,
                      textAlign: format.textAlign,
                      textIndent: format.firstLineIndent ? '0.5in' : '0',
                    }}
                  >
                    {buildHighlightedContentNodes(sec, secAuditIssues)}
                  </div>
                ) : (
                  <textarea
                    ref={isCurrent ? activeTextareaRef : undefined}
                    rows={lineCount}
                    value={sec.content}
                    onPaste={(e) => {
                      if (!onUpdateContextImages) return;
                      const items = Array.from(e.clipboardData?.items || []);
                      const pastedImages = items
                        .filter((it) => it.type.startsWith('image/'))
                        .map((it) => it.getAsFile())
                        .filter((f): f is File => Boolean(f));
                      if (pastedImages.length > 0) {
                        e.preventDefault();
                        const target = e.currentTarget;
                        void handleManualImageFiles(sec, pastedImages, {
                          start: target.selectionStart ?? sec.content.length,
                          end: target.selectionEnd ?? sec.content.length,
                        });
                      }
                    }}
                    onBlur={() => {
                      if (editingSectionId === sec.id) {
                        setEditingSectionId(null);
                      }
                    }}
                    onChange={(e) =>
                      onUpdateSection(
                        sec.id,
                        { content: stripMarkdownHashesFromText(e.target.value) },
                        true
                      )
                    }
                    placeholder={`Bấm "Viết" ở mục "${sec.title}" hoặc gõ nội dung trực tiếp tại đây...`}
                    className="w-full bg-transparent text-slate-900 focus:outline-none resize-y border border-transparent focus:border-blue-200/80 rounded p-1"
                    style={{
                      fontFamily: `"${format.fontFamily}", serif`,
                      fontSize: `${Math.round(
                        (format.fontSizePt * zoomPercent) / 100
                      )}pt`,
                      lineHeight: format.lineSpacing,
                      textAlign: format.textAlign,
                      textIndent: format.firstLineIndent ? '0.5in' : '0',
                    }}
                  />
                )}

                {/* Visual Figure Preview for any [FIGURE: IMG_X] markers embedded in this section */}
                {(() => {
                  const figureTags = Array.from(
                    new Set(
                      sec.content
                        .split(/\r?\n/)
                        .map((line) => parseFigureMarkerTag(line))
                        .filter((t): t is string => Boolean(t))
                    )
                  );
                  const matchedFigures = figureTags
                    .map((tag) => findSessionImageByTag(session.contextImages, tag))
                    .filter((img): img is NonNullable<typeof img> => Boolean(img));
                  if (matchedFigures.length === 0) return null;

                  return (
                    <div className="mt-3 pt-3 border-t border-dashed border-zinc-200 space-y-4">
                      {matchedFigures.map((fig, figIdx) => (
                        <figure
                          key={fig.id}
                          className="group relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-zinc-50/70 border border-zinc-200/80"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMarkerFromSection(sec, fig.tag);
                            }}
                            title={`Gỡ ảnh [${fig.tag}] khỏi mục này`}
                            className="btn-press absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/95 border border-zinc-200 hover:border-rose-300 text-[10.5px] font-sans font-semibold text-zinc-500 hover:text-rose-600 shadow-2xs"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Gỡ ảnh</span>
                          </button>

                          <img
                            src={fig.dataUrl}
                            alt={fig.caption || fig.name}
                            className="max-h-72 max-w-full rounded-lg border border-zinc-200 shadow-2xs object-contain bg-white"
                          />

                          <figcaption
                            className="w-full max-w-xl flex items-center justify-center gap-1.5 text-center italic text-slate-600 text-xs"
                            style={{
                              fontFamily: `"${format.fontFamily}", serif`,
                            }}
                          >
                            <span className="shrink-0 font-semibold not-italic text-slate-700">
                              {session.writingLanguage === 'Vietnamese'
                                ? `Hình ${figIdx + 1}.`
                                : `Figure ${figIdx + 1}.`}
                            </span>
                            {onUpdateContextImages ? (
                              <input
                                type="text"
                                value={fig.caption || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  handleUpdateImageCaption(fig.id, e.target.value)
                                }
                                placeholder="Nhập chú thích hình ảnh..."
                                className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-[#12489B] focus:outline-none text-center italic text-slate-700 px-1 py-0.5"
                              />
                            ) : (
                              <span>{fig.caption || fig.name}</span>
                            )}
                            <span className="not-italic font-mono text-[10px] text-zinc-400 shrink-0">
                              [{fig.tag}]
                            </span>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
