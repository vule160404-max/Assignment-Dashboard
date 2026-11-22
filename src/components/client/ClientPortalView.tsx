import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  createRevisionRequest,
  fetchTrackingPortalOnce,
  subscribeOrderRevisions,
  subscribeTrackingPortal,
} from '../../services/firestoreService';
import {
  formatBytes,
  formatDateTime,
  getSafeExternalUrl,
  getStageMeta,
  isValidOrderCode,
  normalizeOrderCode,
} from '../../lib/utils';
import {
  AttachmentItem,
  FIELD_LIMITS,
  ORDER_STAGES,
  RevisionRequest,
  TrackingPortalRecord,
} from '../../types/domain';
import { DeadlineBadge } from '../shared/DeadlineBadge';
import { BrandLogo } from '../shared/BrandLogo';
import { OrderChatPanel } from '../shared/OrderChatPanel';
import { PdfPreviewModal } from '../shared/PdfPreviewModal';
import { PolicyModal, PolicyTabKey } from '../shared/PolicyModal';
import { PublicTopNav } from '../shared/PublicTopNav';
import { ClientIntegrityCheckerView } from './ClientIntegrityCheckerView';
import { ClientOrderFormView } from './ClientOrderFormView';
import {
  ClientLandingSections,
  ClientValuePropCard,
} from './ClientLandingSections';
import { PaymentQrCard } from './PaymentQrCard';

const RECENT_CODES_STORAGE_KEY = 'assigntrack_client_recent_codes_v1';

function loadRecentOrderCodes(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_CODES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c): c is string => typeof c === 'string' && isValidOrderCode(c))
      .slice(0, 12);
  } catch {
    return [];
  }
}

function saveRecentOrderCodes(codes: string[]): void {
  try {
    localStorage.setItem(
      RECENT_CODES_STORAGE_KEY,
      JSON.stringify(codes.slice(0, 12))
    );
  } catch {
    // ignore storage errors
  }
}

export type ClientPortalTab = 'order' | 'lookup' | 'checker';

interface ClientPortalViewProps {
  initialOrderCode?: string;
  initialTab?: ClientPortalTab;
  initialServiceType?: string;
  nowMs: number;
  onSwitchToAdmin: () => void;
  onBackToRoleSelect?: () => void;
  onOpenSamples?: () => void;
  onOpenOrderModal?: (serviceType?: string) => void;
  onToast: (msg: string) => void;
}

const CATEGORY_LABELS: Record<AttachmentItem['category'], string> = {
  brief: 'Đề bài & Tài liệu',
  turnitin: 'Báo cáo Turnitin / AI',
  draft: 'Bản nháp',
  final: 'Bài hoàn chỉnh',
};

export function ClientPortalView({
  initialOrderCode = '',
  initialTab,
  initialServiceType,
  nowMs,
  onSwitchToAdmin,
  onBackToRoleSelect,
  onOpenSamples,
  onOpenOrderModal,
  onToast,
}: ClientPortalViewProps) {
  const [codeInput, setCodeInput] = useState(initialOrderCode);
  const [activeCode, setActiveCode] = useState(
    initialOrderCode ? normalizeOrderCode(initialOrderCode) : ''
  );
  const [recentCodes, setRecentCodes] = useState<string[]>(loadRecentOrderCodes);
  const [portal, setPortal] = useState<TrackingPortalRecord | null>(null);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [previewAttachment, setPreviewAttachment] =
    useState<AttachmentItem | null>(null);
  const [activePolicyTab, setActivePolicyTab] = useState<PolicyTabKey | null>(
    null
  );

  const [homeTab, setHomeTabState] = useState<ClientPortalTab>(() => {
    if (initialOrderCode) return 'lookup';
    if (initialTab) return initialTab;
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    if (urlTab === 'order' || urlTab === 'lookup' || urlTab === 'checker') {
      return urlTab;
    }
    return 'order';
  });

  useEffect(() => {
    if (initialTab) {
      setHomeTabState(initialTab);
    }
  }, [initialTab]);

  const setHomeTab = (nextTab: ClientPortalTab) => {
    const changed = nextTab !== homeTab;
    setHomeTabState(nextTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', nextTab);
    if (changed) {
      window.history.pushState({}, '', url.toString());
    } else {
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Revision form state
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionMsg, setRevisionMsg] = useState('');
  const [submittingRev, setSubmittingRev] = useState(false);

  useEffect(() => {
    if (!activeCode) {
      setPortal(null);
      setRevisions([]);
      return;
    }

    setLoading(true);
    setLookupError('');

    const unsubPortal = subscribeTrackingPortal(activeCode, (data) => {
      setPortal(data);
      setLoading(false);
      if (!data) {
        setLookupError(
          `Không tìm thấy đơn hàng với mã "${activeCode}". Vui lòng kiểm tra lại.`
        );
      }
    });

    const unsubRevs = subscribeOrderRevisions(activeCode, (list) => {
      setRevisions(list);
    });

    return () => {
      unsubPortal();
      unsubRevs();
    };
  }, [activeCode]);

  const rememberOrderCode = (code: string) => {
    setRecentCodes((prev) => {
      const next = [code, ...prev.filter((c) => c !== code)].slice(0, 12);
      saveRecentOrderCodes(next);
      return next;
    });
  };

  const removeRecentOrderCode = (code: string) => {
    setRecentCodes((prev) => {
      const next = prev.filter((c) => c !== code);
      saveRecentOrderCodes(next);
      return next;
    });
  };

  const openOrderByCode = async (rawCode: string) => {
    const normalized = normalizeOrderCode(rawCode);
    if (!isValidOrderCode(normalized)) {
      setLookupError('Mã đơn hàng không hợp lệ (ví dụ: ASG-2026-001).');
      return;
    }
    setCodeInput(normalized);
    setLoading(true);
    setLookupError('');
    try {
      const found = await fetchTrackingPortalOnce(normalized);
      if (!found) {
        setLookupError(`Không tìm thấy đơn hàng với mã "${normalized}".`);
        setLoading(false);
        return;
      }
      setActiveCode(normalized);
      rememberOrderCode(normalized);
      const url = new URL(window.location.href);
      url.searchParams.set('code', normalized);
      window.history.replaceState({}, '', url.toString());
    } catch {
      setLookupError('Không thể tra cứu mã đơn lúc này.');
      setLoading(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    await openOrderByCode(codeInput);
  };

  const handleResetLookup = () => {
    setActiveCode('');
    setPortal(null);
    setLookupError('');
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.toString());
  };

  const handleSubmitRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal || !revisionMsg.trim() || submittingRev) return;
    setSubmittingRev(true);
    try {
      await createRevisionRequest(portal.orderCode, revisionMsg.trim());
      setRevisionMsg('');
      setShowRevisionForm(false);
      onToast('Đã gửi yêu cầu chỉnh sửa tới Admin.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gửi yêu cầu thất bại.');
    } finally {
      setSubmittingRev(false);
    }
  };

  const isFullyPaid = portal?.paymentStatus === 'fully_paid';
  const currentStageMeta = portal ? getStageMeta(portal.stage) : null;
  const displayName = portal ? `Khách đơn #${portal.orderCode}` : 'Khách hàng';

  const tabHeroMeta: Record<
    ClientPortalTab,
    {
      eyebrow: string;
      titlePrefix: string;
      titleHighlight: string;
      subtitle: string;
      badges: string[];
    }
  > = {
    order: {
      eyebrow: 'AssignTrack · Đặt bài trực tuyến không cần đăng nhập',
      titlePrefix: 'ĐĂNG KÝ ĐẶT BÀI &',
      titleHighlight: 'BÁO GIÁ TRONG 15 PHÚT',
      subtitle:
        'Điền nhanh yêu cầu, đính kèm file đề bài / Rubric bảo mật — tư vấn viên báo giá rõ ràng và cấp Mã đơn theo dõi tiến độ 24/7.',
      badges: [
        'Báo giá minh bạch trước khi làm',
        'Tải lên file đề bài bảo mật',
        'Tặng báo cáo Turnitin & AI 0%',
      ],
    },
    lookup: {
      eyebrow: 'AssignTrack · Cổng theo dõi thời gian thực 24/7',
      titlePrefix: 'TRA CỨU TIẾN ĐỘ',
      titleHighlight: 'BẰNG MÃ ĐƠN HÀNG',
      subtitle:
        'Không cần tạo tài khoản — nhập Mã đơn hàng (Passcode) được cấp để theo dõi 6 mốc tiến độ, xem trước bài viết và thanh toán QR.',
      badges: [
        'Cập nhật 6 mốc tiến độ trực tiếp',
        'Xem trước tài liệu & Turnitin',
        'Nhắn tin trực tiếp với đội ngũ',
      ],
    },
    checker: {
      eyebrow: 'AssignTrack · Công cụ kiểm định học thuật miễn phí',
      titlePrefix: 'KIỂM TRA',
      titleHighlight: 'ĐẠO VĂN & AI SƠ BỘ',
      subtitle:
        'Tải lên file Word/PDF hoặc dán văn bản để phân tích từng câu, phát hiện đoạn trùng lặp và dấu vết AI hoàn toàn miễn phí.',
      badges: [
        'Miễn phí · Không cần đăng nhập',
        'Phân tích chi tiết từng câu',
        'Không lưu trữ bài viết của bạn',
      ],
    },
  };

  const currentHero = tabHeroMeta[homeTab];
  const showHeroBanner = !portal && !(activeCode && loading);

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#0F172A] flex flex-col">
      <PublicTopNav
        activeNav={portal ? 'lookup' : homeTab}
        onGoHome={() => {
          if (onBackToRoleSelect) {
            onBackToRoleSelect();
          } else {
            handleResetLookup();
            setHomeTab('lookup');
          }
        }}
        onOpenOrder={() => {
          if (onOpenOrderModal) {
            onOpenOrderModal();
          } else {
            handleResetLookup();
            setHomeTab('order');
          }
        }}
        onOpenLookup={() => {
          handleResetLookup();
          setHomeTab('lookup');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenChecker={() => {
          handleResetLookup();
          setHomeTab('checker');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenSamples={() => {
          if (onOpenSamples) {
            onOpenSamples();
          } else if (onBackToRoleSelect) {
            onBackToRoleSelect();
          }
        }}
        onSelectAdmin={onSwitchToAdmin}
      />

      {/* Deep Academic Navy Blueprint Hero Banner (Synchronized with Landing Page & Sample Library) */}
      {showHeroBanner && (
        <section className="relative overflow-hidden bg-[#0B2559] text-white py-10 sm:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #93C5FD 1px, transparent 1px), linear-gradient(to bottom, #93C5FD 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[620px] h-[280px] rounded-full bg-sky-400/15 blur-3xl"
          />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold uppercase tracking-[0.1em] text-sky-200">
              <span className="w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_8px_#7DD3FC]" />
              <span>{currentHero.eyebrow}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-[-0.03em] leading-tight">
              {currentHero.titlePrefix}{' '}
              <span className="text-sky-300">{currentHero.titleHighlight}</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-200/85 max-w-2xl mx-auto leading-relaxed">
              {currentHero.subtitle}
            </p>

            <div className="pt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-200">
              <span className="inline-flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-sky-300" />
                <span>{currentHero.badges[0]}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>{currentHero.badges[1]}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{currentHero.badges[2]}</span>
              </span>
            </div>
          </div>
        </section>
      )}

      <main
        className={`flex-1 w-full ${
          !portal && (homeTab === 'order' || homeTab === 'checker' || homeTab === 'lookup')
            ? 'max-w-6xl'
            : 'max-w-5xl'
        } mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10`}
      >
        {(() => {
          if (activeCode && loading && !portal) {
            return (
              <div className="surface-enter max-w-md mx-auto mt-10 bg-white border border-zinc-200 rounded-2xl p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-900">
                  Đang mở khóa tiến độ đơn hàng #{activeCode}...
                </p>
                <p className="text-xs text-zinc-500">Vui lòng chờ trong giây lát.</p>
              </div>
            );
          }

          if (!activeCode || !portal) {
            if (homeTab === 'order') {
              return (
                <div className="surface-enter">
                  <ClientOrderFormView
                    defaultServiceType={initialServiceType}
                    onGoToLookup={() => setHomeTab('lookup')}
                    onToast={onToast}
                  />
                </div>
              );
            }

            if (homeTab === 'checker') {
              return (
                <div className="surface-enter">
                  <ClientIntegrityCheckerView onToast={onToast} />
                </div>
              );
            }

            return (
              <div className="surface-enter space-y-5">
                {/* Row 1: 2-Column Hero Split — Tra cứu bằng Mã đơn (Passcode) + Cam kết cốt lõi */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  <section className="relative overflow-hidden lg:col-span-7 bg-white border border-zinc-200/90 rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-[0_14px_38px_rgba(15,23,42,0.06)] space-y-5">
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#0B2559] via-[#12489B] to-[#F5B700]"
                    />

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#12489B] text-[11px] font-semibold">
                          <KeyRound className="w-3 h-3" />
                          <span>Mở khóa nhanh bằng Mã đơn hàng (Passcode)</span>
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                          Nhập mã đơn hàng của bạn
                        </h2>
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          Không cần tài khoản — nhập chính xác <strong>Mã đơn hàng</strong> do AssignTrack cung cấp để xem tiến độ, tài liệu &amp; thanh toán.
                        </p>
                      </div>

                      <form onSubmit={handleLookup} className="space-y-2">
                        <label className="block text-xs font-medium text-slate-700">
                          Mã đơn hàng (Passcode) *
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2 p-1.5 bg-slate-100/80 border border-slate-200/90 rounded-2xl focus-within:bg-white focus-within:border-[#12489B]/75 focus-within:ring-4 focus-within:ring-[#12489B]/10 transition-colors">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={codeInput}
                              onChange={(e) => setCodeInput(e.target.value)}
                              placeholder="Ví dụ: ASG-2026-001"
                              className="w-full pl-9 pr-3 py-2 text-sm font-mono uppercase bg-transparent border-0 text-slate-900 placeholder:text-zinc-400 rounded-xl focus:outline-none"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={loading || !codeInput.trim()}
                            className="btn-press sm:w-auto w-full py-2 px-5 text-sm font-semibold bg-gradient-to-r from-[#0B2559] to-[#12489B] hover:from-[#081B42] hover:to-[#0E3A7D] text-white rounded-xl shadow-[0_6px_16px_-6px_rgba(11,37,89,0.5)] disabled:opacity-75 whitespace-nowrap shrink-0"
                          >
                            {loading ? 'Đang mở khóa...' : 'Mở khóa đơn hàng'}
                          </button>
                        </div>

                        {lookupError && (
                          <p className="text-xs text-[#DC2626] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {lookupError}
                          </p>
                        )}
                      </form>
                    </div>

                    {/* Locally Saved Recent Passcodes */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          <Bookmark className="w-3.5 h-3.5 text-[#12489B]" />
                          Mã đơn đã mở gần đây trên máy này
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                          {recentCodes.length} mã
                        </span>
                      </div>

                      {recentCodes.length === 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                          <span>
                            Mã đơn hợp lệ sau khi mở sẽ tự lưu nhanh tại đây.
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onOpenOrderModal
                                ? onOpenOrderModal()
                                : setHomeTab('order')
                            }
                            className="font-bold text-[#EA580C] hover:underline"
                          >
                            Chưa có mã đơn? Đăng ký đặt bài mới →
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {recentCodes.map((savedCode) => (
                            <div
                              key={savedCode}
                              className="inline-flex items-center bg-blue-50/60 border border-blue-200/70 rounded-lg overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => void openOrderByCode(savedCode)}
                                className="btn-press px-2.5 py-1 text-xs font-mono font-semibold text-[#12489B] hover:bg-blue-100/70"
                              >
                                #{savedCode}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRecentOrderCode(savedCode)}
                                aria-label={`Bỏ lưu ${savedCode}`}
                                className="px-1.5 py-1 text-blue-400 hover:text-[#DC2626] hover:bg-red-50 border-l border-blue-200/70"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="lg:col-span-5">
                    <ClientValuePropCard />
                  </div>
                </div>

                {/* Row 2 (Social Proof Strip) + Row 3 (3 Service Cards) */}
                <ClientLandingSections
                  onOpenChecker={(hintToast) => {
                    handleResetLookup();
                    setHomeTab('checker');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    if (hintToast) {
                      onToast(hintToast);
                    }
                  }}
                />
              </div>
            );
          }

          return (
          <div className="surface-enter space-y-6">
            {/* Back + Update Timestamp */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleResetLookup}
                className="btn-press inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Tra cứu mã khác
              </button>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                Cập nhật: {new Date(portal.updatedAt).toLocaleString('vi-VN')}
              </span>
            </div>

            {/* Order Focal Header & 6-Stage Progress */}
            <section className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-600">
                    <span className="font-mono font-semibold text-[#12489B]">
                      #{portal.orderCode}
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span>{portal.subject}</span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span className="font-mono tabular-nums">
                      {portal.wordCount.toLocaleString('vi-VN')} từ
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span>Trích dẫn {portal.citationStyle}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {portal.topic}
                  </h1>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                  <DeadlineBadge
                    deadlineAt={portal.deadlineAt}
                    nowMs={nowMs}
                    orderStatus={portal.orderStatus}
                  />
                  <span className="text-xs text-zinc-500 font-mono tabular-nums">
                    Hạn nộp: {formatDateTime(portal.deadlineAt)}
                  </span>
                </div>
              </div>

              {/* GPU-composited Progress Bar & 6-stage Pipeline */}
              <div className="space-y-3 pt-4 border-t border-zinc-100">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-900">
                    {currentStageMeta?.step}. {currentStageMeta?.label}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#12489B] tabular-nums">
                    {portal.progressPercent}%
                  </span>
                </div>

                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="progress-fill h-full w-full bg-[#12489B]"
                    style={{ transform: `scaleX(${portal.progressPercent / 100})` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                  {ORDER_STAGES.map((st) => {
                    const currentStep = currentStageMeta?.step || 1;
                    const done = st.step <= currentStep;
                    const isCurrent = st.step === currentStep;
                    let stepCardClass = 'bg-white border-zinc-100 text-zinc-400';
                    if (isCurrent) {
                      stepCardClass =
                        'bg-blue-50/80 border-[#12489B]/40 text-[#12489B] font-semibold';
                    } else if (done) {
                      stepCardClass = 'bg-zinc-50 border-zinc-200 text-slate-800';
                    }
                    return (
                      <div
                        key={st.key}
                        className={`px-2.5 py-2 rounded-lg border text-xs transition-colors ${stepCardClass}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {done && !isCurrent && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                          )}
                          <span className="truncate">
                            {st.step}. {st.shortLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {portal.publicStatusNote && (
                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl px-4 py-3 text-sm text-slate-800 max-w-[65ch]">
                    <span className="text-xs font-semibold text-zinc-500 block mb-0.5">
                      Ghi chú tiến độ mới nhất từ người viết
                    </span>
                    {portal.publicStatusNote}
                  </div>
                )}
              </div>
            </section>

            {/* 2-Column Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Brief Verification, Files, Revisions */}
              <div className="lg:col-span-7 space-y-6">
                {(portal.outlineAndInstructions || portal.rubricNotes) && (
                  <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Thông tin đề bài & Dàn ý đã chốt
                    </h2>
                    {portal.outlineAndInstructions && (
                      <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50 border border-zinc-200/80 rounded-lg p-3.5 max-w-[65ch]">
                        {portal.outlineAndInstructions}
                      </div>
                    )}
                    {portal.rubricNotes && (
                      <div className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed max-w-[65ch]">
                        <span className="font-semibold text-zinc-800">
                          Rubric / Yêu cầu đặc biệt:{' '}
                        </span>
                        {portal.rubricNotes}
                      </div>
                    )}
                  </section>
                )}

                {/* Attachments & Page-Windowed Previews */}
                {(() => {
                  const visibleAttachments = portal.attachments.filter(
                    (att) => !att.isBackup
                  );
                  return (
                <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Tài liệu & Bài làm ({visibleAttachments.length})
                    </h2>
                    <span className="text-xs text-zinc-500">
                      Nhấn Xem trước để kiểm tra nội dung
                    </span>
                  </div>

                  {visibleAttachments.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-5 text-center">
                      Chưa có tài liệu nào được đính kèm.
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
                      {visibleAttachments.map((att) => {
                        const locked = att.isPaymentLocked && !isFullyPaid;
                        const isDeliverable =
                          att.category === 'draft' || att.category === 'final';
                        const safeUrl =
                          att.sourceType === 'upload'
                            ? getSafeExternalUrl(att.fileIdOrUrl)
                            : getSafeExternalUrl(att.fileIdOrUrl);
                        const downloadHref =
                          att.sourceType === 'upload' && safeUrl
                            ? `${safeUrl}?download=1`
                            : safeUrl;
                        const downloadTarget =
                          att.sourceType === 'url' ? '_blank' : undefined;
                        const downloadName =
                          att.sourceType === 'upload' ? att.name : undefined;

                        return (
                          <div
                            key={att.id}
                            className="hover-row p-3.5 bg-white flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <FileText className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {att.name}
                                  </p>
                                  {isDeliverable && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                      Bản mới nhất
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                  {CATEGORY_LABELS[att.category]}
                                  {att.sizeBytes > 0 && ` · ${formatBytes(att.sizeBytes)}`}
                                  {att.category === 'turnitin' &&
                                    ` · Xem đến trang ${(att.turnitinScorePage || 1) + 2}`}
                                  {locked &&
                                    ` · Khóa tải (xem trước ${att.previewMaxPages || 2} trang)`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(att)}
                                className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-900 rounded-lg whitespace-nowrap"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Xem trước
                              </button>

                              {locked && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#D97706] bg-amber-50 border border-amber-200 rounded-lg whitespace-nowrap">
                                  <Lock className="w-3 h-3" />
                                  Chờ thanh toán
                                </span>
                              )}

                              {!locked && Boolean(downloadHref) && (
                                <a
                                  href={downloadHref}
                                  target={downloadTarget}
                                  rel="noopener noreferrer"
                                  download={downloadName}
                                  className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] whitespace-nowrap"
                                >
                                  {att.sourceType === 'url' ? (
                                    <>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Mở link
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-3.5 h-3.5" />
                                      Tải xuống
                                    </>
                                  )}
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
                  );
                })()}

                {/* Revision Request Section */}
                <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">
                        Yêu cầu chỉnh sửa (Revision)
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Gửi phản hồi từ giảng viên trực tiếp tại đây để tránh trôi tin nhắn.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRevisionForm((v) => !v)}
                      className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Yêu cầu sửa
                    </button>
                  </div>

                  {showRevisionForm && (
                    <form
                      onSubmit={handleSubmitRevision}
                      className="surface-enter p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3"
                    >
                      <textarea
                        rows={3}
                        value={revisionMsg}
                        onChange={(e) => setRevisionMsg(e.target.value)}
                        maxLength={FIELD_LIMITS.revisionMessageMax}
                        placeholder="Mô tả chi tiết phần cần chỉnh sửa theo góp ý của giảng viên..."
                        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#12489B]/20 focus:border-[#12489B]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRevisionForm(false)}
                          className="btn-press px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900"
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          disabled={revisionMsg.trim().length < 3 || submittingRev}
                          className="btn-press inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] disabled:opacity-45"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Gửi yêu cầu
                        </button>
                      </div>
                    </form>
                  )}

                  {revisions.length > 0 && (
                    <div className="space-y-2.5">
                      {revisions.map((rev) => {
                        const revColorMap: Record<RevisionRequest['status'], string> = {
                          resolved: 'bg-emerald-50 text-[#16A34A] border-emerald-200',
                          in_progress: 'bg-amber-50 text-[#D97706] border-amber-200',
                          open: 'bg-blue-50 text-[#12489B] border-blue-200',
                        };
                        const revLabelMap: Record<RevisionRequest['status'], string> = {
                          resolved: 'Đã sửa xong',
                          in_progress: 'Đang xử lý',
                          open: 'Chờ xử lý',
                        };
                        return (
                          <div
                            key={rev.id}
                            className="border border-zinc-200 rounded-xl p-3.5 space-y-2 text-sm"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono text-zinc-500 tabular-nums">
                                {new Date(rev.createdAt).toLocaleString('vi-VN')}
                              </span>
                              <span
                                className={`px-2 py-0.5 font-medium rounded-md border ${revColorMap[rev.status]}`}
                              >
                                {revLabelMap[rev.status]}
                              </span>
                            </div>
                            <p className="text-slate-800 whitespace-pre-wrap">{rev.message}</p>
                            {rev.adminReply && (
                              <p className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200/80 rounded-lg p-2.5">
                                <span className="font-semibold text-slate-900">Phản hồi: </span>
                                {rev.adminReply}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column: Payment QR & 48h Live Chat */}
              <div className="lg:col-span-5 space-y-6">
                <PaymentQrCard
                  orderCode={portal.orderCode}
                  totalAmount={portal.totalAmount}
                  depositAmount={portal.depositAmount}
                  paidAmount={portal.paidAmount}
                  paymentStatus={portal.paymentStatus}
                  bankSnapshot={portal.bankSnapshot}
                  onToast={onToast}
                />

                <OrderChatPanel
                  orderCode={portal.orderCode}
                  senderRole="client"
                  senderName={displayName}
                />
              </div>
            </div>
          </div>
          );
        })()}
      </main>

      {/* Clean Footer (Synchronized with Landing Page) */}
      <footer className="bg-white border-t border-zinc-200/90 py-8 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <BrandLogo />
              <p className="text-xs text-zinc-500 max-w-md">
                AssignTrack — Nền tảng hỗ trợ học thuật, kiểm định đạo văn &amp; theo dõi tiến độ minh bạch dành cho sinh viên.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-xs font-semibold text-slate-600">
              {onBackToRoleSelect && (
                <button
                  type="button"
                  onClick={onBackToRoleSelect}
                  className="hover:text-[#12489B]"
                >
                  Trang chủ
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (onOpenOrderModal) {
                    onOpenOrderModal();
                  } else {
                    handleResetLookup();
                    setHomeTab('order');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="hover:text-[#EA580C]"
              >
                Đặt bài mới
              </button>
              {onOpenSamples && (
                <button
                  type="button"
                  onClick={onOpenSamples}
                  className="hover:text-[#12489B]"
                >
                  Sample Library
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  handleResetLookup();
                  setHomeTab('lookup');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-[#12489B]"
              >
                Tra cứu mã đơn
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetLookup();
                  setHomeTab('checker');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-[#12489B]"
              >
                Check Đạo văn &amp; AI
              </button>
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="hover:text-[#12489B]"
              >
                Đăng nhập Quản trị
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11.5px] text-zinc-500">
            <span>© {new Date().getFullYear()} AssignTrack Academic Support · Zalo: 0916.045.202</span>
            <div className="flex flex-wrap items-center gap-4 font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setActivePolicyTab('refund')}
                className="hover:text-[#12489B] underline-offset-2 hover:underline"
              >
                Chính sách Hoàn tiền
              </button>
              <button
                type="button"
                onClick={() => setActivePolicyTab('privacy')}
                className="hover:text-[#12489B] underline-offset-2 hover:underline"
              >
                Chính sách Bảo mật
              </button>
              <button
                type="button"
                onClick={() => setActivePolicyTab('terms')}
                className="hover:text-[#12489B] underline-offset-2 hover:underline"
              >
                Điều khoản Sử dụng
              </button>
            </div>
          </div>
        </div>
      </footer>

      <PolicyModal
        initialTab={activePolicyTab}
        onClose={() => setActivePolicyTab(null)}
      />

      <PdfPreviewModal
        attachment={previewAttachment}
        isFullyPaid={isFullyPaid}
        isAdmin={false}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
}
