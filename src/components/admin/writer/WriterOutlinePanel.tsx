import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Layers,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { countWords } from '../../../lib/wordHumanizer';
import {
  SectionHeadingLevel,
  WriterOutlineSection,
  WriterSession,
} from './types';

interface WriterOutlinePanelProps {
  session: WriterSession;
  currentSectionId: string;
  totalDraftedWords: number;
  totalOutlineTargetWords: number;
  generatingOutline: boolean;
  runningAllSections: boolean;
  onSelectSection: (sectionId: string) => void;
  onAiGenerateOutline: () => void;
  onWriteAllSequentially: () => void;
  onStopSequential: () => void;
  onWriteSingleSection: (sectionId: string) => void;
  onAddSection: () => void;
  onUpdateSection: (
    sectionId: string,
    patch: Partial<WriterOutlineSection>
  ) => void;
  onMoveSection: (sectionId: string, dir: -1 | 1) => void;
  onDeleteSection: (sectionId: string) => void;
}

export function WriterOutlinePanel({
  session,
  currentSectionId,
  totalDraftedWords,
  totalOutlineTargetWords,
  generatingOutline,
  runningAllSections,
  onSelectSection,
  onAiGenerateOutline,
  onWriteAllSequentially,
  onStopSequential,
  onWriteSingleSection,
  onAddSection,
  onUpdateSection,
  onMoveSection,
  onDeleteSection,
}: WriterOutlinePanelProps) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-2xs overflow-hidden">
      <div className="px-4 py-3 bg-zinc-50/80 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#4338CA]" />
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            2. Dàn ý từng mục ({session.outline.length} mục)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={generatingOutline || runningAllSections}
            onClick={onAiGenerateOutline}
            className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-[#4338CA] hover:bg-indigo-100 rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
          >
            {generatingOutline ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {generatingOutline ? 'Đang lập dàn ý...' : 'AI Lập Dàn Ý'}
            </span>
          </button>

          {runningAllSections ? (
            <button
              type="button"
              onClick={onStopSequential}
              className="px-2.5 py-1 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-lg"
            >
              Dừng viết tự động
            </button>
          ) : (
            <button
              type="button"
              disabled={generatingOutline}
              onClick={onWriteAllSequentially}
              className="px-2.5 py-1 text-xs font-semibold bg-[#4338CA] text-white hover:bg-indigo-700 rounded-lg inline-flex items-center gap-1 shadow-2xs"
            >
              <Play className="w-3 h-3" />
              <span>Viết tuần tự tất cả</span>
            </button>
          )}
        </div>
      </div>

      {/* Word count progress bar */}
      <div className="px-4 py-2 bg-indigo-50/40 border-b border-zinc-200 flex items-center justify-between text-xs">
        <span className="text-zinc-600">
          Đã viết:{' '}
          <strong className="font-mono text-slate-900">
            {totalDraftedWords.toLocaleString('vi-VN')}
          </strong>{' '}
          / {session.targetWordCount.toLocaleString('vi-VN')} từ
        </span>
        <span className="text-[11px] font-mono text-zinc-500">
          Tổng phân bổ dàn ý: {totalOutlineTargetWords.toLocaleString('vi-VN')}w
        </span>
      </div>

      {/* Outline Section Cards */}
      <div className="p-3 space-y-2.5 max-h-[540px] overflow-y-auto">
        {session.outline.map((sec, idx) => {
          const isSelected = currentSectionId === sec.id;
          const actualWords = countWords(sec.content);
          const isGenerating = sec.status === 'generating';

          return (
            <div
              key={sec.id}
              onClick={() => onSelectSection(sec.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#4338CA] bg-indigo-50/40 ring-2 ring-indigo-500/10'
                  : 'border-zinc-200 bg-white hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <select
                    aria-label="Cấp tiêu đề"
                    value={sec.headingLevel}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      onUpdateSection(sec.id, {
                        headingLevel: e.target.value as SectionHeadingLevel,
                      })
                    }
                    className="px-1.5 py-0.5 text-[11px] font-mono font-bold bg-zinc-100 border border-zinc-200 rounded text-zinc-700"
                  >
                    <option value="h1">H1</option>
                    <option value="h2">H2</option>
                    <option value="h3">H3</option>
                  </select>

                  <input
                    type="text"
                    value={sec.title}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      onUpdateSection(sec.id, {
                        title: e.target.value,
                      })
                    }
                    className="flex-1 px-2 py-1 text-xs font-bold text-slate-900 bg-white border border-zinc-200 rounded-md focus:outline-none focus:border-[#4338CA]"
                  />
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={50}
                    max={10000}
                    step={50}
                    value={sec.targetWords}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      onUpdateSection(sec.id, {
                        targetWords: Math.max(
                          50,
                          Number(e.target.value) || 200
                        ),
                      })
                    }
                    title="Số từ mục tiêu của mục này"
                    className="w-16 px-1.5 py-0.5 text-[11px] font-mono text-right bg-white border border-zinc-200 rounded"
                  />
                  <span className="text-[11px] text-zinc-400">w</span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveSection(sec.id, -1);
                    }}
                    disabled={idx === 0}
                    className="p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                    title="Đưa mục này lên trên"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveSection(sec.id, 1);
                    }}
                    disabled={idx === session.outline.length - 1}
                    className="p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                    title="Đưa mục này xuống dưới"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSection(sec.id);
                    }}
                    disabled={session.outline.length <= 1}
                    className="p-1 text-zinc-400 hover:text-rose-600 disabled:opacity-30"
                    title="Xóa mục này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Guidance Notes for this section */}
              <textarea
                rows={2}
                value={sec.guidanceNotes}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) =>
                  onUpdateSection(sec.id, {
                    guidanceNotes: e.target.value,
                  })
                }
                placeholder="Ghi chú luận điểm, lý thuyết, trích dẫn cần có trong mục này..."
                className="w-full p-2 text-[11px] text-zinc-700 bg-zinc-50/80 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4338CA]"
              />

              {/* Section Status & Action Bar */}
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-100">
                <div className="flex items-center gap-2 text-[11px]">
                  {actualWords > 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Đã có {actualWords} / {sec.targetWords} từ
                      </span>
                    </span>
                  ) : (
                    <span className="text-zinc-400">Chưa có nội dung</span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isGenerating || runningAllSections}
                  onClick={(e) => {
                    e.stopPropagation();
                    onWriteSingleSection(sec.id);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition-colors ${
                    actualWords > 0
                      ? 'bg-white border border-indigo-200 text-[#4338CA] hover:bg-indigo-50'
                      : 'bg-[#4338CA] text-white hover:bg-indigo-700'
                  } disabled:opacity-50`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>AI đang viết...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>
                        {actualWords > 0
                          ? 'AI Viết lại mục này'
                          : 'AI Viết mục này'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {sec.errorMsg && (
                <p className="text-[11px] text-rose-600 mt-1">{sec.errorMsg}</p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddSection}
          className="w-full py-2 text-xs font-semibold text-[#4338CA] bg-indigo-50/60 hover:bg-indigo-100/80 border border-dashed border-indigo-300 rounded-xl inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm mục dàn ý mới</span>
        </button>
      </div>
    </div>
  );
}
