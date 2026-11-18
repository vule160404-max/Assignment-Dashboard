import { useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  FilePlus2,
  FileText,
  FolderUp,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { extractTextFromSkillFile } from '../../../lib/docxBuilder';
import { countWords } from '../../../lib/wordHumanizer';
import { DEFAULT_BUILTIN_SKILLS, SkillDocument } from './types';

interface WriterSkillLibraryModalProps {
  isOpen: boolean;
  skills: SkillDocument[];
  onUpdateSkills: (next: SkillDocument[]) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function WriterSkillLibraryModal({
  isOpen,
  skills,
  onUpdateSkills,
  onClose,
  onToast,
}: WriterSkillLibraryModalProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string>(
    skills[0]?.id || ''
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const selectedSkill =
    skills.find((s) => s.id === selectedSkillId) || skills[0] || null;

  const handleToggleSkill = (id: string) => {
    onUpdateSkills(
      skills.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleUploadSkillFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const added: SkillDocument[] = [];
      for (const file of Array.from(fileList)) {
        const text = await extractTextFromSkillFile(file);
        if (!text.trim()) continue;
        const baseName = file.name.replace(/\.(md|txt|docx|json)$/i, '');
        added.push({
          id: `skill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: baseName,
          fileName: file.name,
          description: `Tải lên từ tệp ${file.name} (${countWords(text)} từ)`,
          content: text.trim(),
          enabled: true,
          updatedAt: new Date().toISOString(),
        });
      }
      if (added.length > 0) {
        const next = [...added, ...skills];
        onUpdateSkills(next);
        setSelectedSkillId(added[0].id);
        onToast(`Đã nạp ${added.length} file Skill vào thư viện dùng chung.`);
      }
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : 'Không thể đọc tệp Skill tải lên.'
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCreateBlankSkill = () => {
    const newSkill: SkillDocument = {
      id: `skill_${Date.now()}`,
      name: 'Skill Quy chuẩn Viết bài Mới',
      fileName: 'custom-academic-skill.md',
      description: 'Quy tắc viết bài, cấu trúc lập luận hoặc mẫu trích dẫn riêng của bạn',
      content: `# Quy chuẩn / Skill hướng dẫn AI làm bài\n- Luôn viết theo văn phong học thuật nghiêm túc.\n- Bám sát các tiêu chí trong Rubric và sử dụng dẫn chứng học thuật rõ ràng.`,
      enabled: true,
      updatedAt: new Date().toISOString(),
    };
    const next = [newSkill, ...skills];
    onUpdateSkills(next);
    setSelectedSkillId(newSkill.id);
    onToast('Đã tạo Skill mới. Bạn có thể sửa nội dung ở khung bên phải.');
  };

  const handleDeleteSkill = (id: string) => {
    const next = skills.filter((s) => s.id !== id);
    onUpdateSkills(next);
    if (selectedSkillId === id) {
      setSelectedSkillId(next[0]?.id || '');
    }
    onToast('Đã xóa Skill khỏi thư viện.');
  };

  const handleRestoreDefaults = () => {
    const customSkills = skills.filter((s) => !s.isBuiltIn);
    const next = [...DEFAULT_BUILTIN_SKILLS, ...customSkills];
    onUpdateSkills(next);
    setSelectedSkillId(next[0]?.id || '');
    onToast('Đã khôi phục các Skill học thuật mặc định.');
  };

  const updateSelectedSkill = (patch: Partial<SkillDocument>) => {
    if (!selectedSkill) return;
    onUpdateSkills(
      skills.map((s) =>
        s.id === selectedSkill.id
          ? { ...s, ...patch, updatedAt: new Date().toISOString() }
          : s
      )
    );
  };

  const activeCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="modal-panel bg-white border border-zinc-200 rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4338CA]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Thư viện File Skill & Ngữ cảnh Chuẩn Học Thuật ({activeCount}/
                {skills.length} đang bật)
              </h3>
              <p className="text-xs text-zinc-500">
                Tải lên file Skill (`.md`, `.txt`, `.docx`, `.json`) để huấn luyện AI Chatbot cách phân tích dàn ý, trích dẫn và hành văn đúng gu của bạn.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-zinc-200 bg-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".md,.txt,.docx,.json"
              onChange={(e) => void handleUploadSkillFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 text-xs font-semibold bg-[#4338CA] text-white rounded-lg hover:bg-indigo-700 inline-flex items-center gap-1.5 shadow-2xs"
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>
                {uploading
                  ? 'Đang đọc file...'
                  : 'Tải lên File Skill (.md, .txt, .docx, .json)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCreateBlankSkill}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-800 hover:bg-zinc-200 rounded-lg inline-flex items-center gap-1.5"
            >
              <FilePlus2 className="w-3.5 h-3.5" />
              <span>Viết Skill mới</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900 hover:bg-zinc-100 rounded-lg inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục Skill gốc</span>
          </button>
        </div>

        {/* Main 2-column body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-[420px]">
          {/* Left: Skill list */}
          <div className="md:col-span-5 border-r border-zinc-200 overflow-y-auto p-4 space-y-2 bg-zinc-50/50">
            {skills.map((skill) => {
              const isSelected = selectedSkill?.id === skill.id;
              return (
                <div
                  key={skill.id}
                  onClick={() => setSelectedSkillId(skill.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#4338CA] bg-indigo-50/70 shadow-2xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSkill(skill.id);
                        }}
                        title={
                          skill.enabled
                            ? 'Đang bật cho AI học — Bấm để tắt'
                            : 'Đang tắt — Bấm để bật'
                        }
                        className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                          skill.enabled
                            ? 'bg-[#4338CA] border-[#4338CA] text-white'
                            : 'bg-white border-zinc-300'
                        }`}
                      >
                        {skill.enabled && <Check className="w-3 h-3" />}
                      </button>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {skill.name}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500 truncate flex items-center gap-1 mt-0.5">
                          <FileText className="w-3 h-3 shrink-0" />
                          <span className="truncate">{skill.fileName}</span>
                          <span>· {countWords(skill.content)}w</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSkill(skill.id);
                      }}
                      title="Xóa Skill này"
                      className="p-1 text-zinc-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {skill.description && (
                    <p className="text-[11px] text-zinc-600 mt-1.5 line-clamp-2">
                      {skill.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Skill Editor */}
          <div className="md:col-span-7 p-5 flex flex-col overflow-y-auto bg-white">
            {selectedSkill ? (
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 uppercase mb-1">
                      Tên Skill
                    </label>
                    <input
                      type="text"
                      value={selectedSkill.name}
                      onChange={(e) =>
                        updateSelectedSkill({ name: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs font-semibold border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 uppercase mb-1">
                      Tên File / Nhãn
                    </label>
                    <input
                      type="text"
                      value={selectedSkill.fileName}
                      onChange={(e) =>
                        updateSelectedSkill({ fileName: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 uppercase mb-1">
                    Mô tả ngắn
                  </label>
                  <input
                    type="text"
                    value={selectedSkill.description}
                    onChange={(e) =>
                      updateSelectedSkill({ description: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
                  />
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-zinc-500 uppercase">
                      Nội dung chỉ dẫn Skill (Sẽ được nạp trực tiếp vào System Prompt của AI)
                    </label>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {countWords(selectedSkill.content)} từ
                    </span>
                  </div>
                  <textarea
                    value={selectedSkill.content}
                    onChange={(e) =>
                      updateSelectedSkill({ content: e.target.value })
                    }
                    rows={12}
                    className="w-full flex-1 p-3 text-xs font-mono leading-relaxed border border-zinc-300 rounded-xl focus:outline-none focus:border-[#4338CA] bg-zinc-50/50"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-zinc-400">
                Chọn hoặc tải lên một File Skill để xem và chỉnh sửa nội dung.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <span className="text-xs text-zinc-600">
            Mọi Skill được tích chọn (<strong className="text-[#4338CA]">{activeCount}</strong>) sẽ tự động được gửi kèm khi AI lập dàn ý và viết từng mục.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-[#4338CA] text-white rounded-lg hover:bg-indigo-700"
          >
            Hoàn tất & Áp dụng Skill
          </button>
        </div>
      </div>
    </div>
  );
}
