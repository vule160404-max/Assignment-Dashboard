import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BookCheck,
  CheckCircle2,
  FileWarning,
  Link2Off,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  PaperAuditCategory,
  PaperAuditIssue,
  PaperAuditReport,
} from '../../../lib/aiWriterClient';

interface WriterAuditModalProps {
  isOpen: boolean;
  report: PaperAuditReport | null;
  isAuditing: boolean;
  isAutoFixing: boolean;
  auditStatusLabel: string;
  onRunAudit: () => void;
  onAutoFixAll: (report: PaperAuditReport, selectedIssueIds?: string[]) => void;
  onJumpToSection: (sectionId: string, issueId?: string) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<PaperAuditCategory, string> = {
  doi_and_sources: 'Nguồn & Mã DOI (Crossref)',
  citation_sync: 'Khớp Trích dẫn 1-1',
  structure_and_content: 'Nội dung & Bố cục',
  completeness: 'Độ hoàn chỉnh & Cắt cụt',
};

export function WriterAuditModal({
  isOpen,
  report,
  isAuditing,
  isAutoFixing,
  auditStatusLabel,
  onRunAudit,
  onAutoFixAll,
  onJumpToSection,
  onClose,
}: WriterAuditModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!report) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(report.issues.filter((i) => i.autoFixable).map((i) => i.id));
  }, [report]);

  if (!isOpen) return null;

  const criticalCount =
    report?.issues.filter((i) => i.severity === 'critical').length || 0;
  const warningCount =
    report?.issues.filter((i) => i.severity === 'warning').length || 0;
  const autoFixableIssues =
    report?.issues.filter((i) => i.autoFixable) || [];
  const autoFixableCount = autoFixableIssues.length;
  const selectedSet = new Set(selectedIds);
  const selectedFixableCount = autoFixableIssues.filter((i) =>
    selectedSet.has(i.id)
  ).length;

  const toggleIssueSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFixable = () => {
    if (selectedFixableCount === autoFixableCount) {
      setSelectedIds([]);
    } else {
      setSelectedIds(autoFixableIssues.map((i) => i.id));
    }
  };

  const groupedCategories: PaperAuditCategory[] = [
    'doi_and_sources',
    'citation_sync',
    'structure_and_content',
    'completeness',
  ];

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      onClick={() => {
        if (!isAuditing && !isAutoFixing) onClose();
      }}
    >
      <div
        className="modal-panel bg-white border border-zinc-200 rounded-2xl shadow-xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 bg-slate-50/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                report?.verdict === 'pass'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : report?.verdict === 'critical_errors'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-blue-50 border-blue-200 text-[#12489B]'
              }`}
            >
              {report?.verdict === 'pass' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : report?.verdict === 'critical_errors' ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <BookCheck className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                Kiểm duyệt bài cuối cùng (AI Academic QA Auditor)
              </h3>
              <p className="text-xs text-zinc-500 truncate">
                2 lớp kiểm định: Crossref DOI thật + Đối chiếu trích dẫn 1-1 + AI Giám khảo rà lỗi logic
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isAuditing || isAutoFixing}
            onClick={onClose}
            className="btn-press p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {(isAuditing || isAutoFixing) && (
            <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[#12489B] animate-spin shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0B2559]">
                  {isAutoFixing
                    ? 'Đang tự động sửa các lỗi và cập nhật nhật ký...'
                    : 'Đang kiểm duyệt toàn bộ bài viết...'}
                </div>
                <p className="text-xs text-[#12489B] mt-0.5">
                  {auditStatusLabel ||
                    'Đang đối chiếu Crossref DOI, trích dẫn In-text và nội dung các chương...'}
                </p>
              </div>
            </div>
          )}

          {!report && !isAuditing && (
            <div className="py-10 text-center space-y-3">
              <BookCheck className="w-10 h-10 text-zinc-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                Chưa có kết quả kiểm duyệt cho phiên viết này.
              </p>
              <button
                type="button"
                onClick={onRunAudit}
                className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#12489B] hover:bg-[#0D387A] text-white text-xs font-bold shadow-2xs"
              >
                <Sparkles className="w-4 h-4" />
                <span>Chạy Kiểm duyệt ngay</span>
              </button>
            </div>
          )}

          {report && (
            <>
              {/* Score + Metrics Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div
                  className={`sm:col-span-5 p-4 rounded-xl border flex items-center gap-4 ${
                    report.verdict === 'pass'
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : report.verdict === 'critical_errors'
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-amber-50/70 border-amber-200'
                  }`}
                >
                  <div className="shrink-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Điểm QA
                    </div>
                    <div
                      className={`text-3xl font-black font-mono tabular-nums leading-none mt-0.5 ${
                        report.verdict === 'pass'
                          ? 'text-emerald-700'
                          : report.verdict === 'critical_errors'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {report.score}
                      <span className="text-sm font-semibold opacity-70">/100</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-xs font-bold uppercase tracking-wide ${
                        report.verdict === 'pass'
                          ? 'text-emerald-800'
                          : report.verdict === 'critical_errors'
                          ? 'text-rose-800'
                          : 'text-amber-800'
                      }`}
                    >
                      {report.verdict === 'pass'
                        ? 'Đạt chuẩn giao khách'
                        : report.verdict === 'critical_errors'
                        ? `Phát hiện ${report.issues.length} lỗi cần sửa`
                        : `Cần rà soát ${report.issues.length} mục`}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      {criticalCount} lỗi nghiêm trọng · {warningCount} cảnh báo
                    </p>
                  </div>
                </div>

                <div className="sm:col-span-7 grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/90">
                    <div className="text-[10px] font-semibold text-zinc-500 uppercase">
                      DOI kiểm chứng
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-800 mt-0.5">
                      {report.checkedDoiCount}
                    </div>
                    <div className="text-[10px] text-zinc-400">Crossref API</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/80">
                    <div className="text-[10px] font-semibold text-emerald-700 uppercase">
                      DOI hợp lệ
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-700 mt-0.5">
                      {report.verifiedDoiCount}
                    </div>
                    <div className="text-[10px] text-emerald-600/80">Khớp tác giả</div>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/80">
                    <div className="text-[10px] font-semibold text-rose-700 uppercase">
                      DOI lỗi / giả
                    </div>
                    <div className="text-lg font-bold font-mono text-rose-700 mt-0.5">
                      {report.invalidDoiCount}
                    </div>
                    <div className="text-[10px] text-rose-600/80">Trùng / 404 / Bịa</div>
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-zinc-200/80 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900">Nhận xét của Giám khảo AI: </span>
                {report.summary}
              </div>

              {/* Issues List */}
              {report.issues.length === 0 ? (
                <div className="p-6 rounded-xl bg-emerald-50/60 border border-emerald-200 text-center space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <div className="text-sm font-bold text-emerald-900">
                    Tuyệt vời! Không phát hiện lỗi nghiêm trọng nào.
                  </div>
                  <p className="text-xs text-emerald-700">
                    Các mã DOI, trích dẫn In-text ↔ References và cấu trúc chương đều đạt chuẩn để xuất DOCX/PDF giao khách.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Quick Select All / Deselect All Bar */}
                  {autoFixableCount > 0 && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none font-semibold text-[#0B2559]">
                        <input
                          type="checkbox"
                          checked={
                            autoFixableCount > 0 &&
                            selectedFixableCount === autoFixableCount
                          }
                          onChange={toggleSelectAllFixable}
                          className="w-4 h-4 rounded accent-[#12489B] cursor-pointer"
                        />
                        <span>
                          {selectedFixableCount === autoFixableCount
                            ? 'Bỏ chọn tất cả lỗi'
                            : 'Chọn tất cả lỗi có thể tự sửa'}
                        </span>
                      </label>
                      <span className="font-mono text-[11px] font-bold text-[#12489B]">
                        Đã chọn {selectedFixableCount}/{autoFixableCount} lỗi
                      </span>
                    </div>
                  )}

                  {groupedCategories.map((cat) => {
                    const catIssues = report.issues.filter(
                      (i) => i.category === cat
                    );
                    if (catIssues.length === 0) return null;

                    return (
                      <div key={cat} className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                          <span className="inline-flex items-center gap-1.5">
                            {cat === 'doi_and_sources' ? (
                              <Link2Off className="w-3.5 h-3.5 text-rose-600" />
                            ) : (
                              <FileWarning className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span>{CATEGORY_LABELS[cat]}</span>
                          </span>
                          <span className="font-mono">{catIssues.length} mục</span>
                        </div>

                        <div className="space-y-2">
                          {catIssues.map((issue: PaperAuditIssue) => {
                            const isChecked =
                              issue.autoFixable && selectedSet.has(issue.id);
                            return (
                              <div
                                key={issue.id}
                                className={`p-3.5 rounded-xl border space-y-1.5 transition-colors ${
                                  issue.autoFixable && !isChecked
                                    ? 'bg-zinc-50/70 border-zinc-200/80 opacity-65'
                                    : issue.severity === 'critical'
                                    ? 'bg-rose-50/40 border-rose-200/90'
                                    : issue.severity === 'warning'
                                    ? 'bg-amber-50/40 border-amber-200/90'
                                    : 'bg-zinc-50/60 border-zinc-200/80'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    {issue.autoFixable ? (
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() =>
                                          toggleIssueSelection(issue.id)
                                        }
                                        aria-label={`Chọn sửa lỗi: ${issue.title}`}
                                        className="mt-0.5 w-4 h-4 rounded accent-[#12489B] cursor-pointer shrink-0"
                                      />
                                    ) : issue.severity === 'critical' ? (
                                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                    ) : (
                                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    )}
                                    <div
                                      className={`min-w-0 ${
                                        issue.autoFixable ? 'cursor-pointer' : ''
                                      }`}
                                      onClick={() => {
                                        if (issue.autoFixable) {
                                          toggleIssueSelection(issue.id);
                                        }
                                      }}
                                    >
                                      <div className="text-xs font-bold text-slate-900 leading-snug">
                                        {issue.title}
                                      </div>
                                      <p className="text-[11.5px] text-slate-600 mt-0.5 leading-relaxed break-words">
                                        {issue.detail}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {issue.autoFixable && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[#12489B] text-[10px] font-semibold">
                                        Auto-Fix
                                      </span>
                                    )}
                                    {issue.sectionId && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onJumpToSection(
                                            issue.sectionId!,
                                            issue.id
                                          );
                                          onClose();
                                        }}
                                        className="btn-press inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:border-[#12489B] text-[10.5px] font-semibold text-slate-700 hover:text-[#12489B]"
                                      >
                                        <span>Đến câu lỗi</span>
                                        <ArrowUpRight className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {issue.fixHint && (
                                  <div className="pl-6 text-[11px] text-[#12489B] font-medium">
                                    Hướng xử lý: {issue.fixHint}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-200 bg-zinc-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            disabled={isAuditing || isAutoFixing}
            onClick={onRunAudit}
            className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
            <span>Kiểm duyệt lại</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isAuditing || isAutoFixing}
              onClick={onClose}
              className="btn-press px-3.5 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-zinc-700 disabled:opacity-50"
            >
              Đóng
            </button>

            {report && autoFixableCount > 0 && (
              <button
                type="button"
                disabled={isAuditing || isAutoFixing || selectedFixableCount === 0}
                onClick={() => onAutoFixAll(report, selectedIds)}
                className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#12489B] hover:bg-[#0D387A] text-white text-xs font-bold shadow-2xs disabled:opacity-50"
              >
                {isAutoFixing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wrench className="w-3.5 h-3.5" />
                )}
                <span>
                  {selectedFixableCount === 0
                    ? 'Hãy tích chọn ít nhất 1 lỗi'
                    : selectedFixableCount > 5
                    ? `Tự động sửa 5 lỗi đã chọn (5/${selectedFixableCount})`
                    : `Tự động sửa ${selectedFixableCount} lỗi đã chọn`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
