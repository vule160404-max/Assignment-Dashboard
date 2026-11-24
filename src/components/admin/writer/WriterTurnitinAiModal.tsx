import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Fingerprint,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import {
  TurnitinPaperScanReport,
  TurnitinSectionScanResult,
} from '../../../lib/turnitinAiBreaker';

interface WriterTurnitinAiModalProps {
  isOpen: boolean;
  report: TurnitinPaperScanReport | null;
  isHumanizing: boolean;
  progressState: {
    currentStep: number;
    totalSteps: number;
    currentSectionTitle: string;
  } | null;
  onRescan: () => void;
  onRunFastBreaker: (sectionIds: string[]) => void;
  onRunDeepAiHumanize: (sectionIds: string[]) => void;
  onJumpToSection: (sectionId: string) => void;
  onClose: () => void;
}

export function WriterTurnitinAiModal({
  isOpen,
  report,
  isHumanizing,
  progressState,
  onRescan,
  onRunFastBreaker,
  onRunDeepAiHumanize,
  onJumpToSection,
  onClose,
}: WriterTurnitinAiModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!report) return;
    const flagged = report.sections
      .filter((s) => s.aiRiskPercent >= 18 || s.detectedAiPhrases.length > 0)
      .map((s) => s.sectionId);
    setSelectedIds(
      flagged.length > 0
        ? flagged
        : report.sections.map((s) => s.sectionId)
    );
  }, [report]);

  if (!isOpen || !report) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllFlagged = () => {
    const flagged = report.sections
      .filter((s) => s.aiRiskPercent >= 18)
      .map((s) => s.sectionId);
    setSelectedIds(
      flagged.length > 0 ? flagged : report.sections.map((s) => s.sectionId)
    );
  };

  const riskBadge = (sec: TurnitinSectionScanResult) => {
    if (sec.riskLevel === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3 h-3" />
          Nguy cơ cao ({sec.aiRiskPercent}% AI)
        </span>
      );
    }
    if (sec.riskLevel === 'moderate') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          Cảnh báo nhẹ ({sec.aiRiskPercent}% AI)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" />
        An toàn Pass ({sec.aiRiskPercent}% AI)
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#071A42] via-[#0B2559] to-[#12489B] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Fingerprint className="w-5 h-5 text-sky-300" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold truncate">
                  Trình Rà Soát &amp; Phá Vân Tay Turnitin AI (AIW-2 / AIR-1)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-[10.5px] font-bold">
                  Khóa Trích Dẫn &amp; Số Liệu 100%
                </span>
              </div>
              <p className="text-xs text-slate-200/85 truncate">
                Bước 1: Quét độ đều nhịp câu (Burstiness) &amp; từ nối AI · Bước 2: Tự động Humanize vượt Turnitin mà không chạm vào trích dẫn, số liệu và hình ảnh.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isHumanizing}
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPI Summary Strip */}
        <div className="px-6 py-4 bg-[#F4F7FB] border-b border-zinc-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white border border-zinc-200/90 p-3">
            <div className="text-[11px] text-zinc-500">
              Dự báo Turnitin AI Score
            </div>
            <div
              className={`text-2xl font-bold font-mono tabular-nums mt-0.5 ${
                report.overallAiRiskPercent >= 45
                  ? 'text-rose-600'
                  : report.overallAiRiskPercent >= 20
                  ? 'text-amber-600'
                  : 'text-emerald-700'
              }`}
            >
              {report.overallAiRiskPercent}%
              <span className="text-xs font-sans font-semibold ml-1.5">
                {report.overallAiRiskPercent < 20
                  ? '· Đạt chuẩn Pass'
                  : report.overallAiRiskPercent < 45
                  ? '· Nên phá nhịp'
                  : '· Cần Humanize'}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-zinc-200/90 p-3">
            <div className="text-[11px] text-zinc-500">
              Độ biến thiên nhịp câu (Burstiness)
            </div>
            <div
              className={`text-2xl font-bold font-mono tabular-nums mt-0.5 ${
                report.overallBurstinessCvPercent >= 42
                  ? 'text-emerald-700'
                  : 'text-[#12489B]'
              }`}
            >
              {report.overallBurstinessCvPercent}%
              <span className="text-[11px] font-sans font-normal text-zinc-400 ml-1">
                (Chuẩn &ge; 42%)
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-zinc-200/90 p-3">
            <div className="text-[11px] text-zinc-500">
              Vân tay từ nối AI phát hiện
            </div>
            <div className="text-2xl font-bold font-mono text-[#EA580C] tabular-nums mt-0.5">
              {report.totalAiFingerprints}
              <span className="text-[11px] font-sans font-normal text-zinc-400 ml-1">
                cụm từ máy móc
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/90 p-3">
            <div className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Khóa bảo toàn (Frozen)</span>
            </div>
            <div className="text-sm font-bold text-emerald-900 mt-1">
              {report.totalProtectedCitations} trích dẫn ·{' '}
              {report.totalProtectedFigures} hình · {report.totalProtectedStats}{' '}
              số liệu
            </div>
          </div>
        </div>

        {/* Live Progress Banner when Humanizing */}
        {isHumanizing && progressState && (
          <div className="px-6 py-3.5 bg-blue-50 border-b border-blue-200 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-xs font-bold text-[#0B2559]">
                <Loader2 className="w-4 h-4 animate-spin text-[#12489B] shrink-0" />
                <span>
                  Đang xử lý mục {progressState.currentStep}/
                  {progressState.totalSteps}: &ldquo;
                  {progressState.currentSectionTitle}&rdquo;...
                </span>
                {progressState.totalSteps - progressState.currentStep <= 1 && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-bold">
                    ⚡ Đang ở mục cuối — Sắp hoàn thành!
                  </span>
                )}
              </div>
              <span className="font-mono text-xs font-bold text-[#12489B]">
                {Math.round(
                  (progressState.currentStep /
                    Math.max(1, progressState.totalSteps)) *
                    100
                )}
                %
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-blue-200/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0B2559] to-[#12489B] transition-all duration-300"
                style={{
                  width: `${Math.round(
                    (progressState.currentStep /
                      Math.max(1, progressState.totalSteps)) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Section-by-Section Scan List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div className="text-xs font-bold text-slate-800">
              Kết quả rà soát từng mục ({report.sections.length} mục nội dung · Đã tự động bỏ qua Tài liệu tham khảo):
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                disabled={isHumanizing}
                onClick={selectAllFlagged}
                className="font-semibold text-[#12489B] hover:underline"
              >
                Chọn các mục có nguy cơ
              </button>
              <span className="text-zinc-300">|</span>
              <button
                type="button"
                disabled={isHumanizing}
                onClick={() =>
                  setSelectedIds(report.sections.map((s) => s.sectionId))
                }
                className="font-semibold text-slate-600 hover:underline"
              >
                Chọn tất cả
              </button>
              <span className="text-zinc-300">|</span>
              <button
                type="button"
                disabled={isHumanizing}
                onClick={onRescan}
                className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-[#12489B]"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Quét lại</span>
              </button>
            </div>
          </div>

          {report.sections.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 bg-zinc-50 rounded-2xl border border-zinc-200">
              Bài viết chưa có nội dung ở các mục thân bài để rà soát Turnitin AI.
            </div>
          ) : (
            report.sections.map((sec) => {
              const checked = selectedIds.includes(sec.sectionId);
              const isCurrentRunning =
                isHumanizing &&
                progressState?.currentSectionTitle === sec.sectionTitle;
              return (
                <div
                  key={sec.sectionId}
                  onClick={() => !isHumanizing && toggleSelect(sec.sectionId)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                    isCurrentRunning
                      ? 'bg-blue-100/70 border-[#12489B] ring-2 ring-[#12489B] shadow-md'
                      : checked
                      ? 'bg-blue-50/40 border-[#12489B]/60 shadow-2xs'
                      : 'bg-white border-zinc-200/90 hover:border-zinc-300'
                  }`}
                >
                  {isCurrentRunning && (
                    <div className="px-2.5 py-1 rounded-lg bg-[#0B2559] text-white text-[11px] font-bold inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-sky-300" />
                      <span>ĐANG XỬ LÝ MỤC NÀY — Đang lọc 6 lớp &amp; phẫu thuật đoạn nguy cơ cao...</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isHumanizing}
                        onChange={() => toggleSelect(sec.sectionId)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded accent-[#12489B]"
                      />
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {sec.sectionTitle}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        ({sec.wordCount} từ · {sec.sentenceCount} câu)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {riskBadge(sec)}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToSection(sec.sectionId);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-[11px] font-semibold text-slate-700"
                      >
                        Mở mục
                      </button>
                    </div>
                  </div>

                  {/* Diagnostic telemetry row */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`px-2 py-0.5 rounded-md font-mono font-semibold ${
                        sec.burstinessCvPercent >= 42
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      Burstiness CV: {sec.burstinessCvPercent}%
                    </span>

                    {sec.monotonousRunCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                        {sec.monotonousRunCount} cụm câu đều nhịp 18–24 từ
                      </span>
                    )}

                    {sec.detectedAiPhrases.length > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-orange-50 text-[#EA580C] border border-orange-200 font-semibold">
                        Từ nối AI: {sec.detectedAiPhrases.join(', ')}
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-slate-700 font-medium inline-flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-700" />
                      Khóa bảo vệ: {sec.protectedCitations.length} trích dẫn
                      {sec.protectedFigureTags.length > 0
                        ? ` · ${sec.protectedFigureTags.length} hình`
                        : ''}
                      {sec.protectedStatTokens.length > 0
                        ? ` · ${sec.protectedStatTokens.length} chỉ số`
                        : ''}
                    </span>
                  </div>

                  {sec.protectedCitations.length > 0 && (
                    <div className="text-[11px] text-zinc-500 truncate">
                      <strong className="text-slate-700">
                        Trích dẫn được khóa nguyên vẹn:
                      </strong>{' '}
                      {sec.protectedCitations.slice(0, 8).join(', ')}
                      {sec.protectedCitations.length > 8
                        ? ` (+${sec.protectedCitations.length - 8} trích dẫn khác)`
                        : ''}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Đã chọn <strong>{selectedIds.length}</strong> mục. Cơ chế{' '}
              <strong>Frozen-Citation Lock</strong> tự động khôi phục nếu AI làm rơi bất kỳ trích dẫn hoặc hình ảnh nào.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isHumanizing || selectedIds.length === 0}
              onClick={() => onRunFastBreaker(selectedIds)}
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-blue-200 hover:bg-blue-50 text-[#12489B] text-xs font-bold disabled:opacity-40"
              title="Chạy 6 lớp phá vân tay Turnitin AIW-2 & AIR-1 trực tiếp trên trình duyệt (0 giây, 0 Token, hoàn toàn miễn phí)"
            >
              <Zap className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Phá vân tay 6 Lớp (0 Token · Miễn phí)</span>
            </button>

            <button
              type="button"
              disabled={isHumanizing || selectedIds.length === 0}
              onClick={() => onRunDeepAiHumanize(selectedIds)}
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0B2559] to-[#12489B] hover:from-[#071A42] hover:to-[#0B2559] text-white text-xs font-bold shadow-sm disabled:opacity-40"
              title="Chạy lọc 0-Token trước, sau đó chỉ gửi đúng các đoạn văn còn nguy cơ cao lên AI với Prompt siêu gọn (Tiết kiệm ~85% Token & cam kết < 20% AI)"
            >
              {isHumanizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              <span>
                AI Phẫu Thuật (&lt; 20% AI · Tiết kiệm ~{report.tokenSavingsPercent}% Token)
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
