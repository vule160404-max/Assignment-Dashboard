import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookMarked,
  Check,
  Eye,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { CoverPageSheetPreview } from './CoverPageSheetPreview';
import {
  COVER_PAGE_TEMPLATES,
  CoverPageConfig,
  CoverPageFieldsVisibility,
  CoverPageTemplateMeta,
  DEFAULT_COVER_PAGE_CONFIG,
  WriterSession,
} from './types';

interface WriterCoverPageModalProps {
  isOpen: boolean;
  session: WriterSession;
  linkedClientName?: string;
  linkedClientSchoolMajor?: string;
  onSaveCoverPage: (coverPage: CoverPageConfig, nextTopic?: string, nextSubject?: string) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

function splitSchoolAndMajor(raw?: string): { school: string; major: string } {
  const text = (raw || '').trim();
  if (!text) return { school: '', major: '' };
  const sep = text.includes(' · ')
    ? ' · '
    : text.includes(' / ')
      ? ' / '
      : text.includes(' - ')
        ? ' - '
        : null;
  if (!sep) return { school: text, major: '' };
  const parts = text.split(sep);
  return {
    school: (parts[0] || '').trim(),
    major: parts.slice(1).join(' · ').trim(),
  };
}

export function WriterCoverPageModal({
  isOpen,
  session,
  linkedClientName,
  linkedClientSchoolMajor,
  onSaveCoverPage,
  onClose,
  onToast,
}: WriterCoverPageModalProps) {
  const [draft, setDraft] = useState<CoverPageConfig>(DEFAULT_COVER_PAGE_CONFIG);
  const [draftTopic, setDraftTopic] = useState('');
  const [draftSubject, setDraftSubject] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const base = session.format.coverPage || DEFAULT_COVER_PAGE_CONFIG;
    const parsed = splitSchoolAndMajor(linkedClientSchoolMajor);
    setDraft({
      ...DEFAULT_COVER_PAGE_CONFIG,
      ...base,
      universityName: base.universityName || parsed.school || DEFAULT_COVER_PAGE_CONFIG.universityName,
      majorName: base.majorName || parsed.major || DEFAULT_COVER_PAGE_CONFIG.majorName,
      studentName: base.studentName || linkedClientName || '',
      fields: {
        ...DEFAULT_COVER_PAGE_CONFIG.fields,
        ...(base.fields || {}),
      },
    });
    setDraftTopic(session.topic || '');
    setDraftSubject(session.subject || '');
  }, [isOpen, session, linkedClientName, linkedClientSchoolMajor]);

  if (!isOpen) return null;

  const toggleField = (key: keyof CoverPageFieldsVisibility) => {
    setDraft((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [key]: !prev.fields[key],
      },
    }));
  };

  const handleSelectAllFields = (checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      fields: {
        showUniversity: checked,
        showFaculty: checked,
        showDocumentType: checked,
        showTopic: checked,
        showSubject: checked,
        showMajor: checked,
        showStudentName: checked,
        showStudentId: checked,
        showClassName: checked,
        showSupervisor: checked,
        showInternshipUnit: checked,
        showWordCount: checked,
        showSubmissionDate: checked,
      },
    }));
  };

  const handleApplyTemplatePreview = (tpl: CoverPageTemplateMeta) => {
    setDraft((prev) => ({
      ...prev,
      enabled: true,
      templateId: tpl.id,
      showBorder: tpl.defaultBorder,
      documentTypeLabel: tpl.recommendedDocType,
      fields: {
        ...prev.fields,
        ...tpl.recommendedFields,
      },
    }));
    onToast(`Đã áp dụng thử mẫu "${tpl.name}" ở khung xem trước bên phải.`);
  };

  const handleAutoFillFromOrder = () => {
    const parsed = splitSchoolAndMajor(linkedClientSchoolMajor);
    setDraft((prev) => ({
      ...prev,
      universityName: parsed.school || prev.universityName,
      majorName: parsed.major || prev.majorName,
      studentName: linkedClientName || prev.studentName,
    }));
    onToast('Đã điền thông tin Trường, Ngành và Sinh viên từ hồ sơ đơn hàng.');
  };

  const handleApplyAndSave = (enableCover: boolean) => {
    onSaveCoverPage(
      {
        ...draft,
        enabled: enableCover,
      },
      draftTopic,
      draftSubject
    );
    onToast(
      enableCover
        ? 'Đã áp dụng Trang bìa vào bài làm & bản xuất .DOCX!'
        : 'Đã tắt Trang bìa cho bài viết này.'
    );
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5"
    >
      <div
        className="modal-panel bg-white border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#12489B]">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Thiết kế Trang bìa / Cover Page (Luận văn &amp; Báo cáo)
              </h3>
              <p className="text-xs text-zinc-500">
                Chọn mẫu có sẵn, tích chọn các mục cần hiển thị và xem trước trực tiếp trước khi áp dụng vào bài làm.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(linkedClientName || linkedClientSchoolMajor) && (
              <button
                type="button"
                onClick={handleAutoFillFromOrder}
                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-100"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Điền từ đơn hàng</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="btn-press p-1.5 rounded-lg text-zinc-400 hover:text-slate-900 hover:bg-zinc-200/70"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body: Left Config (7 cols) + Right Live Preview (5 cols) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
          {/* Left: Templates + Checkboxes + Inputs */}
          <div className="lg:col-span-7 p-5 space-y-5 border-b lg:border-b-0 lg:border-r border-zinc-200">
            {/* Enable Switch */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80">
              <div>
                <div className="text-xs font-bold text-[#0B2559]">
                  Trạng thái Trang bìa cho bài này
                </div>
                <div className="text-[11px] text-zinc-600">
                  Khi bật, trang bìa sẽ hiển thị ở trang đầu tiên trên bản xem A4 và file Word `.DOCX` xuất ra.
                </div>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-[#12489B] rounded"
                />
                <span className="text-xs font-semibold text-[#12489B]">
                  {draft.enabled ? 'Đang bật Trang bìa' : 'Chưa bật Trang bìa'}
                </span>
              </label>
            </div>

            {/* Template Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  1. Mẫu Trang bìa có sẵn (Bấm để áp dụng thử)
                </h4>
                <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.showBorder}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        showBorder: e.target.checked,
                      }))
                    }
                    className="w-3.5 h-3.5 accent-[#12489B]"
                  />
                  <span>Kẻ khung viền trang bìa</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {COVER_PAGE_TEMPLATES.map((tpl) => {
                  const selected = draft.templateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleApplyTemplatePreview(tpl)}
                      className={`text-left p-3 rounded-xl border transition-colors ${
                        selected
                          ? 'bg-blue-50/70 border-[#12489B] ring-1 ring-[#12489B]/20'
                          : 'bg-white border-zinc-200 hover:border-blue-300 hover:bg-zinc-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-900">
                          {tpl.name}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                            selected
                              ? 'bg-[#12489B] text-white'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {selected ? 'Đang chọn' : tpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        {tpl.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Checklist & Field Inputs */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Tích chọn &amp; Nhập các mục trên Trang bìa
                </h4>
                <div className="inline-flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleSelectAllFields(true)}
                    className="font-medium text-[#12489B] hover:underline"
                  >
                    Tích tất cả
                  </button>
                  <span className="text-zinc-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleSelectAllFields(false)}
                    className="font-medium text-zinc-500 hover:underline"
                  >
                    Bỏ tích tất cả
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* University */}
                <CoverFieldRow
                  checked={draft.fields.showUniversity}
                  onToggle={() => toggleField('showUniversity')}
                  label="Tên Trường / Học viện"
                  value={draft.universityName}
                  onChange={(v) =>
                    setDraft((p) => ({ ...p, universityName: v }))
                  }
                  placeholder="VD: TRƯỜNG ĐẠI HỌC KINH TẾ QUỐC DÂN"
                />

                {/* Faculty */}
                <CoverFieldRow
                  checked={draft.fields.showFaculty}
                  onToggle={() => toggleField('showFaculty')}
                  label="Khoa / Viện / Bộ môn"
                  value={draft.facultyName}
                  onChange={(v) => setDraft((p) => ({ ...p, facultyName: v }))}
                  placeholder="VD: KHOA QUẢN TRỊ KINH DOANH"
                />

                {/* Document Type */}
                <CoverFieldRow
                  checked={draft.fields.showDocumentType}
                  onToggle={() => toggleField('showDocumentType')}
                  label="Loại tài liệu (Luận văn / Báo cáo...)"
                  value={draft.documentTypeLabel}
                  onChange={(v) =>
                    setDraft((p) => ({ ...p, documentTypeLabel: v }))
                  }
                  placeholder="VD: KHÓA LUẬN TỐT NGHIỆP / BÁO CÁO THỰC TẬP"
                />

                {/* Subject / Module */}
                <CoverFieldRow
                  checked={draft.fields.showSubject}
                  onToggle={() => toggleField('showSubject')}
                  label="Tên Môn học / Học phần (Module)"
                  value={draftSubject}
                  onChange={setDraftSubject}
                  placeholder="VD: Strategic Management"
                />

                {/* Topic (Full width) */}
                <div className="sm:col-span-2">
                  <CoverFieldRow
                    checked={draft.fields.showTopic}
                    onToggle={() => toggleField('showTopic')}
                    label="Tên Đề tài (Topic / Title)"
                    value={draftTopic}
                    onChange={setDraftTopic}
                    placeholder="Nhập tên đề tài luận văn / báo cáo thực tập..."
                    multiline
                  />
                </div>

                {/* Major */}
                <CoverFieldRow
                  checked={draft.fields.showMajor}
                  onToggle={() => toggleField('showMajor')}
                  label="Tên Ngành / Chuyên ngành"
                  value={draft.majorName}
                  onChange={(v) => setDraft((p) => ({ ...p, majorName: v }))}
                  placeholder="VD: Quản trị Kinh doanh Quốc tế"
                />

                {/* Supervisor */}
                <CoverFieldRow
                  checked={draft.fields.showSupervisor}
                  onToggle={() => toggleField('showSupervisor')}
                  label="Giảng viên hướng dẫn (Supervisor)"
                  value={draft.supervisorName}
                  onChange={(v) =>
                    setDraft((p) => ({ ...p, supervisorName: v }))
                  }
                  placeholder="VD: TS. Nguyễn Văn A"
                />

                {/* Student Name */}
                <CoverFieldRow
                  checked={draft.fields.showStudentName}
                  onToggle={() => toggleField('showStudentName')}
                  label="Họ và tên Sinh viên"
                  value={draft.studentName}
                  onChange={(v) => setDraft((p) => ({ ...p, studentName: v }))}
                  placeholder="VD: Trần Minh Anh"
                />

                {/* Student ID */}
                <CoverFieldRow
                  checked={draft.fields.showStudentId}
                  onToggle={() => toggleField('showStudentId')}
                  label="Mã số sinh viên (Student ID)"
                  value={draft.studentId}
                  onChange={(v) => setDraft((p) => ({ ...p, studentId: v }))}
                  placeholder="VD: 11210458"
                />

                {/* Class / Cohort */}
                <CoverFieldRow
                  checked={draft.fields.showClassName}
                  onToggle={() => toggleField('showClassName')}
                  label="Lớp / Khóa"
                  value={draft.className}
                  onChange={(v) => setDraft((p) => ({ ...p, className: v }))}
                  placeholder="VD: K63 - QTKD CLC"
                />

                {/* Internship Unit */}
                <CoverFieldRow
                  checked={draft.fields.showInternshipUnit}
                  onToggle={() => toggleField('showInternshipUnit')}
                  label="Đơn vị thực tập / Doanh nghiệp"
                  value={draft.internshipUnit}
                  onChange={(v) =>
                    setDraft((p) => ({ ...p, internshipUnit: v }))
                  }
                  placeholder="VD: Công ty Cổ phần FPT"
                />

                {/* Submission Date / Location */}
                <CoverFieldRow
                  checked={draft.fields.showSubmissionDate}
                  onToggle={() => toggleField('showSubmissionDate')}
                  label="Địa điểm &amp; Thời gian / Ngày nộp"
                  value={draft.locationAndDate}
                  onChange={(v) =>
                    setDraft((p) => ({ ...p, locationAndDate: v }))
                  }
                  placeholder="VD: Hà Nội, tháng 11/2026"
                />

                {/* Word Count Toggle */}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-zinc-200 bg-zinc-50/70">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={draft.fields.showWordCount}
                      onChange={() => toggleField('showWordCount')}
                      className="w-3.5 h-3.5 accent-[#12489B]"
                    />
                    <span>Hiển thị Số từ (Word Count)</span>
                  </label>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {session.targetWordCount.toLocaleString()}w
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live A4 Preview */}
          <div className="lg:col-span-5 bg-zinc-100/90 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold text-[#0B2559]">
                <Eye className="w-3.5 h-3.5 text-[#12489B]" />
                Xem trước Trang bìa (Live Preview)
              </span>
              <span className="text-[11px] text-zinc-500">
                Font: {session.format.fontFamily}
              </span>
            </div>

            <div className="rounded-xl shadow-md border border-zinc-300 overflow-hidden bg-white">
              <CoverPageSheetPreview
                cover={draft}
                topic={draftTopic}
                subject={draftSubject}
                targetWordCount={session.targetWordCount}
                writingLanguage={session.writingLanguage}
                fontFamily={session.format.fontFamily}
                compact
              />
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Mẹo: Bạn có thể bấm qua lại giữa 4 mẫu ở cột bên trái để thử bố cục ngay lập tức xem mẫu nào hợp với bài luận hoặc báo cáo thực tập của khách nhất.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-200 bg-zinc-50/80 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleApplyAndSave(false)}
            className="btn-press px-3.5 py-2 text-xs font-medium text-zinc-600 hover:text-rose-600 border border-zinc-200 bg-white rounded-lg"
          >
            Tắt trang bìa
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-press px-4 py-2 text-xs font-medium text-zinc-600 hover:text-slate-900"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => handleApplyAndSave(true)}
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#12489B] hover:bg-[#0B2559] text-white rounded-lg shadow-2xs"
            >
              {draft.enabled ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Áp dụng Trang bìa vào bài làm</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CoverFieldRow({
  checked,
  onToggle,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <div
      className={`p-2.5 rounded-lg border transition-colors ${
        checked
          ? 'bg-white border-zinc-200'
          : 'bg-zinc-50/70 border-zinc-200/60 opacity-75'
      }`}
    >
      <label className="inline-flex items-center gap-2 cursor-pointer mb-1.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-3.5 h-3.5 accent-[#12489B]"
        />
        <span className="text-[11px] font-semibold text-zinc-700">{label}</span>
      </label>
      {multiline ? (
        <textarea
          rows={2}
          value={value}
          disabled={!checked}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:bg-white focus:outline-none focus:border-[#12489B] disabled:opacity-60 resize-y"
        />
      ) : (
        <input
          type="text"
          value={value}
          disabled={!checked}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-md focus:bg-white focus:outline-none focus:border-[#12489B] disabled:opacity-60"
        />
      )}
    </div>
  );
}
