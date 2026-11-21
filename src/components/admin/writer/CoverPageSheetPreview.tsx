import {
  CoverPageConfig,
  FontFamilyOption,
} from './types';

interface CoverPageSheetPreviewProps {
  cover: CoverPageConfig;
  topic: string;
  subject: string;
  targetWordCount: number;
  writingLanguage: 'English' | 'Vietnamese' | 'Bilingual';
  fontFamily: FontFamilyOption;
  compact?: boolean;
}

export function CoverPageSheetPreview({
  cover,
  topic,
  subject,
  targetWordCount,
  writingLanguage,
  fontFamily,
  compact = false,
}: CoverPageSheetPreviewProps) {
  const f = cover.fields;
  const isVi = writingLanguage === 'Vietnamese';
  const tpl = cover.templateId;

  const isModern = tpl === 'modern_executive';
  const isIntl = tpl === 'academic_international';
  const isInternship = tpl === 'internship_report';

  const borderClass = cover.showBorder
    ? tpl === 'classic_vn_thesis' || isInternship
      ? 'border-[3px] border-double border-slate-800 p-6 sm:p-8'
      : isModern
      ? 'border-2 border-[#0B2559] p-6 sm:p-8'
      : 'border border-slate-400 p-6 sm:p-8'
    : 'p-4 sm:p-6';

  const infoRows: Array<{ label: string; value: string; enabled: boolean }> = [
    {
      label: isVi ? 'Môn học / Học phần' : 'Module / Course',
      value: subject.trim() || (isVi ? 'Chưa nhập tên môn học' : 'Module Name'),
      enabled: f.showSubject,
    },
    {
      label: isVi ? 'Chuyên ngành' : 'Major / Programme',
      value: cover.majorName.trim() || (isVi ? 'Chưa nhập tên ngành' : 'Major Name'),
      enabled: f.showMajor,
    },
    {
      label: isVi ? 'Đơn vị thực tập' : 'Internship Organization',
      value:
        cover.internshipUnit.trim() ||
        (isVi ? 'Tên công ty / đơn vị thực tập' : 'Company / Host Organization'),
      enabled: f.showInternshipUnit,
    },
    {
      label: isVi ? 'Giảng viên hướng dẫn' : 'Supervisor / Lecturer',
      value:
        cover.supervisorName.trim() ||
        (isVi ? 'TS. / ThS. Nguyễn Văn A' : 'Dr. / Prof. Supervisor Name'),
      enabled: f.showSupervisor,
    },
    {
      label: isVi ? 'Sinh viên thực hiện' : 'Student Name',
      value:
        cover.studentName.trim() ||
        (isVi ? 'Họ và tên sinh viên' : 'Full Student Name'),
      enabled: f.showStudentName,
    },
    {
      label: isVi ? 'Mã số sinh viên' : 'Student ID',
      value: cover.studentId.trim() || '20210000',
      enabled: f.showStudentId,
    },
    {
      label: isVi ? 'Lớp / Khóa' : 'Class / Cohort',
      value: cover.className.trim() || (isVi ? 'K63 - QTKD' : 'Cohort 2026'),
      enabled: f.showClassName,
    },
    {
      label: isVi ? 'Độ dài dự kiến' : 'Word Count',
      value: `${targetWordCount.toLocaleString()} ${isVi ? 'từ' : 'words'}`,
      enabled: f.showWordCount,
    },
  ].filter((row) => row.enabled);

  return (
    <div
      className={`bg-white text-slate-900 flex flex-col justify-between ${borderClass} ${
        compact ? 'min-h-[470px] text-[10.5px]' : 'min-h-[780px] text-[13px]'
      } relative overflow-hidden select-none`}
      style={{ fontFamily: `"${fontFamily}", serif` }}
    >
      {isModern && (
        <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-[#0B2559] via-[#12489B] to-[#F5B700]" />
      )}

      {/* Top Block: University & Faculty */}
      <div className="text-center space-y-1.5 pt-2">
        {f.showUniversity && (
          <div
            className={`font-bold uppercase tracking-wide ${
              compact ? 'text-[11px]' : 'text-[14px]'
            } ${isModern ? 'text-[#0B2559]' : 'text-slate-900'}`}
          >
            {cover.universityName.trim() || 'TÊN TRƯỜNG ĐẠI HỌC / HỌC VIỆN'}
          </div>
        )}
        {f.showFaculty && (
          <div
            className={`font-semibold uppercase tracking-wide ${
              compact ? 'text-[10px]' : 'text-[12.5px]'
            } ${isIntl ? 'text-zinc-600' : 'text-slate-800'}`}
          >
            {cover.facultyName.trim() || 'KHOA / VIỆN CHUYÊN NGÀNH'}
          </div>
        )}
        {(f.showUniversity || f.showFaculty) && (
          <div
            className={`mx-auto mt-2 ${
              isModern
                ? 'w-24 h-0.5 bg-[#F5B700]'
                : isIntl
                ? 'w-20 h-px bg-zinc-400'
                : 'w-28 h-0.5 bg-slate-800'
            }`}
          />
        )}
      </div>

      {/* Middle Block: Document Type + Topic */}
      <div className="my-auto py-6 text-center space-y-4">
        {f.showDocumentType && (
          <div
            className={`font-bold uppercase tracking-widest ${
              compact ? 'text-[11px]' : 'text-[14px]'
            } ${
              isModern
                ? 'text-[#12489B]'
                : isIntl
                ? 'text-zinc-600'
                : 'text-slate-900'
            }`}
          >
            {cover.documentTypeLabel.trim() || 'BÀI LUẬN / BÁO CÁO NGHIÊN CỨU'}
          </div>
        )}

        {f.showTopic && (
          <div className="px-2 sm:px-6 space-y-2">
            {!isIntl && !isModern && (
              <div
                className={`uppercase font-semibold tracking-wider text-zinc-500 ${
                  compact ? 'text-[9px]' : 'text-[11px]'
                }`}
              >
                {isVi ? 'ĐỀ TÀI:' : 'TOPIC:'}
              </div>
            )}
            <div
              className={`font-bold leading-snug text-slate-900 ${
                compact ? 'text-[13px]' : 'text-[18px]'
              }`}
            >
              {topic.trim() ||
                (isVi
                  ? 'NHẬP TÊN ĐỀ TÀI LUẬN VĂN / BÁO CÁO'
                  : 'RESEARCH PAPER / DISSERTATION TITLE')}
            </div>
          </div>
        )}
      </div>

      {/* Metadata Table / Info Block */}
      <div className="space-y-6 pb-2">
        {infoRows.length > 0 && (
          <div
            className={`mx-auto ${
              compact ? 'max-w-[92%]' : 'max-w-[82%]'
            } rounded-lg ${
              isModern
                ? 'bg-blue-50/40 border border-blue-100 px-4 py-3'
                : isIntl
                ? 'border-t border-b border-zinc-200 py-3 px-2'
                : 'px-2 py-2'
            }`}
          >
            <div className="space-y-1.5">
              {infoRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-12 gap-2 items-baseline text-left"
                >
                  <span className="col-span-5 font-semibold text-zinc-700">
                    {row.label}:
                  </span>
                  <span className="col-span-7 font-medium text-slate-900 break-words">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Location & Date */}
        {f.showSubmissionDate && (
          <div
            className={`text-center font-semibold text-slate-800 pt-2 ${
              compact ? 'text-[10px]' : 'text-[12.5px]'
            }`}
          >
            {cover.locationAndDate.trim() ||
              `Hà Nội, ${new Date().getFullYear()}`}
          </div>
        )}
      </div>
    </div>
  );
}
