import { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  callAiChatbot,
  fetchOpenAiCompatibleModels,
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
  onSaveSettings: (next: AiChatbotSettingsStore) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

const PROVIDER_TABS: { key: AiProviderType; shortLabel: string; badge: string }[] = [
  {
    key: 'custom_openai',
    shortLabel: 'Trạm API Bên thứ 3 (XingChi / NewAPI)',
    badge: 'Hỗ trợ mọi Endpoint sk-...',
  },
  { key: 'gemini', shortLabel: 'Google Gemini', badge: 'AI Studio' },
  { key: 'openai', shortLabel: 'OpenAI (ChatGPT)', badge: 'GPT-4o / o3' },
  { key: 'anthropic', shortLabel: 'Anthropic Claude', badge: 'Claude 3.7 / 3.5' },
];

const QUICK_ENDPOINT_PRESETS: { label: string; url: string; defaultModel: string }[] = [
  {
    label: 'XingChi API (api.xingchiapi.com)',
    url: 'https://api.xingchiapi.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  {
    label: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
  },
  {
    label: 'DeepSeek Official',
    url: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
];

export function WriterApiSettingsModal({
  isOpen,
  settings,
  onSaveSettings,
  onClose,
  onToast,
}: WriterApiSettingsModalProps) {
  const [draft, setDraft] = useState<AiChatbotSettingsStore>(settings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const activeProvider = draft.activeProvider;
  const currentProfile: AiProviderProfile = draft.profiles[activeProvider];
  const suggestedModels =
    fetchedModels.length > 0
      ? fetchedModels
      : AI_PROVIDER_SUGGESTED_MODELS[activeProvider] || [];

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

  const handleFetchModelsFromEndpoint = async () => {
    setFetchingModels(true);
    setTestResult(null);
    try {
      const models = await fetchOpenAiCompatibleModels(currentProfile);
      setFetchedModels(models);
      if (models.length > 0 && !models.includes(currentProfile.model)) {
        updateCurrentProfile({ model: models[0] });
      }
      setTestResult({
        ok: true,
        message: `Đã tải thành công ${models.length} Model mà Key/Group của bạn được phép gọi! Hãy bấm chọn 1 Model bên dưới.`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách Model từ Endpoint này.',
      });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const reply = await callAiChatbot({
        profile: currentProfile,
        systemPrompt: 'You are a helpful academic research assistant.',
        userPrompt:
          'Reply with a short 1-sentence confirmation in Vietnamese that the API connection is working properly.',
      });
      setTestResult({
        ok: true,
        message: `Kết nối thành công (${currentProfile.model}): "${reply.slice(0, 140)}"`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Kiểm tra kết nối thất bại. Vui lòng kiểm tra lại API Key, Base URL hoặc chọn đúng Model trong Group.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSaveSettings(draft);
    onToast(
      `Đã lưu cấu hình AI Chatbot: ${currentProfile.label} (${currentProfile.model})`
    );
    onClose();
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="modal-panel bg-white border border-zinc-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4338CA]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Cài đặt API Chatbot Nghiên cứu & Viết bài
              </h3>
              <p className="text-xs text-zinc-500">
                Hỗ trợ các trạm API bên thứ 3 (`https://api.xingchiapi.com`), Gemini, OpenAI, Claude.
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
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Provider selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              1. Chọn loại cổng API bạn đang dùng
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROVIDER_TABS.map((tab) => {
                const isSelected = activeProvider === tab.key;
                const hasKey = Boolean(draft.profiles[tab.key]?.apiKey?.trim());
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setTestResult(null);
                      setFetchedModels([]);
                      setDraft((prev) => ({ ...prev, activeProvider: tab.key }));
                    }}
                    className={`btn-press p-3 rounded-xl border text-left flex items-start justify-between ${
                      isSelected
                        ? 'border-[#4338CA] bg-indigo-50/60 ring-2 ring-indigo-500/15'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {tab.shortLabel}
                      </div>
                      <span className="inline-block mt-0.5 text-[11px] text-zinc-500">
                        {tab.badge}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        hasKey
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {hasKey ? 'Đã có Key' : 'Chưa có Key'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Base URL (Moved up so user sets Endpoint first for 3rd-party stations) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
              <label className="text-xs font-semibold text-slate-800">
                2. API Endpoint / Base URL (Hệ thống tự động thêm `/v1/chat/completions`)
              </label>
              {activeProvider === 'custom_openai' && (
                <div className="flex flex-wrap items-center gap-1">
                  {QUICK_ENDPOINT_PRESETS.map((p) => (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() =>
                        updateCurrentProfile({
                          baseUrl: p.url,
                          model: p.defaultModel,
                        })
                      }
                      className="btn-press px-2 py-0.5 text-[11px] font-medium bg-indigo-50 text-[#4338CA] hover:bg-indigo-100 rounded border border-indigo-200/80"
                    >
                      Điền {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="text"
              value={currentProfile.baseUrl}
              onChange={(e) =>
                updateCurrentProfile({ baseUrl: e.target.value })
              }
              placeholder="https://api.xingchiapi.com hoặc https://api.xingchiapi.com/v1"
              className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
            />
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              3. API Key ({currentProfile.label})
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showKey ? 'text' : 'password'}
                value={currentProfile.apiKey}
                onChange={(e) => updateCurrentProfile({ apiKey: e.target.value })}
                placeholder={
                  activeProvider === 'gemini'
                    ? 'AIzaSy...'
                    : activeProvider === 'anthropic'
                    ? 'sk-ant-api03-...'
                    : 'sk-...'
                }
                className="w-full pl-9 pr-10 py-2 text-sm font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
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
          </div>

          {/* Model Name + Auto-Fetch Button from 3rd party station */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-semibold text-slate-800">
                4. Tên Model (Phải nằm trong Group của Key — VD: `gpt-4o-mini`, `gpt-4o`...)
              </label>
              {(activeProvider === 'custom_openai' ||
                activeProvider === 'openai') && (
                <button
                  type="button"
                  disabled={fetchingModels || !currentProfile.apiKey.trim()}
                  onClick={() => void handleFetchModelsFromEndpoint()}
                  className="btn-press px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-md inline-flex items-center gap-1 disabled:opacity-40"
                >
                  {fetchingModels ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  <span>Tải danh sách Model từ Trạm API này</span>
                </button>
              )}
            </div>

            <input
              type="text"
              value={currentProfile.model}
              onChange={(e) => updateCurrentProfile({ model: e.target.value })}
              placeholder="Nhập tên model (VD: gpt-4o-mini, gpt-4o, claude-3-5-sonnet...)"
              className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
            />

            <div className="mt-2 max-h-28 overflow-y-auto p-2 bg-zinc-50 border border-zinc-200/80 rounded-lg">
              <div className="text-[11px] text-zinc-500 mb-1.5">
                {fetchedModels.length > 0
                  ? `Danh sách ${fetchedModels.length} Model lấy trực tiếp từ Endpoint của bạn (Bấm để chọn):`
                  : 'Chọn nhanh Model phổ biến (hoặc bấm nút "Tải danh sách Model" ở trên):'}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {suggestedModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateCurrentProfile({ model: m })}
                    className={`btn-press px-2 py-0.5 text-xs font-mono rounded-md border ${
                      currentProfile.model === m
                        ? 'bg-[#4338CA] text-white border-[#4338CA]'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Temperature */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <label className="text-xs font-semibold text-slate-800">
              5. Độ sáng tạo (Temperature: {currentProfile.temperature})
            </label>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={currentProfile.temperature}
              onChange={(e) =>
                updateCurrentProfile({
                  temperature: Number(e.target.value) || 0.4,
                })
              }
              className="w-48 accent-[#4338CA]"
            />
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
            disabled={testing || !currentProfile.apiKey.trim()}
            onClick={() => void handleTestConnection()}
            className="btn-press px-3.5 py-2 text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50 text-[#4338CA] hover:bg-indigo-100 disabled:opacity-40 inline-flex items-center gap-1.5"
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
              onClick={handleSave}
              className="btn-press px-5 py-2 text-xs font-semibold bg-[#4338CA] text-white rounded-lg hover:bg-indigo-700 shadow-xs"
            >
              Lưu & Sử dụng Chatbot này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
