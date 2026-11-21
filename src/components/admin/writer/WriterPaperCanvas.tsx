import { RefObject, useMemo } from 'react';
import { ListTree, Maximize2, Minimize2 } from 'lucide-react';
import { countWords } from '../../../lib/wordHumanizer';
import {
  DocumentFormatConfig,
  SectionHeadingLevel,
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

interface WriterPaperCanvasProps {
  session: WriterSession;
  currentSectionId: string;
  zoomPercent: number;
  focusPaperMode: boolean;
  activeTextareaRef: RefObject<HTMLTextAreaElement | null>;
  onSelectSection: (sectionId: string) => void;
  onUpdateTopic: (nextTopic: string) => void;
  onUpdateViewMode: (mode: 'sections' | 'full_paper') => void;
  onToggleFocusPaperMode: () => void;
  onUpdateFormat: (patch: Partial<DocumentFormatConfig>) => void;
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
  activeTextareaRef,
  onSelectSection,
  onUpdateTopic,
  onUpdateViewMode,
  onToggleFocusPaperMode,
  onUpdateFormat,
  onUpdateSection,
}: WriterPaperCanvasProps) {
  const { format } = session;
  const pagePaddingPx = Math.round(format.marginInch * 64);
  const includeToc = format.includeTableOfContents ?? true;
  const tocHeadingTitle =
    session.writingLanguage === 'Vietnamese' ? 'MỤC LỤC' : 'TABLE OF CONTENTS';

  const tocEntries = useMemo<TocPreviewEntry[]>(() => {
    if (!includeToc) return [];
    const entries: TocPreviewEntry[] = [];
    // When TOC is enabled, main content starts on Page 2 after the TOC page break
    let cumulativeWords = 0;
    const wordsPerPage = format.lineSpacing >= 2.0 ? 275 : 350;

    for (const sec of session.outline) {
      const currentPage = 2 + Math.floor(cumulativeWords / wordsPerPage);
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
          const pageAtLine = 2 + Math.floor(cumulativeWords / wordsPerPage);
          if (trimmed.startsWith('### ')) {
            entries.push({
              key: `sub_${sec.id}_${idx}`,
              sectionId: sec.id,
              title: trimmed.slice(4).trim(),
              level: 'h3',
              pageNumber: pageAtLine,
            });
          } else if (trimmed.startsWith('## ')) {
            entries.push({
              key: `sub_${sec.id}_${idx}`,
              sectionId: sec.id,
              title: trimmed.slice(3).trim(),
              level: 'h2',
              pageNumber: pageAtLine,
            });
          } else if (trimmed.startsWith('# ')) {
            entries.push({
              key: `sub_${sec.id}_${idx}`,
              sectionId: sec.id,
              title: trimmed.slice(2).trim(),
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
  }, [includeToc, session.outline, format.lineSpacing]);

  return (
    <div
      className={`${
        focusPaperMode ? 'lg:col-span-12' : 'lg:col-span-8'
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

      {/* A4 Paper Sheet */}
      <div
        className="mx-auto bg-white shadow-lg border border-zinc-300 rounded-xs"
        style={{
          width: `${Math.round((794 * zoomPercent) / 100)}px`,
          minHeight: `${Math.round((1123 * zoomPercent) / 100)}px`,
          padding: `${Math.round((pagePaddingPx * zoomPercent) / 100)}px`,
          fontFamily: `"${format.fontFamily}", serif`,
          fontSize: `${Math.round((format.fontSizePt * zoomPercent) / 100)}pt`,
          lineHeight: format.lineSpacing,
          textAlign: format.textAlign,
        }}
      >
        {/* Running Header & Page Number Simulation */}
        <div className="flex items-center justify-between text-[10pt] text-zinc-400 pb-4 mb-6 border-b border-zinc-100 select-none">
          <input
            type="text"
            value={format.runningHeader}
            onChange={(e) => onUpdateFormat({ runningHeader: e.target.value })}
            placeholder="TIÊU ĐỀ ĐẦU TRANG (RUNNING HEAD)..."
            className="bg-transparent border-none focus:outline-none text-zinc-500 uppercase tracking-wider w-3/4"
            style={{ fontFamily: `"${format.fontFamily}", serif` }}
          />
          {format.includePageNumbers && <span>Page 1</span>}
        </div>

        {/* Paper Main Title */}
        <div className="mb-6 text-center">
          <input
            type="text"
            value={session.topic}
            onChange={(e) => onUpdateTopic(e.target.value)}
            placeholder="NHẬP TIÊU ĐỀ BÀI NGHIÊN CỨU TẠI ĐÂY..."
            className="w-full text-center font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-[#12489B] focus:outline-none pb-1"
            style={{
              fontFamily: `"${format.fontFamily}", serif`,
              fontSize: `${Math.round(
                ((format.fontSizePt + 3) * zoomPercent) / 100
              )}pt`,
            }}
          />
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

            return (
              <div
                key={sec.id}
                onClick={() => onSelectSection(sec.id)}
                className={`rounded-lg transition-colors duration-150 ${
                  session.viewMode === 'sections'
                    ? isCurrent
                      ? 'ring-1 ring-[#12489B]/35 bg-blue-50/15 p-3 -mx-3'
                      : 'hover:bg-zinc-50/80 p-3 -mx-3'
                    : 'py-1'
                }`}
              >
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

                  {session.viewMode === 'sections' && (
                    <span className="text-[11px] font-sans font-mono text-zinc-400 shrink-0 select-none tabular-nums">
                      {countWords(sec.content)}/{sec.targetWords}w
                    </span>
                  )}
                </div>

                {/* Editable Section Prose */}
                <textarea
                  ref={isCurrent ? activeTextareaRef : undefined}
                  rows={lineCount}
                  value={sec.content}
                  onChange={(e) =>
                    onUpdateSection(
                      sec.id,
                      { content: e.target.value },
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
