import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
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
  const progressRatio = Math.min(
    1,
    session.targetWordCount > 0
      ? totalDraftedWords / session.targetWordCount
      : 0
  );

  return (
    <div className="tab-panel-enter flex flex-col">
      {/* Top Action Strip */}
      <div className="px-3.5 py-2.5 bg-zinc-50/70 border-b border-zinc-200/80 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={generatingOutline || runningAllSections}
          onClick={onAiGenerateOutline}
          className="btn-press px-2.5 py-1.5 text-xs font-semibold bg-white border border-indigo-200 text-[#4338CA] hover:bg-indigo-50 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {generatingOutline ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>
            {generatingOutline ? 'Đang lập dàn ý...' : 'AI Tự Lập Dàn Ý'}
          </span>
        </button>

        {runningAllSections ? (
          <button
            type="button"
            onClick={onStopSequential}
            className="btn-press px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-lg"
          >
            Dừng viết tự động
          </button>
        ) : (
          <button
            type="button"
            disabled={generatingOutline}
            onClick={onWriteAllSequentially}
            className="btn-press px-3 py-1.5 text-xs font-semibold bg-[#4338CA] text-white hover:bg-indigo-700 rounded-lg inline-flex items-center gap-1.5 shadow-2xs"
          >
            <Play className="w-3 h-3" />
            <span>Viết tuần tự cả bài</span>
          </button>
        )}
      </div>

      {/* Hardware-accelerated progress bar & word counter */}
      <div className="px-3.5 py-2 bg-white border-b border-zinc-100">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
          <span>
            Tiến độ:{' '}
            <strong className="font-mono text-slate-900 tabular-nums">
              {totalDraftedWords.toLocaleString('vi-VN')}
            </strong>{' '}
            / {session.targetWordCount.toLocaleString('vi-VN')}w
          </span>
          <span className="font-mono tabular-nums">
            Dàn ý: {totalOutlineTargetWords.toLocaleString('vi-VN')}w
          </span>
        </div>
        <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="progress-fill h-full w-full bg-[#4338CA]"
            style={{ transform: `scaleX(${progressRatio})` }}
          />
        </div>
      </div>

      {/* Accordion-Style Outline Cards */}
      <div className="p-3 space-y-2 max-h-[620px] overflow-y-auto">
        {session.outline.map((sec, idx) => {
          const isSelected = currentSectionId === sec.id;
          const actualWords = countWords(sec.content);
          const isGenerating = sec.status === 'generating';

          return (
            <div
              key={sec.id}
              onClick={() => onSelectSection(sec.id)}
              className={`card-interactive rounded-xl border p-2.5 cursor-pointer ${
                isSelected
                  ? 'border-[#4338CA] bg-indigo-50/35 ring-2 ring-indigo-500/10'
                  : 'border-zinc-200/90 bg-white'
              }`}
            >
              {/* Compact Header Row (Always visible) */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isGenerating
                        ? 'bg-amber-500 animate-pulse'
                        : actualWords > 0
                        ? 'bg-emerald-500'
                        : 'bg-zinc-300'
                    }`}
                  />
                  {isSelected ? (
                    <input
                      type="text"
                      value={sec.title}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        onUpdateSection(sec.id, { title: e.target.value })
                      }
                      className="flex-1 px-2 py-0.5 text-xs font-bold text-slate-900 bg-white border border-indigo-200 rounded focus:outline-none focus:border-[#4338CA]"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {sec.title}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                    {actualWords}/{sec.targetWords}w
                  </span>

                  <button
                    type="button"
                    disabled={isGenerating || runningAllSections}
                    onClick={(e) => {
                      e.stopPropagation();
                      onWriteSingleSection(sec.id);
                    }}
                    className={`btn-press px-2 py-1 text-[11px] font-semibold rounded-md inline-flex items-center gap-1 ${
                      actualWords > 0
                        ? 'bg-white border border-indigo-200 text-[#4338CA] hover:bg-indigo-50'
                        : 'bg-[#4338CA] text-white hover:bg-indigo-700'
                    } disabled:opacity-50`}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Đang viết</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        <span>{actualWords > 0 ? 'Viết lại' : 'Viết'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Detail Controls ONLY for active selected section */}
              {isSelected && (
                <div
                  className="popover-enter mt-2.5 pt-2.5 border-t border-indigo-100/80 space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5">
                      <select
                        aria-label="Cấp tiêu đề"
                        value={sec.headingLevel}
                        onChange={(e) =>
                          onUpdateSection(sec.id, {
                            headingLevel: e.target.value as SectionHeadingLevel,
                          })
                        }
                        className="px-1.5 py-0.5 text-[11px] font-mono font-semibold bg-white border border-zinc-200 rounded text-zinc-700"
                      >
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                      </select>

                      <label className="inline-flex items-center gap-1 text-[11px] text-zinc-600">
                        <span>Mục tiêu:</span>
                        <input
                          type="number"
                          min={50}
                          max={10000}
                          step={50}
                          value={sec.targetWords}
                          onChange={(e) =>
                            onUpdateSection(sec.id, {
                              targetWords: Math.max(
                                50,
                                Number(e.target.value) || 200
                              ),
                            })
                          }
                          className="w-16 px-1.5 py-0.5 text-[11px] font-mono text-right bg-white border border-zinc-200 rounded tabular-nums"
                        />
                        <span>từ</span>
                      </label>
                    </div>

                    <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onMoveSection(sec.id, -1)}
                        disabled={idx === 0}
                        className="btn-press p-1 text-zinc-500 hover:text-slate-900 disabled:opacity-30"
                        title="Đưa lên trên"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveSection(sec.id, 1)}
                        disabled={idx === session.outline.length - 1}
                        className="btn-press p-1 text-zinc-500 hover:text-slate-900 disabled:opacity-30"
                        title="Đưa xuống dưới"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSection(sec.id)}
                        disabled={session.outline.length <= 1}
                        className="btn-press p-1 text-zinc-400 hover:text-rose-600 disabled:opacity-30"
                        title="Xóa mục này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={sec.guidanceNotes}
                    onChange={(e) =>
                      onUpdateSection(sec.id, {
                        guidanceNotes: e.target.value,
                      })
                    }
                    placeholder="Ghi chú luận điểm, lý thuyết, trích dẫn cần triển khai trong mục này..."
                    className="w-full p-2 text-[11px] text-zinc-700 bg-white border border-indigo-200/70 rounded-lg focus:outline-none focus:border-[#4338CA]"
                  />

                  {actualWords > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Đã viết {actualWords} từ — có thể sửa trực tiếp trên giấy A4 bên phải.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {sec.errorMsg && (
                <p className="text-[11px] text-rose-600 mt-1.5">{sec.errorMsg}</p>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddSection}
          className="btn-press w-full py-2 text-xs font-semibold text-[#4338CA] bg-indigo-50/50 hover:bg-indigo-100/70 border border-dashed border-indigo-300 rounded-xl inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm mục dàn ý</span>
        </button>
      </div>
    </div>
  );
}
