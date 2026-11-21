import { useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  BookMarked,
  ChevronDown,
  Eraser,
  Indent,
  Italic,
  List,
  ListOrdered,
  ListTree,
  Redo2,
  Replace,
  Search,
  Sparkles,
  Underline,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AiRefineAction } from '../../../lib/aiWriterClient';
import {
  ACADEMIC_FORMAT_PRESETS,
  AcademicPresetKey,
  DocumentFormatConfig,
  FontFamilyOption,
  LineSpacingOption,
  MarginPresetInch,
  TextAlignmentOption,
} from './types';

interface WriterWordRibbonProps {
  format: DocumentFormatConfig;
  canUndo: boolean;
  canRedo: boolean;
  zoomPercent: number;
  aiBusy: boolean;
  onUpdateFormat: (patch: Partial<DocumentFormatConfig>) => void;
  onApplyPreset: (preset: Exclude<AcademicPresetKey, 'CUSTOM'>) => void;
  onInlineFormat: (marker: '**' | '*' | '__' | 'clear') => void;
  onBlockPrefix: (prefix: '# ' | '## ' | '### ' | '• ' | '1. ' | 'body') => void;
  onUndo: () => void;
  onRedo: () => void;
  onFindReplace: (findText: string, replaceText: string, replaceAll: boolean) => void;
  onZoomChange: (nextZoom: number) => void;
  onAiRefineSection: (action: AiRefineAction, customPrompt?: string) => void;
  onOpenCoverPage: () => void;
}

const FONT_FAMILIES: FontFamilyOption[] = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Georgia',
  'Cambria',
];

const FONT_SIZES: number[] = [10, 11, 12, 13, 14, 16];

const LINE_SPACINGS: { value: LineSpacingOption; label: string }[] = [
  { value: 1.0, label: '1.0' },
  { value: 1.15, label: '1.15' },
  { value: 1.5, label: '1.5' },
  { value: 2.0, label: '2.0' },
];

const MARGIN_OPTIONS: { value: MarginPresetInch; label: string }[] = [
  { value: 1.0, label: 'Lề 1"' },
  { value: 0.5, label: 'Lề 0.5"' },
  { value: 1.25, label: 'Lề 1.25"' },
];

export function WriterWordRibbon({
  format,
  canUndo,
  canRedo,
  zoomPercent,
  aiBusy,
  onUpdateFormat,
  onApplyPreset,
  onInlineFormat,
  onBlockPrefix,
  onUndo,
  onRedo,
  onFindReplace,
  onZoomChange,
  onAiRefineSection,
  onOpenCoverPage,
}: WriterWordRibbonProps) {
  const [showFindBar, setShowFindBar] = useState(false);
  const [showAiBar, setShowAiBar] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [customAiPrompt, setCustomAiPrompt] = useState('');

  const handlePresetChange = (val: string) => {
    if (val === 'CUSTOM') return;
    onApplyPreset(val as Exclude<AcademicPresetKey, 'CUSTOM'>);
  };

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs overflow-hidden">
      {/* Compact Single-Row Word Ribbon */}
      <div className="px-3 py-1.5 flex flex-wrap items-center gap-1.5">
        {/* Undo / Redo */}
        <div className="inline-flex items-center gap-0.5 pr-1.5 border-r border-zinc-200/80">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Hoàn tác (Undo)"
            className="btn-press p-1.5 rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-slate-900 disabled:opacity-30"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Làm lại (Redo)"
            className="btn-press p-1.5 rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-slate-900 disabled:opacity-30"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Academic Preset Dropdown */}
        <div className="inline-flex items-center gap-1 pr-1.5 border-r border-zinc-200/80">
          <select
            aria-label="Chuẩn định dạng học thuật"
            value={format.preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="px-2 py-1 text-xs font-semibold bg-blue-50/70 text-[#12489B] border border-blue-200/80 rounded-md focus:outline-none focus:border-[#12489B]"
          >
            {(Object.keys(ACADEMIC_FORMAT_PRESETS) as Array<
              Exclude<AcademicPresetKey, 'CUSTOM'>
            >).map((key) => (
              <option key={key} value={key}>
                Chuẩn:{' '}
                {key === 'APA7'
                  ? 'APA 7th'
                  : key === 'MLA9'
                  ? 'MLA 9th'
                  : key === 'HARVARD'
                  ? 'Harvard'
                  : 'IEEE'}
              </option>
            ))}
            {format.preset === 'CUSTOM' && (
              <option value="CUSTOM">Chuẩn: Tùy chỉnh</option>
            )}
          </select>
        </div>

        {/* Font Family & Font Size */}
        <div className="inline-flex items-center gap-1 pr-1.5 border-r border-zinc-200/80">
          <select
            aria-label="Font chữ"
            value={format.fontFamily}
            onChange={(e) =>
              onUpdateFormat({
                fontFamily: e.target.value as FontFamilyOption,
                preset: 'CUSTOM',
              })
            }
            className="px-2 py-1 text-xs font-medium bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-md text-slate-900 focus:outline-none focus:border-[#12489B]"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </select>

          <select
            aria-label="Cỡ chữ"
            value={format.fontSizePt}
            onChange={(e) =>
              onUpdateFormat({
                fontSizePt: Number(e.target.value) || 12,
                preset: 'CUSTOM',
              })
            }
            className="px-1.5 py-1 text-xs font-mono font-medium bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-md text-slate-900 focus:outline-none focus:border-[#12489B]"
          >
            {FONT_SIZES.map((sz) => (
              <option key={sz} value={sz}>
                {sz}pt
              </option>
            ))}
          </select>
        </div>

        {/* Inline Styles: Bold / Italic / Underline / Clear */}
        <div className="inline-flex items-center gap-0.5 pr-1.5 border-r border-zinc-200/80">
          <button
            type="button"
            onClick={() => onInlineFormat('**')}
            title="In đậm (**text**)"
            className="btn-press p-1.5 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onInlineFormat('*')}
            title="In nghiêng (*text*)"
            className="btn-press p-1.5 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onInlineFormat('__')}
            title="Gạch chân (__text__)"
            className="btn-press p-1.5 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onInlineFormat('clear')}
            title="Xóa định dạng vùng chọn"
            className="btn-press p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-slate-900"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Headings & Lists */}
        <div className="inline-flex items-center gap-0.5 pr-1.5 border-r border-zinc-200/80">
          <select
            aria-label="Kiểu đoạn văn"
            defaultValue="body"
            onChange={(e) => {
              const val = e.target.value as
                | '# '
                | '## '
                | '### '
                | 'body';
              onBlockPrefix(val);
              e.target.value = 'body';
            }}
            className="px-2 py-1 text-xs font-medium bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-md text-zinc-700 focus:outline-none focus:border-[#12489B]"
          >
            <option value="body">Kiểu chữ: Normal</option>
            <option value="# ">Heading 1 (H1)</option>
            <option value="## ">Heading 2 (H2)</option>
            <option value="### ">Heading 3 (H3)</option>
          </select>

          <button
            type="button"
            onClick={() => onBlockPrefix('• ')}
            title="Danh sách chấm đầu dòng"
            className="btn-press p-1.5 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onBlockPrefix('1. ')}
            title="Danh sách đánh số"
            className="btn-press p-1.5 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Alignment & First-Line Indent */}
        <div className="inline-flex items-center gap-0.5 pr-1.5 border-r border-zinc-200/80">
          {(
            [
              { key: 'left', icon: AlignLeft, label: 'Căn trái' },
              { key: 'center', icon: AlignCenter, label: 'Căn giữa' },
              { key: 'right', icon: AlignRight, label: 'Căn phải' },
              { key: 'justify', icon: AlignJustify, label: 'Căn đều 2 bên' },
            ] as { key: TextAlignmentOption; icon: typeof AlignLeft; label: string }[]
          ).map(({ key, icon: Icon, label }) => {
            const active = format.textAlign === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  onUpdateFormat({ textAlign: key, preset: 'CUSTOM' })
                }
                title={label}
                className={`btn-press p-1.5 rounded-md ${
                  active
                    ? 'bg-blue-50 text-[#12489B]'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}

          <button
            type="button"
            onClick={() =>
              onUpdateFormat({
                firstLineIndent: !format.firstLineIndent,
                preset: 'CUSTOM',
              })
            }
            title="Thụt đầu dòng 0.5 inch (First-line indent)"
            className={`btn-press p-1.5 rounded-md ${
              format.firstLineIndent
                ? 'bg-blue-50 text-[#12489B]'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Indent className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateFormat({
                includeTableOfContents: !(format.includeTableOfContents ?? true),
              })
            }
            title="Bật/tắt Mục lục tự động chuẩn luận văn (Table of Contents) khi xem & xuất .DOCX"
            className={`btn-press px-2 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 ${
              (format.includeTableOfContents ?? true)
                ? 'bg-blue-50 text-[#12489B] border border-blue-200/80'
                : 'text-zinc-600 hover:bg-zinc-100 border border-transparent'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Mục lục</span>
          </button>

          <button
            type="button"
            onClick={onOpenCoverPage}
            title="Thiết kế & Bật/tắt Trang bìa (Cover Page) chuẩn luận văn / báo cáo thực tập"
            className={`btn-press px-2 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 ${
              format.coverPage?.enabled
                ? 'bg-amber-50 text-amber-800 border border-amber-300/80'
                : 'text-zinc-600 hover:bg-zinc-100 border border-transparent'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Trang bìa</span>
          </button>
        </div>

        {/* Line Spacing & Margin Compact Selects */}
        <div className="inline-flex items-center gap-1 pr-1.5 border-r border-zinc-200/80">
          <select
            aria-label="Giãn dòng"
            title="Khoảng cách giãn dòng (Line spacing)"
            value={format.lineSpacing}
            onChange={(e) =>
              onUpdateFormat({
                lineSpacing: Number(e.target.value) as LineSpacingOption,
                preset: 'CUSTOM',
              })
            }
            className="px-1.5 py-1 text-xs font-mono bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-md text-zinc-700 focus:outline-none focus:border-[#12489B]"
          >
            {LINE_SPACINGS.map((ls) => (
              <option key={ls.value} value={ls.value}>
                Dòng {ls.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Lề trang"
            title="Kích thước căn lề trang giấy A4"
            value={format.marginInch}
            onChange={(e) =>
              onUpdateFormat({
                marginInch: Number(e.target.value) as MarginPresetInch,
                preset: 'CUSTOM',
              })
            }
            className="px-1.5 py-1 text-xs bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-md text-zinc-700 focus:outline-none focus:border-[#12489B]"
          >
            {MARGIN_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Right Tools: AI Assistant Drawer Toggle, Find/Replace, Zoom */}
        <div className="inline-flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setShowAiBar((v) => !v)}
            className={`btn-press px-2.5 py-1 text-xs font-semibold rounded-md inline-flex items-center gap-1 border ${
              showAiBar
                ? 'bg-[#12489B] text-white border-[#12489B]'
                : 'bg-blue-50/80 text-[#12489B] border-blue-200/80 hover:bg-blue-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Chỉnh sửa mục</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-150 ${
                showAiBar ? 'rotate-180' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setShowFindBar((v) => !v)}
            title="Tìm kiếm & Thay thế"
            className={`btn-press p-1.5 rounded-md border ${
              showFindBar
                ? 'bg-blue-50 text-[#12489B] border-blue-200'
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <div className="inline-flex items-center bg-zinc-50 border border-zinc-200 rounded-md px-1 py-0.5">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(75, zoomPercent - 10))}
              title="Thu nhỏ"
              className="btn-press p-0.5 text-zinc-500 hover:text-slate-900"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-medium text-zinc-700 px-1.5 tabular-nums">
              {zoomPercent}%
            </span>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(135, zoomPercent + 10))}
              title="Phóng to"
              className="btn-press p-0.5 text-zinc-500 hover:text-slate-900"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Row: AI Co-Pilot Refine Bar (Only visible when toggled) */}
      {showAiBar && (
        <div className="popover-enter px-3 py-2 bg-blue-50/45 border-t border-blue-100 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={aiBusy}
            onClick={() => onAiRefineSection('rewrite_academic')}
            className="btn-press px-2.5 py-1 text-xs font-medium bg-white border border-blue-200/80 text-[#12489B] hover:bg-blue-50 rounded-md disabled:opacity-50"
          >
            Nâng cấp văn phong Học thuật
          </button>

          <button
            type="button"
            disabled={aiBusy}
            onClick={() => onAiRefineSection('expand_depth')}
            className="btn-press px-2.5 py-1 text-xs font-medium bg-white border border-blue-200/80 text-[#12489B] hover:bg-blue-50 rounded-md disabled:opacity-50"
          >
            + Mở rộng & Tăng số từ
          </button>

          <button
            type="button"
            disabled={aiBusy}
            onClick={() => onAiRefineSection('add_citations')}
            className="btn-press px-2.5 py-1 text-xs font-medium bg-white border border-blue-200/80 text-[#12489B] hover:bg-blue-50 rounded-md disabled:opacity-50"
          >
            + Bổ sung Citations
          </button>

          <button
            type="button"
            disabled={aiBusy}
            onClick={() => onAiRefineSection('rubric_check')}
            className="btn-press px-2.5 py-1 text-xs font-medium bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-md disabled:opacity-50"
          >
            Đối chiếu Rubric
          </button>

          <button
            type="button"
            disabled={aiBusy}
            onClick={() => onAiRefineSection('condense')}
            className="btn-press px-2.5 py-1 text-xs font-medium bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 rounded-md disabled:opacity-50"
          >
            Thu gọn
          </button>

          <div className="flex items-center gap-1.5 ml-auto min-w-[240px] flex-1 max-w-sm">
            <input
              type="text"
              value={customAiPrompt}
              onChange={(e) => setCustomAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customAiPrompt.trim() && !aiBusy) {
                  onAiRefineSection('rewrite_academic', customAiPrompt);
                  setCustomAiPrompt('');
                }
              }}
              placeholder="Yêu cầu AI sửa riêng mục đang chọn..."
              className="flex-1 px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-md focus:outline-none focus:border-[#12489B]"
            />
            <button
              type="button"
              disabled={aiBusy || !customAiPrompt.trim()}
              onClick={() => {
                onAiRefineSection('rewrite_academic', customAiPrompt);
                setCustomAiPrompt('');
              }}
              className="btn-press px-2.5 py-1 text-xs font-semibold bg-[#12489B] text-white rounded-md hover:bg-[#0B2559] disabled:opacity-40 whitespace-nowrap"
            >
              Chạy AI
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Row: Find & Replace Bar */}
      {showFindBar && (
        <div className="popover-enter px-3 py-2 bg-zinc-50 border-t border-zinc-200 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700">
            <Replace className="w-3.5 h-3.5 text-[#12489B]" />
            <span>Tìm & Thay thế:</span>
          </div>
          <input
            type="text"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="Tìm từ..."
            className="px-2.5 py-1 text-xs bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-[#12489B]"
          />
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder="Thay bằng..."
            className="px-2.5 py-1 text-xs bg-white border border-zinc-300 rounded-md focus:outline-none focus:border-[#12489B]"
          />
          <button
            type="button"
            disabled={!findQuery}
            onClick={() => onFindReplace(findQuery, replaceQuery, false)}
            className="btn-press px-2.5 py-1 text-xs font-medium bg-white border border-zinc-300 text-zinc-700 rounded-md hover:bg-zinc-100 disabled:opacity-40"
          >
            Thay 1 từ
          </button>
          <button
            type="button"
            disabled={!findQuery}
            onClick={() => onFindReplace(findQuery, replaceQuery, true)}
            className="btn-press px-2.5 py-1 text-xs font-semibold bg-[#12489B] text-white rounded-md hover:bg-[#0B2559] disabled:opacity-40"
          >
            Thay tất cả
          </button>
        </div>
      )}
    </div>
  );
}
