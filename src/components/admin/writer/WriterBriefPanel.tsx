import { useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderUp,
} from 'lucide-react';
import { CITATION_STYLES, CitationStyle } from '../../../types/domain';
import { WriterSession } from './types';

interface WriterBriefPanelProps {
  session: WriterSession;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUpdateSession: (updater: (prev: WriterSession) => WriterSession) => void;
  onUploadContextFiles: (fileList: FileList | null) => Promise<void>;
}

export function WriterBriefPanel({
  session,
  collapsed,
  onToggleCollapse,
  onUpdateSession,
  onUploadContextFiles,
}: WriterBriefPanelProps) {
  const contextFileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-2xs overflow-hidden">
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full px-4 py-3 bg-zinc-50/80 border-b border-zinc-200 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#4338CA]" />
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            1. Thông tin Đề bài, Hướng dẫn & Rubric
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-mono">
            {session.targetWordCount.toLocaleString('vi-VN')}w ·{' '}
            {session.citationStyle}
          </span>
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Môn học / Học phần (Subject)
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
                className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                  Số từ mục tiêu
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
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
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
                  className="w-full px-2 py-1.5 text-xs font-medium border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
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
              Chủ đề / Đề bài chính (Topic & Research Question)
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
              className="w-full px-2.5 py-1.5 text-xs font-medium border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Ngôn ngữ viết bài
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
                className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
              >
                <option value="English">Tiếng Anh học thuật (Academic English)</option>
                <option value="Vietnamese">Tiếng Việt học thuật</option>
                <option value="Bilingual">Song ngữ Anh - Việt</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
                Cấp độ / Giọng văn
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
                className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
              Yêu cầu đề bài & Hướng dẫn làm bài chi tiết (Assignment Instructions)
            </label>
            <textarea
              rows={3}
              value={session.instructions}
              onChange={(e) =>
                onUpdateSession((s) => ({
                  ...s,
                  instructions: e.target.value,
                }))
              }
              placeholder="Dán yêu cầu chi tiết của giảng viên, câu hỏi phụ, cấu trúc bắt buộc, case study..."
              className="w-full p-2.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 mb-1">
              Rubric chấm điểm (Grading Rubric & Trọng số điểm)
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
              placeholder="Dán thang điểm Rubric (VD: Critical Analysis 40%, Literature 30%, Structure & APA 30%)..."
              className="w-full p-2.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
            />
          </div>

          {/* Per-session context / reference files */}
          <div className="pt-2 border-t border-zinc-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-zinc-600">
                Tài liệu đính kèm riêng cho bài này (.md, .txt, .docx):
              </span>
              <input
                ref={contextFileInputRef}
                type="file"
                multiple
                accept=".md,.txt,.docx,.json"
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
                className="px-2 py-1 text-[11px] font-semibold text-[#4338CA] bg-indigo-50 hover:bg-indigo-100 rounded-md inline-flex items-center gap-1"
              >
                <FolderUp className="w-3 h-3" />
                <span>+ Tải tài liệu đề/mẫu</span>
              </button>
            </div>

            {session.contextFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {session.contextFiles.map((cf) => (
                  <span
                    key={cf.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] bg-zinc-100 text-zinc-700 rounded-md"
                  >
                    <FileText className="w-3 h-3 text-[#4338CA]" />
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
        </div>
      )}
    </div>
  );
}
