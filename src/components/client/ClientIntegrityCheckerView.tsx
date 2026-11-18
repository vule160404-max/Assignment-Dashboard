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
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  AnalyzedSentence,
  IntegrityAnalysisReport,
  SAMPLE_ACADEMIC_TEXT,
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
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative w-22 h-22 shrink-0 flex items-center justify-center">
      <svg className="w-22 h-22 -rotate-90" viewBox="0 0 84 84">
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke="#E4E4E7"
          strokeWidth="7"
        />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke={colorHex}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 550ms cubic-bezier(0.23, 1, 0.32, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900">
          {clamped}%
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
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
    <div className="space-y-1">
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
      <p className="text-[11px] text-zinc-500">{hint}</p>
    </div>
  );
}

export function ClientIntegrityCheckerView({
  onToast,
}: ClientIntegrityCheckerViewProps) {
  const [title, setTitle] = useState('');
  const [textInput, setTextInput] = useState('');
  const [excludeReferences, setExcludeReferences] = useState(true);
  const [excludeQuotes, setExcludeQuotes] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [scanStageText, setScanStageText] = useState('');
  const [report, setReport] = useState<IntegrityAnalysisReport | null>(null);
  const [layerMode, setLayerMode] = useState<HighlightLayerMode>('combined');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('sources');
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(
    null
  );
  const [activeSourceFilterId, setActiveSourceFilterId] = useState<number | null>(
    null
  );

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
      if (!title.trim()) {
        setTitle(file.name.replace(/\.(docx|txt|md)$/i, ''));
      }
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
    setScanStageText('1/3 Đang tách đoạn, nhận diện câu & lọc trích dẫn...');
    const t1 = window.setTimeout(() => {
      setScanStageText(
        '2/3 Đang đối chiếu Crossref, OpenAlex & cơ sở dữ liệu Internet...'
      );
    }, 650);
    const t2 = window.setTimeout(() => {
      setScanStageText(
        '3/3 Đang chấm điểm Burstiness, Lexical Entropy & AI Forensics...'
      );
    }, 1500);

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
        `Hoàn tất kiểm định (${result.overallSimilarityPercent}% Trùng lặp · ${result.overallAiPercent}% AI).`
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
      setScanStageText('');
    }
  };

  const handlePrintReport = () => {
    if (!report) return;
    const opened = openPrintableIntegrityReport(report);
    if (!opened) {
      onToast('Trình duyệt đang chặn cửa sổ bật lên (Pop-up). Hãy cho phép mở tab in.');
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
        badge: 'Mức độ trùng lặp Cao',
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
      badge: 'Mức trùng lặp An toàn',
      badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }, [report?.overallSimilarityPercent]);

  const aiStatusMeta = useMemo(() => {
    const score = report?.overallAiPercent ?? 0;
    if (score >= 60) {
      return {
        color: '#D97706',
        badge: 'Khả năng cao do AI tạo',
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
      badge: 'Văn phong Tự nhiên (Người viết)',
      badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }, [report?.overallAiPercent]);

  return (
    <div className="space-y-6">
      {/* Top Hero & Input Workbench */}
      <section className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-7 shadow-[0_8px_28px_rgb(15,23,42,0.03)] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-[11px] font-semibold text-[#4338CA]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Hệ thống Đối chiếu Học thuật & AI Forensics</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Kiểm tra Đạo văn (Similarity) & Nhận diện Văn bản AI
            </h1>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Tải lên file Word (`.docx`) hoặc dán trực tiếp bài viết. Hệ thống tự động truy vấn đối chiếu với hàng trăm triệu bài báo khoa học trên{' '}
              <strong className="text-slate-800">Crossref, OpenAlex &amp; Internet</strong>, đồng thời phân tích độ biến thiên câu (Burstiness) và dấu vết ngôn ngữ AI ở cấp độ từng câu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.txt,.md"
              className="hidden"
              onChange={(e) => void handleUploadDocument(e.target.files)}
            />
            <button
              type="button"
              disabled={loadingFile || analyzing}
              onClick={() => fileInputRef.current?.click()}
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-indigo-50 text-[#4338CA] border border-indigo-200 hover:bg-indigo-100 rounded-xl disabled:opacity-50"
            >
              {loadingFile ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FolderUp className="w-3.5 h-3.5" />
              )}
              <span>Tải file .DOCX / .TXT</span>
            </button>

            <button
              type="button"
              disabled={analyzing}
              onClick={() => {
                setTitle('Financial Inclusion in Southeast Asian Rural Areas');
                setTextInput(SAMPLE_ACADEMIC_TEXT);
                setReport(null);
              }}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-100 text-slate-800 hover:bg-zinc-200/80 rounded-xl"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#4338CA]" />
              <span>Thử bằng bài mẫu</span>
            </button>

            {textInput.trim() && (
              <button
                type="button"
                disabled={analyzing}
                onClick={() => {
                  setTitle('');
                  setTextInput('');
                  setReport(null);
                  setSelectedSentenceId(null);
                }}
                className="btn-press inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-zinc-500 hover:text-slate-900 hover:bg-zinc-100 rounded-xl"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa trắng</span>
              </button>
            )}
          </div>
        </div>

        {/* Title + Textarea */}
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề bài viết / Tên tài liệu (không bắt buộc)..."
            className="w-full px-3.5 py-2 text-xs sm:text-sm font-semibold bg-zinc-50/90 border border-zinc-200 rounded-xl text-slate-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
          />

          <div className="relative">
            <textarea
              rows={8}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Dán nội dung bài làm hoặc nhấn nút 'Tải file .DOCX / .TXT' ở góc trên (tối thiểu 40 ký tự)..."
              className="w-full p-4 text-xs sm:text-sm leading-relaxed bg-zinc-50/80 border border-zinc-200 rounded-xl text-slate-900 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={excludeReferences}
                    onChange={(e) => setExcludeReferences(e.target.checked)}
                    className="rounded border-zinc-300 text-[#4338CA] focus:ring-[#4338CA]"
                  />
                  <span>Loại trừ Danh mục Tài liệu tham khảo (Bibliography)</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={excludeQuotes}
                    onChange={(e) => setExcludeQuotes(e.target.checked)}
                    className="rounded border-zinc-300 text-[#4338CA] focus:ring-[#4338CA]"
                  />
                  <span>Loại trừ Trích dẫn trong ngoặc kép (Quotes)</span>
                </label>
              </div>

              <span className="font-mono tabular-nums">
                {inputWords.toLocaleString('vi-VN')} từ ·{' '}
                {textInput.length.toLocaleString('vi-VN')} ký tự
              </span>
            </div>
          </div>
        </div>

        {/* Submit CTA & Progress */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#4338CA] shrink-0" />
            <span>
              {analyzing && scanStageText
                ? scanStageText
                : 'Kết quả hiển thị trực quan từng câu trùng nguồn và điểm AI giống báo cáo Turnitin.'}
            </span>
          </div>

          <button
            type="button"
            disabled={analyzing || textInput.trim().length < 40}
            onClick={() => void handleRunScan()}
            className="btn-press inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#4338CA] text-white rounded-xl hover:bg-[#3730A3] disabled:opacity-45 shadow-xs"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang kiểm định...</span>
              </>
            ) : (
              <>
                <FileCheck2 className="w-4 h-4" />
                <span>Quét Đạo văn &amp; Kiểm định AI</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Dual Integrity Studio Report */}
      {report && (
        <div className="surface-enter space-y-5">
          {/* Executive Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Similarity Index */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-2xs">
              <RadialScoreRing
                percent={report.overallSimilarityPercent}
                colorHex={simStatusMeta.color}
                label="Similarity"
              />
              <div className="min-w-0 space-y-1.5">
                <div className="text-xs font-bold text-slate-900">
                  Chỉ số Trùng lặp (Đạo văn)
                </div>
                <span
                  className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${simStatusMeta.badgeCls}`}
                >
                  {simStatusMeta.badge}
                </span>
                <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                  Tạp chí/Sách: {report.publicationsSimilarityPercent}% · Web:{' '}
                  {report.internetSimilarityPercent}%
                </div>
              </div>
            </div>

            {/* Card 2: AI Probability */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-2xs">
              <RadialScoreRing
                percent={report.overallAiPercent}
                colorHex={aiStatusMeta.color}
                label="AI Score"
              />
              <div className="min-w-0 space-y-1.5">
                <div className="text-xs font-bold text-slate-900">
                  Xác suất Văn bản AI
                </div>
                <span
                  className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${aiStatusMeta.badgeCls}`}
                >
                  {aiStatusMeta.badge}
                </span>
                <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                  {report.forensics.highAiSentenceCount} câu AI cao ·{' '}
                  {report.forensics.mixedAiSentenceCount} pha trộn ·{' '}
                  {report.forensics.humanSentenceCount} tự nhiên
                </div>
              </div>
            </div>

            {/* Card 3: Report Meta & Print PDF */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    Mã báo cáo: <strong className="text-slate-900">{report.reportId}</strong>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-0.5">
                    Đã phân tích {report.analyzedWords.toLocaleString('vi-VN')} /{' '}
                    {report.totalWords.toLocaleString('vi-VN')} từ
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {report.sources.length} nguồn đối chiếu ·{' '}
                    {new Date(report.analyzedAt).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePrintReport}
                className="btn-press w-full py-2 px-3 text-xs font-semibold bg-zinc-900 text-white hover:bg-slate-800 rounded-xl inline-flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In / Xuất Báo cáo PDF chuẩn</span>
              </button>
            </div>
          </div>

          {/* Layer Filter Bar */}
          <div className="bg-white border border-zinc-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-zinc-600 mr-1">
                Lớp hiển thị:
              </span>
              {(
                [
                  { key: 'combined', label: 'Kết hợp (Đạo văn + AI)' },
                  { key: 'similarity', label: 'Chỉ lớp Đạo văn (Similarity)' },
                  { key: 'ai', label: 'Chỉ lớp AI Detection' },
                ] as { key: HighlightLayerMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setLayerMode(opt.key)}
                  className={`btn-press px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    layerMode === opt.key
                      ? 'bg-[#4338CA] text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/25 border border-rose-500" />
                Trùng nguồn
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-300/60 border border-amber-500" />
                AI cao (&ge;65%)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-violet-200/70 border border-violet-400" />
                Pha trộn (38–64%)
              </span>
            </div>
          </div>

          {/* 2-Column Studio Grid: Highlighted Document (Left) + Inspector Sidebar (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT: Interactive Highlighted Document Viewer */}
            <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-2xs space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-[#4338CA] shrink-0" />
                  <h2 className="text-sm font-bold text-slate-900 truncate">
                    {report.title}
                  </h2>
                </div>
                {activeSourceFilterId !== null && (
                  <button
                    type="button"
                    onClick={() => setActiveSourceFilterId(null)}
                    className="btn-press px-2 py-0.5 text-[11px] font-medium bg-indigo-50 text-[#4338CA] rounded-md shrink-0"
                  >
                    Đang lọc Nguồn #{activeSourceFilterId} · Bỏ lọc
                  </button>
                )}
              </div>

              <div className="space-y-4 text-[13.5px] leading-[1.8] text-slate-900">
                {paragraphsGrouped.map((sents, pIdx) => (
                  <p key={pIdx}>
                    {sents.map((s) => {
                      const isExcluded =
                        s.isExcludedReference || s.isExcludedQuote;
                      const isSelected = selectedSentenceId === s.id;
                      const showSim =
                        (layerMode === 'combined' || layerMode === 'similarity') &&
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
                        'rounded px-0.5 py-0.5 transition-colors cursor-pointer ';

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
                                : `AI: ${s.aiProbability}%${
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

            {/* RIGHT: Inspector Sidebar (Sources & AI Forensics) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Selected Sentence Inspector (when user clicks any sentence) */}
              {selectedSentence && (
                <div className="popover-enter bg-white border border-indigo-200 rounded-2xl p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#4338CA]">
                      Chi tiết câu đang chọn
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedSentenceId(null)}
                      className="text-[11px] text-zinc-400 hover:text-zinc-700"
                    >
                      Đóng
                    </button>
                  </div>
                  <p className="text-xs text-slate-800 bg-zinc-50 border border-zinc-200/80 rounded-lg p-2.5 leading-relaxed">
                    "{selectedSentence.text}"
                  </p>
                  {selectedSentence.isExcludedReference ||
                  selectedSentence.isExcludedQuote ? (
                    <p className="text-xs text-zinc-500 italic">
                      Câu này nằm trong phần{' '}
                      {selectedSentence.isExcludedReference
                        ? 'Tài liệu tham khảo'
                        : 'Trích dẫn trong ngoặc kép'}{' '}
                      nên được loại trừ theo bộ lọc.
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-600">Xác suất AI của câu:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {selectedSentence.aiProbability}%
                        </span>
                      </div>
                      {selectedSentence.matchedSourceId !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-600">Trùng khớp nguồn:</span>
                          <span className="font-mono font-bold text-rose-600">
                            Nguồn #{selectedSentence.matchedSourceId} (
                            {selectedSentence.matchSimilarity}%)
                          </span>
                        </div>
                      )}
                      <ul className="list-disc pl-4 text-[11px] text-zinc-600 space-y-0.5 pt-1">
                        {selectedSentence.aiReasons.map((reason, rIdx) => (
                          <li key={rIdx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Sidebar Tabs */}
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs">
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
                  <div className="tab-panel-enter p-4 space-y-3 max-h-[640px] overflow-y-auto">
                    {report.sources.length === 0 ? (
                      <div className="py-10 text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                        <p className="text-xs font-semibold text-slate-900">
                          Không tìm thấy đoạn trùng lặp nguyên văn
                        </p>
                        <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                          Hệ thống đã đối chiếu câu trích xuất với Crossref, OpenAlex và Wikipedia nhưng không có đoạn nào vượt ngưỡng trùng lặp.
                        </p>
                      </div>
                    ) : (
                      report.sources.map((src) => {
                        const isFiltered = activeSourceFilterId === src.id;
                        return (
                          <div
                            key={src.id}
                            onClick={() =>
                              setActiveSourceFilterId(isFiltered ? null : src.id)
                            }
                            className={`card-interactive p-3 rounded-xl border cursor-pointer space-y-1.5 ${
                              isFiltered
                                ? 'border-[#4338CA] bg-indigo-50/40 ring-2 ring-indigo-500/10'
                                : 'border-zinc-200 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 min-w-0">
                                <span
                                  style={{ backgroundColor: src.badgeColor }}
                                  className="text-white text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0"
                                >
                                  {src.id}
                                </span>
                                <div className="min-w-0">
                                  <h3 className="text-xs font-bold text-slate-900 line-clamp-2">
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

                            <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                              <span className="text-zinc-500">
                                {src.sourceType === 'internet'
                                  ? 'Nguồn Internet'
                                  : 'Tạp chí / Học thuật'}{' '}
                                · {src.matchedWordCount} từ ({src.matchedSentenceCount} câu)
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
                    <div className="space-y-3">
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
                        hint="Tỷ lệ từ vựng phong phú tự nhiên so với độ dài toàn bài."
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
                        hint="Tần suất xuất hiện các cụm từ chuyển ý/sáo rỗng phổ biến của LLM."
                      />
                    </div>

                    {report.detectedAiPhrases.length > 0 && (
                      <div className="pt-3 border-t border-zinc-100 space-y-2">
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
