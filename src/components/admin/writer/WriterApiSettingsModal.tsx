import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  PenTool,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  PerplexityModelInfo,
  callAiChatbot,
  fetchPerplexityCatalogModels,
  normalizeHybridPipeline,
  resolveEffectiveWriterConfig,
  saveAiProviderKeyToServerVault,
  stripSecretsFromAiSettings,
  syncServerAiKeysStatus,
} from '../../../lib/aiWriterClient';
import {
  AI_PROVIDER_SUGGESTED_MODELS,
  AiChatbotSettingsStore,
  AiHybridPipelineConfig,
  AiProviderProfile,
  AiProviderType,
} from './types';

interface WriterApiSettingsModalProps {
  isOpen: boolean;
  settings: AiChatbotSettingsStore;
  serverKeysConfigured: Record<AiProviderType, boolean>;
  onUpdateServerKeysConfigured: (next: Record<AiProviderType, boolean>) => void;
  onSaveSettings: (next: AiChatbotSettingsStore) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

const PROVIDER_OPTIONS: {
  key: AiProviderType;
  label: string;
  shortLabel: string;
}[] = [
  { key: 'perplexity', label: 'Perplexity Agent API', shortLabel: 'Perplexity' },
  {
    key: 'custom_openai',
    label: 'Custom OpenAI (NIM / Zhipu)',
    shortLabel: 'Custom OpenAI',
  },
  { key: 'gemini', label: 'Google Gemini', shortLabel: 'Gemini' },
  { key: 'openai', label: 'OpenAI (ChatGPT)', shortLabel: 'OpenAI' },
  { key: 'anthropic', label: 'Anthropic Claude', shortLabel: 'Claude' },
];

const HYBRID_RESEARCH_OPTIONS: { value: string; label: string }[] = [
  { value: 'perplexity-search', label: 'Search API (/search) · Rẻ nhất' },
  { value: 'fast-search', label: 'fast-search · Agent Nhanh' },
  { value: 'pro-search', label: 'pro-search · Agent Cân bằng' },
  { value: 'deep-research', label: 'deep-research · Chuyên sâu' },
  {
    value: 'perplexity/glm-5.3-flash',
    label: 'glm-5.3-flash + Web Search',
  },
  {
    value: 'perplexity/glm-5.3',
    label: 'glm-5.3 + Web Search',
  },
];

const PERPLEXITY_PRESETS = [
  'fast-search',
  'pro-search',
  'deep-research',
  'advanced-deep-research',
];

const DEFAULT_PERPLEXITY_WRITER_MODELS = [
  'perplexity/glm-5.3-flash',
  'perplexity/glm-5.3',
  'google/gemini-3.5-flash',
  'google/gemini-3.8-flash',
  'perplexity/kimi-k3',
  'xai/grok-4.7',
];

function getProviderShortLabel(provider: AiProviderType): string {
  return (
    PROVIDER_OPTIONS.find((p) => p.key === provider)?.shortLabel || provider
  );
}

export function WriterApiSettingsModal({
  isOpen,
  settings,
  serverKeysConfigured,
  onUpdateServerKeysConfigured,
  onSaveSettings,
  onClose,
  onToast,
}: WriterApiSettingsModalProps) {
  const [draft, setDraft] = useState<AiChatbotSettingsStore>(() =>
    stripSecretsFromAiSettings(settings)
  );
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);
  const [customWriterModelMode, setCustomWriterModelMode] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingVault, setSavingVault] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [catalogModels, setCatalogModels] = useState<PerplexityModelInfo[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const normalized = stripSecretsFromAiSettings(settings);
    setDraft(normalized);
    setTestResult(null);
    setCustomModelMode(false);
    setCustomWriterModelMode(false);
    setShowAdvanced(
      !normalized.hybridPipeline?.enabled &&
        normalized.activeProvider === 'custom_openai'
    );
    void syncServerAiKeysStatus().then((status) => {
      onUpdateServerKeysConfigured(status);
    });
  }, [isOpen, settings, onUpdateServerKeysConfigured]);

  const hybrid: AiHybridPipelineConfig = useMemo(
    () => normalizeHybridPipeline(draft.hybridPipeline),
    [draft.hybridPipeline]
  );

  // Saved/currently active configuration for the top banner
  const savedEffective = useMemo(
    () => resolveEffectiveWriterConfig(settings),
    [settings]
  );
  const savedReady = savedEffective.isHybrid
    ? Boolean(serverKeysConfigured.perplexity) &&
      Boolean(serverKeysConfigured[savedEffective.profile.provider])
    : Boolean(serverKeysConfigured[savedEffective.profile.provider]);

  const activeProvider = draft.activeProvider;
  const currentProfile: AiProviderProfile = draft.profiles[activeProvider];
  const perplexityProfile: AiProviderProfile = draft.profiles.perplexity;

  const needsPerplexityCatalog =
    isOpen &&
    (hybrid.enabled || activeProvider === 'perplexity') &&
    (serverKeysConfigured.perplexity || Boolean(perplexityProfile.apiKey.trim()));

  useEffect(() => {
    if (!needsPerplexityCatalog) return;
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        const res = await fetchPerplexityCatalogModels(perplexityProfile.apiKey);
        if (!cancelled) {
          if (res.serverKeyConfigured && !serverKeysConfigured.perplexity) {
            onUpdateServerKeysConfigured({
              ...serverKeysConfigured,
              perplexity: true,
            });
          }
          if (res.models.length > 0) {
            setCatalogModels(res.models);
          }
        }
      } catch {
        // Silent on initial probe
      }
    };
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [
    needsPerplexityCatalog,
    perplexityProfile.apiKey,
    serverKeysConfigured,
    onUpdateServerKeysConfigured,
  ]);

  if (!isOpen) return null;

  const perplexityCatalogIds = Array.from(
    new Set([
      ...DEFAULT_PERPLEXITY_WRITER_MODELS,
      ...catalogModels.map((m) => m.id),
    ])
  );

  const singleSuggestedModels =
    activeProvider === 'perplexity'
      ? Array.from(new Set([...PERPLEXITY_PRESETS, ...perplexityCatalogIds]))
      : AI_PROVIDER_SUGGESTED_MODELS[activeProvider] || [];

  const writerSuggestedModels = perplexityCatalogIds;

  const updateProfile = (
    provider: AiProviderType,
    patch: Partial<AiProviderProfile>
  ) => {
    setTestResult(null);
    setDraft((prev) => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [provider]: {
          ...prev.profiles[provider],
          ...patch,
        },
      },
    }));
  };

  const updateHybrid = (patch: Partial<AiHybridPipelineConfig>) => {
    setTestResult(null);
    setDraft((prev) => ({
      ...prev,
      hybridPipeline: {
        ...normalizeHybridPipeline(prev.hybridPipeline),
        ...patch,
      },
    }));
  };

  const persistEnteredKeysToVault = async (): Promise<void> => {
    const providers: AiProviderType[] = [
      'perplexity',
      'gemini',
      'openai',
      'anthropic',
      'custom_openai',
    ];
    let latestStatus = serverKeysConfigured;
    let savedAny = false;
    for (const p of providers) {
      const entered = (draft.profiles[p]?.apiKey || '').trim();
      if (entered) {
        latestStatus = await saveAiProviderKeyToServerVault(p, entered);
        savedAny = true;
      }
    }
    if (savedAny) {
      onUpdateServerKeysConfigured(latestStatus);
      setDraft((prev) => stripSecretsFromAiSettings(prev));
    }
  };

  const handleRefreshPerplexityModels = async () => {
    setLoadingCatalog(true);
    setTestResult(null);
    try {
      await persistEnteredKeysToVault();
      const res = await fetchPerplexityCatalogModels();
      if (res.serverKeyConfigured) {
        onUpdateServerKeysConfigured({
          ...serverKeysConfigured,
          perplexity: true,
        });
      }
      setCatalogModels(res.models);
      onToast(
        res.models.length > 0
          ? `Đã cập nhật ${res.models.length} model khả dụng theo Perplexity Key.`
          : 'Đã kết nối Perplexity nhưng danh sách model trống.'
      );
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách model từ Perplexity.',
      });
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await persistEnteredKeysToVault();
      const eff = resolveEffectiveWriterConfig(draft);

      if (eff.isHybrid) {
        // Test Step 1 (Perplexity Search / Agent) + Step 2 (Writer Model)
        await callAiChatbot({
          profile: { ...eff.researchProfile, apiKey: '' },
          systemPrompt:
            eff.researchProfile.model === 'perplexity-search'
              ? ''
              : 'Reply in 5 words or less.',
          userPrompt:
            eff.researchProfile.model === 'perplexity-search'
              ? 'academic research citation standards APA 7th edition'
              : 'Confirm Perplexity search is online.',
          enableWebSearch: true,
        });
        const writerReply = await callAiChatbot({
          profile: { ...eff.profile, apiKey: '' },
          systemPrompt: 'You are an academic writer assistant.',
          userPrompt:
            'Reply with a short 1-sentence confirmation in Vietnamese that the writer model is ready.',
          enableWebSearch: eff.enableWebSearch,
        });
        setTestResult({
          ok: true,
          message: `Kết nối 2 bước thành công! Tra cứu: ${eff.researchProfile.model} → Viết bài: ${eff.profile.model} ("${writerReply.slice(0, 100)}")`,
        });
      } else {
        const reply = await callAiChatbot({
          profile: { ...eff.profile, apiKey: '' },
          systemPrompt: 'You are a helpful academic research assistant.',
          userPrompt:
            'Reply with a short 1-sentence confirmation in Vietnamese that the API connection is working properly.',
        });
        setTestResult({
          ok: true,
          message: `Kết nối thành công (${eff.profile.model}): "${reply.slice(0, 120)}"`,
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Kiểm tra kết nối thất bại. Vui lòng kiểm tra lại API Key hoặc Model.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSavingVault(true);
    try {
      await persistEnteredKeysToVault();
      const scrubbed = stripSecretsFromAiSettings(draft);
      onSaveSettings(scrubbed);
      const eff = resolveEffectiveWriterConfig(scrubbed);
      onToast(
        eff.isHybrid
          ? `Đã kích hoạt chế độ Kết hợp: Perplexity (${eff.researchProfile.model}) → ${eff.profile.model}`
          : `Đã kích hoạt: ${getProviderShortLabel(eff.profile.provider)} (${eff.profile.model})`
      );
      onClose();
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Không thể lưu API Key vào kho bảo mật Server.',
      });
    } finally {
      setSavingVault(false);
    }
  };

  const canTest = hybrid.enabled
    ? Boolean(perplexityProfile.apiKey.trim()) ||
      Boolean(serverKeysConfigured.perplexity)
    : Boolean(currentProfile.apiKey.trim()) ||
      Boolean(serverKeysConfigured[activeProvider]);

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div
        className="modal-panel bg-white border border-zinc-200 rounded-2xl shadow-xl w-full max-w-[600px] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0B2559]/10 text-[#12489B] flex items-center justify-center">
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Cài đặt API Mô hình AI
              </h3>
              <p className="text-[11px] text-zinc-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>API Key được mã hóa &amp; ẩn hoàn toàn trên Server Vault</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-press p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Always-visible Currently Active API Banner (clean 1-line layout) */}
          <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  savedReady ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] font-semibold text-zinc-500 shrink-0">
                Đang dùng:
              </span>
              {savedEffective.isHybrid ? (
                <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#12489B] border border-blue-200/70 font-mono text-[11px] font-semibold truncate">
                    {savedEffective.researchProfile.model === 'perplexity-search'
                      ? 'PPLX /search'
                      : savedEffective.researchProfile.model}
                  </span>
                  <ArrowRight className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-mono text-[11px] font-semibold truncate">
                    {savedEffective.profile.model.replace(/^perplexity\//, '')}
                  </span>
                </div>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#12489B] border border-blue-200/70 font-mono text-[11px] font-semibold truncate">
                  {getProviderShortLabel(savedEffective.profile.provider)} ·{' '}
                  {savedEffective.profile.model}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
                savedReady
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {savedReady ? 'Sẵn sàng' : 'Chưa có Key'}
            </span>
          </div>

          {/* Minimalist 2-Mode Segmented Control */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-100 border border-zinc-200/80 gap-1">
            <button
              type="button"
              onClick={() => updateHybrid({ enabled: true })}
              className={`btn-press px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                hybrid.enabled
                  ? 'bg-white text-[#0B2559] shadow-xs border border-zinc-200/80'
                  : 'text-zinc-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Perplexity 2 bước (Tiết kiệm)</span>
            </button>
            <button
              type="button"
              onClick={() => updateHybrid({ enabled: false })}
              className={`btn-press px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                !hybrid.enabled
                  ? 'bg-white text-[#0B2559] shadow-xs border border-zinc-200/80'
                  : 'text-zinc-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Đơn lẻ (1 Mô hình)</span>
            </button>
          </div>

          {/* MODE A: PERPLEXITY-ONLY 2-STEP PIPELINE */}
          {hybrid.enabled ? (
            <div className="space-y-3">
              {/* Shared Perplexity API Key (single key for both steps) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-800">
                    Perplexity API Key (Dùng chung cho cả 2 bước)
                  </label>
                  {serverKeysConfigured.perplexity && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Đã lưu trên Server</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    value={perplexityProfile.apiKey}
                    onChange={(e) =>
                      updateProfile('perplexity', { apiKey: e.target.value })
                    }
                    placeholder={
                      serverKeysConfigured.perplexity
                        ? '•••••••••••••••••••••••• (Nhập key mới nếu muốn đổi)'
                        : 'Nhập Perplexity API Key (pplx-...)'
                    }
                    className="w-full pl-9 pr-9 py-2 text-xs font-mono bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#12489B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  >
                    {showKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Clean 2-Step Pipeline Stack */}
              <div className="space-y-2">
                {/* Step 1: Perplexity Web Research */}
                <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#12489B] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#12489B] shrink-0" />
                      <span>Tra cứu nguồn &amp; Trích dẫn mới nhất (Perplexity)</span>
                    </div>
                  </div>

                  <select
                    value={hybrid.researchModel}
                    onChange={(e) =>
                      updateHybrid({ researchModel: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-zinc-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#12489B]"
                  >
                    {HYBRID_RESEARCH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <p className="text-[11px] text-zinc-500">
                    {hybrid.researchModel === 'perplexity-search'
                      ? 'Lấy 12 kết quả web & URL thật qua POST /search — 0 token output LLM.'
                      : 'Chạy 1 lần cho mỗi đề tài qua /v1/agent để thu thập nguồn & trích dẫn chuẩn.'}
                  </p>
                </div>

                {/* Flow connector */}
                <div className="flex items-center justify-center -my-1">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] font-medium text-zinc-500">
                    <ArrowDown className="w-3 h-3 text-[#12489B]" />
                    <span>Đẩy nguồn thật sang Bước 2 · Tự tắt Web Search khi viết</span>
                  </div>
                </div>

                {/* Step 2: Perplexity Writer Model Only */}
                <div className="p-3.5 rounded-xl border border-zinc-200 bg-white space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <PenTool className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Model Perplexity viết bài hoàn chỉnh</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={loadingCatalog}
                        onClick={() => void handleRefreshPerplexityModels()}
                        className="btn-press inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-40"
                        title="Tải danh sách model theo Perplexity Key"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${loadingCatalog ? 'animate-spin' : ''}`}
                        />
                        <span>Đồng bộ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomWriterModelMode((v) => !v)}
                        className="text-[10px] font-medium text-[#12489B] hover:underline"
                      >
                        {customWriterModelMode ? 'Danh sách' : 'Tự nhập'}
                      </button>
                    </div>
                  </div>

                  {customWriterModelMode ||
                  !writerSuggestedModels.includes(hybrid.writerModel) ? (
                    <input
                      type="text"
                      value={hybrid.writerModel}
                      onChange={(e) =>
                        updateHybrid({
                          writerProvider: 'perplexity',
                          writerModel: e.target.value,
                        })
                      }
                      placeholder="perplexity/glm-5.3-flash"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-[#12489B]"
                    />
                  ) : (
                    <select
                      value={hybrid.writerModel}
                      onChange={(e) =>
                        updateHybrid({
                          writerProvider: 'perplexity',
                          writerModel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-zinc-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#12489B]"
                    >
                      {writerSuggestedModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}

                  <p className="text-[11px] text-zinc-500">
                    Khuyên dùng <code className="text-slate-700 font-semibold">perplexity/glm-5.3-flash</code> hoặc <code className="text-slate-700 font-semibold">perplexity/glm-5.3</code> để viết bài dài nhanh và tối ưu chi phí.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* MODE B: SINGLE PROVIDER (MINIMALIST) */
            <div className="space-y-3.5">
              {/* Provider + Model in clean 2-col layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Nền tảng AI
                  </label>
                  <select
                    value={activeProvider}
                    onChange={(e) => {
                      const next = e.target.value as AiProviderType;
                      setTestResult(null);
                      setCustomModelMode(false);
                      setShowAdvanced(next === 'custom_openai');
                      setDraft((prev) => ({ ...prev, activeProvider: next }));
                    }}
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-zinc-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#12489B]"
                  >
                    {PROVIDER_OPTIONS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-800">
                      Preset / Model
                    </label>
                    <div className="flex items-center gap-2">
                      {activeProvider === 'perplexity' && (
                        <button
                          type="button"
                          disabled={loadingCatalog}
                          onClick={() => void handleRefreshPerplexityModels()}
                          className="text-[10px] font-medium text-zinc-500 hover:text-[#12489B] inline-flex items-center gap-1 disabled:opacity-40"
                          title="Đồng bộ danh sách model theo Key"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${
                              loadingCatalog ? 'animate-spin' : ''
                            }`}
                          />
                          <span>Đồng bộ</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCustomModelMode((v) => !v)}
                        className="text-[10px] font-medium text-[#12489B] hover:underline"
                      >
                        {customModelMode ? 'Danh sách' : 'Tự nhập'}
                      </button>
                    </div>
                  </div>

                  {customModelMode ||
                  !singleSuggestedModels.includes(currentProfile.model) ? (
                    <input
                      type="text"
                      value={currentProfile.model}
                      onChange={(e) =>
                        updateProfile(activeProvider, {
                          model: e.target.value,
                          ...(activeProvider === 'perplexity'
                            ? { baseUrl: 'https://api.perplexity.ai/v1/agent' }
                            : {}),
                        })
                      }
                      placeholder="Nhập tên model..."
                      className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#12489B]"
                    />
                  ) : activeProvider === 'perplexity' ? (
                    <select
                      value={currentProfile.model}
                      onChange={(e) =>
                        updateProfile('perplexity', {
                          model: e.target.value,
                          baseUrl: 'https://api.perplexity.ai/v1/agent',
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-zinc-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#12489B]"
                    >
                      <optgroup label="Agent Presets (Tìm kiếm Web)">
                        {PERPLEXITY_PRESETS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup
                        label={`Model theo Key (${perplexityCatalogIds.length})`}
                      >
                        {perplexityCatalogIds.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  ) : (
                    <select
                      value={currentProfile.model}
                      onChange={(e) =>
                        updateProfile(activeProvider, { model: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-zinc-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#12489B]"
                    >
                      {singleSuggestedModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Clean API Key Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-800">
                    API Key ({getProviderShortLabel(activeProvider)})
                  </label>
                  {serverKeysConfigured[activeProvider] && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Đã lưu trên Server</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    value={currentProfile.apiKey}
                    onChange={(e) =>
                      updateProfile(activeProvider, { apiKey: e.target.value })
                    }
                    placeholder={
                      serverKeysConfigured[activeProvider]
                        ? '•••••••••••••••••••••••• (Nhập key mới nếu muốn thay đổi)'
                        : activeProvider === 'perplexity'
                        ? 'Nhập Perplexity API Key (pplx-...)'
                        : 'Nhập API Key...'
                    }
                    className="w-full pl-9 pr-9 py-2 text-xs font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#12489B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  >
                    {showKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Advanced Settings (Base URL & Temperature) */}
              <div className="border-t border-zinc-100 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="text-[11px] font-medium text-zinc-500 hover:text-slate-800 inline-flex items-center gap-1"
                >
                  {showAdvanced ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  <span>Tùy chỉnh nâng cao (Base URL &amp; Độ sáng tạo)</span>
                </button>

                {showAdvanced && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        API Base URL
                      </label>
                      <input
                        type="text"
                        value={currentProfile.baseUrl}
                        onChange={(e) =>
                          updateProfile(activeProvider, {
                            baseUrl: e.target.value,
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#12489B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        Nhiệt độ ({currentProfile.temperature})
                      </label>
                      <input
                        type="range"
                        min={0.1}
                        max={1.0}
                        step={0.1}
                        value={currentProfile.temperature}
                        onChange={(e) =>
                          updateProfile(activeProvider, {
                            temperature: Number(e.target.value) || 0.2,
                          })
                        }
                        className="w-full accent-[#12489B] mt-1.5"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Test Connection Result */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="break-words">{testResult.message}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={testing || !canTest}
            onClick={() => void handleTestConnection()}
            className="btn-press px-3 py-2 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50 text-[#12489B] hover:bg-blue-100 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Kiểm tra</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-press px-3.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60 rounded-lg"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={savingVault}
              onClick={() => void handleSave()}
              className="btn-press px-4 py-2 text-xs font-semibold bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] shadow-xs disabled:opacity-40"
            >
              {savingVault ? 'Đang lưu...' : 'Lưu & Áp dụng'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
