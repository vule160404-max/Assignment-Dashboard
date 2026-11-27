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
    label: 'Luận văn (VN)',
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
    label: 'Báo cáo (VN)',
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
    label: 'Nghiên cứu (VN)',
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
  onRunFullAuto?: () => void;
  onRewriteNewPerspective?: () => void;
  fullAutoRunning?: boolean;
}

export function WriterBriefPanel({
  session,
  onUpdateSession,
  onUploadContextFiles,
  onSwitchToOutlineWithAi,
  onRunFullAuto,
  onRewriteNewPerspective,
  fullAutoRunning = false,
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
      setImageError('Tối đa 6 ảnh tài liệu cho mỗi bài viết.');
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

  const inputCls = 'w-full px-2.5 py-2 text-[12px] bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-[#12489B] focus:ring-1 focus:ring-blue-500/10 transition-colors';
  const labelCls = 'block text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5';

  return (
    <div className="tab-panel-enter p-3 space-y-3">
      {/* Cohort badge */}
      {session.cohortMeta && (
        <div className="rounded-xl bg-slate-900 text-white p-3 space-y-1">
          <div className="flex items-center justify-between gap-2 text-[10.5px]">
            <span className="font-mono font-bold text-amber-300 uppercase tracking-wider">
              Nhóm #{session.cohortMeta.cloneIndex}/{session.cohortMeta.cohortSize}
            </span>
            <span className="font-mono text-sky-300">
              {session.cohortMeta.sampledSourceCount}/{session.cohortMeta.poolTotalCount} DOI
            </span>
          </div>
          {(session.cohortMeta.customMethodology || session.cohortMeta.methodologyLabel) && (
            <div className="text-[11px] font-semibold leading-snug">
              PP: {session.cohortMeta.customMethodology || session.cohortMeta.methodologyLabel}
            </div>
          )}
          <div className="text-[10.5px] text-slate-300 leading-snug">
            Cấu trúc: {session.cohortMeta.customApproach || session.cohortMeta.archetypeLabel}
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

      {/* ── Document type selector ── */}
      <div>
        <label className={labelCls}>Loại bài</label>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_DOC_PRESETS.map((p) => {
            const selected = activeDocType === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDocPreset(p.id)}
                className={`btn-press px-3 py-2 rounded-xl text-[11.5px] font-semibold border text-left transition-all ${
                  selected
                    ? 'bg-[#12489B] text-white border-[#12489B] shadow-sm'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-[#12489B]/40 hover:bg-blue-50/30'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Core fields ── */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Môn học</label>
            <input
              type="text"
              value={session.subject}
              onChange={(e) => onUpdateSession((s) => ({ ...s, subject: e.target.value }))}
              placeholder="Strategic Management / MBA701"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Số từ</label>
              <input
                type="number"
                min={200} max={30000} step={100}
                value={session.targetWordCount}
                onChange={(e) => onUpdateSession((s) => ({ ...s, targetWordCount: Math.max(100, Number(e.target.value) || 1000) }))}
                className={`${inputCls} font-mono tabular-nums`}
              />
            </div>
            <div>
              <label className={labelCls}>Trích dẫn</label>
              <select
                value={session.citationStyle}
                onChange={(e) => onUpdateSession((s) => ({ ...s, citationStyle: e.target.value as CitationStyle }))}
                className={inputCls}
              >
                {CITATION_STYLES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Chủ đề / Research question</label>
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
            className={`${inputCls} resize-y leading-relaxed`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Ngôn ngữ</label>
            <select
              value={session.writingLanguage}
              onChange={(e) => onUpdateSession((s) => ({ ...s, writingLanguage: e.target.value as WriterSession['writingLanguage'] }))}
              className={inputCls}
            >
              <option value="English">Academic English</option>
              <option value="Vietnamese">Tiếng Việt</option>
              <option value="Bilingual">Song ngữ</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Cấp độ học thuật</label>
            <input
              type="text"
              value={session.academicTone}
              onChange={(e) => onUpdateSession((s) => ({ ...s, academicTone: e.target.value }))}
              placeholder="Master / HD"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Yêu cầu chi tiết (Instructions)</label>
          <textarea
            rows={3}
            value={session.instructions}
            onChange={(e) => onUpdateSession((s) => ({ ...s, instructions: e.target.value }))}
            placeholder="Yêu cầu chi tiết từ giảng viên, cấu trúc bắt buộc, case study..."
            className={`${inputCls} resize-y`}
          />
        </div>

        <div>
          <label className={labelCls}>Rubric (Thang điểm)</label>
          <textarea
            rows={2}
            value={session.rubricNotes}
            onChange={(e) => onUpdateSession((s) => ({ ...s, rubricNotes: e.target.value }))}
            placeholder="Critical Analysis 40%, Literature 30%, APA 30%..."
            className={`${inputCls} resize-y`}
          />
        </div>
      </div>

      {/* ── Attachments section ── */}
      <div className="rounded-xl border border-zinc-200 bg-[#FAFBFC] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700">
            Tài liệu đính kèm
          </span>
          <div className="flex items-center gap-1.5">
            <input
              ref={contextFileInputRef}
              type="file"
              multiple
              accept=".md,.txt,.docx,.pdf,.json"
              onChange={(e) => { void onUploadContextFiles(e.target.files); if (contextFileInputRef.current) contextFileInputRef.current.value = ''; }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => contextFileInputRef.current?.click()}
              className="btn-press px-2.5 py-1 text-[10.5px] font-semibold text-[#12489B] bg-white hover:bg-blue-50 border border-blue-200 rounded-lg inline-flex items-center gap-1"
            >
              <FolderUp className="w-3 h-3" />
              <span>Tệp</span>
            </button>
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
              className="btn-press px-2.5 py-1 text-[10.5px] font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
            >
              {processingImages ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
              <span>Ảnh ({contextImages.length}/6)</span>
            </button>
          </div>
        </div>

        {session.contextFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {session.contextFiles.map((cf) => (
              <span
                key={cf.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] bg-white text-zinc-700 rounded-lg border border-zinc-200"
              >
                <FileText className="w-3 h-3 text-[#12489B]" />
                <span className="truncate max-w-[120px]">{cf.name}</span>
                <span className="text-zinc-400 font-mono text-[10px]">({cf.wordCount}w)</span>
                <button
                  type="button"
                  onClick={() => onUpdateSession((s) => ({ ...s, contextFiles: s.contextFiles.filter((item) => item.id !== cf.id) }))}
                  className="text-zinc-400 hover:text-rose-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {imageError && (
          <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
            {imageError}
          </p>
        )}

        {contextImages.length > 0 && (
          <div
            className="space-y-2"
            onPaste={(e) => {
              const items = Array.from(e.clipboardData?.items || []);
              const pastedImages: File[] = [];
              for (const item of items) {
                if (item.type.startsWith('image/')) {
                  const f = item.getAsFile();
                  if (f) pastedImages.push(f);
                }
              }
              if (pastedImages.length > 0) { e.preventDefault(); void handleAddContextImages(pastedImages); }
            }}
          >
            {contextImages.map((img) => (
              <div
                key={img.id}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-zinc-200"
              >
                <img
                  src={img.dataUrl}
                  alt={img.caption || img.name}
                  className="w-12 h-10 object-cover rounded-lg border border-zinc-100 bg-zinc-50 shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded-md bg-[#0B2559] text-white font-mono text-[9px] font-bold shrink-0">
                        {img.tag}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(`[FIGURE: ${img.tag}]`).catch(() => {});
                          setCopiedImgTag(img.tag);
                          window.setTimeout(() => setCopiedImgTag(''), 1500);
                        }}
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#12489B] hover:underline"
                      >
                        {copiedImgTag === img.tag ? (
                          <><Check className="w-2.5 h-2.5 text-emerald-600" /><span className="text-emerald-700">Copied</span></>
                        ) : (
                          <><Copy className="w-2.5 h-2.5" /><span>Copy</span></>
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateSession((s) => ({ ...s, contextImages: (s.contextImages || []).filter((item) => item.id !== img.id) }))}
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
                      onUpdateSession((s) => ({ ...s, contextImages: (s.contextImages || []).map((item) => item.id === img.id ? { ...item, caption: val } : item) }));
                    }}
                    placeholder="Chú thích ảnh..."
                    className="w-full px-2 py-1 text-[11px] bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#12489B]"
                  />

                  <label className="inline-flex items-center gap-1.5 text-[10.5px] text-zinc-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={img.insertIntoPaper}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onUpdateSession((s) => ({ ...s, contextImages: (s.contextImages || []).map((item) => item.id === img.id ? { ...item, insertIntoPaper: checked } : item) }));
                      }}
                      className="rounded border-zinc-300 text-[#12489B] focus:ring-[#12489B]"
                    />
                    <span>Chèn vào bài</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      {(onRunFullAuto || onSwitchToOutlineWithAi) && (
        <div className="space-y-2">
          {onRunFullAuto && (
            <div className="rounded-xl bg-gradient-to-br from-[#0B2559] to-[#12489B] p-3.5 space-y-2">
              <button
                type="button"
                disabled={fullAutoRunning}
                onClick={onRunFullAuto}
                className="btn-press w-full py-3 px-4 text-[12.5px] font-bold bg-white/10 hover:bg-white/15 text-white rounded-xl inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-colors border border-white/20"
              >
                {fullAutoRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300" />
                )}
                <span>
                  {fullAutoRunning
                    ? 'Đang chạy tự động...'
                    : 'Full Auto (Dàn ý → Viết → Humanize)'}
                </span>
              </button>
              <p className="text-[10.5px] text-white/60 text-center leading-snug">
                1 chạm: AI tự lập dàn ý → viết tuần tự → đẩy HixBypass
              </p>
              {onRewriteNewPerspective && (
                <button
                  type="button"
                  disabled={fullAutoRunning}
                  onClick={onRewriteNewPerspective}
                  className="btn-press w-full py-2 px-3 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-amber-200 rounded-xl inline-flex items-center justify-center gap-1.5 disabled:opacity-50 border border-white/10"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Viết lại góc nhìn mới (Xoay nguồn)</span>
                </button>
              )}
            </div>
          )}

          {onSwitchToOutlineWithAi && (
            <button
              type="button"
              disabled={fullAutoRunning}
              onClick={onSwitchToOutlineWithAi}
              className="btn-press w-full py-2.5 text-[12px] font-semibold bg-white border border-blue-200 text-[#12489B] hover:bg-blue-50 rounded-xl inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Chỉ Lập Dàn Ý →</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
