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

export function extractInTextCitations(text: string): string[] {
  const found = new Map<string, string>();
  const addCit = (raw: string) => {
    const clean = raw.replace(/\s+/g, ' ').trim();
    if (clean.length < 6) return;
    const key = clean.toLowerCase().replace(/[^a-z0-9à-ỹ]/gi, '');
    if (!found.has(key)) found.set(key, clean);
  };

  // 1. Parenthetical citations: (Smith, 2024), (Fredricks, Blumenfeld & Paris, 2004; Hiver et al., 2024)
  const parenRegex = /\(([^()]{2,140}(?:19|20)\d{2}[a-z]?[^()]{0,40})\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRegex.exec(text)) !== null) {
    // Split multi-citation parentheses by ';' so each citation is handled individually
    const parts = m[1].split(';').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (/(?:19|20)\d{2}/.test(part) && /[A-Za-zÀ-ỹ]{2,}/.test(part)) {
        addCit(`(${part})`);
      }
    }
  }

  // 2. Narrative citations supporting 1, 2, 3, or 4+ authors:
  //    Fredricks, Blumenfeld and Paris (2004) | Xu, Yang and He (2023) | Vardal Ocaklı (2019) | Hiver et al. (2024)
  const authorToken = "[A-ZÀ-Ỹ][A-Za-zÀ-ỹ'’-]+(?:\\s+[A-ZÀ-Ỹ][A-Za-zÀ-ỹ'’-]+)?";
  const narrativeRegex = new RegExp(
    `\\b${authorToken}(?:,\\s*${authorToken})*(?:,?\\s+(?:&|and|và)\\s+${authorToken}|\\s+et\\s+al\\.?)?\\s*\\((?:19|20)\\d{2}[a-z]?\\)`,
    'g'
  );
  for (const match of text.match(narrativeRegex) || []) {
    // Trim common leading non-author sentence starters like "According to ", "Following ", "In "
    const cleaned = match
      .replace(
        /^(?:According to|Following|As|In|See|By|From|With|For|Like|Unlike|Modelled by|Documented by|Synthesized by|Attributed to)\s+/i,
        ''
      )
      .trim();
    if (cleaned) addCit(cleaned);
  }

  return Array.from(found.values()).slice(0, 60);
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

    const leanRefSystemPrompt = `You are a strict Academic Bibliographer.
Format ONLY complete, authentic ${session.citationStyle} reference entries matching the exact in-text citations provided.
CRITICAL ANTI-HALLUCINATION RULES:
- Preserve EVERY author name in exact order (NEVER drop the first author of a 3-author citation like "Fredricks, Blumenfeld and Paris" or "Xu, Yang and He").
- NEVER invent, guess, or fabricate a DOI (especially sequential numbers like 123456, 1123456, 1156789) or URL.
- NEVER copy or reuse one source's DOI, URL, or paper title onto a different author.
- ONLY include a DOI or URL if it appears verbatim in the VERIFIED SOURCES list for THAT exact author and work. If you are not 100% certain of the DOI/URL, OMIT the DOI/URL completely.
- Output each reference entry on a SINGLE line (do not insert line breaks inside one entry), separated from the next entry by a blank line.
- NEVER include the assignment prompt, rubric, syllabus, or skill instructions. No headings, no markdown '#', no commentary.`;

    const researchedSnippet = session.researchedSources?.trim()
      ? `\n\n=== VERIFIED SOURCES FROM WEB RESEARCH (ONLY COPY A DOI/URL IF THE AUTHOR & TITLE ACTUALLY MATCH!) ===\n${session.researchedSources
          .trim()
          .slice(0, 4500)}`
      : '';

    const BATCH_SIZE = 3;
    const accumulatedEntries: string[] = [];

    const isSuspiciousFakeDoi = (doi: string): boolean => {
      const lower = doi.toLowerCase();
      return /(?:12345|23456|34567|45678|56789|00000|99999|11111)/.test(lower);
    };

    const mergeAndSortRefs = (entries: string[]): string => {
      const seen = new Set<string>();
      const seenDois = new Set<string>();
      const cleaned: string[] = [];
      for (const rawEntry of entries) {
        let line = stripMarkdownHashesFromText(rawEntry)
          .replace(/\s*\n+\s*/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (!line || line.length < 18) continue;
        if (
          /^(references|bibliography|tài liệu tham khảo)/i.test(line) &&
          line.length < 50
        ) {
          continue;
        }
        // Strip fake sequential DOIs or duplicate DOIs accidentally reused on another author
        const doiMatches = line.match(/10\.\d{4,9}\/[^\s,;)]+/g) || [];
        for (const doi of doiMatches) {
          const normDoi = doi.replace(/\.+$/, '').toLowerCase();
          if (isSuspiciousFakeDoi(normDoi) || seenDois.has(normDoi)) {
            line = line
              .replace(
                new RegExp(
                  `\\s*(?:https?:\\/\\/doi\\.org\\/|doi:\\s*)?${doi.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                  )}\\.?`,
                  'gi'
                ),
                ''
              )
              .replace(/\s*Available at:\s*https?:\/\/\S+(?:\s*\(Accessed:[^)]+\))?\.?/gi, '')
              .trim();
          } else {
            seenDois.add(normDoi);
          }
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

        // Split by blank lines first so multi-line reference entries are never sliced mid-sentence.
        // Fall back to single newlines only if every line looks like its own author-year entry.
        const paragraphBlocks = rawChunk
          .split(/\r?\n\s*\r?\n+/)
          .map((blk) => blk.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim())
          .filter(Boolean);
        let chunkLines = paragraphBlocks;
        if (paragraphBlocks.length === 1) {
          const singleLines = rawChunk
            .split(/\r?\n+/)
            .map((l) => l.trim())
            .filter(Boolean);
          const allLookLikeEntries =
            singleLines.length > 1 &&
            singleLines.every((l) => /\((?:19|20)\d{2}[a-z]?\)|\b(?:19|20)\d{2}\b/.test(l));
          if (allLookLikeEntries) {
            chunkLines = singleLines;
          }
        }
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

// ---------------------------------------------------------------------------
// Final Academic QA Auditor Agent (Layer 1: Deterministic + Crossref DOI API,
// Layer 2: AI Examiner Review)
// ---------------------------------------------------------------------------

export type PaperAuditSeverity = 'critical' | 'warning' | 'info';
export type PaperAuditCategory =
  | 'doi_and_sources'
  | 'citation_sync'
  | 'structure_and_content'
  | 'completeness';

export interface PaperAuditIssue {
  id: string;
  severity: PaperAuditSeverity;
  category: PaperAuditCategory;
  title: string;
  detail: string;
  sectionId?: string;
  sectionTitle?: string;
  autoFixable: boolean;
  fixHint?: string;
  /** Optional DOI string if this issue is about a specific bad/duplicate DOI */
  badDoi?: string;
  /** Optional list of exact in-text citations missing from References */
  missingCitations?: string[];
}

export interface PaperAuditReport {
  score: number;
  verdict: 'pass' | 'needs_revision' | 'critical_errors';
  summary: string;
  checkedDoiCount: number;
  verifiedDoiCount: number;
  invalidDoiCount: number;
  issues: PaperAuditIssue[];
  auditedAt: string;
}

function normalizeExtractedDoi(rawDoi: string): string {
  return rawDoi
    .trim()
    .replace(/[.)\],;]+$/, '')
    .replace(/\/(?:full|abstract|pdf|html|epub|meta)\/?$/i, '')
    .replace(/[.)\],;]+$/, '');
}

function isSuspiciousFakeDoiGlobal(doi: string): boolean {
  const clean = normalizeExtractedDoi(doi);
  if (/(?:12345|123456|112345|115678|234567|345678|987654|000000|111111)/.test(clean)) {
    return true;
  }
  return false;
}

function normalizeSurnameToken(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

interface CrossrefVerifyResult {
  exists: boolean;
  networkError?: boolean;
  title?: string;
  year?: number;
  firstAuthorSurname?: string;
}

async function verifyDoiWithCrossref(
  doi: string,
  signal?: AbortSignal
): Promise<CrossrefVerifyResult> {
  const cleanDoi = doi.trim().replace(/[.)\],;]+$/, '');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 6500);
  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort);

  try {
    const res = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );
    if (res.status === 404) {
      return { exists: false };
    }
    if (!res.ok) {
      return { exists: true, networkError: true };
    }
    const json = (await res.json()) as {
      message?: {
        title?: string[];
        author?: Array<{ family?: string; name?: string }>;
        issued?: { 'date-parts'?: number[][] };
        published?: { 'date-parts'?: number[][] };
      };
    };
    const msg = json?.message;
    const title = msg?.title?.[0];
    const firstAuthorSurname =
      msg?.author?.[0]?.family || msg?.author?.[0]?.name || undefined;
    const year =
      msg?.issued?.['date-parts']?.[0]?.[0] ||
      msg?.published?.['date-parts']?.[0]?.[0] ||
      undefined;
    return {
      exists: true,
      title,
      year,
      firstAuthorSurname,
    };
  } catch {
    return { exists: true, networkError: true };
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

export async function runDeterministicPaperAudit(
  session: WriterSession,
  onProgress?: (label: string) => void,
  signal?: AbortSignal
): Promise<{
  issues: PaperAuditIssue[];
  checkedDoiCount: number;
  verifiedDoiCount: number;
  invalidDoiCount: number;
}> {
  const issues: PaperAuditIssue[] = [];
  let issueSeq = 1;
  const pushIssue = (item: Omit<PaperAuditIssue, 'id'>) => {
    issues.push({ ...item, id: `det_${issueSeq++}` });
  };

  const refSection = session.outline.find((s) =>
    /^(references|bibliography|works cited|tài liệu tham khảo)/i.test(
      s.title.trim()
    )
  );
  const bodySections = session.outline.filter((s) => s.id !== refSection?.id);

  // 1. Check empty or truncated sections
  for (const sec of session.outline) {
    const trimmed = (sec.content || '').trim();
    if (!trimmed) {
      pushIssue({
        severity: 'critical',
        category: 'completeness',
        title: `Mục "${sec.title}" đang bị trống`,
        detail: 'Mục này chưa có nội dung. Cần viết hoàn chỉnh trước khi giao bài.',
        sectionId: sec.id,
        sectionTitle: sec.title,
        autoFixable: true,
        fixHint: 'Viết đầy đủ nội dung cho mục này theo dàn ý và rubric.',
      });
      continue;
    }

    const words = trimmed.split(/\s+/).filter(Boolean).length;
    if (sec.id !== refSection?.id && words < 45) {
      pushIssue({
        severity: 'warning',
        category: 'completeness',
        title: `Mục "${sec.title}" quá ngắn (${words} từ)`,
        detail: `Mục tiêu đề ra là ~${sec.targetWords} từ nhưng hiện mới có ${words} từ.`,
        sectionId: sec.id,
        sectionTitle: sec.title,
        autoFixable: true,
        fixHint: `Mở rộng mục "${sec.title}" đạt chuẩn học thuật và tiệm cận ~${sec.targetWords} từ.`,
      });
    }

    // Check if the last non-empty line is abruptly truncated mid-sentence
    const lastLine = trimmed.split(/\r?\n/).filter((l) => l.trim()).pop()?.trim() || '';
    const endsCleanly = /[.!?…)"'\]»]$|https?:\/\/\S+$|10\.\d{4,9}\/\S+$/.test(lastLine);
    if (lastLine.length > 25 && !endsCleanly) {
      pushIssue({
        severity: 'critical',
        category: 'completeness',
        title: `Nội dung cuối mục "${sec.title}" bị cắt cụt giữa câu`,
        detail: `Đoạn cuối kết thúc dang dở: "...${lastLine.slice(-70)}"`,
        sectionId: sec.id,
        sectionTitle: sec.title,
        autoFixable: true,
        fixHint: 'Hoàn thiện trọn vẹn câu/đoạn cuối bị cắt cụt, không để dang dở.',
      });
    }
  }

  // 2. Check orphan sub-heading numbering (e.g., 4.1 without 4.2)
  const subByParent = new Map<string, string[]>();
  for (const sec of bodySections) {
    const m = sec.title.trim().match(/^(\d+)\.(\d+)\b/);
    if (m) {
      const parent = m[1];
      const list = subByParent.get(parent) || [];
      list.push(sec.title.trim());
      subByParent.set(parent, list);
    }
  }
  for (const [parentNum, subs] of subByParent.entries()) {
    if (subs.length === 1 && /^(\d+)\.1\b/.test(subs[0])) {
      const targetSec = bodySections.find((s) => s.title.trim() === subs[0]);
      pushIssue({
        severity: 'warning',
        category: 'structure_and_content',
        title: `Đánh số tiểu mục lẻ: có ${subs[0]} nhưng thiếu mục ${parentNum}.2`,
        detail:
          'Trong học thuật, khi đã chia tiểu mục (ví dụ 4.1) thì nên có ít nhất tiểu mục 4.2 hoặc gộp thẳng vào mục chính.',
        sectionId: targetSec?.id,
        sectionTitle: targetSec?.title,
        autoFixable: false,
      });
    }
  }

  // 3. References & DOI audit
  let checkedDoiCount = 0;
  let verifiedDoiCount = 0;
  let invalidDoiCount = 0;

  if (refSection && refSection.content.trim()) {
    const refEntries = refSection.content
      .split(/\r?\n\s*\r?\n+/)
      .map((e) => e.replace(/\r?\n+/g, ' ').trim())
      .filter(Boolean);

    // 3a. Detect duplicate DOIs & suspicious fake DOIs
    const doiToEntries = new Map<string, string[]>();
    const doiEntriesList: Array<{ doi: string; entry: string }> = [];

    for (const entry of refEntries) {
      // Check truncated reference entry
      const entryEndsClean = /[.!?)\]]$|https?:\/\/\S+$|10\.\d{4,9}\/\S+$/.test(entry);
      if (entry.length > 20 && !entryEndsClean) {
        pushIssue({
          severity: 'critical',
          category: 'doi_and_sources',
          title: 'Một nguồn trong References bị cắt cụt giữa chừng',
          detail: `Nguồn bị đứt đoạn: "${entry.slice(0, 120)}..."`,
          sectionId: refSection.id,
          sectionTitle: refSection.title,
          autoFixable: true,
          fixHint: 'Tạo lại danh mục Tài liệu tham khảo đầy đủ, không cắt ngang dòng.',
        });
      }

      const doiMatches = entry.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/g) || [];
      for (const rawDoi of doiMatches) {
        const cleanDoi = normalizeExtractedDoi(rawDoi);
        const lowerDoi = cleanDoi.toLowerCase();
        const existing = doiToEntries.get(lowerDoi) || [];
        existing.push(entry);
        doiToEntries.set(lowerDoi, existing);

        if (isSuspiciousFakeDoiGlobal(cleanDoi)) {
          invalidDoiCount++;
          pushIssue({
            severity: 'critical',
            category: 'doi_and_sources',
            title: `Phát hiện DOI giả dạng số thứ tự (${cleanDoi})`,
            detail: `Nguồn: "${entry.slice(0, 130)}..." chứa đuôi số bịa (123456/112345/...).`,
            sectionId: refSection.id,
            sectionTitle: refSection.title,
            autoFixable: true,
            badDoi: cleanDoi,
            fixHint: `Xóa bỏ DOI giả ${cleanDoi} và kiểm chứng lại nguồn tham khảo.`,
          });
        } else {
          doiEntriesList.push({ doi: cleanDoi, entry });
        }
      }
    }

    for (const [lowerDoi, matchedEntries] of doiToEntries.entries()) {
      if (matchedEntries.length > 1) {
        invalidDoiCount++;
        pushIssue({
          severity: 'critical',
          category: 'doi_and_sources',
          title: `Trùng lặp 1 mã DOI cho ${matchedEntries.length} tác giả khác nhau (${lowerDoi})`,
          detail: `Mã DOI ${lowerDoi} bị gán lặp lại cho nhiều bài báo khác nhau — dấu hiệu rõ của việc AI tự ghép nguồn sai.`,
          sectionId: refSection.id,
          sectionTitle: refSection.title,
          autoFixable: true,
          badDoi: lowerDoi,
          fixHint: `Loại bỏ DOI bị trùng ${lowerDoi} khỏi các tác giả không khớp và xây dựng lại danh mục References chuẩn.`,
        });
      }
    }

    // 3b. Live Crossref DOI verification (unique non-suspicious DOIs, max 20, batch of 4)
    const uniqueDoisToCheck: Array<{ doi: string; entry: string }> = [];
    const seenCheck = new Set<string>();
    for (const item of doiEntriesList) {
      const k = item.doi.toLowerCase();
      if (seenCheck.has(k)) continue;
      seenCheck.add(k);
      uniqueDoisToCheck.push(item);
      if (uniqueDoisToCheck.length >= 20) break;
    }

    if (uniqueDoisToCheck.length > 0) {
      onProgress?.(`Đang kiểm chứng ${uniqueDoisToCheck.length} mã DOI qua Crossref API...`);
      for (let i = 0; i < uniqueDoisToCheck.length; i += 4) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const batch = uniqueDoisToCheck.slice(i, i + 4);
        const results = await Promise.all(
          batch.map((item) => verifyDoiWithCrossref(item.doi, signal))
        );
        results.forEach((res, idx) => {
          const { doi, entry } = batch[idx];
          if (res.networkError) return;
          checkedDoiCount++;
          if (!res.exists) {
            invalidDoiCount++;
            pushIssue({
              severity: 'critical',
              category: 'doi_and_sources',
              title: `DOI không tồn tại trên Crossref (${doi})`,
              detail: `Tra cứu Crossref trả về 404 (Không tồn tại). Nguồn: "${entry.slice(0, 120)}..."`,
              sectionId: refSection.id,
              sectionTitle: refSection.title,
              autoFixable: true,
              badDoi: doi,
              fixHint: `Xóa DOI không tồn tại ${doi} và xác minh lại nguồn.`,
            });
          } else {
            // Check author surname & year mismatch against real Crossref metadata
            const entryYearMatch = entry.match(/\(((?:19|20)\d{2})[a-z]?\)/);
            const entryYear = entryYearMatch ? Number(entryYearMatch[1]) : undefined;
            const firstSurnameToken = normalizeSurnameToken(
              entry.split(/[,(\s]/)[0] || ''
            );
            const crossrefSurnameToken = normalizeSurnameToken(
              res.firstAuthorSurname || ''
            );

            const surnameMismatch =
              Boolean(firstSurnameToken.length >= 3 && crossrefSurnameToken.length >= 3) &&
              !normalizeSurnameToken(entry.slice(0, 80)).includes(crossrefSurnameToken);
            const yearMismatch =
              Boolean(entryYear && res.year) &&
              Math.abs((entryYear || 0) - (res.year || 0)) >= 2;

            if (surnameMismatch || yearMismatch) {
              invalidDoiCount++;
              pushIssue({
                severity: 'critical',
                category: 'doi_and_sources',
                title: `DOI lệch tác giả/năm so với bài thật trên Crossref (${doi})`,
                detail: `Bài viết ghi "${entry.slice(0, 75)}...", nhưng Crossref xác nhận DOI này thuộc về tác giả "${res.firstAuthorSurname || 'N/A'}" (${res.year || 'N/A'}) — "${res.title || ''}".`,
                sectionId: refSection.id,
                sectionTitle: refSection.title,
                autoFixable: true,
                badDoi: doi,
                fixHint: `Gỡ bỏ DOI bị gán nhầm ${doi} và sửa lại nguồn khớp với trích dẫn trong bài.`,
              });
            } else {
              verifiedDoiCount++;
            }
          }
        });
      }
    }

    // 3c. In-Text <-> References 1-to-1 check
    const allBodyText = bodySections.map((s) => s.content || '').join('\n\n');
    const inTextCitations = extractInTextCitations(allBodyText);
    const normalizedRefText = refSection.content
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const missingCitations: string[] = [];
    for (const cite of inTextCitations) {
      const yearMatch = cite.match(/(19|20)\d{2}/);
      const year = yearMatch ? yearMatch[0] : '';
      const firstAuthor = cite.split(/[,&\s(]/)[0] || '';
      const normAuthor = normalizeSurnameToken(firstAuthor);
      if (normAuthor.length < 2 || !year) continue;

      const hasEntry = refEntries.some((entry) => {
        const normEntry = entry
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        // Check that first author appears near the start of the reference entry (within first 60 chars)
        return (
          normEntry.slice(0, 70).replace(/[^a-z0-9]/g, '').includes(normAuthor) &&
          normEntry.includes(year)
        );
      });

      if (!hasEntry && !normalizedRefText.includes(`${normAuthor}`)) {
        missingCitations.push(cite);
      } else if (!hasEntry) {
        // Author exists in ref list or year mismatch / dropped first author
        missingCitations.push(cite);
      }
    }

    if (missingCitations.length > 0) {
      pushIssue({
        severity: 'critical',
        category: 'citation_sync',
        title: `Thiếu hoặc lệch tác giả đầu cho ${missingCitations.length} trích dẫn trong bài`,
        detail: `Các trích dẫn trong bài chưa khớp 1-1 với đầu mục References: ${missingCitations
          .slice(0, 8)
          .join('; ')}${missingCitations.length > 8 ? ` (+${missingCitations.length - 8} nguồn khác)` : ''}.`,
        sectionId: refSection.id,
        sectionTitle: refSection.title,
        autoFixable: true,
        missingCitations,
        fixHint:
          'Bổ sung đúng các nguồn còn thiếu và giữ nguyên các nguồn hợp lệ hiện có để khớp 100% họ tác giả đầu và năm.',
      });
    }
  } else if (bodySections.some((s) => (s.content || '').trim().length > 100)) {
    pushIssue({
      severity: 'warning',
      category: 'citation_sync',
      title: 'Bài viết chưa có mục References / Tài liệu tham khảo',
      detail: 'Không tìm thấy mục References hoặc mục References đang trống.',
      autoFixable: false,
    });
  }

  return {
    issues,
    checkedDoiCount,
    verifiedDoiCount,
    invalidDoiCount,
  };
}

export async function runAiPaperAudit(
  session: WriterSession,
  deterministicResult: {
    issues: PaperAuditIssue[];
    checkedDoiCount: number;
    verifiedDoiCount: number;
    invalidDoiCount: number;
  },
  skills: SkillDocument[],
  profile: AiProviderProfile,
  enableWebSearch?: boolean,
  signal?: AbortSignal
): Promise<PaperAuditReport> {
  const digest = session.outline
    .map((sec, idx) => {
      const text = (sec.content || '').trim();
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      const isRef = /^(references|bibliography|works cited|tài liệu tham khảo)/i.test(
        sec.title.trim()
      );
      const preview = isRef
        ? text.slice(0, 2600)
        : text.length > 900
        ? `${text.slice(0, 480)}\n[...]\n${text.slice(-360)}`
        : text;
      return `--- SECTION ${idx + 1} (id: ${sec.id}) | TITLE: "${sec.title}" | WORDS: ${words}/${sec.targetWords} ---\n${preview || '[EMPTY]'}`;
    })
    .join('\n\n');

  const detSummary =
    deterministicResult.issues.length > 0
      ? deterministicResult.issues
          .map((i) => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.detail}`)
          .join('\n')
      : 'None found by deterministic verifier.';

  const systemPrompt = `You are a strict Senior University Academic Examiner & Quality Auditor (Người kiểm duyệt bài nghiên cứu trước khi giao khách).
Your job is to inspect the drafted paper below and catch EVERY serious academic/structural/factual defect that would cause a student to lose marks or fail QA:
1. Heading vs. Content Mismatch (e.g., heading says "Personal Facilitators" while body discusses "Social Facilitators").
2. Factual Self-Contradictions across sections (e.g., Section 2 calls a study a "doctoral thesis" while References calls it a "Master's thesis", or conflicting sample sizes/years).
3. Wrongly pasted paper title onto unrelated authors in References.
4. Off-topic drift or failure to address key assignment brief/rubric requirements.

Do NOT repeat issues already caught by the deterministic checker unless adding new context.
Output ONLY a valid JSON object (no markdown fences, no commentary) with this exact schema:
{
  "summary": "2-3 concise Vietnamese sentences summarizing overall paper readiness and top risks.",
  "aiIssues": [
    {
      "severity": "critical" | "warning" | "info",
      "category": "structure_and_content" | "doi_and_sources" | "citation_sync" | "completeness",
      "title": "Short Vietnamese issue title",
      "detail": "Specific Vietnamese explanation citing exact section/evidence",
      "sectionId": "exact section id from digest if applicable, else empty string",
      "autoFixable": true | false,
      "fixHint": "Exact instruction for AI to fix this section"
    }
  ]
}`;

  const userPrompt = `Assignment Topic: ${session.topic || session.title}
Subject: ${session.subject || 'N/A'}
Citation Style: ${session.citationStyle}
Writing Language: ${session.writingLanguage}
Brief / Instructions: ${(session.instructions || '').slice(0, 1200)}
Rubric: ${(session.rubricNotes || '').slice(0, 800)}

=== ALREADY CAUGHT BY DETERMINISTIC VERIFIER ===
${detSummary}

=== PAPER DIGEST TO AUDIT ===
${digest}`;

  let aiSummary = '';
  const aiIssues: PaperAuditIssue[] = [];

  try {
    const raw = await callAiChatbot({
      profile,
      systemPrompt,
      userPrompt,
      enableWebSearch: Boolean(enableWebSearch && false), // Fast pure reasoning audit
      maxOutputTokens: 1400,
      reasoningEffort: 'low',
      signal,
    });
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as {
        summary?: string;
        aiIssues?: Array<{
          severity?: string;
          category?: string;
          title?: string;
          detail?: string;
          sectionId?: string;
          autoFixable?: boolean;
          fixHint?: string;
        }>;
      };
      aiSummary = (parsed.summary || '').trim();
      if (Array.isArray(parsed.aiIssues)) {
        parsed.aiIssues.forEach((item, idx) => {
          if (!item.title) return;
          const matchedSec = session.outline.find(
            (s) => s.id === item.sectionId
          );
          aiIssues.push({
            id: `ai_${idx + 1}`,
            severity:
              item.severity === 'critical' ||
              item.severity === 'warning' ||
              item.severity === 'info'
                ? item.severity
                : 'warning',
            category:
              item.category === 'doi_and_sources' ||
              item.category === 'citation_sync' ||
              item.category === 'structure_and_content' ||
              item.category === 'completeness'
                ? item.category
                : 'structure_and_content',
            title: item.title.trim(),
            detail: (item.detail || '').trim(),
            sectionId: matchedSec?.id,
            sectionTitle: matchedSec?.title,
            autoFixable: Boolean(item.autoFixable && matchedSec),
            fixHint: (item.fixHint || '').trim() || undefined,
          });
        });
      }
    }
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      (err as { name?: string }).name === 'AbortError'
    ) {
      throw err;
    }
    // Keep deterministic results even if AI JSON parsing fails
  }

  // Keep reference to skills so callers can pass it consistently
  void skills;

  const allIssues = [...deterministicResult.issues, ...aiIssues];
  const criticalCount = allIssues.filter((i) => i.severity === 'critical').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;

  const score = Math.max(
    15,
    Math.min(100, 100 - criticalCount * 14 - warningCount * 5)
  );
  const verdict: PaperAuditReport['verdict'] =
    criticalCount > 0
      ? 'critical_errors'
      : warningCount > 0 || score < 85
      ? 'needs_revision'
      : 'pass';

  const fallbackSummary =
    verdict === 'pass'
      ? 'Bài viết vượt qua lớp kiểm duyệt học thuật: trích dẫn khớp 1-1, DOI hợp lệ và bố cục logic.'
      : `Phát hiện ${criticalCount} lỗi nghiêm trọng và ${warningCount} cảnh báo cần xử lý trước khi giao khách.`;

  return {
    score,
    verdict,
    summary: aiSummary || fallbackSummary,
    checkedDoiCount: deterministicResult.checkedDoiCount,
    verifiedDoiCount: deterministicResult.verifiedDoiCount,
    invalidDoiCount: deterministicResult.invalidDoiCount,
    issues: allIssues,
    auditedAt: new Date().toISOString(),
  };
}

function escapeRegExpForDoi(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Surgical, deterministic-first References fixer:
 * 1) Deterministically strips every verified-bad / 404 / fake / duplicate DOI from existing entries (never breaks valid entries).
 * 2) Generates ONLY the specific missing in-text citations (if any) with strict no-DOI-hallucination rules.
 * 3) Verifies any newly generated DOI against Crossref API and auto-strips any invalid one before returning.
 */
export async function fixReferencesTargetedWithAi(
  session: WriterSession,
  refSectionId: string,
  badDois: string[],
  missingCitations: string[],
  profile: AiProviderProfile,
  enableWebSearch?: boolean,
  signal?: AbortSignal
): Promise<{ content: string; changeSummary: string }> {
  const refSection = session.outline.find((s) => s.id === refSectionId);
  if (!refSection) {
    throw new Error('Không tìm thấy mục Tài liệu tham khảo.');
  }

  let entries = refSection.content
    .split(/\r?\n\s*\r?\n+/)
    .map((e) => e.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);

  const normalizedBadSet = new Set(
    badDois.map((d) => normalizeExtractedDoi(d).toLowerCase()).filter(Boolean)
  );

  let strippedDoiCount = 0;

  // Step 1: Deterministic scrub of every flagged bad/duplicate/404 DOI & suspicious fake DOI
  entries = entries.map((entry) => {
    let cleaned = entry;
    const foundDois = entry.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/g) || [];
    for (const rawDoi of foundDois) {
      const norm = normalizeExtractedDoi(rawDoi).toLowerCase();
      if (normalizedBadSet.has(norm) || isSuspiciousFakeDoiGlobal(rawDoi)) {
        const escaped = escapeRegExpForDoi(rawDoi);
        cleaned = cleaned
          .replace(
            new RegExp(
              `(?:Available at:\\s*)?(?:https?:\\/\\/(?:dx\\.)?doi\\.org\\/|https?:\\/\\/[^\\s]*?)?${escaped}(?:\\/(?:full|abstract|pdf|html))?[.)\\],;]*`,
              'gi'
            ),
            ''
          )
          .replace(/(?:doi:\s*|Available at:\s*)(?=[.,;\s]*$)/gi, '')
          .replace(/\s+\./g, '.')
          .replace(/\.\s*\./g, '.')
          .replace(/\s{2,}/g, ' ')
          .trim();
        strippedDoiCount++;
      }
    }
    // Ensure clean ending punctuation
    if (cleaned.length > 20 && !/[.!?)\]]$|https?:\/\/\S+$|10\.\d{4,9}\/\S+$/.test(cleaned)) {
      cleaned = `${cleaned}.`;
    }
    return cleaned;
  });

  // Step 2: Generate ONLY the missing citations (targeted, max 5 at a time)
  let addedCount = 0;
  const uniqueMissing = Array.from(
    new Set(missingCitations.map((c) => c.trim()).filter(Boolean))
  );

  if (uniqueMissing.length > 0) {
    const researchedSnippet = session.researchedSources?.trim()
      ? `\nVerified web sources:\n${session.researchedSources.trim().slice(0, 1800)}`
      : '';

    const systemPrompt = `You are a strict academic bibliographer.
Generate ONLY the full ${session.citationStyle} reference entries for the exact missing in-text citations listed below.
CRITICAL RULES:
- PRESERVE THE EXACT FIRST AUTHOR SURNAME AND YEAR from each listed citation (e.g., if listed "Eren and Rakıcıoğlu-Söylemez (2023)", entry MUST start with "Eren, ... (2023)").
- DO NOT INVENT, GUESS, OR PASTE ANY DOI OR URL unless it is 100% verbatim in the Verified web sources for THAT EXACT author. If unsure, OMIT the DOI/URL completely!
- Output ONLY the reference entries (one complete entry per paragraph, separated by a blank line). No markdown '#', no numbering, no intro/outro.`;

    const userPrompt = `Topic: ${session.topic || session.title}
Citation Style: ${session.citationStyle}
Writing Language: ${session.writingLanguage}${researchedSnippet}

Generate full ${session.citationStyle} entries for ONLY these ${uniqueMissing.length} missing citations:
${uniqueMissing.map((c, idx) => `${idx + 1}. ${c}`).join('\n')}`;

    const rawAdded = await callAiChatbot({
      profile,
      systemPrompt,
      userPrompt,
      enableWebSearch,
      maxOutputTokens: 1100,
      reasoningEffort: 'low',
      signal,
    });

    const addedBlocks = rawAdded
      .split(/\r?\n\s*\r?\n+/)
      .map((blk) =>
        stripMarkdownHashesFromText(blk)
          .replace(/\r?\n+/g, ' ')
          .replace(/^\d+[.)]\s+/, '')
          .replace(/\s{2,}/g, ' ')
          .trim()
      )
      .filter((blk) => blk.length >= 20);

    // Verify any DOI inside newly generated entries against Crossref immediately — auto-strip if 404 or fake!
    for (const blk of addedBlocks) {
      let safeEntry = blk;
      const newDois = blk.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/g) || [];
      for (const rawDoi of newDois) {
        const cleanDoi = normalizeExtractedDoi(rawDoi);
        let isBad = isSuspiciousFakeDoiGlobal(cleanDoi);
        if (!isBad) {
          const check = await verifyDoiWithCrossref(cleanDoi, signal);
          if (!check.networkError && !check.exists) {
            isBad = true;
          }
        }
        if (isBad) {
          const escaped = escapeRegExpForDoi(rawDoi);
          safeEntry = safeEntry
            .replace(
              new RegExp(
                `(?:Available at:\\s*)?(?:https?:\\/\\/(?:dx\\.)?doi\\.org\\/|doi:\\s*)?${escaped}[.)\\],;]*`,
                'gi'
              ),
              ''
            )
            .replace(/\s{2,}/g, ' ')
            .trim();
        }
      }
      if (safeEntry.length > 20 && !/[.!?)\]]$|https?:\/\/\S+$|10\.\d{4,9}\/\S+$/.test(safeEntry)) {
        safeEntry = `${safeEntry}.`;
      }
      entries.push(safeEntry);
      addedCount++;
    }
  }

  // Deduplicate & sort alphabetically
  const deduped: string[] = [];
  const seenKeys = new Set<string>();
  for (const e of entries) {
    const key = e.toLowerCase().replace(/[^a-z0-9à-ỹ]/gi, '').slice(0, 52);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(e);
  }
  if (session.citationStyle !== 'IEEE') {
    deduped.sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));
  }

  const parts: string[] = [];
  if (strippedDoiCount > 0) {
    parts.push(`gỡ bỏ triệt để ${strippedDoiCount} mã DOI lỗi/404/trùng`);
  }
  if (addedCount > 0) {
    parts.push(`bổ sung ${addedCount} nguồn trích dẫn còn thiếu khớp tác giả đầu`);
  }
  if (parts.length === 0) {
    parts.push('chuẩn hóa dấu câu và sắp xếp lại danh mục Tài liệu tham khảo');
  }

  return {
    content: deduped.join('\n\n'),
    changeSummary: `Đã ${parts.join(' và ')} (giữ nguyên các nguồn hợp lệ).`,
  };
}
