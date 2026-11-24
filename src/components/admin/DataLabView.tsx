import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  Info,
  Plus,
  RefreshCw,
  Send,
  Sliders,
  Sparkles,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  LikertConstruct,
  SurveyProject,
} from '../../types/dataLab';
import {
  buildApaStatsReportText,
  createDefaultSurveyProject,
  exportSurveyProjectToCsv,
  fmtNum,
  fmtP,
  generateSyntheticDataset,
  parseCsvIntoSurveyRows,
  runFullSurveyAnalysis,
} from '../../lib/statsEngine';
import {
  GeneratedDataChart,
  renderConstructMeansChart,
  renderDemographicChart,
  renderRegressionBetaChart,
} from '../../lib/dataLabCharts';
import { copyTextToClipboard } from '../../lib/utils';

const DATA_LAB_STORAGE_KEY = 'assigntrack_data_lab_project_v1';
const DATA_LAB_GUIDE_KEY = 'assigntrack_data_lab_guide_open_v1';

type DataLabSubTab = 'design' | 'sheet' | 'stats' | 'charts';

export interface DataLabAiWriterPayload {
  reportTitle: string;
  reportText: string;
  charts: GeneratedDataChart[];
}

interface DataLabViewProps {
  onPushToAiWriter: (payload: DataLabAiWriterPayload) => void;
  onToast: (msg: string) => void;
}

function loadSavedProject(): SurveyProject {
  try {
    const raw = localStorage.getItem(DATA_LAB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SurveyProject;
      if (parsed && Array.isArray(parsed.constructs) && Array.isArray(parsed.rows)) {
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return createDefaultSurveyProject();
}

export function DataLabView({ onPushToAiWriter, onToast }: DataLabViewProps) {
  const [project, setProject] = useState<SurveyProject>(loadSavedProject);
  const [subTab, setSubTab] = useState<DataLabSubTab>('stats');
  const [showGuide, setShowGuide] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(DATA_LAB_GUIDE_KEY);
      if (saved === '0') return false;
      return true;
    } catch {
      return true;
    }
  });
  const [synthSize, setSynthSize] = useState(200);
  const [copiedApa, setCopiedApa] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const toggleGuide = () => {
    setShowGuide((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DATA_LAB_GUIDE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  // New construct form state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'independent' | 'dependent'>('independent');
  const [newItemCount, setNewItemCount] = useState(3);

  useEffect(() => {
    try {
      localStorage.setItem(DATA_LAB_STORAGE_KEY, JSON.stringify(project));
    } catch {
      // ignore quota errors
    }
  }, [project]);

  const analysis = useMemo(() => runFullSurveyAnalysis(project), [project]);

  const charts = useMemo<GeneratedDataChart[]>(() => {
    if (analysis.validN < 3) return [];
    const list: GeneratedDataChart[] = [];
    try {
      const c1 = renderDemographicChart(analysis);
      if (c1) list.push(c1);
      const c2 = renderConstructMeansChart(project, analysis);
      if (c2) list.push(c2);
      const c3 = renderRegressionBetaChart(analysis);
      if (c3) list.push(c3);
    } catch {
      // ignore canvas errors in headless environments
    }
    return list;
  }, [project, analysis]);

  const apaReportText = useMemo(
    () => buildApaStatsReportText(project, analysis),
    [project, analysis]
  );

  const handleGenerateSynthetic = () => {
    const nextRows = generateSyntheticDataset(project, synthSize);
    setProject((prev) => ({
      ...prev,
      rows: nextRows,
      updatedAt: new Date().toISOString(),
    }));
    onToast(`Đã tạo bộ dữ liệu mô phỏng kiểm thử N = ${nextRows.length} mẫu.`);
  };

  const handleUploadCsv = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const { rows, matchedColumns } = parseCsvIntoSurveyRows(text, project);
      if (matchedColumns === 0) {
        onToast(
          'Không tìm thấy cột nào khớp mã biến (VD: CL1, HL1, GioiTinh). Hãy tải file CSV mẫu để xem tên cột chuẩn.'
        );
        return;
      }
      setProject((prev) => ({
        ...prev,
        rows,
        updatedAt: new Date().toISOString(),
      }));
      onToast(
        `Đã nhập ${rows.length} dòng dữ liệu từ "${file.name}" (${matchedColumns} cột khớp mã biến).`
      );
      setSubTab('stats');
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Không thể đọc tệp CSV tải lên.'
      );
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleDownloadCsv = () => {
    const csv = exportSurveyProjectToCsv(project);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AssignTrack_Survey_N${project.rows.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Đã tải xuống file dữ liệu .CSV chuẩn Excel/SPSS.');
  };

  const handleCleanBadRows = () => {
    const badIds = new Set(analysis.straightLinerIds);
    const allItemCodes = project.constructs.flatMap((c) =>
      c.items.map((it) => it.code)
    );
    const cleaned = project.rows.filter((row) => {
      if (badIds.has(row.id)) return false;
      return allItemCodes.every(
        (code) =>
          typeof row.values[code] === 'number' &&
          Number.isFinite(row.values[code])
      );
    });
    const removed = project.rows.length - cleaned.length;
    setProject((prev) => ({
      ...prev,
      rows: cleaned,
      updatedAt: new Date().toISOString(),
    }));
    onToast(
      removed > 0
        ? `Đã làm sạch ${removed} dòng dữ liệu thiếu hoặc trả lời 1 mức cố định.`
        : 'Dữ liệu hiện tại đã sạch, không có dòng lỗi.'
    );
  };

  const handleAddConstruct = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    if (!cleanCode || !newName.trim()) {
      onToast('Vui lòng nhập Mã nhân tố (VD: DV) và Tên nhân tố.');
      return;
    }
    if (project.constructs.some((c) => c.code === cleanCode)) {
      onToast(`Mã nhân tố "${cleanCode}" đã tồn tại.`);
      return;
    }
    const count = Math.max(2, Math.min(8, newItemCount));
    const newConstruct: LikertConstruct = {
      id: `c_${Date.now()}`,
      code: cleanCode,
      name: newName.trim(),
      role: newRole,
      items: Array.from({ length: count }, (_, idx) => ({
        code: `${cleanCode}${idx + 1}`,
        label: `Biến quan sát ${cleanCode}${idx + 1} thuộc ${newName.trim()}`,
      })),
    };
    setProject((prev) => {
      const updated = {
        ...prev,
        constructs: [...prev.constructs, newConstruct],
        updatedAt: new Date().toISOString(),
      };
      return {
        ...updated,
        rows: generateSyntheticDataset(updated, Math.max(120, prev.rows.length || 180)),
      };
    });
    setNewCode('');
    setNewName('');
    onToast(`Đã thêm nhân tố ${cleanCode} (${count} biến quan sát) & cập nhật dữ liệu.`);
  };

  const handleCopyApaReport = async () => {
    const ok = await copyTextToClipboard(apaReportText);
    if (ok) {
      setCopiedApa(true);
      onToast('Đã sao chép toàn bộ báo cáo thống kê chuẩn APA vào Clipboard.');
      window.setTimeout(() => setCopiedApa(false), 1800);
    }
  };

  const handlePushAllToWriter = () => {
    onPushToAiWriter({
      reportTitle: `KetQua_KhaoSat_${project.title.slice(0, 32).replace(/\s+/g, '_')}.txt`,
      reportText: apaReportText,
      charts,
    });
  };

  const allItemCodes = useMemo(
    () => project.constructs.flatMap((c) => c.items.map((it) => it.code)),
    [project.constructs]
  );

  return (
    <div className="space-y-5">
      {/* Top Hero / KPI Strip */}
      <section className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#12489B] text-[11px] font-bold">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>AssignTrack Data Lab · Khảo sát &amp; Phân tích Thống kê SPSS/APA</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {project.title}
            </h1>
            <p className="text-xs text-zinc-500">
              Nhập file CSV khảo sát thật hoặc sinh dữ liệu kiểm thử → Tự chạy Cronbach&apos;s Alpha, Pearson, Hồi quy OLS, ANOVA/T-Test, vẽ biểu đồ PNG 2x và đẩy 1 chạm sang AI Writer Studio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleGuide}
              className={`btn-press inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                showGuide
                  ? 'bg-blue-50 border-blue-200 text-[#12489B]'
                  : 'bg-white border-zinc-200 hover:bg-zinc-50 text-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Hướng dẫn</span>
              {showGuide ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-slate-800 text-xs font-semibold"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Xuất .CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePushAllToWriter}
              disabled={analysis.validN < 3}
              className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0B2559] to-[#12489B] hover:from-[#071A42] hover:to-[#0B2559] disabled:opacity-50 text-white text-xs font-bold shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Đẩy sang AI Writer Studio</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-zinc-100">
          <div className="rounded-xl bg-[#F4F7FB] border border-zinc-200/80 px-3.5 py-2.5">
            <div className="text-[11px] text-zinc-500">Cỡ mẫu hợp lệ (N)</div>
            <div className="text-xl font-bold font-mono text-[#0B2559] tabular-nums mt-0.5">
              {analysis.validN}
              <span className="text-xs font-normal text-zinc-400 ml-1">
                / {analysis.totalRows}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-[#F4F7FB] border border-zinc-200/80 px-3.5 py-2.5">
            <div className="text-[11px] text-zinc-500">Cronbach&apos;s Alpha đạt</div>
            <div className="text-xl font-bold font-mono text-emerald-700 tabular-nums mt-0.5">
              {analysis.cronbachResults.filter((c) => c.passed).length}/
              {analysis.cronbachResults.length}
              <span className="text-xs font-normal text-zinc-400 ml-1">nhân tố</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#F4F7FB] border border-zinc-200/80 px-3.5 py-2.5">
            <div className="text-[11px] text-zinc-500">Adjusted R² (Hồi quy)</div>
            <div className="text-xl font-bold font-mono text-[#12489B] tabular-nums mt-0.5">
              {analysis.regression
                ? `${(analysis.regression.adjRSquare * 100).toFixed(1)}%`
                : '—'}
            </div>
          </div>

          <div className="rounded-xl bg-[#F4F7FB] border border-zinc-200/80 px-3.5 py-2.5">
            <div className="text-[11px] text-zinc-500">Giả thuyết chấp nhận</div>
            <div className="text-xl font-bold font-mono text-[#EA580C] tabular-nums mt-0.5">
              {analysis.regression
                ? `${
                    analysis.regression.coefficients.filter((c) => c.supported)
                      .length
                  }/${analysis.regression.coefficients.length}`
                : '—'}
            </div>
          </div>
        </div>
      </section>

      {/* Collapsible Step-by-Step User Guide */}
      {showGuide && (
        <section className="bg-gradient-to-br from-[#F4F7FB] to-white border border-blue-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#0B2559] text-white flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#0B2559]">
                  Hướng dẫn sử dụng nhanh — Quy trình chạy dữ liệu định lượng 4 bước
                </h2>
                <p className="text-[11.5px] text-zinc-500">
                  Mọi tính toán chạy trực tiếp trên trình duyệt theo công thức SPSS/APA. Bấm nút từng bước để chuyển nhanh.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleGuide}
              className="text-xs font-semibold text-zinc-500 hover:text-[#0B2559] px-2.5 py-1 rounded-lg hover:bg-white"
            >
              Ẩn hướng dẫn
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white border border-zinc-200/90 p-3.5 flex flex-col justify-between gap-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#12489B] font-mono text-[11px] font-bold">
                    BƯỚC 1
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubTab('design')}
                    className="text-[11px] font-semibold text-[#12489B] hover:underline"
                  >
                    Mở tab 1 →
                  </button>
                </div>
                <h3 className="text-xs font-bold text-slate-900">
                  Thiết kế mô hình &amp; Nạp dữ liệu
                </h3>
                <p className="text-[11.5px] text-zinc-600 leading-relaxed">
                  Khai báo nhân tố <strong>IV</strong> (độc lập) và <strong>DV</strong> (phụ thuộc), chọn Likert 5/7. Có dữ liệu thật thì tải file <strong>.CSV</strong> lên (bấm <em>Xuất .CSV</em> để xem đúng tên cột chuẩn), hoặc chọn cỡ mẫu <strong>N</strong> rồi bấm <strong>Chạy sinh dữ liệu</strong> để test.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-zinc-200/90 p-3.5 flex flex-col justify-between gap-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#12489B] font-mono text-[11px] font-bold">
                    BƯỚC 2
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubTab('sheet')}
                    className="text-[11px] font-semibold text-[#12489B] hover:underline"
                  >
                    Mở tab 2 →
                  </button>
                </div>
                <h3 className="text-xs font-bold text-slate-900">
                  Kiểm tra &amp; Làm sạch phiếu lỗi
                </h3>
                <p className="text-[11.5px] text-zinc-600 leading-relaxed">
                  Hệ thống tự phát hiện phiếu <strong>thiếu ô trả lời</strong> và phiếu <strong>đánh 1 cột đồng loạt</strong> (straight-liner). Bấm nút <strong>Làm sạch ngay</strong> để lọc bỏ các dòng nhiễu trước khi đọc kết quả.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-zinc-200/90 p-3.5 flex flex-col justify-between gap-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#12489B] font-mono text-[11px] font-bold">
                    BƯỚC 3
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubTab('stats')}
                    className="text-[11px] font-semibold text-[#12489B] hover:underline"
                  >
                    Mở tab 3 →
                  </button>
                </div>
                <h3 className="text-xs font-bold text-slate-900">
                  Đọc bảng kết quả chuẩn SPSS/APA
                </h3>
                <p className="text-[11.5px] text-zinc-600 leading-relaxed">
                  Kiểm tra ngưỡng đạt chuẩn: <strong>Alpha ≥ 0.60</strong>, <strong>Item-Total ≥ 0.30</strong>, <strong>Durbin-Watson 1.5–2.5</strong>, <strong>VIF &lt; 2.0</strong> và <strong>Sig. &lt; 0.05</strong> để chấp nhận giả thuyết. Có nút <strong>Copy toàn bộ bảng APA</strong> dán thẳng vào Word.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-zinc-200/90 p-3.5 flex flex-col justify-between gap-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-orange-50 text-[#EA580C] font-mono text-[11px] font-bold">
                    BƯỚC 4
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubTab('charts')}
                    className="text-[11px] font-semibold text-[#EA580C] hover:underline"
                  >
                    Mở tab 4 →
                  </button>
                </div>
                <h3 className="text-xs font-bold text-slate-900">
                  Xuất biểu đồ &amp; Đẩy sang AI Writer
                </h3>
                <p className="text-[11.5px] text-zinc-600 leading-relaxed">
                  Tải từng biểu đồ PNG độ nét cao hoặc bấm <strong>Đẩy sang AI Writer Studio</strong> để tự động đính kèm báo cáo APA + biểu đồ (<code>IMG_1..IMG_3</code>) vào phiên viết bài, giúp AI viết Chương 4 và chèn hình thẳng vào Word/PDF.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-blue-50/70 border border-blue-200/70 px-3.5 py-2.5 text-[11.5px] text-slate-700">
            <Info className="w-4 h-4 text-[#12489B] shrink-0 mt-0.5" />
            <div>
              <strong>Lưu ý khi nhập file .CSV từ Google Forms / Excel:</strong> Dòng đầu tiên (Header) cần đặt trùng mã biến đã khai báo ở Bước 1 (VD:{' '}
              <code className="px-1 py-0.5 rounded bg-white border border-blue-200 font-mono text-[10.5px]">
                GioiTinh, DoTuoi, CL1, CL2, CL3, HL1, HL2, HL3
              </code>
              ) và câu trả lời thang đo Likert phải ở dạng số (<code>1–5</code> hoặc <code>1–7</code>).
            </div>
          </div>
        </section>
      )}

      {/* 4 Sub-Tab Switcher */}
      <div className="inline-flex flex-wrap items-center gap-1 bg-white border border-zinc-200/90 p-1 rounded-2xl shadow-2xs text-xs font-semibold">
        {[
          { key: 'design' as const, label: '1. Thiết kế & Dữ liệu', icon: Sliders },
          {
            key: 'sheet' as const,
            label: `2. Dữ liệu thô (${project.rows.length})`,
            icon: Database,
          },
          { key: 'stats' as const, label: '3. Kết quả Thống kê (SPSS/APA)', icon: Table2 },
          {
            key: 'charts' as const,
            label: `4. Biểu đồ & Đẩy AI Writer (${charts.length})`,
            icon: BarChart3,
          },
        ].map((t) => {
          const Icon = t.icon;
          const active = subTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key)}
              className={`btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors ${
                active
                  ? 'bg-[#0B2559] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-zinc-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* SUB-TAB 1: DESIGN & DATA SOURCES                                  */}
      {/* ================================================================= */}
      {subTab === 'design' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Model & Constructs */}
          <div className="lg:col-span-7 bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100">
              <h2 className="text-sm font-bold text-slate-900">
                Cấu trúc Bảng hỏi &amp; Thang đo Likert
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-500">Thang Likert:</span>
                {([5, 7] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() =>
                      setProject((p) => ({
                        ...p,
                        likertScale: sc,
                        updatedAt: new Date().toISOString(),
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold ${
                      project.likertScale === sc
                        ? 'bg-[#12489B] text-white'
                        : 'bg-zinc-100 text-slate-600'
                    }`}
                  >
                    1–{sc}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Tên đề tài khảo sát
              </label>
              <input
                type="text"
                value={project.title}
                onChange={(e) =>
                  setProject((p) => ({ ...p, title: e.target.value }))
                }
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-zinc-200 focus:outline-none focus:border-[#12489B]"
              />
            </div>

            <div className="space-y-2.5">
              {project.constructs.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-zinc-200/90 bg-[#F4F7FB]/60 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-[#0B2559] text-white font-mono text-[11px] font-bold">
                        {c.code}
                      </span>
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {c.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.role === 'dependent'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-[#12489B]'
                        }`}
                      >
                        {c.role === 'dependent' ? 'Biến phụ thuộc (Y)' : 'Biến độc lập (X)'}
                      </span>
                    </div>
                    {project.constructs.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setProject((p) => ({
                            ...p,
                            constructs: p.constructs.filter((x) => x.id !== c.id),
                          }))
                        }
                        className="p-1 text-zinc-400 hover:text-rose-600"
                        title="Xóa nhân tố"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.items.map((it) => (
                      <span
                        key={it.code}
                        className="px-2 py-0.5 rounded-md bg-white border border-zinc-200 text-[11px] font-mono text-slate-700"
                        title={it.label}
                      >
                        {it.code}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Add new construct inline */}
            <form
              onSubmit={handleAddConstruct}
              className="pt-3 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
            >
              <div className="sm:col-span-2">
                <label className="block text-[10.5px] font-semibold text-zinc-500 mb-1">
                  Mã (VD: TM)
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="TM"
                  className="w-full px-2.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-zinc-200"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[10.5px] font-semibold text-zinc-500 mb-1">
                  Tên nhân tố
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="VD: Tính tiện lợi"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[10.5px] font-semibold text-zinc-500 mb-1">
                  Vai trò
                </label>
                <select
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(e.target.value as 'independent' | 'dependent')
                  }
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white"
                >
                  <option value="independent">Độc lập (X)</option>
                  <option value="dependent">Phụ thuộc (Y)</option>
                </select>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[10.5px] font-semibold text-zinc-500 mb-1">
                  Số biến
                </label>
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={newItemCount}
                  onChange={(e) => setNewItemCount(Number(e.target.value) || 3)}
                  className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-zinc-200"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="btn-press w-full py-1.5 px-2.5 rounded-lg bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right: Data Import + Synthetic Sandbox */}
          <div className="lg:col-span-5 space-y-4">
            {/* Import CSV */}
            <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#12489B]" />
                <span>Nhập dữ liệu khảo sát thật (.CSV)</span>
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Tải file <code>.csv</code> xuất từ Google Forms hoặc Excel có tên cột khớp mã biến (VD: <code>GioiTinh, DoTuoi, CL1, CL2, HL1...</code>).
              </p>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void handleUploadCsv(e.target.files?.[0])}
                className="hidden"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#12489B] hover:bg-[#0B2559] text-white text-xs font-bold"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn file .CSV tải lên</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-slate-700 text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải file CSV mẫu</span>
                </button>
              </div>
            </div>

            {/* Goal-Seek Backwards Data Engine (Chạy Ngược Số Liệu SPSS theo Kịch Bản) */}
            <div className="bg-gradient-to-br from-[#F4F7FB] to-white border border-blue-200/90 rounded-2xl p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#0B2559] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#EA580C]" />
                  <span>Chạy Ngược Số Liệu theo Kịch Bản (Goal-Seek SPSS)</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#EA580C] font-mono text-[10px] font-bold">
                  Khớp SPSS 100%
                </span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Khóa trước <strong>Adjusted R²</strong>, chọn nhân tố nào <strong>Chấp nhận (Sig. &lt; 0.05)</strong> hoặc <strong>Bác bỏ (Sig. &gt; 0.05)</strong> và sắp xếp thứ tự <strong>Beta chuẩn hóa</strong>. Hệ thống tự giải ngược ra bảng dữ liệu thô <code>.CSV</code> khớp kịch bản Chương 4.
              </p>

              {/* Target Adjusted R2 Slider */}
              <div className="p-3 rounded-xl bg-white border border-zinc-200/90 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    Độ giải thích mô hình mục tiêu (Adjusted R²):
                  </span>
                  <span className="font-mono font-bold text-[#12489B]">
                    {Math.round((project.targetAdjRSquare ?? 0.66) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={0.84}
                  step={0.02}
                  value={project.targetAdjRSquare ?? 0.66}
                  onChange={(e) =>
                    setProject((p) => ({
                      ...p,
                      targetAdjRSquare: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-[#12489B]"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>40% (Vừa phải)</span>
                  <span>65% (Chuẩn luận văn)</span>
                  <span>84% (Rất mạnh)</span>
                </div>
              </div>

              {/* Per-Construct Goal-Seek Controls */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {project.constructs
                  .filter((c) => c.role === 'independent')
                  .map((ic, idx) => {
                    const isSupported = ic.targetSupported !== false;
                    const betaVal =
                      ic.targetBeta ??
                      Number(Math.max(0.14, 0.38 - idx * 0.06).toFixed(2));
                    const meanVal =
                      ic.targetMean ??
                      Number(
                        ((project.likertScale === 7 ? 4.95 : 3.78) - idx * 0.07).toFixed(
                          2
                        )
                      );
                    return (
                      <div
                        key={ic.id}
                        className={`p-2.5 rounded-xl border text-xs space-y-2 ${
                          isSupported
                            ? 'bg-white border-zinc-200/90'
                            : 'bg-zinc-50 border-zinc-200/70 opacity-85'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-[#0B2559] text-white font-mono text-[10.5px] font-bold">
                              {ic.code}
                            </span>
                            <span className="font-bold text-slate-800 truncate">
                              {ic.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setProject((p) => ({
                                ...p,
                                constructs: p.constructs.map((item) =>
                                  item.id === ic.id
                                    ? {
                                        ...item,
                                        targetSupported: !isSupported,
                                      }
                                    : item
                                ),
                              }))
                            }
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border transition-colors shrink-0 ${
                              isSupported
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            }`}
                            title="Bấm để đảo trạng thái Chấp nhận hoặc Bác bỏ giả thuyết của nhân tố này"
                          >
                            {isSupported
                              ? '✓ Chấp nhận (Sig. < 0.05)'
                              : '✕ Bác bỏ (Sig. > 0.05)'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <div>
                            <div className="flex justify-between text-[10.5px] text-zinc-500 mb-0.5">
                              <span>Trọng số Beta:</span>
                              <span className="font-mono font-bold text-[#12489B]">
                                {isSupported ? betaVal.toFixed(2) : '~0.01'}
                              </span>
                            </div>
                            <input
                              type="range"
                              disabled={!isSupported}
                              min={0.12}
                              max={0.58}
                              step={0.02}
                              value={betaVal}
                              onChange={(e) =>
                                setProject((p) => ({
                                  ...p,
                                  constructs: p.constructs.map((item) =>
                                    item.id === ic.id
                                      ? {
                                          ...item,
                                          targetBeta: Number(e.target.value),
                                        }
                                      : item
                                  ),
                                }))
                              }
                              className="w-full accent-[#12489B] disabled:opacity-40"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-[10.5px] text-zinc-500 mb-0.5">
                              <span>Mean mục tiêu:</span>
                              <span className="font-mono font-bold text-slate-700">
                                {meanVal.toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={project.likertScale === 7 ? 3.5 : 2.8}
                              max={project.likertScale === 7 ? 6.2 : 4.45}
                              step={0.05}
                              value={meanVal}
                              onChange={(e) =>
                                setProject((p) => ({
                                  ...p,
                                  constructs: p.constructs.map((item) =>
                                    item.id === ic.id
                                      ? {
                                          ...item,
                                          targetMean: Number(e.target.value),
                                        }
                                      : item
                                  ),
                                }))
                              }
                              className="w-full accent-slate-700"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs font-semibold text-slate-700 shrink-0">
                  Cỡ mẫu (N):
                </label>
                <input
                  type="number"
                  min={30}
                  max={1500}
                  step={10}
                  value={synthSize}
                  onChange={(e) => setSynthSize(Number(e.target.value) || 180)}
                  className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-zinc-200 bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleGenerateSynthetic();
                    setSubTab('stats');
                  }}
                  className="btn-press flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Chạy giải ngược &amp; Xem bảng SPSS</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setProject(createDefaultSurveyProject());
                onToast('Đã khôi phục bộ khảo sát mẫu mặc định.');
              }}
              className="text-xs font-semibold text-zinc-500 hover:text-[#12489B] underline"
            >
              Khôi phục mẫu nghiên cứu mặc định
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 2: RAW DATA SHEET & CLEANING                              */}
      {/* ================================================================= */}
      {subTab === 'sheet' && (
        <div className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3 bg-[#F4F7FB]/70">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-bold text-slate-900">
                Bảng dữ liệu phản hồi ({project.rows.length} dòng)
              </span>
              {analysis.missingRowsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  {analysis.missingRowsCount} dòng thiếu dữ liệu
                </span>
              )}
              {analysis.straightLinerIds.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  {analysis.straightLinerIds.length} dòng trả lời 1 mức cố định
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleCleanBadRows}
              className="btn-press px-3 py-1.5 rounded-lg bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold"
            >
              Làm sạch dữ liệu lỗi
            </button>
          </div>

          <div className="overflow-x-auto max-h-[540px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-zinc-50 sticky top-0 z-10 border-b border-zinc-200">
                <tr>
                  <th className="px-3 py-2 font-mono text-zinc-500">#</th>
                  {project.demographics.map((d) => (
                    <th key={d.code} className="px-3 py-2 font-bold text-slate-700 whitespace-nowrap">
                      {d.label}
                    </th>
                  ))}
                  {allItemCodes.map((code) => (
                    <th key={code} className="px-2.5 py-2 font-mono font-bold text-[#0B2559] text-center">
                      {code}
                    </th>
                  ))}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {project.rows.slice(0, 120).map((row, idx) => {
                  const isStraight = analysis.straightLinerIds.includes(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={isStraight ? 'bg-rose-50/60' : 'hover:bg-zinc-50'}
                    >
                      <td className="px-3 py-1.5 font-mono text-zinc-400">
                        {idx + 1}
                      </td>
                      {project.demographics.map((d) => (
                        <td key={d.code} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                          {row.demographics[d.code] || '—'}
                        </td>
                      ))}
                      {allItemCodes.map((code) => (
                        <td
                          key={code}
                          className="px-2.5 py-1.5 font-mono text-center text-slate-800"
                        >
                          {row.values[code] ?? '—'}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setProject((p) => ({
                              ...p,
                              rows: p.rows.filter((r) => r.id !== row.id),
                            }))
                          }
                          className="text-zinc-300 hover:text-rose-600"
                          title="Xóa dòng này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {project.rows.length > 120 && (
            <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100 text-[11px] text-zinc-500 text-center">
              Đang hiển thị 120/{project.rows.length} dòng đầu tiên (toàn bộ {project.rows.length} dòng đều được đưa vào tính toán thống kê).
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 3: FULL SPSS / APA STATISTICAL RESULTS                    */}
      {/* ================================================================= */}
      {subTab === 'stats' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-zinc-500">
              Tính toán thời gian thực trên mẫu hợp lệ <strong>N = {analysis.validN}</strong> (chuẩn SPSS / APA 7th).
            </span>
            <button
              type="button"
              onClick={handleCopyApaReport}
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-zinc-200 hover:border-[#12489B] text-xs font-bold text-slate-800"
            >
              {copiedApa ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Đã copy báo cáo APA</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#12489B]" />
                  <span>Copy toàn bộ bảng chuẩn APA</span>
                </>
              )}
            </button>
          </div>

          {/* 1. Cronbach's Alpha & Construct Descriptives */}
          <section className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 bg-[#F4F7FB]/70">
              <h2 className="text-sm font-bold text-[#0B2559]">
                Bảng 1. Kiểm định Độ tin cậy Thang đo (Cronbach&apos;s Alpha) &amp; Thống kê Mô tả
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Nhân tố / Biến quan sát</th>
                    <th className="px-3 py-2.5 font-mono text-right">Mean</th>
                    <th className="px-3 py-2.5 font-mono text-right">SD</th>
                    <th className="px-3 py-2.5 font-mono text-right">Tương quan biến–tổng</th>
                    <th className="px-3 py-2.5 font-mono text-right">Alpha nếu loại biến</th>
                    <th className="px-4 py-2.5 text-right">Đánh giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {analysis.cronbachResults.map((cr) => {
                    const desc = analysis.constructDescriptives.find(
                      (d) => d.code === cr.code
                    );
                    return (
                      <Fragment key={cr.code}>
                        <tr className="bg-blue-50/40 font-bold">
                          <td className="px-4 py-2.5 text-[#0B2559]">
                            {cr.code} — {cr.name} ({cr.itemCount} biến)
                          </td>
                          <td className="px-3 py-2.5 font-mono text-right tabular-nums">
                            {fmtNum(desc?.mean || 0, 2)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-right tabular-nums">
                            {fmtNum(desc?.sd || 0, 2)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-right text-zinc-400">
                            Alpha ={' '}
                            <span
                              className={
                                cr.alpha >= 0.6 ? 'text-emerald-700' : 'text-rose-600'
                              }
                            >
                              {fmtNum(cr.alpha)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-right text-zinc-400">
                            —
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                                cr.passed
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {cr.passed ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" /> Đạt chuẩn
                                </>
                              ) : (
                                'Cần kiểm tra'
                              )}
                            </span>
                          </td>
                        </tr>
                        {cr.items.map((it) => (
                          <tr key={it.code} className="hover:bg-zinc-50/70">
                            <td className="pl-8 pr-4 py-2 text-slate-700">
                              <span className="font-mono font-semibold text-slate-900 mr-1.5">
                                {it.code}
                              </span>
                              <span className="text-zinc-500">{it.label}</span>
                            </td>
                            <td className="px-3 py-2 font-mono text-right tabular-nums">
                              {fmtNum(it.mean, 2)}
                            </td>
                            <td className="px-3 py-2 font-mono text-right tabular-nums">
                              {fmtNum(it.sd, 2)}
                            </td>
                            <td
                              className={`px-3 py-2 font-mono text-right tabular-nums font-semibold ${
                                it.flagged ? 'text-rose-600' : 'text-slate-800'
                              }`}
                            >
                              {fmtNum(it.correctedItemTotal)}
                            </td>
                            <td className="px-3 py-2 font-mono text-right tabular-nums text-zinc-600">
                              {fmtNum(it.alphaIfDeleted)}
                            </td>
                            <td className="px-4 py-2 text-right text-[11px]">
                              {it.flagged ? (
                                <span className="text-rose-600 font-semibold">
                                  &lt; 0.30 (Nên loại)
                                </span>
                              ) : (
                                <span className="text-emerald-700">Giữ biến</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. Pearson Correlation Matrix */}
          {analysis.correlationMatrix && (
            <section className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-100 bg-[#F4F7FB]/70 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#0B2559]">
                  Bảng 2. Ma trận Tương quan Pearson (r)
                </h2>
                <span className="text-[11px] text-zinc-500">
                  * p &lt; .05 · ** p &lt; .01 (2-tailed)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-2.5 font-bold text-slate-700">Nhân tố</th>
                      {analysis.correlationMatrix.constructCodes.map((code) => (
                        <th
                          key={code}
                          className="px-3 py-2.5 font-mono font-bold text-center text-[#0B2559]"
                        >
                          {code}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {analysis.correlationMatrix.constructCodes.map((cA) => (
                      <tr key={cA}>
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          <span className="font-mono text-[#12489B] mr-1.5">{cA}</span>
                          <span className="font-normal text-zinc-500">
                            {analysis.correlationMatrix!.constructNames[cA]}
                          </span>
                        </td>
                        {analysis.correlationMatrix!.constructCodes.map((cB) => {
                          const cell = analysis.correlationMatrix!.matrix[cA][cB];
                          const isDiag = cA === cB;
                          return (
                            <td
                              key={cB}
                              className={`px-3 py-2.5 font-mono text-center tabular-nums ${
                                isDiag
                                  ? 'text-zinc-400 bg-zinc-50/70'
                                  : cell.p < 0.05
                                  ? 'font-bold text-[#0B2559]'
                                  : 'text-zinc-500'
                              }`}
                            >
                              {isDiag ? '1.000' : `${fmtNum(cell.r)}${cell.stars}`}
                              {!isDiag && (
                                <div className="text-[10px] font-normal text-zinc-400">
                                  ({fmtP(cell.p)})
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 3. Multiple Linear Regression (OLS) */}
          {analysis.regression && (
            <section className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-100 bg-[#F4F7FB]/70 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#0B2559]">
                  Bảng 3. Hồi quy Tuyến tính Đa biến — Biến phụ thuộc:{' '}
                  {analysis.regression.dependentCode} ({analysis.regression.dependentName})
                </h2>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-white border border-zinc-200">
                    R² = <strong>{fmtNum(analysis.regression.rSquare)}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#12489B]">
                    Adj. R² = <strong>{fmtNum(analysis.regression.adjRSquare)}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-zinc-200">
                    DW = <strong>{fmtNum(analysis.regression.durbinWatson, 2)}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                    F = <strong>{fmtNum(analysis.regression.anova.fStat, 2)}</strong> (Sig.{' '}
                    {fmtP(analysis.regression.anova.pValue)})
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">Biến độc lập (Giả thuyết)</th>
                      <th className="px-3 py-2.5 font-mono text-right">B</th>
                      <th className="px-3 py-2.5 font-mono text-right">Std. Error</th>
                      <th className="px-3 py-2.5 font-mono text-right">Beta chuẩn hóa</th>
                      <th className="px-3 py-2.5 font-mono text-right">t</th>
                      <th className="px-3 py-2.5 font-mono text-right">Sig. (p)</th>
                      <th className="px-3 py-2.5 font-mono text-right">VIF</th>
                      <th className="px-4 py-2.5 text-right">Kết luận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr className="text-zinc-500">
                      <td className="px-4 py-2 italic">(Constant / Hằng số)</td>
                      <td className="px-3 py-2 font-mono text-right">
                        {fmtNum(analysis.regression.intercept.b)}
                      </td>
                      <td className="px-3 py-2 font-mono text-right">
                        {fmtNum(analysis.regression.intercept.se)}
                      </td>
                      <td className="px-3 py-2 font-mono text-right">—</td>
                      <td className="px-3 py-2 font-mono text-right">
                        {fmtNum(analysis.regression.intercept.t, 2)}
                      </td>
                      <td className="px-3 py-2 font-mono text-right">
                        {fmtP(analysis.regression.intercept.p)}
                      </td>
                      <td className="px-3 py-2 font-mono text-right">—</td>
                      <td className="px-4 py-2 text-right">—</td>
                    </tr>
                    {analysis.regression.coefficients.map((c) => (
                      <tr key={c.code} className="hover:bg-zinc-50/70">
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          <span className="font-mono text-[#12489B] mr-1.5">{c.code}</span>
                          {c.name}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-right tabular-nums">
                          {fmtNum(c.b)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-right tabular-nums text-zinc-500">
                          {fmtNum(c.se)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-right tabular-nums font-bold text-[#0B2559]">
                          {fmtNum(c.beta)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-right tabular-nums">
                          {fmtNum(c.t, 2)}
                        </td>
                        <td
                          className={`px-3 py-2.5 font-mono text-right tabular-nums font-semibold ${
                            c.p < 0.05 ? 'text-emerald-700' : 'text-zinc-500'
                          }`}
                        >
                          {fmtP(c.p)}
                        </td>
                        <td
                          className={`px-3 py-2.5 font-mono text-right tabular-nums ${
                            c.vif > 5 ? 'text-rose-600 font-bold' : 'text-slate-700'
                          }`}
                        >
                          {fmtNum(c.vif, 2)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                              c.supported
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {c.supported ? 'Chấp nhận' : 'Bác bỏ'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 4. Group Difference Tests (T-Test / ANOVA) */}
          {analysis.groupDifferences.length > 0 && (
            <section className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-100 bg-[#F4F7FB]/70">
                <h2 className="text-sm font-bold text-[#0B2559]">
                  Bảng 4. Kiểm định Khác biệt theo Nhân khẩu học (T-Test &amp; One-Way ANOVA)
                </h2>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {analysis.groupDifferences.map((gd) => (
                  <div
                    key={gd.demographicCode}
                    className="rounded-xl border border-zinc-200/90 p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">
                        {gd.demographicLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-100 font-mono text-[10px] font-bold uppercase text-slate-600">
                        {gd.testType}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-700">
                      {gd.statLabel}({gd.dfLabel}) = <strong>{fmtNum(gd.statValue, 2)}</strong> · Sig. ={' '}
                      <strong className={gd.significant ? 'text-emerald-700' : 'text-zinc-600'}>
                        {fmtP(gd.pValue)}
                      </strong>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {gd.significant
                        ? 'Có khác biệt có ý nghĩa thống kê (p < 0.05).'
                        : 'Không có khác biệt có ý nghĩa thống kê (p >= 0.05).'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 4: CHARTS & 1-CLICK PUSH TO AI WRITER STUDIO              */}
      {/* ================================================================= */}
      {subTab === 'charts' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-gradient-to-r from-[#071A42] via-[#0B2559] to-[#12489B] text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold">
                Đẩy toàn bộ Bảng số liệu &amp; {charts.length} Biểu đồ PNG sang AI Writer Studio
              </div>
              <p className="text-xs text-slate-200/85">
                Tự động đính kèm file báo cáo thống kê chuẩn APA + {charts.length} ảnh biểu đồ sắc nét vào Tab 1 (Brief) của phiên viết bài đang mở để Perplexity Vision phân tích và chèn thẳng vào Word/PDF.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePushAllToWriter}
              disabled={analysis.validN < 3}
              className="btn-press shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#EA580C] hover:from-[#D97706] hover:to-[#C2410C] text-white text-xs font-bold shadow-md"
            >
              <Send className="w-4 h-4" />
              <span>Đẩy sang AI Writer ngay</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {charts.map((chart) => (
              <div
                key={chart.id}
                className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-2xs flex flex-col"
              >
                <div className="p-3 bg-[#F4F7FB]">
                  <img
                    src={chart.dataUrl}
                    alt={chart.caption}
                    className="w-full rounded-xl border border-zinc-200 bg-white"
                  />
                </div>
                <div className="p-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-800 leading-snug">
                    {chart.caption}
                  </p>
                  <a
                    href={chart.dataUrl}
                    download={chart.fileName}
                    className="btn-press shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải PNG</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
