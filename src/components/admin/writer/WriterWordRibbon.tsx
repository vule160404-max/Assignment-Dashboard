import { useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Indent,
  Italic,
  List,
  ListOrdered,
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
  { value: 1.0, label: '1.0 (Đơn)' },
  { value: 1.15, label: '1.15 (Chuẩn Word)' },
  { value: 1.5, label: '1.5 (Harvard)' },
  { value: 2.0, label: '2.0 (Double APA/MLA)' },
];

const MARGIN_OPTIONS: { value: MarginPresetInch; label: string }[] = [
  { value: 1.0, label: 'Lề Chuẩn 1" (2.54cm)' },
  { value: 0.5, label: 'Lề Hẹp 0.5" (1.27cm)' },
  { value: 1.25, label: 'Lề Rộng 1.25" (3.17cm)' },
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
}: WriterWordRibbonProps) {
  const [showFindBar, setShowFindBar] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [customAiPrompt, setCustomAiPrompt] = useState('');

  const handleStepFontSize = (delta: number) => {
    const next = Math.max(9, Math.min(22, format.fontSizePt + delta));
    onUpdateFormat({ fontSizePt: next, preset: 'CUSTOM' });
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
      {/* Row 1: Academic Style Presets & Word Core Typography/Layout Controls */}
      <div className="px-3 py-2 bg-zinc-50/90 border-b border-zinc-200 flex flex-wrap items-center gap-2">
        {/* Undo / Redo Group */}
        <div className="inline-flex items-center gap-0.5 pr-2 border-r border-zinc-200">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Hoàn tác (Undo)"
            className="p-1.5 rounded-md text-zinc-700 hover:bg-zinc-200/70 disabled:opacity-35"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Làm lại (Redo)"
            className="p-1.5 rounded-md text-zinc-700 hover:bg-zinc-200/70 disabled:opacity-35"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Academic Preset Selector */}
        <div className="inline-flex items-center gap-1 pr-2 border-r border-zinc-200">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mr-1">
            Chuẩn bài:
          </span>
          {(Object.keys(ACADEMIC_FORMAT_PRESETS) as Array<
            Exclude<AcademicPresetKey, 'CUSTOM'>
          >).map((key) => {
            const active = format.preset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onApplyPreset(key)}
                title={ACADEMIC_FORMAT_PRESETS[key].description}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  active
                    ? 'bg-[#4338CA] text-white shadow-2xs'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {key === 'APA7'
                  ? 'APA 7th'
                  : key === 'MLA9'
                  ? 'MLA 9th'
                  : key === 'HARVARD'
                  ? 'Harvard'
                  : 'IEEE'}
              </button>
            );
          })}
        </div>

        {/* Font Family & Size */}
        <div className="inline-flex items-center gap-1.5 pr-2 border-r border-zinc-200">
          <select
            aria-label="Font chữ"
            value={format.fontFamily}
            onChange={(e) =>
              onUpdateFormat({
                fontFamily: e.target.value as FontFamilyOption,
                preset: 'CUSTOM',
              })
            }
            className="px-2 py-1 text-xs font-medium bg-white border border-zinc-200 rounded-md text-slate-900 focus:outline-none focus:border-[#4338CA]"
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
            className="px-2 py-1 text-xs font-mono font-medium bg-white border border-zinc-200 rounded-md text-slate-900 focus:outline-none focus:border-[#4338CA]"
          >
            {FONT_SIZES.map((sz) => (
              <option key={sz} value={sz}>
                {sz} pt
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => handleStepFontSize(1)}
            title="Tăng cỡ chữ (A+)"
            className="px-1.5 py-1 text-xs font-semibold bg-white border border-zinc-200 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            A+
          </button>
          <button
            type="button"
            onClick={() => handleStepFontSize(-1)}
            title="Giảm cỡ chữ (A-)"
            className="px-1.5 py-1 text-xs font-semibold bg-white border border-zinc-200 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            A-
          </button>
        </div>

        {/* Bold / Italic / Underline / Clear Formatting */}
        <div className="inline-flex items-center gap-0.5 pr-2 border-r border-zinc-200">
          <button
            type="button"
            onClick={() => onInlineFormat('**')}
            title="In đậm đoạn bôi đen (**text**)"
            className="p-1.5 rounded-md text-zinc-700 hover:bg-zinc-200/70"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onInlineFormat('*')}
            title="In nghiêng đoạn bôi đen (*text*)"
            className="p-1.5 rounded-md text-zinc-700 hover:bg-zinc-200/70"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onInlineFormat('__')}
            title="Gạch chân đoạn bôi đen (__text__)"
            className="p-1.5 rounded-md text-zinc-700 hover:bg-zinc-200/70"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onInlineFormat('clear')}
            title="Xóa ký hiệu định dạng trong vùng chọn"
            className="p-1.5 rounded-md text-zinc-600 hover:bg-zinc-200/70"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Paragraph Style / Headings / Lists */}
        <div className="inline-flex items-center gap-1 pr-2 border-r border-zinc-200">
          <button
            type="button"
            onClick={() => onBlockPrefix('# ')}
            title="Đặt dòng hiện tại làm Heading 1"
            className="px-2 py-1 text-xs font-semibold bg-white border border-zinc-200 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => onBlockPrefix('## ')}
            title="Đặt dòng hiện tại làm Heading 2"
            className="px-2 py-1 text-xs font-semibold bg-white border border-zinc-200 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => onBlockPrefix('### ')}
            title="Đặt dòng hiện tại làm Heading 3"
            className="px-2 py-1 text-xs font-semibold bg-white border border-zinc-200 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => onBlockPrefix('body')}
            title="Chuyển về đoạn văn thường (Normal Body)"
            className="px-2 py-1 text-xs font-medium bg-white border border-zinc-200 rounded-md text-zinc-700 hover:bg-zinc-100"
          >
            Normal
          </button>
          <button
            type="button"
            onClick={() => onBlockPrefix('• ')}
            title="Danh sách dấu đầu dòng (Bullet list)"
            className="p-1.5 rounded-md text-zinc-700 hover:bg-zinc-200/70"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onBlockPrefix('1. ')}
            title="Danh sách đánh số (Numbered list)"
            className="p-1.5 rounded-md text-zinc-700 hover:bg-zinc-200/70"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>

        {/* Text Alignment & First-Line Indent */}
        <div className="inline-flex items-center gap-0.5 pr-2 border-r border-zinc-200">
          {(
            [
              { key: 'left', icon: AlignLeft, label: 'Căn lề trái' },
              { key: 'center', icon: AlignCenter, label: 'Căn giữa' },
              { key: 'right', icon: AlignRight, label: 'Căn lề phải' },
              { key: 'justify', icon: AlignJustify, label: 'Căn đều 2 bên (Justify)' },
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
                className={`p-1.5 rounded-md transition-colors ${
                  active
                    ? 'bg-indigo-100 text-[#4338CA]'
                    : 'text-zinc-700 hover:bg-zinc-200/70'
                }`}
              >
                <Icon className="w-4 h-4" />
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
            title="Bật/Tắt thụt đầu dòng đoạn văn 0.5 inch (First-line indent)"
            className={`ml-1 px-2 py-1 text-xs font-medium rounded-md inline-flex items-center gap-1 transition-colors ${
              format.firstLineIndent
                ? 'bg-indigo-100 text-[#4338CA] border border-indigo-200'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <Indent className="w-3.5 h-3.5" />
            <span>Thụt 0.5"</span>
          </button>
        </div>

        {/* Line Spacing & Page Margins */}
        <div className="inline-flex items-center gap-1.5 pr-2 border-r border-zinc-200">
          <label className="inline-flex items-center gap-1 text-xs text-zinc-600">
            <span className="text-[11px] font-medium">Cách dòng:</span>
            <select
              value={format.lineSpacing}
              onChange={(e) =>
                onUpdateFormat({
                  lineSpacing: Number(e.target.value) as LineSpacingOption,
                  preset: 'CUSTOM',
                })
              }
              className="px-2 py-1 text-xs font-medium bg-white border border-zinc-200 rounded-md text-slate-900 focus:outline-none focus:border-[#4338CA]"
            >
              {LINE_SPACINGS.map((ls) => (
                <option key={ls.value} value={ls.value}>
                  {ls.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-1 text-xs text-zinc-600">
            <select
              aria-label="Kích thước lề trang"
              value={format.marginInch}
              onChange={(e) =>
                onUpdateFormat({
                  marginInch: Number(e.target.value) as MarginPresetInch,
                  preset: 'CUSTOM',
                })
              }
              className="px-2 py-1 text-xs font-medium bg-white border border-zinc-200 rounded-md text-slate-900 focus:outline-none focus:border-[#4338CA]"
            >
              {MARGIN_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Find & Replace + Zoom */}
        <div className="inline-flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setShowFindBar((v) => !v)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md inline-flex items-center gap-1 border ${
              showFindBar
                ? 'bg-indigo-50 text-[#4338CA] border-indigo-200'
                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Tìm & Thay thế</span>
          </button>

          <div className="inline-flex items-center gap-0.5 bg-white border border-zinc-200 rounded-md px-1 py-0.5">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(75, zoomPercent - 10))}
              title="Thu nhỏ trang giấy"
              className="p-1 text-zinc-600 hover:text-slate-900"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-medium text-zinc-700 px-1">
              {zoomPercent}%
            </span>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(135, zoomPercent + 10))}
              title="Phóng to trang giấy"
              className="p-1 text-zinc-600 hover:text-slate-900"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: AI Co-Pilot Quick Actions on Current Section / Selection */}
      <div className="px-3 py-2 bg-white flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#4338CA]">
          <Sparkles className="w-3.5 h-3.5" />
          AI Sửa mục đang chọn:
        </span>

        <button
          type="button"
          disabled={aiBusy}
          onClick={() => onAiRefineSection('rewrite_academic')}
          className="px-2.5 py-1 text-xs font-medium bg-indigo-50 text-[#4338CA] hover:bg-indigo-100 rounded-md disabled:opacity-50"
        >
          Nâng cấp văn phong Học thuật
        </button>

        <button
          type="button"
          disabled={aiBusy}
          onClick={() => onAiRefineSection('expand_depth')}
          className="px-2.5 py-1 text-xs font-medium bg-indigo-50 text-[#4338CA] hover:bg-indigo-100 rounded-md disabled:opacity-50"
        >
          + Mở rộng phân tích & tăng số từ
        </button>

        <button
          type="button"
          disabled={aiBusy}
          onClick={() => onAiRefineSection('add_citations')}
          className="px-2.5 py-1 text-xs font-medium bg-indigo-50 text-[#4338CA] hover:bg-indigo-100 rounded-md disabled:opacity-50"
        >
          + Bổ sung trích dẫn (Citations)
        </button>

        <button
          type="button"
          disabled={aiBusy}
          onClick={() => onAiRefineSection('rubric_check')}
          className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md disabled:opacity-50"
        >
          Tối ưu bám sát Rubric
        </button>

        <button
          type="button"
          disabled={aiBusy}
          onClick={() => onAiRefineSection('condense')}
          className="px-2.5 py-1 text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-md disabled:opacity-50"
        >
          Thu gọn súc tích
        </button>

        <div className="flex items-center gap-1.5 ml-auto min-w-[260px] flex-1 max-w-md">
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
            placeholder="Yêu cầu AI sửa riêng mục này (VD: Thêm ví dụ tại Việt Nam)..."
            className="flex-1 px-2.5 py-1 text-xs border border-zinc-200 rounded-md focus:outline-none focus:border-[#4338CA]"
          />
          <button
            type="button"
            disabled={aiBusy || !customAiPrompt.trim()}
            onClick={() => {
              onAiRefineSection('rewrite_academic', customAiPrompt);
              setCustomAiPrompt('');
            }}
            className="px-2.5 py-1 text-xs font-medium bg-[#4338CA] text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 whitespace-nowrap"
          >
            AI Thực hiện
          </button>
        </div>
      </div>

      {/* Optional Find & Replace Bar */}
      {showFindBar && (
        <div className="px-3 py-2 bg-amber-50/70 border-t border-amber-200/80 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-900">
            <Replace className="w-3.5 h-3.5" />
            <span>Tìm kiếm & Thay thế trong bài:</span>
          </div>
          <input
            type="text"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="Từ hoặc cụm từ cần tìm..."
            className="px-2.5 py-1 text-xs bg-white border border-amber-300 rounded-md focus:outline-none focus:border-[#4338CA]"
          />
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder="Thay thế bằng..."
            className="px-2.5 py-1 text-xs bg-white border border-amber-300 rounded-md focus:outline-none focus:border-[#4338CA]"
          />
          <button
            type="button"
            disabled={!findQuery}
            onClick={() => onFindReplace(findQuery, replaceQuery, false)}
            className="px-2.5 py-1 text-xs font-medium bg-white border border-amber-300 text-amber-900 rounded-md hover:bg-amber-100 disabled:opacity-40"
          >
            Thay từ đầu tiên
          </button>
          <button
            type="button"
            disabled={!findQuery}
            onClick={() => onFindReplace(findQuery, replaceQuery, true)}
            className="px-2.5 py-1 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-40"
          >
            Thay tất cả
          </button>
        </div>
      )}
    </div>
  );
}
