import { useRef } from 'react';
import {
  FileText,
  FolderUp,
  Sparkles,
} from 'lucide-react';
import { CITATION_STYLES, CitationStyle } from '../../../types/domain';
import { WriterSession } from './types';

interface WriterBriefPanelProps {
  session: WriterSession;
  onUpdateSession: (updater: (prev: WriterSession) => WriterSession) => void;
  onUploadContextFiles: (fileList: FileList | null) => Promise<void>;
  onSwitchToOutlineWithAi?: () => void;
}

export function WriterBriefPanel({
  session,
  onUpdateSession,
  onUploadContextFiles,
  onSwitchToOutlineWithAi,
}: WriterBriefPanelProps) {
  const contextFileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="tab-panel-enter p-4 space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
            Môn học / Học phần
          </label>
          <input
            type="text"
            value={session.subject}
            onChange={(e) =>
              onUpdateSession((s) => ({
                ...s,
                subject: e.target.value,
              }))
            }
            placeholder="VD: Strategic Management / MBA701"
            className="w-full px-2.5 py-1.5 text-xs bg-zinc-50/70 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
              Tổng số từ
            </label>
            <input
              type="number"
              min={200}
              max={30000}
              step={100}
              value={session.targetWordCount}
              onChange={(e) =>
                onUpdateSession((s) => ({
                  ...s,
                  targetWordCount: Math.max(
                    100,
                    Number(e.target.value) || 1000
                  ),
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-zinc-50/70 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
              Trích dẫn
            </label>
            <select
              value={session.citationStyle}
              onChange={(e) =>
                onUpdateSession((s) => ({
                  ...s,
                  citationStyle: e.target.value as CitationStyle,
                }))
              }
              className="w-full px-2 py-1.5 text-xs font-medium bg-zinc-50/70 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B]"
            >
              {CITATION_STYLES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
          Chủ đề / Câu hỏi nghiên cứu (Topic)
        </label>
        <input
          type="text"
          value={session.topic}
          onChange={(e) =>
            onUpdateSession((s) => ({
              ...s,
              topic: e.target.value,
              title: s.linkedOrderCode
                ? `${s.linkedOrderCode} · ${e.target.value.slice(0, 28)}`
                : e.target.value.slice(0, 36) || 'Bài nghiên cứu mới',
            }))
          }
          placeholder="Nhập tên đề tài hoặc câu hỏi nghiên cứu..."
          className="w-full px-2.5 py-1.5 text-xs font-medium bg-zinc-50/70 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
            Ngôn ngữ viết
          </label>
          <select
            value={session.writingLanguage}
            onChange={(e) =>
              onUpdateSession((s) => ({
                ...s,
                writingLanguage: e.target
                  .value as WriterSession['writingLanguage'],
              }))
            }
            className="w-full px-2.5 py-1.5 text-xs bg-zinc-50/70 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B]"
          >
            <option value="English">Academic English</option>
            <option value="Vietnamese">Tiếng Việt học thuật</option>
            <option value="Bilingual">Song ngữ Anh - Việt</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
            Cấp độ học thuật
          </label>
          <input
            type="text"
            value={session.academicTone}
            onChange={(e) =>
              onUpdateSession((s) => ({
                ...s,
                academicTone: e.target.value,
              }))
            }
            placeholder="VD: Master / High Distinction"
            className="w-full px-2.5 py-1.5 text-xs bg-zinc-50/70 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B]"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
          Yêu cầu đề bài & Hướng dẫn chi tiết (Instructions)
        </label>
        <textarea
          rows={4}
          value={session.instructions}
          onChange={(e) =>
            onUpdateSession((s) => ({
              ...s,
              instructions: e.target.value,
            }))
          }
          placeholder="Dán yêu cầu chi tiết của giảng viên, cấu trúc bắt buộc, case study..."
          className="w-full p-2.5 text-xs bg-zinc-50/70 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B]"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
          Thang điểm Rubric (Grading Criteria)
        </label>
        <textarea
          rows={3}
          value={session.rubricNotes}
          onChange={(e) =>
            onUpdateSession((s) => ({
              ...s,
              rubricNotes: e.target.value,
            }))
          }
          placeholder="Dán tiêu chí Rubric (VD: Critical Analysis 40%, Literature 30%, APA 30%)..."
          className="w-full p-2.5 text-xs bg-zinc-50/70 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B]"
        />
      </div>

      {/* Per-session context / reference files */}
      <div className="pt-2.5 border-t border-zinc-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-zinc-600">
            Tài liệu đính kèm riêng cho bài (.md, .txt, .docx, .pdf):
          </span>
          <input
            ref={contextFileInputRef}
            type="file"
            multiple
            accept=".md,.txt,.docx,.pdf,.json"
            onChange={(e) => {
              void onUploadContextFiles(e.target.files);
              if (contextFileInputRef.current) {
                contextFileInputRef.current.value = '';
              }
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => contextFileInputRef.current?.click()}
            className="btn-press px-2.5 py-1 text-[11px] font-semibold text-[#12489B] bg-blue-50 hover:bg-blue-100 rounded-md inline-flex items-center gap-1"
          >
            <FolderUp className="w-3 h-3" />
            <span>+ Đính kèm tệp</span>
          </button>
        </div>

        {session.contextFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {session.contextFiles.map((cf) => (
              <span
                key={cf.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] bg-zinc-100 text-zinc-700 rounded-md"
              >
                <FileText className="w-3 h-3 text-[#12489B]" />
                <span className="truncate max-w-[140px]">{cf.name}</span>
                <span className="text-zinc-400 font-mono">
                  ({cf.wordCount}w)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSession((s) => ({
                      ...s,
                      contextFiles: s.contextFiles.filter(
                        (item) => item.id !== cf.id
                      ),
                    }))
                  }
                  className="text-zinc-400 hover:text-rose-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {onSwitchToOutlineWithAi && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onSwitchToOutlineWithAi}
            className="btn-press w-full py-2 text-xs font-semibold bg-[#12489B] text-white hover:bg-[#0B2559] rounded-lg inline-flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Chuyển sang Dàn ý & Để AI Lập Dàn Ý →</span>
          </button>
        </div>
      )}
    </div>
  );
}
