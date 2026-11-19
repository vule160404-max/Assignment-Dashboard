import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderUp,
  Info,
  Loader2,
  Printer,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import {
  AnalyzedSentence,
  IntegrityAnalysisReport,
  openPrintableIntegrityReport,
  runIntegrityCheck,
} from '../../lib/integrityCheckerClient';
import { countWords, parseDocxFile } from '../../lib/wordHumanizer';

interface ClientIntegrityCheckerViewProps {
  onToast: (msg: string) => void;
}

type HighlightLayerMode = 'combined' | 'similarity' | 'ai';
type SidebarTab = 'sources' | 'ai_forensics';

function RadialScoreRing({
  percent,
  colorHex,
  label,
}: {
  percent: number;
  colorHex: string;
  label: string;
}) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88" aria-hidden="true">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="#F4F4F5"
          strokeWidth="7.5"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={colorHex}
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 520ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900 leading-none">
          {clamped}%
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 mt-1">
          {label}
        </span>
      </div>
    </div>
  );
}

function MetricProgressBar({
  label,
  value,
  hint,
  barColor,
}: {
  label: string;
  value: number;
  hint: string;
  barColor: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-800">{label}</span>
        <span className="font-mono font-bold text-slate-900 tabular-nums">
          {clamped}/100
        </span>
      </div>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className="progress-fill h-full w-full rounded-full"
          style={{
            backgroundColor: barColor,
            transform: `scaleX(${clamped / 100})`,
          }}
        />
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">{hint}</p>
    </div>
  );
}

export function ClientIntegrityCheckerView({
  onToast,
}: ClientIntegrityCheckerViewProps) {
  const [title, setTitle] = useState('');
  const [textInput, setTextInput] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [excludeReferences, setExcludeReferences] = useState(true);
  const [excludeQuotes, setExcludeQuotes] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [scanStep, setScanStep] = useState<0 | 1 | 2 | 3>(0);
  const [report, setReport] = useState<IntegrityAnalysisReport | null>(null);
  const [layerMode, setLayerMode] = useState<HighlightLayerMode>('combined');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('sources');
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(
    null
  );
  const [activeSourceFilterId, setActiveSourceFilterId] = useState<
    number | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputWords = useMemo(() => countWords(textInput), [textInput]);

  const handleUploadDocument = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setLoadingFile(true);
    try {
      const lower = file.name.toLowerCase();
      let extracted = '';
      if (lower.endsWith('.docx')) {
        const parsed = await parseDocxFile(file);
        extracted = parsed.paragraphs
          .filter((p) => !p.isEmpty)
          .map((p) => p.text)
          .join('\n\n');
      } else if (lower.endsWith('.txt') || lower.endsWith('.md')) {
        extracted = await file.text();
      } else {
        throw new Error('Chỉ hỗ trợ tải lên tệp Word (.docx), .txt hoặc .md.');
      }

      if (!extracted.trim()) {
        throw new Error('Không đọc được nội dung văn bản từ tệp đã chọn.');
      }

      setTextInput(extracted.trim());
      setUploadedFileName(file.name);
      setTitle(file.name.replace(/\.(docx|txt|md)$/i, ''));
      setReport(null);
      onToast(
        `Đã nạp ${countWords(extracted).toLocaleString('vi-VN')} từ từ "${file.name}".`
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Không thể đọc tệp văn bản.'
      );
    } finally {
      setLoadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRunScan = async () => {
    const trimmed = textInput.trim();
    if (trimmed.length < 40) {
      onToast('Vui lòng nhập hoặc tải lên tối thiểu 40 ký tự để kiểm tra.');
      return;
    }

    setAnalyzing(true);
    setScanStep(1);
    const t1 = window.setTimeout(() => setScanStep(2), 600);
    const t2 = window.setTimeout(() => setScanStep(3), 1450);

    try {
      const result = await runIntegrityCheck({
        text: trimmed,
        title: title.trim() || 'Tài liệu kiểm tra Đạo văn & AI',
        excludeReferences,
        excludeQuotes,
      });
      setReport(result);
      setSelectedSentenceId(null);
      setActiveSourceFilterId(null);
      setSidebarTab(result.sources.length > 0 ? 'sources' : 'ai_forensics');
      onToast(
        `Hoàn tất kiểm tra tham khảo (${result.overallSimilarityPercent}% Trùng lặp · ${result.overallAiPercent}% AI).`
      );
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : 'Không thể hoàn tất quá trình kiểm tra.'
      );
    } finally {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setAnalyzing(false);
      setScanStep(0);
    }
  };

  const handlePrintReport = () => {
    if (!report) return;
    const opened = openPrintableIntegrityReport(report);
    if (!opened) {
      onToast(
        'Trình duyệt đang chặn cửa sổ bật lên (Pop-up). Hãy cho phép mở tab in.'
      );
    }
  };

  const paragraphsGrouped = useMemo(() => {
    if (!report) return [];
    const map = new Map<number, AnalyzedSentence[]>();
    for (const s of report.sentences) {
      const arr = map.get(s.paragraphIndex) || [];
      arr.push(s);
      map.set(s.paragraphIndex, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([, list]) => list);
  }, [report]);

  const sourceColorMap = useMemo(() => {
    if (!report) return new Map<number, string>();
    return new Map(report.sources.map((s) => [s.id, s.badgeColor]));
  }, [report]);

  const selectedSentence = useMemo(() => {
    if (!report || !selectedSentenceId) return null;
    return report.sentences.find((s) => s.id === selectedSentenceId) || null;
  }, [report, selectedSentenceId]);

  const simStatusMeta = useMemo(() => {
    const score = report?.overallSimilarityPercent ?? 0;
    if (score >= 25) {
      return {
        color: '#DC2626',
        badge: 'Mức trùng lặp Cao',
        badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }
    if (score >= 15) {
      return {
        color: '#D97706',
        badge: 'Trùng lặp Trung bình',
        badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    return {
      color: '#16A34A',
      badge: 'Mức trùng lặp Thấp',
      badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }, [report?.overallSimilarityPercent]);

  const aiStatusMeta = useMemo(() => {
    const score = report?.overallAiPercent ?? 0;
    if (score >= 60) {
      return {
        color: '#D97706',
        badge: 'Dấu hiệu AI Cao',
        badgeCls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    if (score >= 30) {
      return {
        color: '#7C3AED',
        badge: 'Pha trộn Người & AI',
        badgeCls: 'bg-violet-50 text-violet-700 border-violet-200',
      };
    }
    return {
      color: '#16A34A',
      badge: 'Văn phong Tự nhiên',
      badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }, [report?.overallAiPercent]);

  const scanStepsMeta = [
    { step: 1, label: 'Tách câu & lọc trích dẫn' },
    { step: 2, label: 'Đối chiếu Crossref, OpenAlex & Web' },
    { step: 3, label: 'Phân tích AI Forensics' },
  ];

  return (
    <div className="space-y-6">
      {/* Prominent Reference-Only Advisory Banner (Always Visible & High Contrast) */}
      <div
        role="note"
        className="bg-amber-50/95 border border-amber-300/90 border-l-4 border-l-amber-500 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 flex items-start gap-3.5 shadow-[0_2px_10px_rgb(217,119,6,0.06)]"
      >
        <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-amber-950 tracking-tight">
              LƯU Ý QUAN TRỌNG: Dữ liệu kiểm tra Đạo văn &amp; AI chỉ mang tính chất tham khảo sơ bộ
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-950 rounded-md">
              Chỉ tham khảo · Có sai lệch
            </span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed">
            Hệ thống sử dụng nguồn dữ liệu học thuật mở (<strong>Crossref, OpenAlex, Wikipedia</strong>) kết hợp phân tích thống kê ngôn ngữ học, do đó{' '}
            <strong>kết quả chắc chắn sẽ có độ sai lệch nhất định</strong> so với báo cáo Turnitin nội bộ của từng trường đại học (do khác biệt kho bài sinh viên và thuật toán độc quyền). Nếu bạn cần báo cáo Turnitin chính thức, vui lòng trao đổi với Admin trong đơn hàng.
          </p>
        </div>
      </div>

      {/* Main Input & Upload Studio Card */}
      <section className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-[0_10px_32px_rgb(15,23,42,0.04)]">
        {/* Card Header */}
        <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-zinc-100 flex flex-wrap items-end justify-between gap-4 bg-gradient-to-b from-slate-50/80 to-white">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#4338CA]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Academic Similarity &amp; AI Forensics</span>
            </div>
            <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900">
              Kiểm tra Đạo văn &amp; Nhận diện AI
            </h1>
            <p className="text-xs sm:text-[13px] text-zinc-600 leading-relaxed">
              Kéo thả, dán tệp (`Ctrl + V`) hoặc chọn tệp Word (`.docx`), `.txt`, `.md` từ máy tính để hệ thống đối chiếu nguồn học thuật và đánh giá xác suất AI theo từng câu.
            </p>
          </div>

          {uploadedFileName && (
            <button
              type="button"
              disabled={analyzing}
              onClick={() => {
                setTitle('');
                setTextInput('');
                setUploadedFileName('');
                setReport(null);
                setSelectedSentenceId(null);
              }}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 hover:text-slate-900 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Chọn tệp khác</span>
            </button>
          )}
        </div>

        {/* Workspace Body — File-Only Dropzone (Drag & Drop, Click, or Paste File) */}
        <div
          className="p-6 sm:p-8 space-y-5"
          onPaste={(e) => {
            const pastedFiles = e.clipboardData?.files;
            if (pastedFiles && pastedFiles.length > 0) {
              e.preventDefault();
              void handleUploadDocument(pastedFiles);
            }
          }}
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              void handleUploadDocument(e.dataTransfer.files);
            }}
            onClick={() => {
              if (!loadingFile && !analyzing) {
                fileInputRef.current?.click();
              }
            }}
            className={`rounded-2xl border-2 border-dashed px-6 py-10 sm:py-12 flex flex-col items-center justify-center text-center gap-4 cursor-pointer transition-colors duration-150 ${
              isDraggingFile
                ? 'border-[#4338CA] bg-indigo-50/70'
                : uploadedFileName
                ? 'border-emerald-300 bg-emerald-50/35 hover:border-emerald-400'
                : 'border-zinc-200/90 bg-zinc-50/60 hover:border-indigo-300 hover:bg-indigo-50/25'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.txt,.md"
              className="hidden"
              onChange={(e) => void handleUploadDocument(e.target.files)}
            />

            <div
              className={`w-14 h-14 rounded-2xl border shadow-2xs flex items-center justify-center ${
                uploadedFileName
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-white border-zinc-200/90 text-[#4338CA]'
              }`}
            >
              {loadingFile ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : uploadedFileName ? (
                <FileCheck2 className="w-6 h-6" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>

            {uploadedFileName ? (
              <div className="space-y-1.5 max-w-md">
                <p className="text-sm sm:text-base font-bold text-slate-900 break-all">
                  {uploadedFileName}
                </p>
                <p className="text-xs font-mono text-emerald-700 tabular-nums">
                  Đã trích xuất {inputWords.toLocaleString('vi-VN')} từ ·{' '}
                  {textInput.length.toLocaleString('vi-VN')} ký tự · Sẵn sàng kiểm tra
                </p>
                <p className="text-[11px] text-zinc-500">
                  Bấm vào đây hoặc kéo thả tệp mới để thay thế
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-w-md">
                <p className="text-sm sm:text-base font-bold text-slate-900">
                  Kéo thả tệp vào đây, dán tệp (`Ctrl + V`) hoặc bấm để chọn tệp
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Hỗ trợ định dạng <strong className="text-slate-700">.docx</strong>,{' '}
                  <strong className="text-slate-700">.txt</strong>,{' '}
                  <strong className="text-slate-700">.md</strong> · Tối đa 150.000 ký tự mỗi lượt kiểm tra
                </p>
              </div>
            )}

            <button
              type="button"
              disabled={loadingFile || analyzing}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white text-slate-900 border border-zinc-200 hover:border-indigo-300 hover:text-[#4338CA] rounded-xl shadow-2xs disabled:opacity-50"
            >
              <FolderUp className="w-3.5 h-3.5 text-[#4338CA]" />
              <span>{uploadedFileName ? 'Đổi tệp khác' : 'Chọn tệp từ máy tính'}</span>
            </button>
          </div>

          {/* Filter Options + Primary Action Bar */}
          <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeReferences}
                  onChange={(e) => setExcludeReferences(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-[#4338CA] focus:ring-[#4338CA]"
                />
                <span>Loại trừ Tài liệu tham khảo (Bibliography)</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeQuotes}
                  onChange={(e) => setExcludeQuotes(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-[#4338CA] focus:ring-[#4338CA]"
                />
                <span>Loại trừ Trích dẫn trong ngoặc kép (Quotes)</span>
              </label>
            </div>

            <button
              type="button"
              disabled={analyzing || textInput.trim().length < 40}
              onClick={() => void handleRunScan()}
              className="btn-press inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold bg-[#4338CA] text-white rounded-xl hover:bg-[#3730A3] disabled:opacity-45 shadow-[0_6px_18px_rgb(67,56,202,0.22)] min-w-[230px]"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang phân tích tài liệu...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="w-4 h-4" />
                  <span>Quét Đạo văn &amp; Kiểm định AI</span>
                </>
              )}
            </button>
          </div>

          {/* Live 3-Step Scanning Progress Strip */}
          {analyzing && (
            <div className="popover-enter bg-indigo-50/60 border border-indigo-200/80 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {scanStepsMeta.map((item) => {
                const isDone = scanStep > item.step;
                const isCurrent = scanStep === item.step;
                return (
                  <div
                    key={item.step}
                    className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                      isCurrent
                        ? 'bg-white border-indigo-300 text-[#4338CA] font-semibold shadow-2xs'
                        : isDone
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 font-medium'
                        : 'bg-white/60 border-zinc-200/70 text-zinc-500'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-zinc-200 text-[10px] font-mono flex items-center justify-center shrink-0">
                        {item.step}
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Dual Integrity Studio Report */}
      {report && (
        <div className="surface-enter space-y-5">
          {/* Report Top Reference Disclaimer Ribbon */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 text-xs">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong className="text-amber-300">Báo cáo tham khảo sơ bộ:</strong>{' '}
                Các chỉ số phần trăm bên dưới chỉ dùng để tham khảo nhanh, có thể chênh lệch so với Turnitin bản quyền của trường học.
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
              ID: {report.reportId}
            </span>
          </div>

          {/* Executive Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Similarity Index */}
            <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 flex items-center gap-4 shadow-[0_4px_16px_rgb(15,23,42,0.03)]">
              <RadialScoreRing
                percent={report.overallSimilarityPercent}
                colorHex={simStatusMeta.color}
                label="Similarity"
              />
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">
                    Trùng lặp (Tham khảo)
                  </span>
                </div>
                <span
                  className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${simStatusMeta.badgeCls}`}
                >
                  {simStatusMeta.badge}
                </span>
                <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                  Học thuật: {report.publicationsSimilarityPercent}% · Web:{' '}
                  {report.internetSimilarityPercent}%
                </div>
              </div>
            </div>

            {/* Card 2: AI Probability */}
            <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 flex items-center gap-4 shadow-[0_4px_16px_rgb(15,23,42,0.03)]">
              <RadialScoreRing
                percent={report.overallAiPercent}
                colorHex={aiStatusMeta.color}
                label="AI Score"
              />
              <div className="min-w-0 space-y-1.5">
                <div className="text-xs font-bold text-slate-900">
                  Xác suất AI (Tham khảo)
                </div>
                <span
                  className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${aiStatusMeta.badgeCls}`}
                >
                  {aiStatusMeta.badge}
                </span>
                <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                  {report.forensics.highAiSentenceCount} AI cao ·{' '}
                  {report.forensics.mixedAiSentenceCount} pha trộn ·{' '}
                  {report.forensics.humanSentenceCount} tự nhiên
                </div>
              </div>
            </div>

            {/* Card 3: Report Meta & Print PDF */}
            <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 flex flex-col justify-between gap-3.5 shadow-[0_4px_16px_rgb(15,23,42,0.03)]">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Quy mô phân tích</span>
                  <span className="font-mono tabular-nums">
                    {new Date(report.analyzedAt).toLocaleTimeString('vi-VN')}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                  {report.analyzedWords.toLocaleString('vi-VN')} /{' '}
                  {report.totalWords.toLocaleString('vi-VN')} từ
                </div>
                <div className="text-[11px] text-zinc-500">
                  {report.totalSentences} câu · {report.sources.length} nguồn đối chiếu phát hiện
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrintReport}
                className="btn-press w-full py-2.5 px-3.5 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-xl inline-flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In / Xuất Báo cáo PDF (Tham khảo)</span>
              </button>
            </div>
          </div>

          {/* Layer Filter Bar */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-500 mr-1.5">
                Lớp hiển thị:
              </span>
              {(
                [
                  { key: 'combined', label: 'Kết hợp (Đạo văn + AI)' },
                  { key: 'similarity', label: 'Chỉ lớp Đạo văn' },
                  { key: 'ai', label: 'Chỉ lớp AI Detection' },
                ] as { key: HighlightLayerMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setLayerMode(opt.key)}
                  className={`btn-press px-3 py-1.5 text-xs font-semibold rounded-lg ${
                    layerMode === opt.key
                      ? 'bg-[#4338CA] text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/25 border border-rose-500" />
                Trùng nguồn
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-300/60 border border-amber-500" />
                AI cao (&ge;65%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-violet-200/75 border border-violet-400" />
                Pha trộn (38–64%)
              </span>
            </div>
          </div>

          {/* 2-Column Studio Grid: Highlighted Document (Left 7) + Sticky Inspector Sidebar (Right 5) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT: Interactive Highlighted A4 Document Viewer */}
            <div className="lg:col-span-7 bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-9 shadow-[0_6px_24px_rgb(15,23,42,0.03)] space-y-5">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4338CA] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 truncate">
                      {report.title}
                    </h2>
                    <p className="text-[11px] text-zinc-500">
                      Bấm vào từng câu bất kỳ để xem chi tiết phân tích bên cột phải
                    </p>
                  </div>
                </div>
                {activeSourceFilterId !== null && (
                  <button
                    type="button"
                    onClick={() => setActiveSourceFilterId(null)}
                    className="btn-press px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 text-[#4338CA] border border-indigo-200 rounded-lg shrink-0"
                  >
                    Đang lọc Nguồn #{activeSourceFilterId} · Bỏ lọc
                  </button>
                )}
              </div>

              <div className="space-y-4 text-[14px] leading-[1.85] text-slate-900">
                {paragraphsGrouped.map((sents, pIdx) => (
                  <p key={pIdx}>
                    {sents.map((s) => {
                      const isExcluded =
                        s.isExcludedReference || s.isExcludedQuote;
                      const isSelected = selectedSentenceId === s.id;
                      const showSim =
                        (layerMode === 'combined' ||
                          layerMode === 'similarity') &&
                        s.matchedSourceId !== null &&
                        (activeSourceFilterId === null ||
                          activeSourceFilterId === s.matchedSourceId);
                      const showAi =
                        (layerMode === 'combined' || layerMode === 'ai') &&
                        !isExcluded &&
                        (s.aiLevel === 'ai_high' || s.aiLevel === 'mixed');

                      const srcColor =
                        s.matchedSourceId !== null
                          ? sourceColorMap.get(s.matchedSourceId) || '#DC2626'
                          : '#DC2626';

                      let inlineStyle: React.CSSProperties | undefined;
                      let extraCls =
                        'rounded px-0.5 py-0.5 transition-colors duration-150 cursor-pointer ';

                      if (isExcluded) {
                        extraCls += 'text-zinc-400 italic';
                      } else if (showSim) {
                        inlineStyle = {
                          backgroundColor: `${srcColor}18`,
                          borderBottom: `2px solid ${srcColor}`,
                        };
                      } else if (showAi) {
                        extraCls +=
                          s.aiLevel === 'ai_high'
                            ? 'bg-amber-100/90 border-b-2 border-amber-500'
                            : 'bg-violet-100/75 border-b border-violet-400';
                      } else {
                        extraCls += 'hover:bg-zinc-100/80';
                      }

                      if (isSelected) {
                        extraCls += ' ring-2 ring-[#4338CA]';
                      }

                      return (
                        <span key={s.id}>
                          <span
                            onClick={() => setSelectedSentenceId(s.id)}
                            style={inlineStyle}
                            className={extraCls}
                            title={
                              isExcluded
                                ? 'Đã loại trừ khỏi tỷ lệ kiểm tra'
                                : `AI (tham khảo): ${s.aiProbability}%${
                                    s.matchedSourceId !== null
                                      ? ` · Trùng Nguồn #${s.matchedSourceId} (${s.matchSimilarity}%)`
                                      : ''
                                  }`
                            }
                          >
                            {showSim && s.matchedSourceId !== null && (
                              <sup
                                style={{ backgroundColor: srcColor }}
                                className="text-white text-[9px] font-bold px-1 py-0.2 rounded mr-1 select-none"
                              >
                                {s.matchedSourceId}
                              </sup>
                            )}
                            {s.text}
                          </span>{' '}
                        </span>
                      );
                    })}
                  </p>
                ))}
              </div>
            </div>

            {/* RIGHT: Sticky Inspector Sidebar (Sources & AI Forensics) */}
            <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
              {selectedSentence && (
                <div className="popover-enter bg-white border border-indigo-200 rounded-2xl p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#4338CA]">
                      Phân tích chi tiết câu đang chọn
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedSentenceId(null)}
                      className="text-[11px] font-medium text-zinc-400 hover:text-zinc-700"
                    >
                      Đóng
                    </button>
                  </div>
                  <p className="text-xs text-slate-800 bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 leading-relaxed">
                    "{selectedSentence.text}"
                  </p>
                  {selectedSentence.isExcludedReference ||
                  selectedSentence.isExcludedQuote ? (
                    <p className="text-xs text-zinc-500 italic">
                      Câu này nằm trong phần{' '}
                      {selectedSentence.isExcludedReference
                        ? 'Tài liệu tham khảo'
                        : 'Trích dẫn trong ngoặc kép'}{' '}
                      nên đã được loại trừ theo bộ lọc.
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-600">
                          Xác suất AI (tham khảo):
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {selectedSentence.aiProbability}%
                        </span>
                      </div>
                      {selectedSentence.matchedSourceId !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-600">Nguồn đối chiếu:</span>
                          <span className="font-mono font-bold text-rose-600 tabular-nums">
                            Nguồn #{selectedSentence.matchedSourceId} (
                            {selectedSentence.matchSimilarity}%)
                          </span>
                        </div>
                      )}
                      <ul className="list-disc pl-4 text-[11px] text-zinc-600 space-y-1 pt-1">
                        {selectedSentence.aiReasons.map((reason, rIdx) => (
                          <li key={rIdx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Sidebar Tabs */}
              <div className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-[0_4px_16px_rgb(15,23,42,0.03)]">
                <div className="p-1.5 bg-zinc-100/80 border-b border-zinc-200 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setSidebarTab('sources')}
                    className={`btn-press py-2 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 ${
                      sidebarTab === 'sources'
                        ? 'bg-white text-[#4338CA] shadow-2xs'
                        : 'text-zinc-600 hover:text-slate-900'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Nguồn trùng ({report.sources.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab('ai_forensics')}
                    className={`btn-press py-2 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 ${
                      sidebarTab === 'ai_forensics'
                        ? 'bg-white text-[#4338CA] shadow-2xs'
                        : 'text-zinc-600 hover:text-slate-900'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Phân tích AI ({report.overallAiPercent}%)</span>
                  </button>
                </div>

                {sidebarTab === 'sources' ? (
                  <div className="tab-panel-enter p-4 space-y-3 max-h-[600px] overflow-y-auto">
                    {report.sources.length === 0 ? (
                      <div className="py-10 text-center space-y-2.5">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mx-auto">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-900">
                          Không phát hiện đoạn trùng lặp đáng kể
                        </p>
                        <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                          Hệ thống đã đối chiếu với nguồn mở Crossref, OpenAlex và Wikipedia. Kết quả chỉ mang tính tham khảo sơ bộ.
                        </p>
                      </div>
                    ) : (
                      report.sources.map((src) => {
                        const isFiltered = activeSourceFilterId === src.id;
                        return (
                          <div
                            key={src.id}
                            onClick={() =>
                              setActiveSourceFilterId(
                                isFiltered ? null : src.id
                              )
                            }
                            className={`card-interactive p-3.5 rounded-xl border cursor-pointer space-y-2 ${
                              isFiltered
                                ? 'border-[#4338CA] bg-indigo-50/40 ring-2 ring-indigo-500/10'
                                : 'border-zinc-200 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <span
                                  style={{ backgroundColor: src.badgeColor }}
                                  className="text-white text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0"
                                >
                                  {src.id}
                                </span>
                                <div className="min-w-0">
                                  <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                                    {src.title}
                                  </h3>
                                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                                    {src.authorOrVenue}
                                    {src.year ? ` (${src.year})` : ''}
                                  </p>
                                </div>
                              </div>
                              <span className="font-mono text-xs font-extrabold text-slate-900 shrink-0 tabular-nums">
                                {src.similarityPercent}%
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-zinc-100 text-[11px]">
                              <span className="text-zinc-500">
                                {src.sourceType === 'internet'
                                  ? 'Nguồn Internet'
                                  : 'Tạp chí / Học thuật'}{' '}
                                · {src.matchedWordCount} từ (
                                {src.matchedSentenceCount} câu)
                              </span>
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 font-semibold text-[#4338CA] hover:underline shrink-0"
                              >
                                <span>Xem nguồn</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="tab-panel-enter p-4 space-y-4">
                    <div className="space-y-3.5">
                      <MetricProgressBar
                        label="Độ biến thiên độ dài câu (Burstiness)"
                        value={report.forensics.burstinessScore}
                        barColor="#16A34A"
                        hint={`Trung bình ${report.forensics.avgSentenceLengthWords} từ/câu · Độ lệch chuẩn ${report.forensics.sentenceLengthStdDev} (cao = giống người viết).`}
                      />

                      <MetricProgressBar
                        label="Độ đa dạng từ vựng (Lexical Entropy)"
                        value={report.forensics.lexicalDiversityScore}
                        barColor="#4338CA"
                        hint="Mức độ phong phú vốn từ tự nhiên so với độ dài toàn bài."
                      />

                      <MetricProgressBar
                        label="Độ đồng nhất cấu trúc (Robotic Uniformity)"
                        value={report.forensics.structuralUniformityScore}
                        barColor="#D97706"
                        hint="Mức độ đều đặn lặp đi lặp lại của cấu trúc đoạn (cao = nghi ngờ AI)."
                      />

                      <MetricProgressBar
                        label="Mật độ cụm từ đặc trưng AI"
                        value={report.forensics.aiPhraseDensityScore}
                        barColor="#DC2626"
                        hint="Tần suất xuất hiện các cụm từ chuyển ý/khuôn mẫu thường gặp ở LLM."
                      />
                    </div>

                    {report.detectedAiPhrases.length > 0 && (
                      <div className="pt-3.5 border-t border-zinc-100 space-y-2">
                        <div className="text-xs font-bold text-slate-900">
                          Cụm từ dấu hiệu AI phát hiện trong bài:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {report.detectedAiPhrases.map((p) => (
                            <span
                              key={p.phrase}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono bg-amber-50 text-amber-900 border border-amber-200 rounded-md"
                            >
                              <span>{p.phrase}</span>
                              <span className="font-bold text-amber-700">
                                ×{p.count}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
