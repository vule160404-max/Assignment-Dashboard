import { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { callAiChatbot } from '../../../lib/aiWriterClient';
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
  { key: 'gemini', shortLabel: 'Google Gemini', badge: 'Gemini 2.5 Pro / Flash' },
  { key: 'openai', shortLabel: 'OpenAI (ChatGPT)', badge: 'GPT-4.1 / GPT-4o / o3' },
  {
    key: 'anthropic',
    shortLabel: 'Anthropic Claude',
    badge: 'Claude 4 / 3.7 Sonnet',
  },
  {
    key: 'custom_openai',
    shortLabel: 'Custom API (OpenRouter / DeepSeek / Groq)',
    badge: 'Tương thích OpenAI',
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
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const activeProvider = draft.activeProvider;
  const currentProfile: AiProviderProfile = draft.profiles[activeProvider];
  const suggestedModels = AI_PROVIDER_SUGGESTED_MODELS[activeProvider] || [];

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
            : 'Kiểm tra kết nối thất bại. Vui lòng kiểm tra lại API Key hoặc URL.',
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
      <div className="modal-panel bg-white border border-zinc-200 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
                Chọn nền tảng AI, nhập API Key và phiên bản Model để tự động lập dàn ý & viết từng mục.
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
          {/* Provider selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              1. Chọn Hãng AI Chatbot đang sử dụng
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PROVIDER_TABS.map((tab) => {
                const isSelected = activeProvider === tab.key;
                const hasKey = Boolean(draft.profiles[tab.key]?.apiKey?.trim());
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setTestResult(null);
                      setDraft((prev) => ({ ...prev, activeProvider: tab.key }));
                    }}
                    className={`btn-press p-3 rounded-xl border text-left flex items-start justify-between ${
                      isSelected
                        ? 'border-[#4338CA] bg-indigo-50/60 ring-2 ring-indigo-500/15'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{tab.shortLabel}</span>
                      </div>
                      <span className="inline-block mt-1 text-[11px] text-zinc-500">
                        {tab.badge}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        hasKey
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {hasKey ? 'Đã có Key' : 'Chưa nhập Key'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              2. API Key ({currentProfile.label})
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
            <p className="text-[11px] text-zinc-500 mt-1">
              API Key được lưu cục bộ trên trình duyệt của bạn và gọi qua kết nối bảo mật.
            </p>
          </div>

          {/* Model Name + Suggested Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              3. Phiên bản Model (Chọn nhanh bên dưới hoặc tự gõ tên Model mới)
            </label>
            <input
              type="text"
              value={currentProfile.model}
              onChange={(e) => updateCurrentProfile({ model: e.target.value })}
              placeholder="Nhập tên model (VD: gemini-2.5-pro, gpt-4.1, claude-sonnet-4-20250514...)"
              className="w-full px-3 py-2 text-sm font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
            />
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-zinc-500 mr-1">Phiên bản có sẵn:</span>
              {suggestedModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateCurrentProfile({ model: m })}
                  className={`btn-press px-2 py-0.5 text-xs font-mono rounded-md border ${
                    currentProfile.model === m
                      ? 'bg-[#4338CA] text-white border-[#4338CA]'
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
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                4. API Base URL (Tùy chỉnh cho OpenRouter / DeepSeek / Groq)
              </label>
              <input
                type="text"
                value={currentProfile.baseUrl}
                onChange={(e) =>
                  updateCurrentProfile({ baseUrl: e.target.value })
                }
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 text-xs font-mono border border-zinc-300 rounded-lg focus:outline-none focus:border-[#4338CA]"
              />
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
                    temperature: Number(e.target.value) || 0.4,
                  })
                }
                className="w-full accent-[#4338CA] mt-2"
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
