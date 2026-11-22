import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileEdit,
  FileUp,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { ExistingDraftMode } from '../../../lib/aiWriterClient';
import { extractTextFromSkillFile } from '../../../lib/docxBuilder';
import { countWords } from '../../../lib/wordHumanizer';

interface WriterImportDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartProcess: (params: {
    rawDraftText: string;
    fileName?: string;
    mode: ExistingDraftMode;
    userEditNotes: string;
  }) => void;
  onToast: (msg: string) => void;
}

const MODES: {
  id: ExistingDraftMode;
  title: string;
  desc: string;
  badge?: string;
}[] = [
  {
    id: 'complete_and_expand',
    title: 'Hoàn thành nốt & Mở rộng bài (Khuyên dùng)',
    desc: 'AI đọc bản nháp có sẵn, giữ các ý tốt, mở rộng các phần còn mỏng và viết nốt các chương/Kết luận/Tài liệu tham khảo còn thiếu.',
    badge: 'Đầy đủ nhất',
  },
  {
    id: 'upgrade_and_fix',
    title: 'Sửa lỗi & Nâng cấp học thuật toàn bài',
    desc: 'Giữ nguyên bố cục bài nháp, rà soát nâng cấp văn phong học thuật, sửa lỗi lập luận/Rubric và củng cố trích dẫn từng mục.',
  },
  {
    id: 'import_only',
    title: 'Chỉ nạp vào khung Dàn ý (Không gọi AI ngay)',
    desc: 'Tự động tách bài nháp thành từng mục trên trang A4 để bạn tự chọn mục nào cần viết tiếp hoặc bấm AI Chỉnh sửa sau.',
  },
];

export function WriterImportDraftModal({
  isOpen,
  onClose,
  onStartProcess,
  onToast,
}: WriterImportDraftModalProps) {
  const [draftText, setDraftText] = useState('');
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<ExistingDraftMode>('complete_and_expand');
  const [userEditNotes, setUserEditNotes] = useState('');
  const [readingFile, setReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const words = countWords(draftText);

  const handleFileSelected = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setReadingFile(true);
    try {
      const text = await extractTextFromSkillFile(file);
      if (!text.trim()) {
        throw new Error('Không trích xuất được chữ từ tệp đã chọn.');
      }
      setDraftText(text.trim());
      setFileName(file.name);
      onToast(
        `Đã nạp ${countWords(text).toLocaleString('vi-VN')} từ từ "${file.name}".`
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Không thể đọc tệp bản nháp.'
      );
    } finally {
      setReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    const trimmed = draftText.trim();
    if (trimmed.length < 30) {
      onToast('Vui lòng tải tệp hoặc dán ít nhất 30 ký tự bài nháp có sẵn.');
      return;
    }
    onStartProcess({
      rawDraftText: trimmed,
      fileName: fileName || undefined,
      mode,
      userEditNotes: userEditNotes.trim(),
    });
    setDraftText('');
    setFileName('');
    setUserEditNotes('');
    onClose();
  };

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div
        className="modal-panel bg-white border border-zinc-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/70 flex items-center justify-center text-[#12489B]">
              <FileEdit className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Sửa &amp; Hoàn thiện bài nháp có sẵn
              </h3>
              <p className="text-[11px] text-zinc-500">
                AI đọc bài khách đã viết, hoàn thiện/mở rộng và ghi rõ từng vị trí đã sửa vào bảng Nhật ký bên phải.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-press p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* 1. Upload or Paste Existing Draft */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-800">
                1. Nạp bài nháp có sẵn (Tải tệp hoặc Dán trực tiếp)
              </label>
              <div className="flex items-center gap-2">
                {words > 0 && (
                  <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    {words.toLocaleString('vi-VN')} từ
                    {fileName ? ` · ${fileName}` : ''}
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.pdf,.txt,.md"
                  className="hidden"
                  onChange={(e) => void handleFileSelected(e.target.files)}
                />
                <button
                  type="button"
                  disabled={readingFile}
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-press inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-[#12489B] border border-blue-200/80 hover:bg-blue-100 disabled:opacity-50"
                >
                  {readingFile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileUp className="w-3.5 h-3.5" />
                  )}
                  <span>Tải .docx / .pdf / .txt</span>
                </button>
              </div>
            </div>

            <textarea
              rows={6}
              value={draftText}
              onChange={(e) => {
                setDraftText(e.target.value);
                if (fileName) setFileName('');
              }}
              placeholder="Dán nội dung bản nháp hoặc phần bài khách đã làm dở vào đây (hoặc bấm nút Tải .docx / .pdf / .txt ở góc trên)..."
              className="w-full p-3 text-xs leading-relaxed text-slate-800 bg-zinc-50/70 focus:bg-white border border-zinc-300 focus:border-[#12489B] rounded-xl focus:outline-none resize-y"
            />
          </div>

          {/* 2. Choose Processing Mode */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              2. Chọn chế độ AI xử lý bài nháp
            </label>
            <div className="space-y-2">
              {MODES.map((m) => {
                const selected = mode === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selected
                        ? 'border-[#12489B] bg-blue-50/50 ring-1 ring-blue-500/15'
                        : 'border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="existing_draft_mode"
                      checked={selected}
                      onChange={() => setMode(m.id)}
                      className="mt-0.5 accent-[#12489B]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {m.title}
                        </span>
                        {m.badge && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-[#12489B]">
                            {m.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                        {m.desc}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Specific Revision Instructions (when AI mode selected) */}
          {mode !== 'import_only' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                3. Yêu cầu sửa cụ thể (Tùy chọn)
              </label>
              <textarea
                rows={2}
                value={userEditNotes}
                onChange={(e) => setUserEditNotes(e.target.value)}
                placeholder="VD: Giữ nguyên phần Mở đầu, mở rộng Chương 2 thêm số liệu mới 2024-2026, viết nốt Kết luận và Tài liệu tham khảo..."
                className="w-full p-2.5 text-xs bg-zinc-50/70 focus:bg-white border border-zinc-300 focus:border-[#12489B] rounded-xl focus:outline-none resize-y"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-press px-3.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60 rounded-lg"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={draftText.trim().length < 30}
            onClick={handleSubmit}
            className="btn-press px-4 py-2 text-xs font-semibold bg-[#12489B] hover:bg-[#0B2559] text-white rounded-lg shadow-xs disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {mode === 'import_only' ? (
              <Sparkles className="w-3.5 h-3.5" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            <span>
              {mode === 'import_only'
                ? 'Nạp vào Dàn ý'
                : 'Phân tích & Bắt đầu sửa bài'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
