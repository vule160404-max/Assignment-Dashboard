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
  RotateCcw,
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
  onRequestResetPaper?: () => void;
}

const FONT_FAMILIES: FontFamilyOption[] = [
  'Times New Roman',
  'Calibri',
  'Georgia',
  'Cambria',
  'Arial',
  'Tahoma',
  'Verdana',
  'Garamond',
  'Palatino Linotype',
];

const FONT_SIZES: number[] = [9, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 16];

const LINE_SPACINGS: { value: LineSpacingOption; label: string }[] = [
  { value: 1.0, label: '1.0' },
  { value: 1.15, label: '1.15' },
  { value: 1.5, label: '1.5' },
  { value: 2.0, label: '2.0' },
];

const MARGIN_OPTIONS: { value: MarginPresetInch; label: string }[] = [
  { value: 1.0, label: '1"' },
  { value: 0.5, label: '0.5"' },
  { value: 1.25, label: '1.25"' },
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
  onRequestResetPaper,
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

  const btnIcon = 'btn-press p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-slate-900 disabled:opacity-30 transition-colors';
  const btnIconActive = 'btn-press p-1.5 rounded-lg bg-blue-50 text-[#12489B] transition-colors';
  const selectBase = 'px-2 py-1 text-[11px] font-medium bg-white border border-zinc-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#12489B] hover:border-zinc-300 transition-colors';

  return (
    <div className="bg-white border border-zinc-200/80 rounded-xl shadow-sm overflow-hidden">
      {/* ───── Main Ribbon Row ───── */}
      <div className="px-3 py-1.5 flex flex-wrap items-center gap-1">
        {/* Undo / Redo */}
        <div className="inline-flex items-center gap-0.5 mr-1">
          <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo" className={btnIcon}>
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo" className={btnIcon}>
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Preset */}
        <select
          aria-label="Chuẩn trích dẫn"
          value={format.preset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="px-2 py-1 text-[11px] font-bold bg-blue-50 text-[#12489B] border border-blue-200 rounded-lg focus:outline-none focus:border-[#12489B]"
        >
          {(Object.keys(ACADEMIC_FORMAT_PRESETS) as Array<
            Exclude<AcademicPresetKey, 'CUSTOM'>
          >).map((key) => (
            <option key={key} value={key}>
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
            <option value="CUSTOM">Tùy chỉnh</option>
          )}
        </select>

        {/* Font + Size */}
        <select
          aria-label="Font"
          value={format.fontFamily}
          onChange={(e) =>
            onUpdateFormat({ fontFamily: e.target.value as FontFamilyOption, preset: 'CUSTOM' })
          }
          className={selectBase}
        >
          {!FONT_FAMILIES.includes(format.fontFamily) && format.fontFamily && (
            <option value={format.fontFamily}>{format.fontFamily}</option>
          )}
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>

        <select
          aria-label="Size"
          value={format.fontSizePt}
          onChange={(e) =>
            onUpdateFormat({ fontSizePt: Number(e.target.value) || 12, preset: 'CUSTOM' })
          }
          className="px-1.5 py-1 text-[11px] font-mono font-medium bg-white border border-zinc-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#12489B] w-[52px]"
        >
          {!FONT_SIZES.includes(format.fontSizePt) && (
            <option value={format.fontSizePt}>{format.fontSizePt}pt</option>
          )}
          {FONT_SIZES.map((sz) => (
            <option key={sz} value={sz}>{sz}pt</option>
          ))}
        </select>

        {/* Separator */}
        <span className="w-px h-5 bg-zinc-200 mx-0.5" />

        {/* B I U Clear */}
        <div className="inline-flex items-center gap-0.5">
          <button type="button" onClick={() => onInlineFormat('**')} title="Bold" className={btnIcon}>
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onInlineFormat('*')} title="Italic" className={btnIcon}>
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onInlineFormat('__')} title="Underline" className={btnIcon}>
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onInlineFormat('clear')} title="Xóa format" className={btnIcon}>
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Separator */}
        <span className="w-px h-5 bg-zinc-200 mx-0.5" />

        {/* Heading + List */}
        <select
          aria-label="Kiểu đoạn"
          defaultValue="body"
          onChange={(e) => {
            const val = e.target.value as '# ' | '## ' | '### ' | 'body';
            onBlockPrefix(val);
            e.target.value = 'body';
          }}
          className={selectBase}
        >
          <option value="body">Normal</option>
          <option value="# ">H1</option>
          <option value="## ">H2</option>
          <option value="### ">H3</option>
        </select>

        <button type="button" onClick={() => onBlockPrefix('• ')} title="Bullet list" className={btnIcon}>
          <List className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onBlockPrefix('1. ')} title="Numbered list" className={btnIcon}>
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        {/* Separator */}
        <span className="w-px h-5 bg-zinc-200 mx-0.5" />

        {/* Alignment */}
        {(
          [
            { key: 'left', icon: AlignLeft },
            { key: 'center', icon: AlignCenter },
            { key: 'right', icon: AlignRight },
            { key: 'justify', icon: AlignJustify },
          ] as { key: TextAlignmentOption; icon: typeof AlignLeft }[]
        ).map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onUpdateFormat({ textAlign: key, preset: 'CUSTOM' })}
            className={format.textAlign === key ? btnIconActive : btnIcon}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}

        <button
          type="button"
          onClick={() => onUpdateFormat({ firstLineIndent: !format.firstLineIndent, preset: 'CUSTOM' })}
          title="First-line indent"
          className={format.firstLineIndent ? btnIconActive : btnIcon}
        >
          <Indent className="w-3.5 h-3.5" />
        </button>

        {/* Separator */}
        <span className="w-px h-5 bg-zinc-200 mx-0.5" />

        {/* Quick feature pills */}
        <button
          type="button"
          onClick={() => onUpdateFormat({ includeTableOfContents: !(format.includeTableOfContents ?? true) })}
          title="Mục lục"
          className={`btn-press px-2 py-1 rounded-lg text-[10.5px] font-semibold inline-flex items-center gap-1 border transition-colors ${
            (format.includeTableOfContents ?? true)
              ? 'bg-blue-50 text-[#12489B] border-blue-200'
              : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100'
          }`}
        >
          <ListTree className="w-3 h-3" />
          <span>TOC</span>
        </button>

        <button
          type="button"
          onClick={onOpenCoverPage}
          title="Trang bìa"
          className={`btn-press px-2 py-1 rounded-lg text-[10.5px] font-semibold inline-flex items-center gap-1 border transition-colors ${
            format.coverPage?.enabled
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : 'bg-zinc-50 text-zinc-500 border-zinc-200 hover:bg-zinc-100'
          }`}
        >
          <BookMarked className="w-3 h-3" />
          <span>Bìa</span>
        </button>

        {/* Line Spacing & Margin */}
        <select
          aria-label="Giãn dòng"
          value={format.lineSpacing}
          onChange={(e) =>
            onUpdateFormat({ lineSpacing: Number(e.target.value) as LineSpacingOption, preset: 'CUSTOM' })
          }
          className="px-1.5 py-1 text-[10.5px] font-mono bg-white border border-zinc-200 rounded-lg text-zinc-600 focus:outline-none focus:border-[#12489B]"
        >
          {LINE_SPACINGS.map((ls) => (
            <option key={ls.value} value={ls.value}>{ls.label}×</option>
          ))}
        </select>

        <select
          aria-label="Lề"
          value={format.marginInch}
          onChange={(e) =>
            onUpdateFormat({ marginInch: Number(e.target.value) as MarginPresetInch, preset: 'CUSTOM' })
          }
          className="px-1.5 py-1 text-[10.5px] bg-white border border-zinc-200 rounded-lg text-zinc-600 focus:outline-none focus:border-[#12489B]"
        >
          {MARGIN_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>Lề {m.label}</option>
          ))}
        </select>

        {/* ── Right-aligned tools ── */}
        <div className="inline-flex items-center gap-1 ml-auto">
          {onRequestResetPaper && (
            <button
              type="button"
              onClick={onRequestResetPaper}
              title="Xóa nội dung"
              className="btn-press px-2 py-1 text-[10.5px] font-semibold rounded-lg inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Xóa</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAiBar((v) => !v)}
            className={`btn-press px-2.5 py-1 text-[10.5px] font-bold rounded-lg inline-flex items-center gap-1 border transition-colors ${
              showAiBar
                ? 'bg-[#12489B] text-white border-[#12489B]'
                : 'bg-blue-50 text-[#12489B] border-blue-200 hover:bg-blue-100'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>AI Edit</span>
            <ChevronDown className={`w-2.5 h-2.5 transition-transform ${showAiBar ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowFindBar((v) => !v)}
            title="Tìm & Thay"
            className={`${showFindBar ? btnIconActive : btnIcon} border ${showFindBar ? 'border-blue-200' : 'border-zinc-200'}`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <div className="inline-flex items-center bg-zinc-50 border border-zinc-200 rounded-lg px-1 py-0.5">
            <button type="button" onClick={() => onZoomChange(Math.max(75, zoomPercent - 10))} className="btn-press p-0.5 text-zinc-400 hover:text-slate-900">
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono font-medium text-zinc-600 px-1 tabular-nums">{zoomPercent}%</span>
            <button type="button" onClick={() => onZoomChange(Math.min(135, zoomPercent + 10))} className="btn-press p-0.5 text-zinc-400 hover:text-slate-900">
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ───── Collapsible AI Refine Bar ───── */}
      {showAiBar && (
        <div className="popover-enter px-3 py-2 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border-t border-blue-100 flex flex-wrap items-center gap-1.5">
          {[
            { action: 'rewrite_academic' as AiRefineAction, label: 'Học thuật hóa', style: 'text-[#12489B] border-blue-200 bg-white hover:bg-blue-50' },
            { action: 'expand_depth' as AiRefineAction, label: '+ Mở rộng', style: 'text-[#12489B] border-blue-200 bg-white hover:bg-blue-50' },
            { action: 'add_citations' as AiRefineAction, label: '+ Citations', style: 'text-[#12489B] border-blue-200 bg-white hover:bg-blue-50' },
            { action: 'rubric_check' as AiRefineAction, label: 'Rubric ✓', style: 'text-emerald-700 border-emerald-200 bg-white hover:bg-emerald-50' },
            { action: 'condense' as AiRefineAction, label: 'Thu gọn', style: 'text-zinc-700 border-zinc-200 bg-white hover:bg-zinc-50' },
          ].map(({ action, label, style }) => (
            <button
              key={action}
              type="button"
              disabled={aiBusy}
              onClick={() => onAiRefineSection(action)}
              className={`btn-press px-2.5 py-1 text-[11px] font-semibold rounded-lg border disabled:opacity-50 ${style}`}
            >
              {label}
            </button>
          ))}

          <div className="flex items-center gap-1.5 ml-auto min-w-[200px] flex-1 max-w-sm">
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
              placeholder="Yêu cầu AI sửa mục đang chọn..."
              className="flex-1 px-2.5 py-1 text-[11px] bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-[#12489B]"
            />
            <button
              type="button"
              disabled={aiBusy || !customAiPrompt.trim()}
              onClick={() => { onAiRefineSection('rewrite_academic', customAiPrompt); setCustomAiPrompt(''); }}
              className="btn-press px-2.5 py-1 text-[11px] font-bold bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] disabled:opacity-40"
            >
              Chạy
            </button>
          </div>
        </div>
      )}

      {/* ───── Collapsible Find & Replace Bar ───── */}
      {showFindBar && (
        <div className="popover-enter px-3 py-2 bg-zinc-50/70 border-t border-zinc-200 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600">
            <Replace className="w-3.5 h-3.5 text-[#12489B]" />
            <span>Tìm & Thay:</span>
          </div>
          <input
            type="text"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="Tìm..."
            className="px-2.5 py-1 text-[11px] bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#12489B]"
          />
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            placeholder="Thay bằng..."
            className="px-2.5 py-1 text-[11px] bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#12489B]"
          />
          <button
            type="button"
            disabled={!findQuery}
            onClick={() => onFindReplace(findQuery, replaceQuery, false)}
            className="btn-press px-2.5 py-1 text-[11px] font-medium bg-white border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-100 disabled:opacity-40"
          >
            Thay 1
          </button>
          <button
            type="button"
            disabled={!findQuery}
            onClick={() => onFindReplace(findQuery, replaceQuery, true)}
            className="btn-press px-2.5 py-1 text-[11px] font-bold bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] disabled:opacity-40"
          >
            Thay tất cả
          </button>
        </div>
      )}
    </div>
  );
}
