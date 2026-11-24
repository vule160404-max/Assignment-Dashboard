import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  CopyPlus,
  Loader2,
  Play,
  Shuffle,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { COHORT_STRUCTURAL_ARCHETYPES } from '../../../lib/cohortEngine';
import { OrderRecord } from '../../../types/domain';
import { WriterSession } from './types';

export interface CohortStudentSlotInput {
  linkedOrderCode: string;
  studentName: string;
  studentId: string;
  customCaseFocus: string;
}

export interface CohortCloneLaunchConfig {
  cloneCount: number;
  sourcesPerPaper: number;
  diversifyTypography: boolean;
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

function createEmptySlot(): CohortStudentSlotInput {
  return {
    linkedOrderCode: '',
    studentName: '',
    studentId: '',
    customCaseFocus: '',
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
  const [diversifyTypography, setDiversifyTypography] = useState(true);
  const [slots, setSlots] = useState<CohortStudentSlotInput[]>(() =>
    Array.from({ length: 6 }, () => createEmptySlot())
  );

  useEffect(() => {
    if (!isOpen) return;
    setSlots((prev) => {
      const next = [...prev];
      while (next.length < 8) next.push(createEmptySlot());
      if (baseSession.linkedOrderCode && !next[0].linkedOrderCode) {
        const matched = orders.find(
          (o) => o.orderCode === baseSession.linkedOrderCode
        );
        next[0] = {
          ...next[0],
          linkedOrderCode: baseSession.linkedOrderCode,
          studentName:
            baseSession.format.coverPage?.studentName ||
            matched?.clientDisplayName ||
            '',
          studentId: baseSession.format.coverPage?.studentId || '',
        };
      }
      return next;
    });
  }, [isOpen, baseSession, orders]);

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
    });
  };

  const handleTrigger = (autoRunImmediately: boolean) => {
    onLaunchCohort({
      cloneCount,
      sourcesPerPaper: Math.max(5, Math.min(30, Number(sourcesPerPaper) || 15)),
      diversifyTypography,
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nhân bản độc lập cho nhóm khách cùng lớp"
      onClick={() => {
        if (!launching) onClose();
      }}
      className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-xs p-3 sm:p-5 flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-[0_24px_70px_rgba(8,28,68,0.32)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#081C44] text-white flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
              <Users className="w-3.5 h-3.5" />
              <span>Cohort Polymorphism · Chống Đụng Bài Cùng Lớp</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">
              Nhân bản Độc lập từ 1 Đề bài chung cho Nhóm Khách Cùng Lớp
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Quét 1 bể nguồn lớn (~35–45 bài báo DOI thật), tự động bốc ngẫu nhiên nguồn cho từng bài và ép mỗi bài đi theo một cấu trúc dàn ý + văn phong hoàn toàn khác nhau để không trùng Turnitin Similarity.
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
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-[#F8FAFC]">
          {/* Base Brief Snapshot */}
          <div className="rounded-xl bg-white border border-slate-200/90 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#12489B]">
                Đề bài gốc dùng chung cho cả nhóm
              </div>
              <div className="text-sm font-bold text-slate-900 truncate">
                {baseSession.topic.trim() ||
                  baseSession.subject.trim() ||
                  'Chưa nhập tên đề tài (Vui lòng điền Đề bài / tải file Brief ở cột trái trước)'}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                <span>Môn: {baseSession.subject || 'Chưa điền'}</span>
                <span>·</span>
                <span>~{baseSession.targetWordCount.toLocaleString('vi-VN')} từ/bài</span>
                <span>·</span>
                <span>Chuẩn {baseSession.citationStyle}</span>
                <span>·</span>
                <span>{baseSession.contextFiles.length} tệp Brief đính kèm</span>
              </div>
            </div>

            {!hasTopicOrBrief && (
              <span className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800">
                Hãy nhập Chủ đề / tải file Đề bài trước khi nhân bản
              </span>
            )}
          </div>

          {/* Core Cohort Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Clone Count */}
            <div className="md:col-span-5 rounded-xl bg-white border border-slate-200/90 p-4 space-y-2.5">
              <label className="block text-xs font-bold text-slate-900">
                1. Số lượng bài cần nhân bản cùng lớp
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[2, 3, 4, 5, 6].map((num) => (
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
                    {num} bài
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Mỗi bản tự động nhận 1 lăng kính bố cục dàn ý riêng biệt (không trùng tiêu đề mục H1/H2).
              </p>
            </div>

            {/* Random Source Pool Draw Count */}
            <div className="md:col-span-4 rounded-xl bg-white border border-slate-200/90 p-4 space-y-2.5">
              <label className="block text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5 text-[#12489B]" />
                <span>2. Bốc ngẫu nhiên nguồn / mỗi bài</span>
              </label>
              <div className="flex items-center gap-2">
                {[10, 15, 20].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={launching}
                    onClick={() => setSourcesPerPaper(preset)}
                    className={`btn-press px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors ${
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
                  className="w-16 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:border-[#12489B]"
                />
                <span className="text-xs text-slate-500">nguồn</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Bốc xáo trộn ngẫu nhiên từ bể nguồn chung — có thể giao nhau vài nguồn nền tảng tự nhiên như sinh viên thật cùng lớp.
              </p>
            </div>

            {/* Format & Metadata Jitter */}
            <div className="md:col-span-3 rounded-xl bg-white border border-slate-200/90 p-4 flex flex-col justify-between gap-2">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={launching}
                  checked={diversifyTypography}
                  onChange={(e) => setDiversifyTypography(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#0B2559] focus:ring-[#12489B]"
                />
                <span className="text-xs font-bold text-slate-900 leading-snug">
                  3. Đa dạng hóa định dạng Word &amp; Số từ
                </span>
              </label>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Tự lệch nhẹ số từ (±3%), đổi Font chuẩn học thuật (Times / Calibri / Georgia) và lùi ngày tạo file `.docx` khác nhau cho từng bạn.
              </p>
            </div>
          </div>

          {/* Per-Student Customization Table */}
          <div className="rounded-xl bg-white border border-slate-200/90 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">
                Danh sách {cloneCount} bài nhân bản (Điền tùy chọn Mã đơn, Tên SV hoặc Ví dụ riêng nếu muốn)
              </span>
              <span className="text-[11px] text-slate-500">
                Bỏ trống ô Ví dụ riêng → AI tự chọn tình huống minh họa khác nhau
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {Array.from({ length: cloneCount }).map((_, idx) => {
                const archetype =
                  COHORT_STRUCTURAL_ARCHETYPES[
                    idx % COHORT_STRUCTURAL_ARCHETYPES.length
                  ];
                const slot = slots[idx] || createEmptySlot();
                return (
                  <div
                    key={idx}
                    className="p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="lg:col-span-3 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-[#0B2559] text-white font-mono text-[10.5px] font-bold">
                          Bài #{idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold text-[#12489B] truncate">
                          {archetype.fontEn} {archetype.fontSizeEn}pt
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium line-clamp-1">
                        {archetype.label}
                      </div>
                    </div>

                    <div className="lg:col-span-3">
                      <select
                        disabled={launching}
                        value={slot.linkedOrderCode}
                        onChange={(e) =>
                          handleOrderSelectForSlot(idx, e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#12489B]"
                      >
                        <option value="">-- Chưa gắn mã đơn --</option>
                        {activeOrders.map((ord) => (
                          <option key={ord.id} value={ord.orderCode}>
                            #{ord.orderCode} · {ord.clientDisplayName || ord.subject}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="lg:col-span-3 grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        disabled={launching}
                        value={slot.studentName}
                        onChange={(e) =>
                          updateSlot(idx, { studentName: e.target.value })
                        }
                        placeholder="Tên SV (Tùy chọn)"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#12489B]"
                      />
                      <input
                        type="text"
                        disabled={launching}
                        value={slot.studentId}
                        onChange={(e) =>
                          updateSlot(idx, { studentId: e.target.value })
                        }
                        placeholder="MSSV"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:border-[#12489B]"
                      />
                    </div>

                    <div className="lg:col-span-3">
                      <input
                        type="text"
                        disabled={launching}
                        value={slot.customCaseFocus}
                        onChange={(e) =>
                          updateSlot(idx, { customCaseFocus: e.target.value })
                        }
                        placeholder="Ví dụ / Công ty riêng (VD: Vinamilk...)"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#12489B]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {launching && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-center gap-3 text-xs font-semibold text-[#0B2559]">
              <Loader2 className="w-4 h-4 text-[#12489B] animate-spin shrink-0" />
              <span>
                {launchStatusLabel ||
                  'Đang quét bể nguồn học thuật chung & khởi tạo các bản nhân bản độc lập...'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Sau khi viết xong, bấm <strong>"Soi trùng chéo"</strong> trên thanh tab để kiểm tra 0% đụng câu trước khi xuất Word.
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
                Tạo {cloneCount} bài · Tự lập dàn ý riêng &amp; Viết song song ngay
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
