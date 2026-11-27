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
import { isReferencesSectionTitle } from '../../../lib/aiWriterClient';
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
  fullAutoRunning?: boolean;
  onSelectSection: (sectionId: string) => void;
  onAiGenerateOutline: () => void;
  onWriteAllSequentially: () => void;
  onRunFullAuto?: () => void;
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
  fullAutoRunning = false,
  onSelectSection,
  onAiGenerateOutline,
  onWriteAllSequentially,
  onRunFullAuto,
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
  const progressPct = Math.round(progressRatio * 100);

  return (
    <div className="tab-panel-enter flex flex-col">
      {/* ───── Action Strip ───── */}
      <div className="px-4 py-3 bg-white border-b border-zinc-100 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={generatingOutline || runningAllSections || fullAutoRunning}
          onClick={onAiGenerateOutline}
          className="btn-press px-3 py-2 text-[11.5px] font-bold bg-white border border-blue-200 text-[#12489B] hover:bg-blue-50 rounded-xl inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
        >
          {generatingOutline ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>{generatingOutline ? 'Đang lập...' : 'AI Lập Dàn Ý'}</span>
        </button>

        <div className="flex items-center gap-1.5">
          {runningAllSections || fullAutoRunning ? (
            <button
              type="button"
              onClick={onStopSequential}
              className="btn-press px-3.5 py-2 text-[11.5px] font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-xl"
            >
              Dừng viết
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={generatingOutline}
                onClick={onWriteAllSequentially}
                className="btn-press px-3 py-2 text-[11.5px] font-bold bg-[#12489B] text-white hover:bg-[#0B2559] rounded-xl inline-flex items-center gap-1.5 shadow-sm"
              >
                <Play className="w-3 h-3" />
                <span>Viết tuần tự</span>
              </button>
              {onRunFullAuto && (
                <button
                  type="button"
                  disabled={generatingOutline}
                  onClick={onRunFullAuto}
                  title="Full Auto → HixBypass"
                  className="btn-press px-2.5 py-2 text-[11.5px] font-bold bg-[#0B2559] text-amber-300 hover:bg-[#12489B] rounded-xl inline-flex items-center gap-1 shadow-sm"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ───── Progress bar ───── */}
      <div className="px-4 py-2.5 bg-[#FAFBFC] border-b border-zinc-100">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1.5">
          <span>
            <strong className="font-mono text-slate-800 tabular-nums">
              {totalDraftedWords.toLocaleString('vi-VN')}
            </strong>{' '}
            / {session.targetWordCount.toLocaleString('vi-VN')} từ
          </span>
          <span className="font-mono text-[10px] tabular-nums bg-white px-2 py-0.5 rounded-md border border-zinc-200">
            {progressPct}%
          </span>
        </div>
        <div className="h-1.5 bg-zinc-200/80 rounded-full overflow-hidden">
          <div
            className="progress-fill h-full w-full rounded-full"
            style={{
              transform: `scaleX(${progressRatio})`,
              background: progressPct >= 90 ? '#16a34a' : '#12489B',
            }}
          />
        </div>
      </div>

      {/* ───── Outline Cards ───── */}
      <div className="p-3 space-y-1.5 max-h-[620px] overflow-y-auto">
        {session.outline.map((sec, idx) => {
          const isSelected = currentSectionId === sec.id;
          const actualWords = countWords(sec.content);
          const isGenerating = sec.status === 'generating';
          const isRefSection = isReferencesSectionTitle(sec.title) || sec.targetWords === 0;

          return (
            <div
              key={sec.id}
              onClick={() => onSelectSection(sec.id)}
              className={`rounded-xl border p-2.5 cursor-pointer transition-all ${
                isSelected
                  ? 'border-[#12489B]/40 bg-blue-50/30 ring-1 ring-blue-500/10'
                  : 'border-zinc-200/80 bg-white hover:border-zinc-300'
              }`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className={`w-[7px] h-[7px] rounded-full shrink-0 ${
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
                      onChange={(e) => onUpdateSection(sec.id, { title: e.target.value })}
                      className="flex-1 px-2 py-0.5 text-[12px] font-bold text-slate-900 bg-white border border-blue-200 rounded-lg focus:outline-none focus:border-[#12489B]"
                    />
                  ) : (
                    <span className="text-[12px] font-semibold text-slate-800 truncate">
                      {sec.title}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10.5px] font-mono text-zinc-400 tabular-nums">
                    {isRefSection
                      ? `${actualWords}w`
                      : `${actualWords}/${sec.targetWords}w`}
                  </span>

                  <button
                    type="button"
                    disabled={isGenerating || runningAllSections}
                    onClick={(e) => { e.stopPropagation(); onWriteSingleSection(sec.id); }}
                    className={`btn-press px-2 py-1 text-[10.5px] font-bold rounded-lg inline-flex items-center gap-1 transition-colors ${
                      actualWords > 0
                        ? 'bg-white border border-zinc-200 text-[#12489B] hover:bg-blue-50'
                        : 'bg-[#12489B] text-white hover:bg-[#0B2559]'
                    } disabled:opacity-50`}
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /><span>...</span></>
                    ) : (
                      <><Sparkles className="w-3 h-3" /><span>{actualWords > 0 ? 'Lại' : 'Viết'}</span></>
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded controls */}
              {isSelected && (
                <div
                  className="popover-enter mt-2.5 pt-2.5 border-t border-zinc-100 space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5">
                      <select
                        aria-label="Level"
                        value={sec.headingLevel}
                        onChange={(e) => onUpdateSection(sec.id, { headingLevel: e.target.value as SectionHeadingLevel })}
                        className="px-1.5 py-0.5 text-[10.5px] font-mono font-semibold bg-white border border-zinc-200 rounded-lg text-zinc-700"
                      >
                        <option value="h1">H1</option>
                        <option value="h2">H2</option>
                        <option value="h3">H3</option>
                      </select>

                      {isRefSection ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg">
                          ∞ từ
                        </span>
                      ) : (
                        <label className="inline-flex items-center gap-1 text-[10.5px] text-zinc-600">
                          <input
                            type="number"
                            min={50} max={10000} step={50}
                            value={sec.targetWords}
                            onChange={(e) => onUpdateSection(sec.id, { targetWords: Math.max(50, Number(e.target.value) || 200) })}
                            className="w-16 px-1.5 py-0.5 text-[10.5px] font-mono text-right bg-white border border-zinc-200 rounded-lg tabular-nums"
                          />
                          <span>từ</span>
                        </label>
                      )}
                    </div>

                    <div className="inline-flex items-center gap-0.5">
                      <button type="button" onClick={() => onMoveSection(sec.id, -1)} disabled={idx === 0} className="btn-press p-1 text-zinc-400 hover:text-slate-900 disabled:opacity-30" title="Lên">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => onMoveSection(sec.id, 1)} disabled={idx === session.outline.length - 1} className="btn-press p-1 text-zinc-400 hover:text-slate-900 disabled:opacity-30" title="Xuống">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => onDeleteSection(sec.id)} disabled={session.outline.length <= 1} className="btn-press p-1 text-zinc-400 hover:text-rose-600 disabled:opacity-30" title="Xóa">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={sec.guidanceNotes}
                    onChange={(e) => onUpdateSection(sec.id, { guidanceNotes: e.target.value })}
                    placeholder="Ghi chú luận điểm, lý thuyết, trích dẫn..."
                    className="w-full p-2 text-[11px] text-zinc-700 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-[#12489B]"
                  />

                  {actualWords > 0 && (
                    <div className="flex items-center gap-1 text-[10.5px] text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã viết {actualWords} từ — sửa trên A4 bên phải.</span>
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
          className="btn-press w-full py-2.5 text-[11.5px] font-semibold text-[#12489B] bg-blue-50/40 hover:bg-blue-100/50 border border-dashed border-blue-300 rounded-xl inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm mục</span>
        </button>
      </div>
    </div>
  );
}
