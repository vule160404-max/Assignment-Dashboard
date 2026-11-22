import {
  AiChatbotSettingsStore,
  AiHybridPipelineConfig,
  AiProviderProfile,
  AiProviderType,
  DEFAULT_AI_SETTINGS,
  DEFAULT_BUILTIN_SKILLS,
  DEFAULT_HYBRID_PIPELINE,
  SkillDocument,
  WriterOutlineSection,
  WriterSession,
} from '../components/admin/writer/types';
import { auth } from './firebase';

const AI_SETTINGS_STORAGE_KEY = 'assigntrack_ai_writer_settings_v1';
const SKILL_LIBRARY_STORAGE_KEY = 'assigntrack_ai_skill_library_v1';
const WRITER_SESSIONS_STORAGE_KEY = 'assigntrack_ai_writer_sessions_v1';

const pendingLegacyKeysToMigrate: Partial<Record<AiProviderType, string>> = {};

export function queueLegacyAiKeysForServerMigration(
  profiles?: Partial<Record<AiProviderType, Partial<AiProviderProfile>>>
): boolean {
  if (!profiles || typeof profiles !== 'object') return false;
  let foundAny = false;
  const keys: AiProviderType[] = [
    'perplexity',
    'gemini',
    'openai',
    'anthropic',
    'custom_openai',
  ];
  for (const k of keys) {
    const rawKey = (profiles[k]?.apiKey || '').trim();
    if (rawKey) {
      pendingLegacyKeysToMigrate[k] = rawKey;
      foundAny = true;
    }
  }
  return foundAny;
}

function normalizePerplexityBaseUrl(url?: string, model?: string): string {
  const clean = (url || '').trim();
  if (/^sonar/i.test((model || '').trim())) {
    return 'https://api.perplexity.ai';
  }
  if (!clean || /\/orchestrator/i.test(clean)) {
    return 'https://api.perplexity.ai/v1/agent';
  }
  return clean;
}

export function normalizeHybridPipeline(
  raw?: Partial<AiHybridPipelineConfig> | null
): AiHybridPipelineConfig {
  const rawResearch =
    typeof raw?.researchModel === 'string' ? raw.researchModel.trim() : '';
  const rawWriterModel =
    typeof raw?.writerModel === 'string' ? raw.writerModel.trim() : '';
  return {
    enabled: Boolean(raw?.enabled),
    researchModel:
      rawResearch && !/^sonar/i.test(rawResearch)
        ? rawResearch
        : DEFAULT_HYBRID_PIPELINE.researchModel,
    // Hybrid 2-step pipeline is dedicated exclusively to Perplexity (shared API key)
    writerProvider: 'perplexity',
    writerModel:
      rawWriterModel && rawWriterModel.includes('/')
        ? rawWriterModel
        : DEFAULT_HYBRID_PIPELINE.writerModel,
  };
}

export function stripSecretsFromAiSettings(
  store: AiChatbotSettingsStore
): AiChatbotSettingsStore {
  return {
    activeProvider: store.activeProvider,
    hybridPipeline: normalizeHybridPipeline(store.hybridPipeline),
    profiles: {
      perplexity: {
        ...store.profiles.perplexity,
        label: 'Perplexity Agent API',
        baseUrl: normalizePerplexityBaseUrl(
          store.profiles.perplexity?.baseUrl,
          store.profiles.perplexity?.model
        ),
        apiKey: '',
      },
      gemini: { ...store.profiles.gemini, apiKey: '' },
      openai: { ...store.profiles.openai, apiKey: '' },
      anthropic: { ...store.profiles.anthropic, apiKey: '' },
      custom_openai: { ...store.profiles.custom_openai, apiKey: '' },
    },
  };
}

let inMemoryVaultSeal = '';

async function getTeamAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (inMemoryVaultSeal) {
    headers['x-vault-seal'] = inMemoryVaultSeal;
  }
  const current = auth.currentUser;
  if (!current) return headers;
  try {
    const token = await current.getIdToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  } catch {
    return headers;
  }
}

export async function syncServerAiKeysStatus(): Promise<
  Record<AiProviderType, boolean>
> {
  const defaultStatus: Record<AiProviderType, boolean> = {
    perplexity: false,
    gemini: false,
    openai: false,
    anthropic: false,
    custom_openai: false,
  };
  const authHeaders = await getTeamAuthHeaders();

  const pendingEntries = Object.entries(pendingLegacyKeysToMigrate).filter(
    ([, v]) => Boolean(v && v.trim())
  );
  try {
    if (pendingEntries.length > 0) {
      const keysPayload: Partial<Record<AiProviderType, string>> = {};
      for (const [k, v] of pendingEntries) {
        keysPayload[k as AiProviderType] = v;
        delete pendingLegacyKeysToMigrate[k as AiProviderType];
      }
      const resp = await fetch('/api/ai/keys', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ keys: keysPayload }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        configured?: Record<AiProviderType, boolean>;
        vaultSeal?: string;
      };
      if (data.vaultSeal) {
        inMemoryVaultSeal = data.vaultSeal;
      }
      if (resp.ok && data.configured) {
        return { ...defaultStatus, ...data.configured };
      }
    }

    const resp = await fetch('/api/ai/keys/status', {
      method: 'GET',
      credentials: 'same-origin',
      headers: authHeaders,
    });
    const data = (await resp.json().catch(() => ({}))) as {
      configured?: Record<AiProviderType, boolean>;
    };
    if (resp.ok && data.configured) {
      return { ...defaultStatus, ...data.configured };
    }
  } catch {
    // ignore transient offline
  }
  return defaultStatus;
}

export async function saveAiProviderKeyToServerVault(
  provider: AiProviderType,
  apiKey: string,
  clear = false
): Promise<Record<AiProviderType, boolean>> {
  const authHeaders = await getTeamAuthHeaders();
  const resp = await fetch('/api/ai/keys', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ provider, apiKey: apiKey.trim(), clear }),
  });
  const data = (await resp.json().catch(() => ({}))) as {
    configured?: Record<AiProviderType, boolean>;
    vaultSeal?: string;
    error?: string;
  };
  if (data.vaultSeal) {
    inMemoryVaultSeal = data.vaultSeal;
  }
  if (!resp.ok) {
    throw new Error(data.error || 'Không thể lưu API Key vào kho bảo mật Server.');
  }
  return (
    data.configured || {
      perplexity: false,
      gemini: false,
      openai: false,
      anthropic: false,
      custom_openai: false,
    }
  );
}

export function loadAiChatbotSettings(): AiChatbotSettingsStore {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return stripSecretsFromAiSettings(DEFAULT_AI_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<AiChatbotSettingsStore>;
    const hadLegacyKeys = queueLegacyAiKeysForServerMigration(parsed.profiles);
    const normalized: AiChatbotSettingsStore = stripSecretsFromAiSettings({
      activeProvider:
        parsed.activeProvider || DEFAULT_AI_SETTINGS.activeProvider,
      hybridPipeline: normalizeHybridPipeline(parsed.hybridPipeline),
      profiles: {
        perplexity: {
          ...DEFAULT_AI_SETTINGS.profiles.perplexity,
          ...(parsed.profiles?.perplexity || {}),
          apiKey: '',
        },
        gemini: {
          ...DEFAULT_AI_SETTINGS.profiles.gemini,
          ...(parsed.profiles?.gemini || {}),
          apiKey: '',
        },
        openai: {
          ...DEFAULT_AI_SETTINGS.profiles.openai,
          ...(parsed.profiles?.openai || {}),
          apiKey: '',
        },
        anthropic: {
          ...DEFAULT_AI_SETTINGS.profiles.anthropic,
          ...(parsed.profiles?.anthropic || {}),
          apiKey: '',
        },
        custom_openai: {
          ...DEFAULT_AI_SETTINGS.profiles.custom_openai,
          ...(parsed.profiles?.custom_openai || {}),
          apiKey: '',
        },
      },
    });
    if (hadLegacyKeys) {
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return stripSecretsFromAiSettings(DEFAULT_AI_SETTINGS);
  }
}

export function saveAiChatbotSettings(store: AiChatbotSettingsStore): void {
  try {
    queueLegacyAiKeysForServerMigration(store.profiles);
    const scrubbed = stripSecretsFromAiSettings(store);
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(scrubbed));
  } catch {
    // ignore storage quota errors
  }
}

export function loadGlobalSkillLibrary(): SkillDocument[] {
  try {
    const raw = localStorage.getItem(SKILL_LIBRARY_STORAGE_KEY);
    if (!raw) return DEFAULT_BUILTIN_SKILLS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_BUILTIN_SKILLS;
    }
    const sanitized: SkillDocument[] = parsed
      .filter((item): item is SkillDocument => Boolean(item && typeof item === 'object'))
      .map((item, idx) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `skill_restored_${idx}`,
        name: typeof item.name === 'string' ? item.name : 'Untitled Skill',
        fileName: typeof item.fileName === 'string' ? item.fileName : 'skill.md',
        description: typeof item.description === 'string' ? item.description : '',
        content: typeof item.content === 'string' ? item.content : '',
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
        isBuiltIn: Boolean(item.isBuiltIn),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
      }));

    if (sanitized.length === 0) return DEFAULT_BUILTIN_SKILLS;

    // Ensure built-in strict citation skill is kept up-to-date if not customized, and any missing built-ins are included
    const existingIds = new Set(sanitized.map((s) => s.id));
    const missingBuiltIns = DEFAULT_BUILTIN_SKILLS.filter((b) => !existingIds.has(b.id));
    return [...sanitized, ...missingBuiltIns];
  } catch {
    return DEFAULT_BUILTIN_SKILLS;
  }
}

export function saveGlobalSkillLibrary(skills: SkillDocument[]): void {
  try {
    localStorage.setItem(SKILL_LIBRARY_STORAGE_KEY, JSON.stringify(skills));
  } catch {
    // ignore
  }
}

export function stripMarkdownHashesFromText(text: string): string {
  if (!text) return '';
  return text
    // Replace leading markdown hashes at the beginning of each line (e.g. "## 1.1 " -> "1.1 ")
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
    // Also clean any bold wrapper around leading hashes (e.g. "**## 1.1" -> "**1.1")
    .replace(/^[ \t]*\*\*[ \t]*#{1,6}[ \t]*/gm, '**');
}

export function sanitizeWriterSession(session: WriterSession): WriterSession {
  if (!session) return session;
  return {
    ...session,
    outline: (session.outline || []).map((sec) => ({
      ...sec,
      content: stripMarkdownHashesFromText(sec.content || ''),
      guidanceNotes: stripMarkdownHashesFromText(sec.guidanceNotes || ''),
    })),
    fullPaperOverride: session.fullPaperOverride
      ? stripMarkdownHashesFromText(session.fullPaperOverride)
      : session.fullPaperOverride,
  };
}

export function loadWriterSessions(): WriterSession[] {
  try {
    // Purge any legacy localStorage session cache so customer essays are never readable via DevTools LocalStorage
    localStorage.removeItem(WRITER_SESSIONS_STORAGE_KEY);
  } catch {
    // ignore
  }
  return [];
}

export function saveWriterSessions(_sessions: WriterSession[]): void {
  try {
    // Do not persist customer essay content in browser LocalStorage; sessions sync via authenticated Firestore
    localStorage.removeItem(WRITER_SESSIONS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export interface AiGenerateRequest {
  profile: AiProviderProfile;
  systemPrompt: string;
  userPrompt: string;
  enableWebSearch?: boolean;
  maxOutputTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  isResearchStep?: boolean;
  searchFallbackQuery?: string;
  signal?: AbortSignal;
}

export interface AiGenerateDetailedResponse {
  text: string;
  model?: string;
  citations?: string[];
  search_results?: Array<{
    title?: string;
    url?: string;
    date?: string;
    snippet?: string;
  }>;
}

export interface PerplexityModelInfo {
  id: string;
  owned_by?: string;
  name?: string;
}

export async function fetchPerplexityCatalogModels(
  apiKey?: string
): Promise<{
  models: PerplexityModelInfo[];
  serverKeyConfigured: boolean;
}> {
  const trimmedKey = (apiKey || '').trim();
  const authHeaders = await getTeamAuthHeaders();
  const resp = await fetch('/api/ai/perplexity/models', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ apiKey: trimmedKey }),
  });
  const data = (await resp.json().catch(() => ({}))) as {
    ok?: boolean;
    serverKeyConfigured?: boolean;
    models?: PerplexityModelInfo[];
    error?: string;
  };
  if (resp.ok && Array.isArray(data.models)) {
    return {
      models: data.models,
      serverKeyConfigured: Boolean(data.serverKeyConfigured),
    };
  }
  throw new Error(
    data.error ||
      `Không thể tải danh sách model từ Perplexity (HTTP ${resp.status}).`
  );
}

export async function callAiChatbotDetailed({
  profile,
  systemPrompt,
  userPrompt,
  enableWebSearch,
  maxOutputTokens,
  reasoningEffort,
  isResearchStep,
  searchFallbackQuery,
  signal,
}: AiGenerateRequest): Promise<AiGenerateDetailedResponse> {
  const transientKey = profile.apiKey.trim();
  const authHeaders = await getTeamAuthHeaders();

  const resp = await fetch('/api/ai/generate', {
    method: 'POST',
    credentials: 'same-origin',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      provider: profile.provider,
      apiKey: transientKey,
      baseUrl: profile.baseUrl.trim(),
      model: profile.model.trim(),
      temperature: profile.temperature,
      enableWebSearch,
      maxOutputTokens,
      reasoningEffort,
      isResearchStep,
      searchFallbackQuery,
      systemPrompt,
      userPrompt,
    }),
  });

  const rawRespText = await resp.text().catch(() => '');
  let data: {
    text?: string;
    model?: string;
    error?: string;
    citations?: string[];
    search_results?: Array<{
      title?: string;
      url?: string;
      date?: string;
      snippet?: string;
    }>;
  } = {};
  try {
    data = JSON.parse(rawRespText) as typeof data;
  } catch {
    // non-json response
  }

  if (resp.ok && data.text?.trim()) {
    return {
      text: data.text.trim(),
      model: data.model,
      citations: Array.isArray(data.citations) ? data.citations : undefined,
      search_results: Array.isArray(data.search_results)
        ? data.search_results
        : undefined,
    };
  }

  const rawSnippet = rawRespText
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  throw new Error(
    data.error ||
      (rawSnippet
        ? `Không thể gọi ${profile.label} (HTTP ${resp.status}: ${rawSnippet}).`
        : `Không thể gọi ${profile.label} (HTTP ${resp.status}).`)
  );
}

export async function callAiChatbot(req: AiGenerateRequest): Promise<string> {
  const res = await callAiChatbotDetailed(req);
  return res.text;
}

/**
 * Resolves the effective writing profile from settings.
 * In Hybrid mode, returns the configured Writer provider & model with web search disabled
 * (since Perplexity already gathered real-time verified sources in Step 1).
 */
export function resolveEffectiveWriterConfig(settings: AiChatbotSettingsStore): {
  profile: AiProviderProfile;
  enableWebSearch?: boolean;
  isHybrid: boolean;
  researchProfile: AiProviderProfile;
} {
  const hybrid = normalizeHybridPipeline(settings.hybridPipeline);
  const researchModel = hybrid.researchModel || 'fast-search';
  const researchProfile: AiProviderProfile = {
    ...settings.profiles.perplexity,
    model: researchModel,
    baseUrl: /^sonar/i.test(researchModel)
      ? 'https://api.perplexity.ai'
      : 'https://api.perplexity.ai/v1/agent',
    temperature: 0.1,
  };

  if (hybrid.enabled) {
    const baseWriter = settings.profiles[hybrid.writerProvider];
    const writerModel = hybrid.writerModel?.trim() || baseWriter.model;
    const writerProfile: AiProviderProfile = {
      ...baseWriter,
      model: writerModel,
      baseUrl:
        hybrid.writerProvider === 'perplexity'
          ? 'https://api.perplexity.ai/v1/agent'
          : baseWriter.baseUrl,
    };
    return {
      profile: writerProfile,
      // Disable web search during the writing step so GLM-5.3-Flash / GLM-5.3 writes cheaply from Step 1 sources
      enableWebSearch: false,
      isHybrid: true,
      researchProfile,
    };
  }

  return {
    profile: settings.profiles[settings.activeProvider],
    enableWebSearch: undefined,
    isHybrid: false,
    researchProfile,
  };
}

/**
 * Step 1 of Hybrid Pipeline: Uses Perplexity (Agent Search / Sonar) ONLY to gather
 * up-to-date real-time web/academic sources and properly formatted citations (low output tokens).
 */
export async function researchSourcesWithPerplexity(
  session: WriterSession,
  researchProfile: AiProviderProfile,
  signal?: AbortSignal
): Promise<string> {
  const coreTopic = (session.topic || session.title || '').trim();
  const coreSubject = (session.subject || '').trim();
  const isVi = session.writingLanguage === 'Vietnamese';
  const searchLines = isVi
    ? [
        `${coreTopic} ${coreSubject} nghiên cứu khoa học tạp chí luận văn Việt Nam`.trim(),
        `${coreTopic} thực trạng số liệu thống kê báo cáo 2023 2024 2025 2026`.trim(),
        `${coreTopic} cơ sở lý thuyết mô hình nghiên cứu giải pháp`.trim(),
      ].filter(Boolean)
    : [
        `${coreTopic} ${coreSubject} peer reviewed academic study journal`.trim(),
        `${coreTopic} empirical research data statistics 2023 2024 2025 2026`.trim(),
        `${coreTopic} literature review theoretical framework scholarly article`.trim(),
      ].filter(Boolean);
  const compactSearchQuery = searchLines.join('\n');

  // Fast, ultra-cheap Perplexity Search API (POST /search — raw web results, 0 LLM output tokens, ~1-2s)
  if (researchProfile.model === 'perplexity-search') {
    const res = await callAiChatbotDetailed({
      profile: researchProfile,
      systemPrompt: '',
      userPrompt: compactSearchQuery,
      enableWebSearch: true,
      isResearchStep: true,
      signal,
    });

    return `RAW REAL-TIME WEB & SCHOLARLY SOURCES (Perplexity Search API — Format citations strictly in ${session.citationStyle}):\n\n${res.text}`.trim();
  }

  const systemPrompt = `You are a precision Academic Citation & Web Research Assistant.
Your ONLY job is to search the live web for the latest, authoritative, real-world academic papers, peer-reviewed journal articles, official reports, and verified statistics relevant to the assignment topic.
DO NOT write an essay or long prose. Keep your response concise, structured, and strictly factual to minimize output tokens.`;

  const userPrompt = `Find 8 to 12 recent, high-authority, real-time verifiable scholarly & official sources for the following academic assignment:
- Subject: ${session.subject || 'General Academic Research'}
- Topic: ${session.topic || session.title}
- Citation Style: ${session.citationStyle}
- Writing Language: ${session.writingLanguage}
- Key Instructions / Scope: ${(session.instructions || '').slice(0, 900)}
- Rubric Focus: ${(session.rubricNotes || '').slice(0, 500)}

Return ONLY a clean numbered dossier of verified sources. For each source provide:
1. Exact ${session.citationStyle} full reference entry (Author(s), Year, Title, Journal/Publisher, DOI or direct URL).
2. In-text citation format (e.g., (Author, Year)).
3. 1 concise bullet point of exact verified statistics, empirical findings, or arguments from that source.

STRICT RULES:
- Every single source MUST be real and grounded in your web search results.
- Prioritize recent publications (2021-2026) and seminal foundational studies.
- Do NOT write essay paragraphs — ONLY return the structured verified source & citation dossier.`;

  const res = await callAiChatbotDetailed({
    profile: researchProfile,
    systemPrompt,
    userPrompt,
    enableWebSearch: true,
    isResearchStep: true,
    maxOutputTokens: 1800,
    searchFallbackQuery: compactSearchQuery,
    signal,
  });

  const extraUrls = new Set<string>();
  if (Array.isArray(res.citations)) {
    for (const c of res.citations) {
      if (typeof c === 'string' && c.trim()) extraUrls.add(c.trim());
    }
  }
  if (Array.isArray(res.search_results)) {
    for (const sr of res.search_results) {
      if (sr?.url) {
        extraUrls.add(
          sr.title ? `${sr.title} — ${sr.url}` : sr.url
        );
      }
    }
  }

  const urlAppendix =
    extraUrls.size > 0
      ? `\n\n--- VERIFIED SOURCE URLS RETURNED BY PERPLEXITY ---\n${Array.from(
          extraUrls
        )
          .slice(0, 20)
          .map((u, idx) => `[${idx + 1}] ${u}`)
          .join('\n')}`
      : '';

  return `${res.text}${urlAppendix}`.trim();
}

export function buildSkillsAndContextSystemPrompt(
  session: WriterSession,
  skills: SkillDocument[]
): string {
  const activeSkills = skills.filter((s) => s.enabled && s.content.trim());
  const skillBlock =
    activeSkills.length > 0
      ? activeSkills
          .map(
            (s, idx) =>
              `--- [SKILL #${idx + 1}: ${s.name} (${s.fileName})] ---\n${s.content.trim()}`
          )
          .join('\n\n')
      : 'Use high-distinction academic writing standards.';

  const contextBlock =
    session.contextFiles.length > 0
      ? '\n\n=== UPLOADED ASSIGNMENT & RESEARCH CONTEXT FILES ===\n' +
        session.contextFiles
          .map(
            (cf, idx) =>
              `--- [CONTEXT FILE #${idx + 1}: ${cf.name}] ---\n${cf.content.trim()}`
          )
          .join('\n\n')
      : '';

  const researchedSourcesBlock = session.researchedSources?.trim()
    ? `\n\n=== VERIFIED REAL-TIME WEB SOURCES & CITATIONS (FROM PERPLEXITY SEARCH) ===
CRITICAL GROUNDING RULE: You MUST ground your arguments, empirical statistics, and in-text citations primarily in the verified real-time sources below. Use the exact author names, years, and bibliographic details provided. Do NOT fabricate fake citations or non-existent DOIs.
${session.researchedSources.trim()}`
    : '';

  const isVi = session.writingLanguage === 'Vietnamese';
  const docTypeLabel =
    session.documentType === 'vn_thesis'
      ? 'Luận văn / Tiểu luận / Khóa luận tốt nghiệp Tiếng Việt'
      : session.documentType === 'vn_report'
      ? 'Báo cáo Thực tập / Đồ án Doanh nghiệp Tiếng Việt'
      : session.documentType === 'vn_research'
      ? 'Bài Nghiên cứu Khoa học (NCKH) Tiếng Việt'
      : isVi
      ? 'Bài Luận / Báo cáo Học thuật Tiếng Việt'
      : 'University Academic Essay / Research Paper';

  const vietnameseRulesBlock =
    isVi || session.writingLanguage === 'Bilingual'
      ? `\n\n=== QUY CHUẨN VIẾT HỌC THUẬT TIẾNG VIỆT ===
- Viết 100% bằng tiếng Việt học thuật chuẩn mực (ngôi thứ ba, khách quan, lập luận chặt chẽ, tuyệt đối không dịch máy từ tiếng Anh).
- Dùng đúng thuật ngữ chuyên ngành tại Việt Nam (có thể chú thích thuật ngữ tiếng Anh trong ngoặc đơn ở lần đầu xuất hiện).
- Trích dẫn nguồn chuẩn ${session.citationStyle} với tên tác giả Việt Nam hoặc quốc tế (VD: (Nguyễn Văn A, 2024), (Tổng cục Thống kê, 2025)).`
      : '';

  return `You are an elite Academic Researcher & University Writing Specialist assisting inside an academic research & drafting studio.

=== ACTIVE SKILL FILES & SYSTEM INSTRUCTIONS ===
${skillBlock}${contextBlock}${researchedSourcesBlock}${vietnameseRulesBlock}

=== ASSIGNMENT BRIEF & FORMATTING RULES ===
- Document Type: ${docTypeLabel}
- Subject / Course: ${session.subject || 'General Academic Research'}
- Topic / Title: ${session.topic || 'Untitled Research Topic'}
- Target Total Word Count: ${session.targetWordCount} words
- Citation & Reference Style: ${session.citationStyle}
- Writing Language: ${session.writingLanguage}
- Tone & Academic Level: ${session.academicTone || (isVi ? 'Chuẩn Học thuật Đại học / Thạc sĩ Việt Nam' : 'University Master / High Distinction Academic Tone')}
- Detailed Instructions / Prompt:
${session.instructions || 'Follow standard scholarly structure for this topic.'}
- Grading Rubric & Evaluation Criteria:
${session.rubricNotes || 'High distinction academic rigor, critical synthesis, and accurate citations.'}`;
}

export async function generateOutlineWithAi(
  session: WriterSession,
  skills: SkillDocument[],
  profile: AiProviderProfile,
  enableWebSearch?: boolean,
  signal?: AbortSignal
): Promise<WriterOutlineSection[]> {
  const systemPrompt = buildSkillsAndContextSystemPrompt(session, skills);
  const isVi = session.writingLanguage === 'Vietnamese';

  let vnStructureHint =
    '1. LỜI MỞ ĐẦU (Tính cấp thiết, mục tiêu, đối tượng, phạm vi, phương pháp nghiên cứu), CHƯƠNG 1. CƠ SỞ LÝ LUẬN VÀ TỔNG QUAN NGHIÊN CỨU, CHƯƠNG 2. PHÂN TÍCH THỰC TRẠNG, CHƯƠNG 3. GIẢI PHÁP VÀ KIẾN NGHỊ, KẾT LUẬN, và mục cuối "TÀI LIỆU THAM KHẢO (' +
    session.citationStyle +
    ')".';
  if (session.documentType === 'vn_report') {
    vnStructureHint =
      'LỜI MỞ ĐẦU, CHƯƠNG 1. TỔNG QUAN VỀ ĐƠN VỊ THỰC TẬP, CHƯƠNG 2. THỰC TRẠNG HOẠT ĐỘNG VÀ NỘI DUNG THỰC TẬP, CHƯƠNG 3. ĐÁNH GIÁ, BÀI HỌC KINH NGHIỆM VÀ KIẾN NGHỊ, KẾT LUẬN, và mục cuối "TÀI LIỆU THAM KHẢO (' +
      session.citationStyle +
      ')".';
  } else if (session.documentType === 'vn_research') {
    vnStructureHint =
      'TÓM TẮT (ABSTRACT), 1. ĐẶT VẤN ĐỀ, 2. TỔNG QUAN NGHIÊN CỨU VÀ CƠ SỞ LÝ THUYẾT, 3. PHƯƠNG PHÁP NGHIÊN CỨU, 4. KẾT QUẢ NGHIÊN CỨU VÀ THẢO LUẬN, 5. KẾT LUẬN VÀ HÀM Ý, và mục cuối "TÀI LIỆU THAM KHẢO (' +
      session.citationStyle +
      ')".';
  }

  const userPrompt = isVi
    ? `Dựa trên đề bài, tiêu chí Rubric, tổng số từ yêu cầu (${session.targetWordCount} từ), chuẩn trích dẫn (${session.citationStyle}) và các Skill đang bật, hãy lập một DÀN Ý CHI TIẾT chuẩn học thuật đại học/thạc sĩ Việt Nam hoàn toàn bằng TIẾNG VIỆT.

YÊU CẦU BẮT BUỘC:
1. Chia bài thành các chương/mục cân đối chuẩn Việt Nam theo cấu trúc: ${vnStructureHint}
2. Tổng "targetWords" của các mục nội dung (không tính Tài liệu tham khảo) xấp xỉ ${session.targetWordCount} từ (đặt targetWords cho mục Tài liệu tham khảo khoảng 200-300).
3. Trong "guidanceNotes" của mỗi chương lớn (>= 400 từ), nêu rõ 2-3 tiểu mục con đánh số chuẩn (VD: "Gồm các tiểu mục: 1.1. ..., 1.2. ...") để Word tự tạo Mục lục chuẩn. TUYỆT ĐỐI KHÔNG dùng dấu '#' hay '##' trong tiêu đề.
4. CHỈ trả về duy nhất một mảng JSON hợp lệ (không giải thích thêm) với mỗi phần tử gồm:
   - "title": string (tiêu đề tiếng Việt chuẩn, VD: "LỜI MỞ ĐẦU", "CHƯƠNG 1. CƠ SỞ LÝ LUẬN", "TÀI LIỆU THAM KHẢO (${session.citationStyle})")
   - "headingLevel": "h1" | "h2" | "h3"
   - "targetWords": number
   - "guidanceNotes": string (luận điểm chính, tiểu mục con, số liệu/trích dẫn cần triển khai bằng tiếng Việt)`
    : `Based on the assignment brief, rubric, target total word count (${session.targetWordCount} words), citation style (${session.citationStyle}), and all active Skill files, design a comprehensive, publication-grade academic outline with a clear Table of Contents hierarchy.

REQUIREMENTS:
1. Divide the paper into well-proportioned sections following a standard university thesis / academic report Table of Contents structure (e.g., numbered H1 chapters such as "1. Introduction", "2. Literature Review & Theoretical Framework", "3. Empirical Analysis & Discussion", "4. Strategic Recommendations", "5. Conclusion", plus H2 sub-sections like "2.1 ...", "2.2 ..." for longer papers, and a final "References (${session.citationStyle})" section).
2. The sum of "targetWords" across all prose sections should equal approximately ${session.targetWordCount} words (set targetWords for the References section to ~150-300).
3. In "guidanceNotes" for each major H1 body section (>= 400 words), specify 2-3 numbered H2 sub-headings (e.g. "Include sub-headings: 2.1 ..., 2.2 ...") so the automatic Word Table of Contents captures both H1 and H2 levels cleanly. DO NOT use markdown '#' or '##' hashes in headings.
4. Return ONLY a valid JSON array (no extra commentary) where each item has:
   - "title": string (exact numbered academic heading, e.g. "1. Introduction", "2. Theoretical Framework & Literature Review", "References (${session.citationStyle})")
   - "headingLevel": "h1" | "h2" | "h3"
   - "targetWords": number
   - "guidanceNotes": string (detailed arguments, sub-headings to include, rubric criteria, and types of citations to cover in this section)

Example JSON schema:
[
  {
    "title": "1. Introduction",
    "headingLevel": "h1",
    "targetWords": 300,
    "guidanceNotes": "Define core problem, research background, thesis statement, and paper structure. Include sub-headings 1.1 Background & Context and 1.2 Research Objectives."
  }
]`;

  const rawText = await callAiChatbot({
    profile,
    systemPrompt,
    userPrompt,
    enableWebSearch,
    reasoningEffort: 'low',
    signal,
  });

  return parseAiOutlineJson(rawText, session.targetWordCount, session.citationStyle);
}

export function parseAiOutlineJson(
  rawText: string,
  totalWords: number,
  citationStyle: string
): WriterOutlineSection[] {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const startIdx = cleaned.indexOf('[');
  const endIdx = cleaned.lastIndexOf(']');
  const jsonCandidate =
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx
      ? cleaned.slice(startIdx, endIdx + 1)
      : cleaned;

  try {
    const parsed = JSON.parse(jsonCandidate) as Array<{
      title?: string;
      headingLevel?: string;
      targetWords?: number;
      guidanceNotes?: string;
    }>;

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, idx) => {
        const level =
          item.headingLevel === 'h2' || item.headingLevel === 'h3'
            ? item.headingLevel
            : 'h1';
        return {
          id: `sec_${Date.now()}_${idx}`,
          order: idx + 1,
          title: (item.title || `Section ${idx + 1}`).trim(),
          headingLevel: level,
          targetWords: Math.max(80, Number(item.targetWords) || 300),
          guidanceNotes: stripMarkdownHashesFromText((item.guidanceNotes || '').trim()),
          content: '',
          status: 'idle',
        };
      });
    }
  } catch {
    // Fallback below if model returned non-JSON markdown
  }

  // Fallback structured outline
  const introWords = Math.round(totalWords * 0.15);
  const body1Words = Math.round(totalWords * 0.35);
  const body2Words = Math.round(totalWords * 0.35);
  const conclWords = Math.max(150, totalWords - introWords - body1Words - body2Words);

  return [
    {
      id: `sec_${Date.now()}_0`,
      order: 1,
      title: '1. Introduction',
      headingLevel: 'h1',
      targetWords: introWords,
      guidanceNotes:
        'Contextualize the topic, define key terms, state the core thesis/research objective, and outline paper scope.',
      content: '',
      status: 'idle',
    },
    {
      id: `sec_${Date.now()}_1`,
      order: 2,
      title: '2. Critical Analysis & Literature Synthesis',
      headingLevel: 'h1',
      targetWords: body1Words,
      guidanceNotes:
        'Synthesize peer-reviewed theoretical frameworks and empirical evidence addressing the first half of the brief and rubric.',
      content: '',
      status: 'idle',
    },
    {
      id: `sec_${Date.now()}_2`,
      order: 3,
      title: '3. Empirical Evaluation & Applied Discussion',
      headingLevel: 'h1',
      targetWords: body2Words,
      guidanceNotes:
        'Evaluate real-world implications, case comparisons, limitations, and recommendations aligned with rubric criteria.',
      content: '',
      status: 'idle',
    },
    {
      id: `sec_${Date.now()}_3`,
      order: 4,
      title: '4. Conclusion',
      headingLevel: 'h1',
      targetWords: conclWords,
      guidanceNotes:
        'Synthesize main findings, restate thesis in a new way, and provide closing implications without introducing new citations.',
      content: '',
      status: 'idle',
    },
    {
      id: `sec_${Date.now()}_4`,
      order: 5,
      title: `References (${citationStyle})`,
      headingLevel: 'h1',
      targetWords: 200,
      guidanceNotes: `Complete list of all scholarly sources cited across all sections above formatted strictly in ${citationStyle}.`,
      content: '',
      status: 'idle',
    },
  ];
}

function clipText(text: string, maxChars: number): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  const sliced = clean.slice(0, maxChars);
  const lastPeriod = Math.max(
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf('? '),
    sliced.lastIndexOf('! ')
  );
  return lastPeriod > maxChars * 0.55
    ? sliced.slice(0, lastPeriod + 1).trim()
    : `${sliced.trim()}...`;
}

function extractInTextCitations(text: string): string[] {
  const found = new Set<string>();
  // Matches parenthetical citations like (Smith, 2024), (Smith & Lee, 2023; OECD, 2025)
  const parenRegex = /\([^()]{2,90}(?:19|20)\d{2}[a-z]?[^()]{0,40}\)/g;
  // Matches narrative citations like Smith (2024), Smith and Lee (2023), Smith et al. (2025)
  const narrativeRegex =
    /\b[A-Z][A-Za-zÀ-ỹ'-]+(?:\s+(?:&|and|et al\.?)\s+[A-Z][A-Za-zÀ-ỹ'-]+|\s+et\s+al\.?)?\s*\((?:19|20)\d{2}[a-z]?\)/g;

  for (const m of text.match(parenRegex) || []) {
    found.add(m.trim());
  }
  for (const m of text.match(narrativeRegex) || []) {
    found.add(m.trim());
  }
  return Array.from(found).slice(0, 60);
}

/**
 * Balanced Smart Context Compression:
 * Cuts ~45-55% redundant input tokens across multi-section papers while preserving
 * 100% narrative continuity, thesis coherence, and 1-to-1 citation accuracy.
 */
function buildSmartPriorContext(
  priorSections: WriterOutlineSection[],
  mode: 'body' | 'conclusion' | 'references'
): string {
  const written = priorSections.filter((s) => s.content.trim().length > 0);
  if (written.length === 0) return '';

  if (mode === 'references') {
    const fullCombined = written
      .map((s) => `### ${s.title}\n${s.content.trim()}`)
      .join('\n\n');
    const uniqueCitations = extractInTextCitations(
      written.map((s) => s.content).join('\n')
    );
    const citationHeader =
      uniqueCitations.length > 0
        ? `--- UNIQUE IN-TEXT CITATIONS DETECTED (${uniqueCitations.length}) ---\n${uniqueCitations.join(
            ' · '
          )}\n\n`
        : '';

    // For short papers (<= 3,500 chars), keep full text verbatim
    if (fullCombined.length <= 3500) {
      return `${citationHeader}${fullCombined}`;
    }
    // For medium/long papers, extract every sentence containing a year/citation marker verbatim for fast, 100% 1-to-1 matching
    const citationPattern =
      /(?:\((?:[^()]{0,80}(?:19|20)\d{2}[a-z]?[^()]{0,30})\)|\bet\s+al\.?|\[\d+(?:\s*[-,]\s*\d+)*\]|https?:\/\/|doi\.org)/i;
    const blocks: string[] = [];
    for (const sec of written) {
      const sentences = sec.content
        .replace(/\r\n/g, '\n')
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10 && citationPattern.test(s));
      if (sentences.length > 0) {
        blocks.push(`### ${sec.title} (Citations)\n${sentences.join(' ')}`);
      }
    }
    const bodyExtract = blocks.length > 0 ? blocks.join('\n\n') : fullCombined;
    return `${citationHeader}${bodyExtract}`.trim();
  }

  const allCitations = extractInTextCitations(
    written.map((s) => s.content).join('\n')
  );

  const blocks = written.map((sec, idx) => {
    const paragraphs = sec.content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const isImmediatePrev = idx === written.length - 1;

    if (mode === 'conclusion') {
      if (paragraphs.length <= 2) {
        return `### ${sec.title}\n${clipText(sec.content, 900)}`;
      }
      return `### ${sec.title} (Key points)\n${clipText(
        paragraphs[0],
        420
      )}\n[...]\n${clipText(paragraphs[paragraphs.length - 1], 420)}`;
    }

    // Body mode: keep last 2 paragraphs verbatim for immediate previous section; compact digest for earlier ones
    if (isImmediatePrev) {
      const tail = paragraphs.slice(-2).join('\n\n');
      return `### ${sec.title} (Immediate prior section — continue smoothly from here)\n${clipText(
        tail,
        1200
      )}`;
    }

    if (paragraphs.length <= 1) {
      return `### ${sec.title} (Summary)\n${clipText(sec.content, 400)}`;
    }
    return `### ${sec.title} (Summary)\n${clipText(
      paragraphs[0],
      320
    )}\n[...]\n${clipText(paragraphs[paragraphs.length - 1], 240)}`;
  });

  const citationFooter =
    allCitations.length > 0
      ? `\n\n--- IN-TEXT CITATIONS ALREADY USED IN PRIOR SECTIONS (KEEP CONSISTENT) ---\n${allCitations.join(
          ' · '
        )}`
      : '';

  return `${blocks.join('\n\n')}${citationFooter}`.trim();
}

export async function generateSectionWithAi(
  session: WriterSession,
  targetSectionId: string,
  skills: SkillDocument[],
  profile: AiProviderProfile,
  enableWebSearch?: boolean,
  signal?: AbortSignal,
  onPartialText?: (partialText: string, progressLabel: string) => void
): Promise<string> {
  const sectionIdx = session.outline.findIndex((s) => s.id === targetSectionId);
  if (sectionIdx === -1) {
    throw new Error('Không tìm thấy mục dàn ý cần viết.');
  }
  const targetSection = session.outline[sectionIdx];

  const normalizedHeading = targetSection.title
    .replace(/^\d+(\.\d+)*\.?\s*/, '')
    .trim();
  const isReferencesSection =
    /^(references|bibliography|works cited|tài liệu tham khảo|danh mục tài liệu tham khảo)/i.test(
      normalizedHeading
    );
  const isConclusionSection =
    /^(conclusion|kết luận|summary and conclusion)/i.test(normalizedHeading);

  // FAST CHUNKED REFERENCES PIPELINE: 3 citations per batch → ~2-5s per batch, live progressive paste, ZERO 504 timeouts!
  if (isReferencesSection) {
    const priorText = session.outline
      .slice(0, sectionIdx)
      .map((s) => s.content.trim())
      .filter(Boolean)
      .join('\n\n');
    const uniqueCitations = extractInTextCitations(priorText);

    const leanRefSystemPrompt = `You are a precision Academic Bibliographer.
Format ONLY complete, authentic ${session.citationStyle} reference entries matching the exact in-text citations provided.
STRICT RULES:
- Output ONLY the formatted reference entries (one reference paragraph per line, separated by a blank line).
- NEVER include the assignment prompt, rubric, syllabus, or skill instructions.
- NEVER add headings, numbering (unless IEEE), markdown '#', or conversational commentary.`;

    const researchedSnippet = session.researchedSources?.trim()
      ? `\n\n=== VERIFIED SOURCES FROM WEB RESEARCH (USE EXACT URLS/DOIS WHERE MATCHING) ===\n${session.researchedSources
          .trim()
          .slice(0, 4500)}`
      : '';

    const BATCH_SIZE = 3;
    const accumulatedEntries: string[] = [];

    const mergeAndSortRefs = (entries: string[]): string => {
      const seen = new Set<string>();
      const cleaned: string[] = [];
      for (const rawEntry of entries) {
        const line = stripMarkdownHashesFromText(rawEntry).trim();
        if (!line || line.length < 15) continue;
        // Skip accidental heading lines
        if (/^(references|bibliography|tài liệu tham khảo)/i.test(line) && line.length < 50) {
          continue;
        }
        const key = line.toLowerCase().replace(/[^a-z0-9à-ỹ]/gi, '').slice(0, 48);
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(line);
      }
      if (session.citationStyle !== 'IEEE') {
        cleaned.sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));
      }
      return cleaned.join('\n\n');
    };

    if (uniqueCitations.length > 0) {
      const batches: string[][] = [];
      for (let i = 0; i < uniqueCitations.length; i += BATCH_SIZE) {
        batches.push(uniqueCitations.slice(i, i + BATCH_SIZE));
      }

      for (let b = 0; b < batches.length; b++) {
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        const batch = batches[b];
        const doneCountBefore = b * BATCH_SIZE;
        const targetCountNow = Math.min(
          uniqueCitations.length,
          (b + 1) * BATCH_SIZE
        );
        onPartialText?.(
          mergeAndSortRefs(accumulatedEntries),
          `Đang viết Tài liệu tham khảo (${doneCountBefore + 1}–${targetCountNow}/${uniqueCitations.length} nguồn)...`
        );

        const batchPrompt = `Topic: ${session.topic || session.title}
Citation Style: ${session.citationStyle}
Writing Language: ${session.writingLanguage}

Format ONLY the full ${session.citationStyle} bibliographic reference entries for these ${batch.length} in-text citations (batch ${b + 1}/${batches.length}):
${batch.map((c, idx) => `${idx + 1}. ${c}`).join('\n')}${researchedSnippet}

Return ONLY the ${batch.length} full reference entries (one per line, blank line between entries). No intro, no outro, no markdown '#'.`;

        const rawChunk = await callAiChatbot({
          profile,
          systemPrompt: leanRefSystemPrompt,
          userPrompt: batchPrompt,
          enableWebSearch,
          maxOutputTokens: 900,
          reasoningEffort: 'low',
          signal,
        });

        const chunkLines = rawChunk
          .split(/\n+/)
          .map((l) => l.trim())
          .filter(Boolean);
        accumulatedEntries.push(...chunkLines);

        const mergedNow = mergeAndSortRefs(accumulatedEntries);
        onPartialText?.(
          mergedNow,
          `Đã xong ${targetCountNow}/${uniqueCitations.length} nguồn tham khảo`
        );
      }

      return mergeAndSortRefs(accumulatedEntries);
    }

    // Fallback when no in-text citations were drafted yet: 1 lean fast call
    const fallbackPrompt = `Topic: ${session.topic || session.title}
Citation Style: ${session.citationStyle}
Writing Language: ${session.writingLanguage}${researchedSnippet}

Provide 6 to 8 authoritative, strictly formatted ${session.citationStyle} scholarly references for this topic (one per paragraph, sorted alphabetically). Output ONLY the reference entries with no commentary.`;
    const rawFallback = await callAiChatbot({
      profile,
      systemPrompt: leanRefSystemPrompt,
      userPrompt: fallbackPrompt,
      enableWebSearch,
      maxOutputTokens: 1400,
      reasoningEffort: 'low',
      signal,
    });
    return stripMarkdownHashesFromText(rawFallback);
  }

  const systemPrompt = buildSkillsAndContextSystemPrompt(session, skills);

  const fullOutlineMap = session.outline
    .map(
      (s, i) =>
        `${i + 1}. [${s.headingLevel.toUpperCase()}] ${s.title} (~${
          s.targetWords
        } words) — ${s.guidanceNotes}`
    )
    .join('\n');

  const priorWrittenSections = buildSmartPriorContext(
    session.outline.slice(0, sectionIdx),
    isConclusionSection ? 'conclusion' : 'body'
  );

  const userPrompt = `Now write ONLY Section ${sectionIdx + 1} of the paper: "${targetSection.title}".

=== FULL PAPER OUTLINE ===
${fullOutlineMap}

${
  priorWrittenSections
    ? `=== PREVIOUSLY WRITTEN SECTIONS (FOR CONTINUITY & TO AVOID REPETITION) ===\n${priorWrittenSections}\n`
    : ''
}
=== CURRENT SECTION TO WRITE NOW ===
- Section Title: ${targetSection.title}
- Target Word Count for this section: ${targetSection.targetWords} words (write thoroughly to reach approximately ${targetSection.targetWords} words)
- Specific Guidance & Rubric Notes for this section:
${targetSection.guidanceNotes || 'Develop scholarly arguments with peer-reviewed citations.'}
- Citation Style: ${session.citationStyle}
- Writing Language: ${session.writingLanguage}

STRICT OUTPUT RULES:
1. Do NOT repeat the section heading "${targetSection.title}" on the first line (the editor renders the heading automatically).
2. If this section is a major chapter (${targetSection.targetWords} words >= 350 words and headingLevel is "${targetSection.headingLevel}"), organize the prose with 2 to 4 clear, numbered sub-headings (e.g. "X.1 Sub-section Title", and "X.1.1 ..." if >= 700 words) matching the section number. STRICTLY DO NOT prepend markdown '#' or '##' or '###' symbols to headings or sentences - write clean headings directly as plain text.
3. Write well-structured, cohesive academic paragraphs in ${session.writingLanguage} with authentic ${session.citationStyle} in-text citations.
4. Ensure smooth transition from the previous section and strictly fulfill the rubric and active Skill files.
5. Output ONLY the academic text for this section, with zero meta-commentary or markdown code fences.`;

  const raw = await callAiChatbot({
    profile,
    systemPrompt,
    userPrompt,
    enableWebSearch,
    signal,
  });
  return stripMarkdownHashesFromText(raw);
}

export type AiRefineAction =
  | 'rewrite_academic'
  | 'expand_depth'
  | 'condense'
  | 'add_citations'
  | 'rubric_check';

const CHANGE_LOG_MARKER = '<<<CHANGE_LOG>>>';

function splitChangeLogResponse(raw: string): {
  content: string;
  changeSummary: string;
} {
  const idx = raw.indexOf(CHANGE_LOG_MARKER);
  if (idx === -1) {
    return {
      content: stripMarkdownHashesFromText(raw).trim(),
      changeSummary: '',
    };
  }
  const bodyPart = raw.slice(0, idx).trim();
  const logPart = raw
    .slice(idx + CHANGE_LOG_MARKER.length)
    .replace(/^[:\-\s]+/, '')
    .trim();
  return {
    content: stripMarkdownHashesFromText(bodyPart).trim(),
    changeSummary: logPart.slice(0, 320),
  };
}

export async function refineTextWithAi(
  session: WriterSession,
  sectionTitle: string,
  currentText: string,
  action: AiRefineAction,
  customInstruction: string,
  skills: SkillDocument[],
  profile: AiProviderProfile,
  enableWebSearch?: boolean,
  signal?: AbortSignal
): Promise<{ content: string; changeSummary: string }> {
  const systemPrompt = buildSkillsAndContextSystemPrompt(session, skills);

  let taskDirective = '';
  if (action === 'rewrite_academic') {
    taskDirective =
      'Rewrite and elevate the academic prose, flow, critical depth, and vocabulary of this text while preserving its core meaning and in-text citations.';
  } else if (action === 'expand_depth') {
    taskDirective =
      'Expand this section by ~30-40% with deeper critical evaluation, counter-arguments, empirical evidence, and additional scholarly citations aligned with the rubric.';
  } else if (action === 'condense') {
    taskDirective =
      'Tighten and condense this text by ~20% to remove redundancy while keeping all key arguments and citations intact.';
  } else if (action === 'add_citations') {
    taskDirective = `Strengthen every unsupported claim in this text with accurate ${session.citationStyle} scholarly in-text citations and empirical backing.`;
  } else if (action === 'rubric_check') {
    taskDirective =
      'Critically upgrade this text so that it directly satisfies every single criterion in the Grading Rubric at a High Distinction (HD) level.';
  }

  const userPrompt = `Section: "${sectionTitle}"
Task: ${taskDirective}
${customInstruction.trim() ? `Additional User Instruction: ${customInstruction.trim()}\n` : ''}
Citation Style: ${session.citationStyle}
Language: ${session.writingLanguage}

=== ORIGINAL TEXT ===
${currentText}

OUTPUT FORMAT:
1. Output the revised academic text for this section (no conversational intro, do NOT prepend markdown '#' or '##' hashes).
2. Immediately after the revised text, on a new line output the exact marker: ${CHANGE_LOG_MARKER}
3. Right after that marker, write 1-2 concise Vietnamese sentences specifying EXACTLY which paragraphs/parts were modified and what was improved (e.g., "Đoạn 1-2: Nâng cấp văn phong học thuật; Đoạn 3: Mở rộng phân tích phản biện và bổ sung trích dẫn 2024.").`;

  const raw = await callAiChatbot({
    profile,
    systemPrompt,
    userPrompt,
    enableWebSearch,
    signal,
  });
  return splitChangeLogResponse(raw);
}

export type ExistingDraftMode =
  | 'complete_and_expand'
  | 'upgrade_and_fix'
  | 'import_only';

export type DraftSectionAction = 'keep' | 'revise' | 'expand' | 'write_new';

export interface PlannedDraftSection extends WriterOutlineSection {
  action: DraftSectionAction;
  changeReason: string;
}

/**
 * Local zero-token parser: splits an uploaded/pasted existing draft into structured outline sections
 * by detecting numbered chapters, Vietnamese chapter titles, or common academic headings.
 */
export function parseExistingDraftIntoSections(
  rawDraftText: string,
  targetWordCount: number,
  citationStyle: string,
  writingLanguage: WriterSession['writingLanguage']
): WriterOutlineSection[] {
  const cleanLines = rawDraftText.replace(/\r\n/g, '\n').split('\n');
  const headingRegex =
    /^(?:(?:CHƯƠNG|PHẦN|MỤC|CHAPTER|PART|SECTION)\s+\d+[\.\:\-]?\s+.*|\d+(?:\.\d+)?\.?\s+[A-ZÀ-Ỹ][^\n]{2,110}|(?:LỜI MỞ ĐẦU|MỞ ĐẦU|ĐẶT VẤN ĐỀ|TÓM TẮT|ABSTRACT|INTRODUCTION|LITERATURE REVIEW|METHODOLOGY|FINDINGS|DISCUSSION|CONCLUSION|KẾT LUẬN|KẾT LUẬN VÀ KIẾN NGHỊ|REFERENCES|BIBLIOGRAPHY|TÀI LIỆU THAM KHẢO|DANH MỤC TÀI LIỆU THAM KHẢO)(?:\s*\([^)]+\))?)$/i;

  const detected: Array<{
    title: string;
    headingLevel: 'h1' | 'h2';
    lines: string[];
  }> = [];

  let currentBucket: {
    title: string;
    headingLevel: 'h1' | 'h2';
    lines: string[];
  } | null = null;

  for (const rawLine of cleanLines) {
    const trimmed = stripMarkdownHashesFromText(rawLine).trim();
    if (!trimmed) {
      if (currentBucket) currentBucket.lines.push('');
      continue;
    }

    const isLikelyHeading =
      trimmed.length <= 125 &&
      !trimmed.endsWith('.') &&
      headingRegex.test(trimmed);

    if (isLikelyHeading) {
      if (currentBucket) detected.push(currentBucket);
      const isSub = /^\d+\.\d+/.test(trimmed);
      currentBucket = {
        title: trimmed,
        headingLevel: isSub ? 'h2' : 'h1',
        lines: [],
      };
    } else {
      if (!currentBucket) {
        currentBucket = {
          title:
            writingLanguage === 'Vietnamese'
              ? '1. Nội dung bản nháp hiện có'
              : '1. Existing Draft Content',
          headingLevel: 'h1',
          lines: [],
        };
      }
      currentBucket.lines.push(trimmed);
    }
  }
  if (currentBucket) detected.push(currentBucket);

  const ts = Date.now();
  if (detected.length === 0) {
    return parseAiOutlineJson('', targetWordCount, citationStyle);
  }

  const perSecTarget = Math.max(
    200,
    Math.round(targetWordCount / Math.max(1, detected.length))
  );

  return detected.map((d, idx) => {
    const body = d.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const wCount = body ? body.split(/\s+/).length : 0;
    return {
      id: `sec_draft_${ts}_${idx}`,
      order: idx + 1,
      title: d.title,
      headingLevel: d.headingLevel,
      targetWords: Math.max(wCount, perSecTarget),
      guidanceNotes:
        wCount > 0
          ? `Đã nạp từ bản nháp có sẵn (${wCount} từ).`
          : 'Mục còn trống từ bản nháp, cần viết nội dung.',
      content: body,
      status: wCount > 0 ? 'completed' : 'idle',
    };
  });
}

/**
 * AI reads the customer's existing draft + brief/rubric and builds a structured revision/completion plan.
 */
export async function analyzeAndPlanExistingDraftWithAi(
  session: WriterSession,
  rawDraftText: string,
  mode: Exclude<ExistingDraftMode, 'import_only'>,
  userEditNotes: string,
  skills: SkillDocument[],
  profile: AiProviderProfile,
  enableWebSearch?: boolean,
  signal?: AbortSignal
): Promise<PlannedDraftSection[]> {
  // First split draft locally so we never lose a single word of the original text
  const localSections = parseExistingDraftIntoSections(
    rawDraftText,
    session.targetWordCount,
    session.citationStyle,
    session.writingLanguage
  );

  const systemPrompt = buildSkillsAndContextSystemPrompt(session, skills);
  const isVi = session.writingLanguage === 'Vietnamese';
  const modeDirective =
    mode === 'complete_and_expand'
      ? 'Analyze the existing partial/rough draft. Preserve strong parts, mark thin/incomplete sections as "expand" or "revise", and ADD any missing sections required by the brief/rubric (e.g., remaining body chapters, Conclusion, and References) as "write_new" so the full paper reaches approximately ' +
        session.targetWordCount +
        ' words.'
      : 'Analyze the existing draft section by section. Keep its core structure, mark sections needing academic tone/citation/rubric upgrades as "revise", mark well-written complete sections as "keep", and add a References section as "write_new" only if missing.';

  const draftSummaryForPlan = localSections
    .map((sec, idx) => {
      const words = sec.content ? sec.content.split(/\s+/).length : 0;
      const preview =
        sec.content.length > 900
          ? `${sec.content.slice(0, 600)}\n[...]\n${sec.content.slice(-260)}`
          : sec.content;
      return `[DRAFT_INDEX ${idx}] Title: "${sec.title}" (${words} words)\n${preview || '(empty)'}`;
    })
    .join('\n\n');

  const userPrompt = `You are reviewing an existing customer draft to plan edits & completion.
Mode: ${modeDirective}
${userEditNotes.trim() ? `Specific User Revision Instructions:\n${userEditNotes.trim()}\n` : ''}
Language: ${session.writingLanguage}
Citation Style: ${session.citationStyle}
Target Total Word Count: ${session.targetWordCount} words

=== EXISTING DRAFT SECTIONS ===
${draftSummaryForPlan}

Return ONLY a valid JSON array representing the final complete paper outline. Each object MUST have:
- "draftIndex": number | null (matching [DRAFT_INDEX X] above if this section corresponds to an existing draft section, or null if this is a brand-new section to add)
- "title": string (clean academic heading in ${isVi ? 'Vietnamese' : session.writingLanguage}, no '#' symbols)
- "headingLevel": "h1" | "h2" | "h3"
- "targetWords": number
- "action": "keep" | "revise" | "expand" | "write_new"
- "guidanceNotes": string (exact instructions for revising/expanding/writing this section)
- "changeReason": string (1 short Vietnamese sentence explaining why this section is kept, revised, expanded, or newly added)`;

  const rawText = await callAiChatbot({
    profile,
    systemPrompt,
    userPrompt,
    enableWebSearch,
    reasoningEffort: 'low',
    signal,
  });

  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const startIdx = cleaned.indexOf('[');
  const endIdx = cleaned.lastIndexOf(']');
  const jsonCandidate =
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx
      ? cleaned.slice(startIdx, endIdx + 1)
      : cleaned;

  try {
    const parsed = JSON.parse(jsonCandidate) as Array<{
      draftIndex?: number | null;
      title?: string;
      headingLevel?: string;
      targetWords?: number;
      action?: string;
      guidanceNotes?: string;
      changeReason?: string;
    }>;

    if (Array.isArray(parsed) && parsed.length > 0) {
      const ts = Date.now();
      return parsed.map((item, idx) => {
        const matchedLocal =
          typeof item.draftIndex === 'number' &&
          item.draftIndex >= 0 &&
          item.draftIndex < localSections.length
            ? localSections[item.draftIndex]
            : null;
        const existingContent = matchedLocal?.content || '';
        const action: DraftSectionAction =
          item.action === 'keep' ||
          item.action === 'revise' ||
          item.action === 'expand' ||
          item.action === 'write_new'
            ? item.action
            : existingContent.trim()
            ? mode === 'complete_and_expand'
              ? 'expand'
              : 'revise'
            : 'write_new';

        return {
          id: `sec_plan_${ts}_${idx}`,
          order: idx + 1,
          title: stripMarkdownHashesFromText(
            (item.title || matchedLocal?.title || `Section ${idx + 1}`).trim()
          ),
          headingLevel:
            item.headingLevel === 'h2' || item.headingLevel === 'h3'
              ? item.headingLevel
              : 'h1',
          targetWords: Math.max(100, Number(item.targetWords) || 350),
          guidanceNotes: stripMarkdownHashesFromText(
            (item.guidanceNotes || '').trim()
          ),
          content: existingContent,
          status:
            action === 'keep' && existingContent.trim() ? 'completed' : 'idle',
          action,
          changeReason:
            (item.changeReason || '').trim() ||
            (action === 'keep'
              ? 'Giữ nguyên nội dung đã đạt chuẩn.'
              : action === 'expand'
              ? 'Mở rộng chiều sâu và bổ sung dẫn chứng.'
              : action === 'revise'
              ? 'Nâng cấp văn phong học thuật và trích dẫn.'
              : 'Viết mới mục còn thiếu để hoàn thiện bài.'),
        };
      });
    }
  } catch {
    // Fall back to local parsed sections marked for revise/expand
  }

  return localSections.map((sec) => ({
    ...sec,
    action: sec.content.trim()
      ? mode === 'complete_and_expand'
        ? 'expand'
        : 'revise'
      : 'write_new',
    changeReason:
      mode === 'complete_and_expand'
        ? 'Mở rộng và hoàn thiện dựa trên bản nháp.'
        : 'Sửa lỗi và nâng cấp văn phong học thuật.',
  }));
}

/**
 * Revises or expands an existing draft section while preserving core author arguments,
 * returning both the upgraded prose and an explicit Vietnamese changelog of WHERE/WHAT changed.
 */
export async function reviseOrCompleteSectionWithAi(
  session: WriterSession,
  targetSectionId: string,
  action: 'revise' | 'expand',
  userEditNotes: string,
  skills: SkillDocument[],
  profile: AiProviderProfile,
  enableWebSearch?: boolean,
  signal?: AbortSignal
): Promise<{ content: string; changeSummary: string }> {
  const sectionIdx = session.outline.findIndex((s) => s.id === targetSectionId);
  if (sectionIdx === -1) {
    throw new Error('Không tìm thấy mục cần sửa.');
  }
  const targetSection = session.outline[sectionIdx];
  const systemPrompt = buildSkillsAndContextSystemPrompt(session, skills);
  const priorContext = buildSmartPriorContext(
    session.outline.slice(0, sectionIdx),
    'body'
  );

  const actionGoal =
    action === 'expand'
      ? `PRESERVE the author's core ideas and good passages from the EXISTING DRAFT below, then EXPAND & COMPLETE this section thoroughly to reach approximately ${targetSection.targetWords} words with deeper academic analysis, transitions, and authentic ${session.citationStyle} citations.`
      : `PRESERVE the author's core structure and meaning from the EXISTING DRAFT below, while UPGRADING academic tone, fixing grammar/logic/rubric gaps, and strengthening ${session.citationStyle} citations (target ~${targetSection.targetWords} words).`;

  const userPrompt = `Section ${sectionIdx + 1}: "${targetSection.title}"
Task: ${actionGoal}
Section Guidance: ${targetSection.guidanceNotes || 'Ensure high-distinction academic quality.'}
${userEditNotes.trim() ? `Specific User Edit Instructions: ${userEditNotes.trim()}\n` : ''}
Writing Language: ${session.writingLanguage}
Citation Style: ${session.citationStyle}

${
  priorContext
    ? `=== PRIOR SECTIONS CONTEXT (FOR CONTINUITY) ===\n${priorContext}\n\n`
    : ''
}=== EXISTING DRAFT FOR THIS SECTION (TO REVISE / EXPAND) ===
${targetSection.content.trim()}

OUTPUT FORMAT:
1. Do NOT repeat the section heading "${targetSection.title}" on the first line and do NOT prepend markdown '#' or '##' hashes.
2. Output the complete revised/expanded academic prose for this section.
3. Immediately after the prose, on a new line output the exact marker: ${CHANGE_LOG_MARKER}
4. Right after that marker, write 1-2 concise Vietnamese sentences describing EXACTLY WHERE and WHAT was edited/added in this section (e.g., "Giữ nguyên đoạn mở đầu; mở rộng đoạn 2 thêm phân tích số liệu 2024 và bổ sung 2 trích dẫn; viết tiếp đoạn kết chuyển ý sang chương sau.").`;

  const raw = await callAiChatbot({
    profile,
    systemPrompt,
    userPrompt,
    enableWebSearch,
    signal,
  });
  return splitChangeLogResponse(raw);
}
