import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  PerplexityOrchestratorModelInfo,
  callAiChatbot,
  fetchPerplexityOrchestratorModels,
  saveAiProviderKeyToServerVault,
  stripSecretsFromAiSettings,
  syncServerAiKeysStatus,
} from '../../../lib/aiWriterClient';
import {
  AI_PROVIDER_SUGGESTED_MODELS,
  AiChatbotSettingsStore,
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

const OTHER_PROVIDERS: {
  key: Exclude<AiProviderType, 'perplexity'>;
  label: string;
}[] = [
  { key: 'gemini', label: 'Google Gemini (2.5 Pro / Flash / 2.0 / 1.5)' },
  { key: 'openai', label: 'OpenAI ChatGPT (GPT-4.1 / GPT-4o / o3 / o4-mini)' },
  { key: 'anthropic', label: 'Anthropic Claude (Claude 4 / 3.7 / 3.5 Sonnet)' },
  {
    key: 'custom_openai',
    label: 'Custom OpenAI-Compatible (NVIDIA NIM / OpenRouter / DeepSeek)',
  },
];

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
  const [lastOtherProvider, setLastOtherProvider] = useState<
    Exclude<AiProviderType, 'perplexity'>
  >(
    settings.activeProvider === 'perplexity'
      ? 'gemini'
      : settings.activeProvider
  );
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingVault, setSavingVault] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [catalogModels, setCatalogModels] = useState<
    PerplexityOrchestratorModelInfo[]
  >([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(stripSecretsFromAiSettings(settings));
    setTestResult(null);
    void syncServerAiKeysStatus().then((status) => {
      onUpdateServerKeysConfigured(status);
    });
  }, [isOpen, settings, onUpdateServerKeysConfigured]);

  const activeProvider = draft.activeProvider;
  const isPerplexityMode = activeProvider === 'perplexity';
  const currentProfile: AiProviderProfile = draft.profiles[activeProvider];
  const isCurrentProviderConfiguredOnServer = Boolean(
    serverKeysConfigured[activeProvider]
  );

  useEffect(() => {
    if (!isOpen || !isPerplexityMode) return;
    if (!serverKeysConfigured.perplexity && !draft.profiles.perplexity?.apiKey?.trim()) {
      return;
    }
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        const res = await fetchPerplexityOrchestratorModels(
          draft.profiles.perplexity?.apiKey
        );
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
    isOpen,
    isPerplexityMode,
    draft.profiles.perplexity?.apiKey,
    serverKeysConfigured,
    onUpdateServerKeysConfigured,
  ]);

  if (!isOpen) return null;

  const agentPresets = [
    'pro-search',
    'deep-research',
    'advanced-deep-research',
    'fast-search',
  ];
  const suggestedModels =
    isPerplexityMode && catalogModels.length > 0
      ? Array.from(
          new Set([...agentPresets, ...catalogModels.map((m) => m.id)])
        )
      : AI_PROVIDER_SUGGESTED_MODELS[activeProvider] || [];

  const hasPerplexityKey =
    Boolean(draft.profiles.perplexity?.apiKey?.trim()) ||
    serverKeysConfigured.perplexity;
  const hasOtherKey = OTHER_PROVIDERS.some(
    (p) =>
      Boolean(draft.profiles[p.key]?.apiKey?.trim()) ||
      serverKeysConfigured[p.key]
  );

  const selectMainCategory = (mode: 'perplexity' | 'other') => {
    setTestResult(null);
    if (mode === 'perplexity') {
      setDraft((prev) => ({ ...prev, activeProvider: 'perplexity' }));
    } else {
      setDraft((prev) => ({ ...prev, activeProvider: lastOtherProvider }));
    }
  };

  const selectOtherSubProvider = (
    sub: Exclude<AiProviderType, 'perplexity'>
  ) => {
    setTestResult(null);
    setLastOtherProvider(sub);
    setDraft((prev) => ({ ...prev, activeProvider: sub }));
  };

  const updateCurrentProfile = (patch: Partial<AiProviderProfile>) => {
    setTestResult(null);
    setDraft((prev) => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [activeProvider]: {
          ...prev.profiles[activeProvider],
          ...patch,
        },
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

  const handleFetchOrchestratorCatalog = async () => {
    setLoadingCatalog(true);
    setTestResult(null);
    try {
      await persistEnteredKeysToVault();
      const res = await fetchPerplexityOrchestratorModels();
      if (res.serverKeyConfigured) {
        onUpdateServerKeysConfigured({
          ...serverKeysConfigured,
          perplexity: true,
        });
      }
      setCatalogModels(res.models);
      if (res.models.length > 0) {
        const exists = res.models.some((m) => m.id === currentProfile.model);
        if (!exists) {
          updateCurrentProfile({
            model: res.models[0].id,
            baseUrl: 'https://api.perplexity.ai/orchestrator/v1',
          });
        }
        onToast(
          `Đã tải ${res.models.length} model từ Perplexity Orchestrator (/orchestrator/v1/models).`
        );
      } else {
        onToast('API phản hồi thành công nhưng danh sách model trống.');
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách model từ Perplexity Orchestrator.',
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
      const reply = await callAiChatbot({
        profile: { ...currentProfile, apiKey: '' },
        systemPrompt: 'You are a helpful academic research assistant.',
        userPrompt:
          'Reply with a short 1-sentence confirmation in Vietnamese that the API connection is working properly.',
      });
      setTestResult({
        ok: true,
        message: `Kết nối thành công (${currentProfile.model}): "${reply.slice(
          0,
          140
        )}"`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Kiểm tra kết nối thất bại. Vui lòng kiểm tra lại API Key hoặc URL.',
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
      onToast(
        `Đã lưu bảo mật trên Server Vault & kích hoạt: ${currentProfile.label} (${currentProfile.model})`
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

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div
        className="modal-panel bg-white border border-zinc-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#12489B]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Cài đặt Mô hình AI Nghiên cứu Học thuật (Server Vault)
              </h3>
              <p className="text-xs text-zinc-500">
                Mọi API Key đều được lưu ẩn hoàn toàn trên Server — không lưu ở trình duyệt hay Developer Mode.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-press p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 1. Two Consolidated Options: Perplexity Orchestrator vs All Other Models */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              1. Chọn chế độ Mô hình AI
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Perplexity Agent API */}
              <button
                type="button"
                onClick={() => selectMainCategory('perplexity')}
                className={`btn-press p-3.5 rounded-xl border text-left flex flex-col justify-between gap-2 ${
                  isPerplexityMode
                    ? 'border-[#12489B] bg-blue-50/60 ring-2 ring-blue-500/15'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Globe className="w-4 h-4 text-[#12489B] shrink-0" />
                    <span>Perplexity Agent API (Web-Grounded)</span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      hasPerplexityKey
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-100/80 text-[#12489B]'
                    }`}
                  >
                    {hasPerplexityKey ? 'Đã khóa trên Server' : 'Agent + Web Search'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Tra cứu học thuật &amp; Web thực tế qua <code>POST /v1/agent</code> (Presets: <code>pro-search</code>, <code>deep-research</code>, hoặc model <code>openai/gpt-5.6-sol</code>, <code>anthropic/claude-sonnet-5-5</code>...).
                </p>
              </button>

              {/* Option B: All Other AI Models Consolidated */}
              <button
                type="button"
                onClick={() => selectMainCategory('other')}
                className={`btn-press p-3.5 rounded-xl border text-left flex flex-col justify-between gap-2 ${
                  !isPerplexityMode
                    ? 'border-[#12489B] bg-blue-50/60 ring-2 ring-blue-500/15'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Sparkles className="w-4 h-4 text-[#12489B] shrink-0" />
                    <span>Các Mô hình AI khác (Key riêng)</span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      hasOtherKey
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {hasOtherKey ? 'Đã khóa trên Server' : 'Đa nền tảng'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Dùng API Key trực tiếp của Google Gemini, OpenAI, Anthropic Claude, NVIDIA NIM hoặc OpenRouter.
                </p>
              </button>
            </div>
          </div>

          {/* Sub-provider selector when "Other AI Models" is active */}
          {!isPerplexityMode && (
            <div className="popover-enter p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/90 space-y-2">
              <label className="block text-xs font-semibold text-slate-800">
                Chọn nền tảng trong nhóm Mô hình AI khác:
              </label>
              <select
                value={activeProvider}
                onChange={(e) =>
                  selectOtherSubProvider(
                    e.target.value as Exclude<AiProviderType, 'perplexity'>
                  )
                }
                className="w-full px-3 py-2 text-xs font-semibold bg-white border border-zinc-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#12489B]"
              >
                {OTHER_PROVIDERS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* API Key Input (Write-Only to Server Vault) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                2. API Key ({currentProfile.label})
              </label>
              {isCurrentProviderConfiguredOnServer && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Đã lưu bảo mật trên Server (Ẩn hoàn toàn khỏi Frontend)</span>
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
                  updateCurrentProfile({ apiKey: e.target.value })
                }
                placeholder={
                  isCurrentProviderConfiguredOnServer
                    ? '•••••••••••••••••••••••••••••••• (Nhập key mới nếu muốn thay đổi)'
                    : activeProvider === 'perplexity'
                    ? 'Nhập Perplexity API Key (pplx-...) để lưu lên Server'
                    : activeProvider === 'gemini'
                    ? 'Nhập Gemini API Key (AIzaSy...) để lưu lên Server'
                    : activeProvider === 'anthropic'
                    ? 'Nhập Anthropic Key (sk-ant-...) để lưu lên Server'
                    : 'Nhập API Key (sk-... / nvapi-...) để lưu lên Server'
                }
                className="w-full pl-9 pr-10 py-2 text-sm font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#12489B]"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700"
                title={showKey ? 'Ẩn API Key' : 'Hiện API Key'}
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Ngay khi bấm Lưu hoặc Kiểm tra, Key sẽ được chuyển thẳng vào kho bảo mật trên Server và xóa trắng khỏi bộ nhớ trình duyệt (F12 / LocalStorage sẽ không bao giờ đọc được Key).
            </p>
          </div>

          {/* Model Name + Suggested / Catalog Chips */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                3. Preset hoặc Phiên bản Model (
                {isPerplexityMode
                  ? 'Agent Preset (pro-search, deep-research) hoặc creator/model-name'
                  : currentProfile.label}
                )
              </label>

              {isPerplexityMode && (
                <button
                  type="button"
                  disabled={loadingCatalog}
                  onClick={() => void handleFetchOrchestratorCatalog()}
                  className="btn-press inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-blue-50 text-[#12489B] border border-blue-200 hover:bg-blue-100 disabled:opacity-40"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${loadingCatalog ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {loadingCatalog
                      ? 'Đang tải...'
                      : 'Tải danh sách Model được cấp theo Key'}
                  </span>
                </button>
              )}
            </div>

            <input
              type="text"
              value={currentProfile.model}
              onChange={(e) => updateCurrentProfile({ model: e.target.value })}
              placeholder={
                isPerplexityMode
                  ? 'pro-search, deep-research, openai/gpt-5.6-sol, anthropic/claude-sonnet-5-5...'
                  : 'Nhập tên model (VD: gemini-2.5-pro, gpt-4.1, claude-sonnet-4-20250514...)'
              }
              className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#12489B]"
            />

            <div className="flex flex-wrap items-center gap-1.5 mt-2 max-h-32 overflow-y-auto">
              <span className="text-[11px] text-zinc-500 mr-1">
                {isPerplexityMode && catalogModels.length > 0
                  ? `Presets & Model theo Key (${suggestedModels.length}):`
                  : 'Chọn nhanh Preset / Model:'}
              </span>
              {suggestedModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    const nextBase = isPerplexityMode
                      ? /^sonar/i.test(m)
                        ? 'https://api.perplexity.ai'
                        : currentProfile.baseUrl.includes('/orchestrator') &&
                          !agentPresets.includes(m)
                        ? currentProfile.baseUrl
                        : 'https://api.perplexity.ai/v1/agent'
                      : currentProfile.baseUrl;
                    updateCurrentProfile({ model: m, baseUrl: nextBase });
                  }}
                  className={`btn-press px-2 py-0.5 text-xs font-mono rounded-md border ${
                    currentProfile.model === m
                      ? 'bg-[#12489B] text-white border-[#12489B]'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Base URL & Temperature */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800">
                4. API Base URL
              </label>
              <input
                type="text"
                value={currentProfile.baseUrl}
                onChange={(e) =>
                  updateCurrentProfile({ baseUrl: e.target.value })
                }
                placeholder={
                  isPerplexityMode
                    ? 'https://api.perplexity.ai/v1/agent'
                    : 'https://api.openai.com/v1'
                }
                className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#12489B]"
              />
              {isPerplexityMode && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-zinc-500">Chuẩn giao thức:</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateCurrentProfile({
                        baseUrl: 'https://api.perplexity.ai/v1/agent',
                      })
                    }
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                      currentProfile.baseUrl.replace(/\/+$/, '') ===
                        'https://api.perplexity.ai/v1/agent' ||
                      currentProfile.baseUrl.replace(/\/+$/, '') ===
                        'https://api.perplexity.ai/v1/responses'
                        ? 'bg-blue-50 text-[#12489B] border-blue-200 font-semibold'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                    }`}
                  >
                    Agent API (/v1/agent · Web Search)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateCurrentProfile({
                        baseUrl: 'https://api.perplexity.ai/orchestrator/v1',
                      })
                    }
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                      currentProfile.baseUrl.replace(/\/+$/, '') ===
                      'https://api.perplexity.ai/orchestrator/v1'
                        ? 'bg-blue-50 text-[#12489B] border-blue-200 font-semibold'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                    }`}
                  >
                    Orchestrator (/orchestrator/v1)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateCurrentProfile({
                        baseUrl: 'https://api.perplexity.ai',
                      })
                    }
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                      currentProfile.baseUrl.replace(/\/+$/, '') ===
                      'https://api.perplexity.ai'
                        ? 'bg-blue-50 text-[#12489B] border-blue-200 font-semibold'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                    }`}
                  >
                    Sonar Legacy
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Độ sáng tạo (Temp: {currentProfile.temperature})
              </label>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.1}
                value={currentProfile.temperature}
                onChange={(e) =>
                  updateCurrentProfile({
                    temperature: Number(e.target.value) || 0.2,
                  })
                }
                className="w-full accent-[#12489B] mt-2"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                <span>0.1 (Chuẩn xác)</span>
                <span>1.0 (Đa dạng)</span>
              </div>
            </div>
          </div>

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
        <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={
              testing ||
              (!currentProfile.apiKey.trim() &&
                !isCurrentProviderConfiguredOnServer)
            }
            onClick={() => void handleTestConnection()}
            className="btn-press px-3.5 py-2 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50 text-[#12489B] hover:bg-blue-100 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Kiểm tra kết nối API</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-press px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60 rounded-lg"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={savingVault}
              onClick={() => void handleSave()}
              className="btn-press px-5 py-2 text-xs font-semibold bg-[#12489B] text-white rounded-lg hover:bg-[#0B2559] shadow-xs disabled:opacity-40"
            >
              {savingVault ? 'Đang khóa bảo mật...' : 'Lưu & Sử dụng Mô hình này'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
