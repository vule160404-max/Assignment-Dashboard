import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CopyPlus,
  FlaskConical,
  Loader2,
  Play,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Type,
  Users,
  X,
} from 'lucide-react';
import {
  COHORT_METHODOLOGIES,
  COHORT_STRUCTURAL_ARCHETYPES,
} from '../../../lib/cohortEngine';
import { CITATION_STYLES, CitationStyle, OrderRecord } from '../../../types/domain';
import {
  COVER_PAGE_TEMPLATES,
  CoverPageTemplateId,
  FontFamilyOption,
  LineSpacingOption,
  TextAlignmentOption,
  WriterSession,
} from './types';

export const COHORT_FONT_FAMILIES: string[] = [
  'Times New Roman',
  'Calibri',
  'Georgia',
  'Cambria',
  'Arial',
  'Tahoma',
  'Verdana',
  'Garamond',
  'Palatino Linotype',
];

export const COHORT_FONT_SIZES: number[] = [
  9, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 16,
];

const EXTRA_METHOD_SUGGESTIONS: string[] = [
  ...COHORT_METHODOLOGIES.map((m) => m.label),
  'Định lượng · SmartPLS 4 (PLS-SEM) + Bootstrap 5.000',
  'Định lượng · Hồi quy OLS + Kiểm định Cronbach Alpha & EFA (SPSS)',
  'Định tính · Grounded Theory & Coding 3 bước (Strauss & Corbin)',
  'Định tính · Phân tích Diễn ngôn Phê phán (Critical Discourse Analysis)',
  'Phương pháp Delphi (Lấy ý kiến chuyên gia nhiều vòng)',
  'Netnography (Nghiên cứu hành vi cộng đồng mạng / Social Listening)',
  'Event Study · Đo lường Tỷ suất sinh lời bất thường (CAR)',
  'Phân tích Tài chính · Chuỗi tỷ số DuPont & Z-Score',
  'Nghiên cứu Khoa học Thiết kế (Design Science Research - DSR)',
];

const EXTRA_APPROACH_SUGGESTIONS: string[] = [
  ...COHORT_STRUCTURAL_ARCHETYPES.map((a) => a.label),
  'Phân tích PESTEL → Porter 5 Forces → Ma trận SWOT / TOWS',
  'Bám sát từng Learning Outcome (LO1 → LO2 → LO3 → LO4)',
  'Khung biện luận Pháp lý IRAC (Issue – Rule – Application – Conclusion)',
  'Khung Marketing STP + 7Ps kết hợp Hành trình Khách hàng',
  'Phân tích Vấn đề → Giải pháp ngắn hạn → Tầm nhìn 3–5 năm',
];

const LINE_SPACINGS: { value: LineSpacingOption; label: string }[] = [
  { value: 1.0, label: '1.0' },
  { value: 1.15, label: '1.15' },
  { value: 1.5, label: '1.5' },
  { value: 2.0, label: '2.0' },
];

const DISTINCT_METHOD_ROTATION = [
  'qualitative_thematic',
  'quantitative_survey',
  'comparative_case_study',
  'mixed_methods',
  'secondary_empirical_data',
  'systematic_literature_review',
  'conceptual_critical_essay',
  'auto_by_lens',
];

export interface CohortStudentSlotInput {
  linkedOrderCode: string;
  studentName: string;
  studentId: string;
  fontFamily: FontFamilyOption;
  fontSizePt: number;
  lineSpacing: LineSpacingOption;
  textAlign: TextAlignmentOption;
  coverTemplateId: CoverPageTemplateId;
  targetWordCount: number;
  citationStyle: CitationStyle;
  writingLanguage: WriterSession['writingLanguage'];
  /** Underlying fallback preset id for engine compatibility */
  methodologyId: string;
  /** Freely writable & editable methodology text (takes highest priority!) */
  customMethodology: string;
  /** Underlying structural preset id for engine compatibility */
  archetypeId: string;
  /** Freely writable & editable outline angle / structural approach */
  customApproach: string;
  customTopic: string;
  customCaseFocus: string;
  customFramework: string;
  customInstructions: string;
}

export interface CohortCloneLaunchConfig {
  cloneCount: number;
  sourcesPerPaper: number;
  autoRunImmediately: boolean;
  slots: CohortStudentSlotInput[];
}

interface WriterCohortCloneModalProps {
  isOpen: boolean;
  baseSession: WriterSession;
  orders: OrderRecord[];
  launching: boolean;
  launchStatusLabel: string;
  onLaunchCohort: (config: CohortCloneLaunchConfig) => void;
  onClose: () => void;
}

function buildDefaultSlotFromBase(
  idx: number,
  base: WriterSession,
  diversifyDefaults = true
): CohortStudentSlotInput {
  const archetype =
    COHORT_STRUCTURAL_ARCHETYPES[idx % COHORT_STRUCTURAL_ARCHETYPES.length];
  const methodId = diversifyDefaults
    ? DISTINCT_METHOD_ROTATION[idx % DISTINCT_METHOD_ROTATION.length]
    : 'auto_by_lens';
  const methodObj =
    COHORT_METHODOLOGIES.find((m) => m.id === methodId) ||
    COHORT_METHODOLOGIES[0];

  const baseWords = Math.max(300, base.targetWordCount || 2000);
  const roundedWords = diversifyDefaults
    ? Math.max(
        300,
        Math.round((baseWords * archetype.wordJitterRatio) / 50) * 50
      )
    : baseWords;

  return {
    linkedOrderCode: '',
    studentName: '',
    studentId: '',
    fontFamily: diversifyDefaults ? archetype.fontEn : base.format.fontFamily,
    fontSizePt: diversifyDefaults ? archetype.fontSizeEn : base.format.fontSizePt,
    lineSpacing: diversifyDefaults
      ? archetype.lineSpacingEn
      : base.format.lineSpacing,
    textAlign: diversifyDefaults ? archetype.alignEn : base.format.textAlign,
    coverTemplateId: diversifyDefaults
      ? archetype.coverTemplate
      : base.format.coverPage?.templateId || 'academic_international',
    targetWordCount: roundedWords,
    citationStyle: base.citationStyle,
    writingLanguage: base.writingLanguage,
    methodologyId: methodId,
    customMethodology: methodObj.label,
    archetypeId: archetype.id,
    customApproach: archetype.label,
    customTopic: '',
    customCaseFocus: '',
    customFramework: '',
    customInstructions: '',
  };
}

export function WriterCohortCloneModal({
  isOpen,
  baseSession,
  orders,
  launching,
  launchStatusLabel,
  onLaunchCohort,
  onClose,
}: WriterCohortCloneModalProps) {
  const [cloneCount, setCloneCount] = useState(3);
  const [sourcesPerPaper, setSourcesPerPaper] = useState(15);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
  });
  const [slots, setSlots] = useState<CohortStudentSlotInput[]>(() =>
    Array.from({ length: 8 }, (_, idx) =>
      buildDefaultSlotFromBase(idx, baseSession, true)
    )
  );

  // Sync baseSession defaults when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSlots(
      Array.from({ length: 8 }, (_, idx) => {
        const slot = buildDefaultSlotFromBase(idx, baseSession, true);
        if (idx === 0 && baseSession.linkedOrderCode) {
          const matched = orders.find(
            (o) => o.orderCode === baseSession.linkedOrderCode
          );
          slot.linkedOrderCode = baseSession.linkedOrderCode;
          slot.studentName =
            baseSession.format.coverPage?.studentName ||
            matched?.clientDisplayName ||
            '';
          slot.studentId = baseSession.format.coverPage?.studentId || '';
        }
        return slot;
      })
    );
    setExpandedCards({ 0: true, 1: true, 2: true });
    setShowBulkPaste(false);
  }, [isOpen, baseSession, orders]);

  // Auto-expand newly added slots up to 4
  useEffect(() => {
    setExpandedCards((prev) => {
      const next = { ...prev };
      for (let i = 0; i < cloneCount; i++) {
        if (next[i] === undefined) next[i] = i < 4;
      }
      return next;
    });
  }, [cloneCount]);

  if (!isOpen || typeof document === 'undefined') return null;

  const activeOrders = orders.filter((o) => o.orderStatus !== 'cancelled');

  const updateSlot = (
    idx: number,
    patch: Partial<CohortStudentSlotInput>
  ) => {
    setSlots((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const handleOrderSelectForSlot = (idx: number, code: string) => {
    const matched = activeOrders.find((o) => o.orderCode === code);
    updateSlot(idx, {
      linkedOrderCode: code,
      studentName:
        matched?.clientDisplayName && !slots[idx]?.studentName
          ? matched.clientDisplayName
          : slots[idx]?.studentName || '',
      targetWordCount: matched?.wordCount || slots[idx].targetWordCount,
      citationStyle: matched?.citationStyle || slots[idx].citationStyle,
    });
  };

  const handleRandomizeAllDiversity = () => {
    const shuffledMethods = [...DISTINCT_METHOD_ROTATION.slice(0, 7)].sort(
      () => Math.random() - 0.5
    );
    const shuffledArchetypes = [...COHORT_STRUCTURAL_ARCHETYPES].sort(
      () => Math.random() - 0.5
    );
    setSlots((prev) =>
      prev.map((item, idx) => {
        const arch = shuffledArchetypes[idx % shuffledArchetypes.length];
        const methodId = shuffledMethods[idx % shuffledMethods.length];
        const methodObj =
          COHORT_METHODOLOGIES.find((m) => m.id === methodId) ||
          COHORT_METHODOLOGIES[0];
        const baseW = Math.max(300, baseSession.targetWordCount || 2000);
        return {
          ...item,
          methodologyId: methodId,
          customMethodology: methodObj.label,
          archetypeId: arch.id,
          customApproach: arch.label,
          fontFamily: arch.fontEn,
          fontSizePt: arch.fontSizeEn,
          lineSpacing: arch.lineSpacingEn,
          textAlign: arch.alignEn,
          coverTemplateId: arch.coverTemplate,
          targetWordCount:
            Math.max(300, Math.round((baseW * arch.wordJitterRatio) / 50) * 50),
        };
      })
    );
  };

  const handleSyncAllTypographyToBase = () => {
    setSlots((prev) =>
      prev.map((item) => ({
        ...item,
        fontFamily: baseSession.format.fontFamily,
        fontSizePt: baseSession.format.fontSizePt,
        lineSpacing: baseSession.format.lineSpacing,
        textAlign: baseSession.format.textAlign,
        citationStyle: baseSession.citationStyle,
        writingLanguage: baseSession.writingLanguage,
        targetWordCount: baseSession.targetWordCount,
        coverTemplateId:
          baseSession.format.coverPage?.templateId || 'academic_international',
      }))
    );
  };

  const handleApplyBulkPaste = () => {
    const lines = bulkPasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (lines.length === 0) return;

    const nextCount = Math.max(2, Math.min(8, lines.length));
    setCloneCount(nextCount);
    setSlots((prev) =>
      prev.map((item, idx) => {
        const rawLine = lines[idx];
        if (!rawLine) return item;
        const parts = rawLine.split(/\s*\|\s*/).map((p) => p.trim());
        const topicVal = parts[0] || '';
        const methodVal = parts[1] || '';
        const caseVal = parts[2] || '';
        const fwVal = parts[3] || '';
        const matchedMethod = methodVal
          ? COHORT_METHODOLOGIES.find(
              (m) =>
                m.label.toLowerCase() === methodVal.toLowerCase() ||
                m.shortTag.toLowerCase() === methodVal.toLowerCase()
            )
          : undefined;
        return {
          ...item,
          customTopic: topicVal || item.customTopic,
          customMethodology: methodVal || item.customMethodology,
          methodologyId: matchedMethod ? matchedMethod.id : item.methodologyId,
          customCaseFocus: caseVal || item.customCaseFocus,
          customFramework: fwVal || item.customFramework,
        };
      })
    );
    setExpandedCards((prev) => {
      const next = { ...prev };
      for (let i = 0; i < nextCount; i++) next[i] = true;
      return next;
    });
    setShowBulkPaste(false);
  };

  const toggleAllCardsExpanded = (expand: boolean) => {
    const next: Record<number, boolean> = {};
    for (let i = 0; i < cloneCount; i++) {
      next[i] = expand;
    }
    setExpandedCards(next);
  };

  const handleTrigger = (autoRunImmediately: boolean) => {
    onLaunchCohort({
      cloneCount,
      sourcesPerPaper: Math.max(5, Math.min(30, Number(sourcesPerPaper) || 15)),
      autoRunImmediately,
      slots: slots.slice(0, cloneCount),
    });
  };

  const hasTopicOrBrief = Boolean(
    baseSession.topic.trim() ||
      baseSession.subject.trim() ||
      baseSession.instructions.trim() ||
      baseSession.contextFiles.length > 0
  );

  const anyExpanded = Array.from({ length: cloneCount }).some(
    (_, i) => expandedCards[i] !== false
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Thiết kế chi tiết nhóm bài độc lập"
      onClick={() => {
        if (!launching) onClose();
      }}
      className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-xs p-2.5 sm:p-5 flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl max-h-[94vh] bg-white rounded-2xl border border-slate-200 shadow-[0_24px_70px_rgba(8,28,68,0.34)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-[#081C44] text-white flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
              <Users className="w-3.5 h-3.5" />
              <span>Cohort Studio · Viết Tự Do Mọi Đề Tài, Phương Pháp &amp; Định Dạng</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">
              Thiết kế Chi tiết Nhóm Bài Độc lập ({cloneCount} bài)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
              Mọi trường Đề tài, Phương pháp nghiên cứu, Hướng dàn ý, Mô hình, Font chữ và Cỡ chữ đều cho phép gõ tự do không giới hạn (hoặc bấm chọn nhanh từ danh sách gợi ý). Nguồn CrossRef được bốc ngẫu nhiên pha trộn giữa bể chung lớp và nguồn riêng theo từng bài.
            </p>
          </div>

          <button
            type="button"
            disabled={launching}
            onClick={onClose}
            className="btn-press p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 bg-[#F6F8FC]">
          {/* Top Summary + Global Cohort Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Base Prompt Card */}
            <div className="lg:col-span-5 rounded-xl bg-white border border-slate-200/90 p-4 flex flex-col justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#12489B]">
                    Đề gốc kế thừa (Shared Brief)
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {baseSession.contextFiles.length} tệp Brief đính kèm
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                  {baseSession.topic.trim() ||
                    baseSession.subject.trim() ||
                    'Chưa nhập Đề bài ở cột trái'}
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 font-mono pt-0.5">
                  <span>Môn: {baseSession.subject || 'Chưa điền'}</span>
                  <span>·</span>
                  <span>Gốc: {baseSession.format.fontFamily} {baseSession.format.fontSizePt}pt</span>
                  <span>·</span>
                  <span>{baseSession.targetWordCount.toLocaleString('vi-VN')}w</span>
                </div>
              </div>
              {!hasTopicOrBrief && (
                <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
                  Hãy nhập Chủ đề / tải tệp Đề bài ở cột 1 trước khi chạy!
                </div>
              )}
            </div>

            {/* Clone Count Selector (2..8 papers) */}
            <div className="lg:col-span-4 rounded-xl bg-white border border-slate-200/90 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-900">
                  1. Số lượng bài cần tạo
                </label>
                <span className="text-[11px] font-mono font-semibold text-[#12489B]">
                  2 – 8 bài/đợt
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={launching}
                    onClick={() => setCloneCount(num)}
                    className={`btn-press py-2 rounded-lg text-xs font-bold font-mono transition-colors ${
                      cloneCount === num
                        ? 'bg-[#0B2559] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Gõ tự do mọi đề tài, phương pháp, font chữ &amp; cỡ chữ riêng cho từng sinh viên.
              </p>
            </div>

            {/* Random Source Pool Size */}
            <div className="lg:col-span-3 rounded-xl bg-white border border-slate-200/90 p-4 space-y-2.5">
              <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5 text-[#12489B]" />
                <span>2. Bốc nguồn ngẫu nhiên</span>
              </label>
              <div className="flex items-center gap-1.5">
                {[10, 15, 20].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={launching}
                    onClick={() => setSourcesPerPaper(preset)}
                    className={`btn-press px-2 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                      sourcesPerPaper === preset
                        ? 'bg-blue-50 border-[#12489B] text-[#0B2559]'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
                <input
                  type="number"
                  min={5}
                  max={30}
                  disabled={launching}
                  value={sourcesPerPaper}
                  onChange={(e) =>
                    setSourcesPerPaper(
                      Math.max(5, Math.min(30, Number(e.target.value) || 15))
                    )
                  }
                  className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-[#12489B]"
                />
                <span className="text-[11px] text-slate-500">nguồn</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Tự tìm thêm DOI khớp chính xác phương pháp &amp; đề tài riêng từng bài.
              </p>
            </div>
          </div>

          {/* Batch Quick Actions + Optional Bulk Paste Drawer */}
          <div className="rounded-xl bg-white border border-slate-200/90 overflow-hidden">
            <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#12489B]" />
                <span className="text-xs font-bold text-slate-900">
                  Danh sách {cloneCount} bài thiết kế riêng
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={launching}
                  onClick={() => setShowBulkPaste((v) => !v)}
                  className={`btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    showBulkPaste
                      ? 'bg-[#0B2559] border-[#0B2559] text-white'
                      : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Dán nhanh hàng loạt Đề tài / Phương pháp</span>
                </button>

                <button
                  type="button"
                  disabled={launching}
                  onClick={handleRandomizeAllDiversity}
                  className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200/80 text-xs font-semibold text-[#0B2559] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#12489B]" />
                  <span>Xáo trộn khác biệt tự động</span>
                </button>

                <button
                  type="button"
                  disabled={launching}
                  onClick={handleSyncAllTypographyToBase}
                  className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Đưa Font/Cỡ chữ về bài gốc</span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleAllCardsExpanded(!anyExpanded)}
                  className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600"
                >
                  <span>{anyExpanded ? 'Thu gọn thẻ' : 'Mở rộng tất cả'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      anyExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {showBulkPaste && (
              <div className="px-4 pb-4 pt-3 border-t border-slate-100 bg-slate-50/80 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-900">
                    Dán mỗi dòng tương ứng 1 bài theo mẫu: <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11px]">Đề tài riêng | Phương pháp | Case Study / Đối tượng | Mô hình</code>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Bỏ qua các vế sau dấu | nếu không cần · Tối đa 8 dòng
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={bulkPasteText}
                  onChange={(e) => setBulkPasteText(e.target.value)}
                  placeholder={`AI Chatbot trong Ngân hàng số VN | Định lượng SmartPLS 4 (n=320) | Techcombank | TAM + Trust\nChiến lược ESG Chuỗi cung ứng xanh | Định tính Phỏng vấn sâu 12 quản lý | Vinamilk | Triple Bottom Line\nThương mại điện tử Live-Commerce Gen Z | Mixed-Methods (Khảo sát + Phỏng vấn) | TikTok Shop | SOR Model`}
                  className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs font-sans text-slate-900 focus:outline-none focus:border-[#12489B] leading-relaxed"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkPaste(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={!bulkPasteText.trim()}
                    onClick={handleApplyBulkPaste}
                    className="btn-press px-3.5 py-1.5 rounded-lg bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold disabled:opacity-40"
                  >
                    Nạp vào danh sách bài bên dưới
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Spacious Per-Paper Detailed Cards (100% Free-Writable Inputs + Quick Suggestions) */}
          <div className="space-y-3.5">
            {Array.from({ length: cloneCount }).map((_, idx) => {
              const slot =
                slots[idx] || buildDefaultSlotFromBase(idx, baseSession, true);
              const isOpenCard = expandedCards[idx] !== false;
              const methodDisplay =
                slot.customMethodology.trim() || 'Tự động theo đề gốc';
              const approachDisplay =
                slot.customApproach.trim() || 'Lăng kính tự động';

              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-white border border-slate-200/95 shadow-[0_2px_12px_rgba(15,23,42,0.03)] overflow-hidden"
                >
                  {/* Card Header Summary Strip */}
                  <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="px-2.5 py-0.5 rounded-md bg-[#0B2559] text-white font-mono text-xs font-bold shrink-0">
                        Bài #{idx + 1}
                      </span>

                      <span
                        title={methodDisplay}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-[#12489B] text-[11px] font-semibold max-w-[260px] truncate"
                      >
                        <FlaskConical className="w-3 h-3 shrink-0" />
                        <span className="truncate">{methodDisplay}</span>
                      </span>

                      <span
                        title={approachDisplay}
                        className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-medium max-w-[220px] truncate"
                      >
                        {approachDisplay}
                      </span>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50/90 border border-amber-200/80 text-amber-900 font-mono text-[11px] font-semibold">
                        <Type className="w-3 h-3 text-amber-700" />
                        <span>
                          {slot.fontFamily} · {slot.fontSizePt}pt · Dòng{' '}
                          {slot.lineSpacing}
                        </span>
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                        {slot.targetWordCount.toLocaleString('vi-VN')}w ·{' '}
                        {slot.citationStyle} ·{' '}
                        {slot.writingLanguage === 'Vietnamese'
                          ? 'Tiếng Việt'
                          : slot.writingLanguage === 'Bilingual'
                          ? 'Song ngữ'
                          : 'English'}
                      </span>

                      {slot.customTopic.trim() && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold truncate max-w-[260px]">
                          Chủ đề: {slot.customTopic.trim()}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCards((prev) => ({
                          ...prev,
                          [idx]: !isOpenCard,
                        }))
                      }
                      className="btn-press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 shrink-0"
                    >
                      <span>{isOpenCard ? 'Thu gọn' : 'Chỉnh sửa'}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${
                          isOpenCard ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Expanded Free-Text + Quick-Suggest Card Body */}
                  {isOpenCard && (
                    <div className="p-4 sm:p-5 space-y-4">
                      {/* TIER 1: Identity & Custom Free Typography (Font + Size free input + presets!) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                        <div className="lg:col-span-3">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Mã đơn hàng liên kết
                          </label>
                          <select
                            disabled={launching}
                            value={slot.linkedOrderCode}
                            onChange={(e) =>
                              handleOrderSelectForSlot(idx, e.target.value)
                            }
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          >
                            <option value="">-- Bài độc lập (Chưa gắn đơn) --</option>
                            {activeOrders.map((ord) => (
                              <option key={ord.id} value={ord.orderCode}>
                                #{ord.orderCode} · {ord.clientDisplayName || ord.subject}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="lg:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Tên Sinh viên (Trang bìa)
                          </label>
                          <input
                            type="text"
                            disabled={launching}
                            value={slot.studentName}
                            onChange={(e) =>
                              updateSlot(idx, { studentName: e.target.value })
                            }
                            placeholder="VD: Nguyễn Minh Anh"
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          />
                        </div>

                        <div className="lg:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            MSSV
                          </label>
                          <input
                            type="text"
                            disabled={launching}
                            value={slot.studentId}
                            onChange={(e) =>
                              updateSlot(idx, { studentId: e.target.value })
                            }
                            placeholder="s391234"
                            className="w-full px-2 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          />
                        </div>

                        {/* Free Font Family Combobox (Type any font OR pick preset) */}
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] font-semibold text-[#0B2559] mb-1">
                            Font chữ (Gõ hoặc chọn)
                          </label>
                          <div className="flex rounded-lg border border-blue-200/80 bg-blue-50/35 overflow-hidden focus-within:bg-white focus-within:border-[#12489B]">
                            <input
                              type="text"
                              disabled={launching}
                              value={slot.fontFamily}
                              onChange={(e) =>
                                updateSlot(idx, {
                                  fontFamily: e.target.value as FontFamilyOption,
                                })
                              }
                              style={{ fontFamily: slot.fontFamily }}
                              placeholder="VD: Times New Roman"
                              className="w-full min-w-0 px-2.5 py-2 text-xs font-semibold text-slate-900 bg-transparent focus:outline-none"
                            />
                            <select
                              aria-label="Chọn nhanh Font chữ"
                              disabled={launching}
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateSlot(idx, {
                                    fontFamily: e.target.value as FontFamilyOption,
                                  });
                                }
                              }}
                              className="w-7 shrink-0 bg-blue-100/70 border-l border-blue-200/80 text-[11px] text-[#0B2559] font-semibold focus:outline-none cursor-pointer"
                            >
                              <option value="">▾</option>
                              {COHORT_FONT_FAMILIES.map((f) => (
                                <option key={f} value={f} style={{ fontFamily: f }}>
                                  {f}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Free Font Size Numeric + Presets */}
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] font-semibold text-[#0B2559] mb-1">
                            Cỡ chữ pt (Nhập hoặc chọn)
                          </label>
                          <div className="flex rounded-lg border border-blue-200/80 bg-blue-50/35 overflow-hidden focus-within:bg-white focus-within:border-[#12489B]">
                            <input
                              type="number"
                              min={8}
                              max={24}
                              step={0.5}
                              disabled={launching}
                              value={slot.fontSizePt}
                              onChange={(e) =>
                                updateSlot(idx, {
                                  fontSizePt:
                                    Math.max(8, Math.min(24, Number(e.target.value) || 12)),
                                })
                              }
                              className="w-full min-w-0 px-2.5 py-2 text-xs font-mono font-bold text-slate-900 bg-transparent focus:outline-none"
                            />
                            <select
                              aria-label="Chọn nhanh cỡ chữ"
                              disabled={launching}
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateSlot(idx, {
                                    fontSizePt: Number(e.target.value) || 12,
                                  });
                                }
                              }}
                              className="w-12 shrink-0 px-1 bg-blue-100/70 border-l border-blue-200/80 text-[11px] font-mono text-[#0B2559] font-semibold focus:outline-none cursor-pointer"
                            >
                              <option value="">pt ▾</option>
                              {COHORT_FONT_SIZES.map((sz) => (
                                <option key={sz} value={sz}>
                                  {sz}pt
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="lg:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Giãn dòng
                          </label>
                          <select
                            disabled={launching}
                            value={slot.lineSpacing}
                            onChange={(e) =>
                              updateSlot(idx, {
                                lineSpacing:
                                  (Number(e.target.value) as LineSpacingOption) ||
                                  1.5,
                              })
                            }
                            className="w-full px-2 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          >
                            {LINE_SPACINGS.map((ls) => (
                              <option key={ls.value} value={ls.value}>
                                {ls.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="lg:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Căn lề
                          </label>
                          <select
                            disabled={launching}
                            value={slot.textAlign}
                            onChange={(e) =>
                              updateSlot(idx, {
                                textAlign: e.target.value as TextAlignmentOption,
                              })
                            }
                            className="w-full px-2 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          >
                            <option value="left">Trái</option>
                            <option value="justify">Đều 2 bên</option>
                          </select>
                        </div>
                      </div>

                      {/* TIER 2: Free-Text Methodology Combobox + Free-Text Structural Angle Combobox + Scope */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1 border-t border-slate-100">
                        <div className="lg:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Phương pháp nghiên cứu &amp; Phân tích (Viết tự do hoặc chọn mẫu)
                          </label>
                          <div className="flex rounded-lg border border-slate-200 bg-slate-50/70 overflow-hidden focus-within:bg-white focus-within:border-[#12489B]">
                            <input
                              type="text"
                              disabled={launching}
                              value={slot.customMethodology}
                              onChange={(e) => {
                                const val = e.target.value;
                                const matched = COHORT_METHODOLOGIES.find(
                                  (m) =>
                                    m.label.toLowerCase() ===
                                    val.trim().toLowerCase()
                                );
                                updateSlot(idx, {
                                  customMethodology: val,
                                  methodologyId: matched ? matched.id : 'auto_by_lens',
                                });
                              }}
                              placeholder="Gõ BẤT KỲ phương pháp nào (VD: SmartPLS SEM, OLS SPSS, Phỏng vấn sâu, Event Study...)"
                              className="w-full min-w-0 px-3 py-2 text-xs font-medium text-slate-900 bg-transparent focus:outline-none"
                            />
                            <select
                              aria-label="Chọn nhanh phương pháp gợi ý"
                              disabled={launching}
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const matched = COHORT_METHODOLOGIES.find(
                                  (m) => m.label === val
                                );
                                updateSlot(idx, {
                                  customMethodology: val,
                                  methodologyId: matched
                                    ? matched.id
                                    : 'auto_by_lens',
                                });
                              }}
                              className="w-16 shrink-0 px-1.5 bg-slate-100 border-l border-slate-200 text-[11px] font-semibold text-[#12489B] focus:outline-none cursor-pointer"
                            >
                              <option value="">Mẫu ▾</option>
                              {EXTRA_METHOD_SUGGESTIONS.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="lg:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Hướng triển khai / Cấu trúc Dàn ý (Viết tự do hoặc chọn mẫu)
                          </label>
                          <div className="flex rounded-lg border border-slate-200 bg-slate-50/70 overflow-hidden focus-within:bg-white focus-within:border-[#12489B]">
                            <input
                              type="text"
                              disabled={launching}
                              value={slot.customApproach}
                              onChange={(e) => {
                                const val = e.target.value;
                                const matched = COHORT_STRUCTURAL_ARCHETYPES.find(
                                  (a) =>
                                    a.label.toLowerCase() ===
                                    val.trim().toLowerCase()
                                );
                                updateSlot(idx, {
                                  customApproach: val,
                                  archetypeId: matched
                                    ? matched.id
                                    : COHORT_STRUCTURAL_ARCHETYPES[
                                        idx % COHORT_STRUCTURAL_ARCHETYPES.length
                                      ].id,
                                });
                              }}
                              placeholder="Gõ hướng tiếp cận (VD: PESTEL → Porter 5 Forces → TOWS, Theo LO1–LO4...)"
                              className="w-full min-w-0 px-3 py-2 text-xs font-medium text-slate-900 bg-transparent focus:outline-none"
                            />
                            <select
                              aria-label="Chọn nhanh hướng cấu trúc dàn ý"
                              disabled={launching}
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const matched = COHORT_STRUCTURAL_ARCHETYPES.find(
                                  (a) => a.label === val
                                );
                                updateSlot(idx, {
                                  customApproach: val,
                                  archetypeId: matched
                                    ? matched.id
                                    : COHORT_STRUCTURAL_ARCHETYPES[
                                        idx % COHORT_STRUCTURAL_ARCHETYPES.length
                                      ].id,
                                });
                              }}
                              className="w-16 shrink-0 px-1.5 bg-slate-100 border-l border-slate-200 text-[11px] font-semibold text-[#12489B] focus:outline-none cursor-pointer"
                            >
                              <option value="">Mẫu ▾</option>
                              {EXTRA_APPROACH_SUGGESTIONS.map((ap) => (
                                <option key={ap} value={ap}>
                                  {ap}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="lg:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Số từ
                          </label>
                          <input
                            type="number"
                            min={300}
                            max={30000}
                            step={50}
                            disabled={launching}
                            value={slot.targetWordCount}
                            onChange={(e) =>
                              updateSlot(idx, {
                                targetWordCount: Math.max(
                                  300,
                                  Number(e.target.value) || 2000
                                ),
                              })
                            }
                            className="w-full px-2 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          />
                        </div>

                        <div className="lg:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Trích dẫn
                          </label>
                          <select
                            disabled={launching}
                            value={slot.citationStyle}
                            onChange={(e) =>
                              updateSlot(idx, {
                                citationStyle: e.target.value as CitationStyle,
                              })
                            }
                            className="w-full px-1.5 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          >
                            {CITATION_STYLES.map((cs) => (
                              <option key={cs} value={cs}>
                                {cs}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="lg:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Ngôn ngữ
                          </label>
                          <select
                            disabled={launching}
                            value={slot.writingLanguage}
                            onChange={(e) =>
                              updateSlot(idx, {
                                writingLanguage: e.target
                                  .value as WriterSession['writingLanguage'],
                              })
                            }
                            className="w-full px-1.5 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          >
                            <option value="English">EN</option>
                            <option value="Vietnamese">VN</option>
                            <option value="Bilingual">Song ngữ</option>
                          </select>
                        </div>

                        <div className="lg:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Bìa Word
                          </label>
                          <select
                            disabled={launching}
                            value={slot.coverTemplateId}
                            onChange={(e) =>
                              updateSlot(idx, {
                                coverTemplateId: e.target
                                  .value as CoverPageTemplateId,
                              })
                            }
                            className="w-full px-1.5 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          >
                            {COVER_PAGE_TEMPLATES.map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* TIER 3: Free Topic / Framework / Case Study / Multi-Line Instructions */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-slate-100">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Chủ đề / Đề tài riêng của bài #{idx + 1} (Viết tự do)
                          </label>
                          <input
                            type="text"
                            disabled={launching}
                            value={slot.customTopic}
                            onChange={(e) =>
                              updateSlot(idx, { customTopic: e.target.value })
                            }
                            placeholder="Nhập chính xác tên đề tài riêng của bài này (hoặc bỏ trống để dùng chung đề gốc)..."
                            className="w-full px-3 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Mô hình / Khung lý thuyết / Công cụ phân tích
                          </label>
                          <input
                            type="text"
                            disabled={launching}
                            value={slot.customFramework}
                            onChange={(e) =>
                              updateSlot(idx, {
                                customFramework: e.target.value,
                              })
                            }
                            placeholder="VD: TAM + UTAUT2, SPSS 26, SmartPLS 4, Porter's 5 Forces, DuPont..."
                            className="w-full px-3 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Công ty / Đối tượng / Bối cảnh thực tế (Case / Mẫu)
                          </label>
                          <input
                            type="text"
                            disabled={launching}
                            value={slot.customCaseFocus}
                            onChange={(e) =>
                              updateSlot(idx, {
                                customCaseFocus: e.target.value,
                              })
                            }
                            placeholder="VD: Techcombank, Vinamilk 2022–2025, n=250 SV Gen Z tại Melbourne..."
                            className="w-full px-3 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Mô tả yêu cầu / Đề bài chi tiết bổ sung riêng cho bài #{idx + 1} (Không giới hạn kiểu viết)
                        </label>
                        <textarea
                          rows={2}
                          disabled={launching}
                          value={slot.customInstructions}
                          onChange={(e) =>
                            updateSlot(idx, {
                              customInstructions: e.target.value,
                            })
                          }
                          placeholder="Nhập chi tiết biến nghiên cứu, giả thuyết H1–H5, bảng biểu cần có, nguồn bắt buộc hoặc các lưu ý riêng của giảng viên/khách cho bài này..."
                          className="w-full px-3 py-2 rounded-lg bg-slate-50/70 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#12489B] leading-relaxed resize-y"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {launching && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3 text-xs font-semibold text-[#0B2559]">
              <Loader2 className="w-4 h-4 text-[#12489B] animate-spin shrink-0" />
              <span>
                {launchStatusLabel ||
                  'Đang quét bể nguồn học thuật (chung + chuyên biệt theo từng đề tài/phương pháp) & khởi tạo nhóm bản viết...'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Sau khi AI viết xong, bấm <strong>"Soi trùng chéo"</strong> trên thanh tab để đối chiếu Similarity thân bài (&lt; 3%) trước khi xuất Word.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={launching || !hasTopicOrBrief}
              onClick={() => handleTrigger(false)}
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 disabled:opacity-40"
            >
              <CopyPlus className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Chỉ tạo {cloneCount} tab &amp; Bốc nguồn</span>
            </button>

            <button
              type="button"
              disabled={launching || !hasTopicOrBrief}
              onClick={() => handleTrigger(true)}
              className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold shadow-xs disabled:opacity-40"
            >
              {launching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>
                Tạo {cloneCount} bài · Lập dàn ý riêng &amp; Viết song song ngay
              </span>
              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
