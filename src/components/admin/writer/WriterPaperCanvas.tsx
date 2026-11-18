import { RefObject } from 'react';
import { countWords } from '../../../lib/wordHumanizer';
import {
  DocumentFormatConfig,
  WriterOutlineSection,
  WriterSession,
} from './types';

interface WriterPaperCanvasProps {
  session: WriterSession;
  currentSectionId: string;
  zoomPercent: number;
  activeTextareaRef: RefObject<HTMLTextAreaElement | null>;
  onSelectSection: (sectionId: string) => void;
  onUpdateTopic: (nextTopic: string) => void;
  onUpdateViewMode: (mode: 'sections' | 'full_paper') => void;
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
  activeTextareaRef,
  onSelectSection,
  onUpdateTopic,
  onUpdateViewMode,
  onUpdateFormat,
  onUpdateSection,
}: WriterPaperCanvasProps) {
  const { format } = session;
  const pagePaddingPx = Math.round(format.marginInch * 64);

  return (
    <div className="lg:col-span-7 bg-zinc-200/70 border border-zinc-300 rounded-2xl p-4 sm:p-6 overflow-x-auto">
      {/* Paper Top Info Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-xs text-zinc-600">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">
            Trang giấy A4 trực tiếp (Sửa thủ công mọi lúc):
          </span>
          <span className="px-2 py-0.5 rounded bg-white border border-zinc-200 font-mono text-[11px]">
            {format.fontFamily} · {format.fontSizePt}pt · Cách dòng{' '}
            {format.lineSpacing} · Lề {format.marginInch}"
          </span>
        </div>

        <div className="inline-flex rounded-lg bg-white border border-zinc-200 p-0.5">
          <button
            type="button"
            onClick={() => onUpdateViewMode('sections')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md ${
              session.viewMode === 'sections'
                ? 'bg-[#4338CA] text-white'
                : 'text-zinc-600 hover:text-slate-900'
            }`}
          >
            Soạn theo từng mục
          </button>
          <button
            type="button"
            onClick={() => onUpdateViewMode('full_paper')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md ${
              session.viewMode === 'full_paper'
                ? 'bg-[#4338CA] text-white'
                : 'text-zinc-600 hover:text-slate-900'
            }`}
          >
            Xem toàn trang A4 liền mạch
          </button>
        </div>
      </div>

      {/* A4 Paper Sheet */}
      <div
        className="mx-auto bg-white shadow-lg border border-zinc-300 rounded-xs transition-all"
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
            className="w-full text-center font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-[#4338CA] focus:outline-none pb-1"
            style={{
              fontFamily: `"${format.fontFamily}", serif`,
              fontSize: `${Math.round(
                ((format.fontSizePt + 3) * zoomPercent) / 100
              )}pt`,
            }}
          />
        </div>

        {/* Paper Sections */}
        <div className="space-y-6">
          {session.outline.map((sec) => {
            const isCurrent = currentSectionId === sec.id;
            const headingFontSizePt =
              sec.headingLevel === 'h1'
                ? format.fontSizePt + 2
                : sec.headingLevel === 'h2'
                ? format.fontSizePt + 1
                : format.fontSizePt;

            const lineCount = Math.max(
              6,
              sec.content.split('\n').length +
                Math.ceil(sec.content.length / 85)
            );

            return (
              <div
                key={sec.id}
                onClick={() => onSelectSection(sec.id)}
                className={`rounded-lg transition-all ${
                  session.viewMode === 'sections'
                    ? isCurrent
                      ? 'ring-2 ring-[#4338CA]/30 bg-indigo-50/15 p-3 -mx-3'
                      : 'hover:bg-zinc-50/80 p-3 -mx-3'
                    : 'py-1'
                }`}
              >
                {/* Section Heading */}
                <div className="flex items-center justify-between gap-2 mb-2">
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
                    <span className="text-[11px] font-sans font-mono text-zinc-400 shrink-0 select-none">
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
                  placeholder={`Bấm "AI Viết mục này" ở cột bên trái hoặc tự gõ/chỉnh sửa nội dung mục "${sec.title}" trực tiếp tại đây...`}
                  className="w-full bg-transparent text-slate-900 focus:outline-none resize-y border border-transparent focus:border-indigo-200 rounded p-1"
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
