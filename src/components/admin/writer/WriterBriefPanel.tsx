import { useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  FolderUp,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { CITATION_STYLES, CitationStyle } from '../../../types/domain';
import {
  compressImageToContextItem,
  getNextImageTag,
} from '../../../lib/writerImageUtils';
import {
  DEFAULT_COVER_PAGE_CONFIG,
  SessionContextImage,
  WriterDocumentType,
  WriterSession,
} from './types';

const QUICK_DOC_PRESETS: {
  id: WriterDocumentType;
  label: string;
  language: WriterSession['writingLanguage'];
  academicTone: string;
  fontSizePt: number;
  lineSpacing: 1.5 | 2.0;
  textAlign: 'justify' | 'left';
  coverTemplateId: 'classic_vn_thesis' | 'internship_report' | 'academic_international';
  docTypeLabel: string;
}[] = [
  {
    id: 'essay',
    label: 'Essay (EN)',
    language: 'English',
    academicTone: 'High Distinction (HD) University Standard',
    fontSizePt: 12,
    lineSpacing: 2.0,
    textAlign: 'left',
    coverTemplateId: 'academic_international',
    docTypeLabel: 'ACADEMIC RESEARCH PAPER / ESSAY',
  },
  {
    id: 'vn_thesis',
    label: 'Luận văn / Tiểu luận (VN)',
    language: 'Vietnamese',
    academicTone: 'Chuẩn Luận văn / Tiểu luận Đại học & Thạc sĩ Việt Nam',
    fontSizePt: 13,
    lineSpacing: 1.5,
    textAlign: 'justify',
    coverTemplateId: 'classic_vn_thesis',
    docTypeLabel: 'TIỂU LUẬN / KHÓA LUẬN TỐT NGHIỆP',
  },
  {
    id: 'vn_report',
    label: 'Báo cáo Thực tập (VN)',
    language: 'Vietnamese',
    academicTone: 'Chuẩn Báo cáo Thực tập / Đồ án Doanh nghiệp Việt Nam',
    fontSizePt: 13,
    lineSpacing: 1.5,
    textAlign: 'justify',
    coverTemplateId: 'internship_report',
    docTypeLabel: 'BÁO CÁO THỰC TẬP TỐT NGHIỆP',
  },
  {
    id: 'vn_research',
    label: 'Nghiên cứu Khoa học (VN)',
    language: 'Vietnamese',
    academicTone: 'Chuẩn Bài báo & Đề tài Nghiên cứu Khoa học Tiếng Việt',
    fontSizePt: 13,
    lineSpacing: 1.5,
    textAlign: 'justify',
    coverTemplateId: 'classic_vn_thesis',
    docTypeLabel: 'ĐỀ TÀI NGHIÊN CỨU KHOA HỌC',
  },
];

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
  const contextImageInputRef = useRef<HTMLInputElement | null>(null);
  const [processingImages, setProcessingImages] = useState(false);
  const [imageError, setImageError] = useState('');
  const [copiedImgTag, setCopiedImgTag] = useState('');

  const contextImages = session.contextImages || [];

  const handleAddContextImages = async (files: File[] | FileList | null) => {
    if (!files || files.length === 0) return;
    setImageError('');
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (imageFiles.length === 0) {
      setImageError('Vui lòng chọn tệp ảnh hợp lệ (PNG, JPG, WEBP).');
      return;
    }

    const remaining = Math.max(0, 6 - contextImages.length);
    if (remaining === 0) {
      setImageError('Tối đa 6 ảnh tài liệu cho mỗi bài viết để đảm bảo tốc độ xử lý.');
      return;
    }

    setProcessingImages(true);
    try {
      const nextList: SessionContextImage[] = [...contextImages];
      for (const file of imageFiles.slice(0, remaining)) {
        const tag = getNextImageTag(nextList);
        const compressed = await compressImageToContextItem(file, tag);
        nextList.push(compressed);
      }
      onUpdateSession((s) => ({
        ...s,
        contextImages: nextList,
      }));
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : 'Không thể xử lý ảnh đính kèm.'
      );
    } finally {
      setProcessingImages(false);
      if (contextImageInputRef.current) {
        contextImageInputRef.current.value = '';
      }
    }
  };

  const activeDocType: WriterDocumentType =
    session.documentType ||
    (session.writingLanguage === 'Vietnamese' ? 'vn_thesis' : 'essay');

  const applyDocPreset = (presetId: WriterDocumentType) => {
    const preset = QUICK_DOC_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onUpdateSession((s) => ({
      ...s,
      documentType: preset.id,
      writingLanguage: preset.language,
      academicTone: preset.academicTone,
      format: {
        ...s.format,
        fontFamily: 'Times New Roman',
        fontSizePt: preset.fontSizePt,
        lineSpacing: preset.lineSpacing,
        textAlign: preset.textAlign,
        coverPage: {
          ...DEFAULT_COVER_PAGE_CONFIG,
          ...(s.format.coverPage || {}),
          templateId: preset.coverTemplateId,
          documentTypeLabel: preset.docTypeLabel,
        },
      },
    }));
  };

  return (
    <div className="tab-panel-enter p-4 space-y-3.5">
      {session.cohortMeta && (
        <div className="rounded-xl bg-slate-900 text-white p-3 space-y-1.5 border border-slate-800">
          <div className="flex items-center justify-between gap-2 text-[10.5px]">
            <span className="font-mono font-bold text-amber-300 uppercase tracking-wider">
              Hồ sơ Nhóm #{session.cohortMeta.cloneIndex}/{session.cohortMeta.cohortSize}
            </span>
            <span className="font-mono text-sky-300">
              {session.cohortMeta.sampledSourceCount}/{session.cohortMeta.poolTotalCount} nguồn DOI
            </span>
          </div>
          {(session.cohortMeta.customMethodology ||
            session.cohortMeta.methodologyLabel) && (
            <div className="text-[11px] font-semibold text-white leading-snug">
              PP:{' '}
              {session.cohortMeta.customMethodology ||
                session.cohortMeta.methodologyLabel}
            </div>
          )}
          <div className="text-[10.5px] text-slate-300 leading-snug">
            Cấu trúc:{' '}
            {session.cohortMeta.customApproach ||
              session.cohortMeta.archetypeLabel}
          </div>
          {(session.cohortMeta.customFramework || session.cohortMeta.customCaseFocus) && (
            <div className="text-[10.5px] text-emerald-300 leading-snug">
              {[session.cohortMeta.customFramework, session.cohortMeta.customCaseFocus]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* 1-Click Academic Document Type Selector (VN Thesis / Report / Research & EN Essay) */}
      <div>
        <label className="block text-[11px] font-semibold text-zinc-600 mb-1.5">
          Loại bài &amp; Định dạng chuẩn nhanh
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_DOC_PRESETS.map((p) => {
            const selected = activeDocType === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDocPreset(p.id)}
                className={`btn-press px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border text-left truncate transition-colors ${
                  selected
                    ? 'bg-blue-50 text-[#12489B] border-blue-300 ring-1 ring-blue-500/15'
                    : 'bg-zinc-50/80 text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

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
        <textarea
          rows={2}
          value={session.topic}
          onChange={(e) =>
            onUpdateSession((s) => ({
              ...s,
              topic: e.target.value,
              title: s.linkedOrderCode
                ? `${s.linkedOrderCode} · ${e.target.value.slice(0, 36)}`
                : e.target.value.slice(0, 48) || 'Bài nghiên cứu mới',
            }))
          }
          placeholder="Nhập tên đề tài hoặc câu hỏi nghiên cứu..."
          className="w-full px-2.5 py-1.5 text-xs font-medium bg-zinc-50/70 border border-zinc-200 rounded-lg focus:bg-white focus:outline-none focus:border-[#12489B] leading-relaxed resize-y"
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

      {/* Per-session context / reference files (including client draft if any) */}
      <div className="pt-2.5 border-t border-zinc-100">
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <span className="block text-[11px] font-semibold text-zinc-700">
              Tài liệu đính kèm &amp; Bản nháp (Draft) của khách (.docx, .pdf, .txt, .md):
            </span>
            <span className="block text-[10px] text-zinc-400">
              Nếu khách đã có bản nháp (draft) hoặc tài liệu gốc, đính kèm trực tiếp tại đây để AI đọc hiểu và viết tiếp.
            </span>
          </div>
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

      {/* Per-session visual context images (Survey screenshots, Charts, SPSS tables -> Perplexity Vision + DOCX/PDF Figure Embed) */}
      <div
        className="pt-2.5 border-t border-zinc-100 space-y-2"
        onPaste={(e) => {
          const items = Array.from(e.clipboardData?.items || []);
          const pastedImages: File[] = [];
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              const f = item.getAsFile();
              if (f) pastedImages.push(f);
            }
          }
          if (pastedImages.length > 0) {
            e.preventDefault();
            void handleAddContextImages(pastedImages);
          }
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="block text-[11px] font-semibold text-zinc-700">
              Tài liệu dạng ảnh (Biểu đồ, Khảo sát, Bảng số liệu) · AI Vision ({contextImages.length}/6)
            </span>
            <span className="block text-[10px] text-zinc-400">
              Chọn ảnh hoặc dán (Ctrl+V) trực tiếp vào đây — Perplexity sẽ đọc số liệu chính xác &amp; tự động chèn ảnh vào bài Word/PDF.
            </span>
          </div>
          <input
            ref={contextImageInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => void handleAddContextImages(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            disabled={processingImages || contextImages.length >= 6}
            onClick={() => contextImageInputRef.current?.click()}
            className="btn-press shrink-0 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 rounded-md inline-flex items-center gap-1"
          >
            {processingImages ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ImagePlus className="w-3 h-3" />
            )}
            <span>+ Thêm ảnh</span>
          </button>
        </div>

        {imageError && (
          <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-2.5 py-1.5">
            {imageError}
          </p>
        )}

        {contextImages.length > 0 && (
          <div className="space-y-2">
            {contextImages.map((img) => (
              <div
                key={img.id}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-50 border border-zinc-200/90"
              >
                <img
                  src={img.dataUrl}
                  alt={img.caption || img.name}
                  className="w-14 h-12 object-cover rounded-md border border-zinc-200 bg-white shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-[#0B2559] text-white font-mono text-[10px] font-bold shrink-0">
                        {img.tag}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            ?.writeText(`[FIGURE: ${img.tag}]`)
                            .catch(() => {});
                          setCopiedImgTag(img.tag);
                          window.setTimeout(() => setCopiedImgTag(''), 1500);
                        }}
                        title={`Sao chép thẻ [FIGURE: ${img.tag}] để dán thủ công vào bài`}
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#12489B] hover:underline"
                      >
                        {copiedImgTag === img.tag ? (
                          <>
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                            <span className="text-emerald-700">Đã copy</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-2.5 h-2.5" />
                            <span>Copy thẻ</span>
                          </>
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSession((s) => ({
                          ...s,
                          contextImages: (s.contextImages || []).filter(
                            (item) => item.id !== img.id
                          ),
                        }))
                      }
                      aria-label={`Xóa ảnh ${img.tag}`}
                      className="p-0.5 text-zinc-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={img.caption}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateSession((s) => ({
                        ...s,
                        contextImages: (s.contextImages || []).map((item) =>
                          item.id === img.id ? { ...item, caption: val } : item
                        ),
                      }));
                    }}
                    placeholder="Chú thích hình (VD: Kết quả khảo sát hành vi người tiêu dùng)"
                    className="w-full px-2 py-1 text-[11px] bg-white border border-zinc-200 rounded focus:outline-none focus:border-[#12489B]"
                  />

                  <label className="inline-flex items-center gap-1.5 text-[10.5px] text-zinc-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={img.insertIntoPaper}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onUpdateSession((s) => ({
                          ...s,
                          contextImages: (s.contextImages || []).map((item) =>
                            item.id === img.id
                              ? { ...item, insertIntoPaper: checked }
                              : item
                          ),
                        }));
                      }}
                      className="rounded border-zinc-300 text-[#12489B] focus:ring-[#12489B]"
                    />
                    <span>Chèn hình này vào bài viết &amp; Word/PDF</span>
                  </label>
                </div>
              </div>
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
