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
const INSTITUTION_NAME_RX =
  /\b(?:university|faculty|ministry|department|institute|association|organization|organisation|center|centre|council|board|commission|committee|office|agency|bank|academy|foundation|society|world|united|national|international|who|oecd|unesco|unicef|imf)\b/i;

/**
 * Splits merged 2-word personal names from Crossref (e.g. { family: "Yunika Upa" } or { name: "Yunika Upa" })
 * into { given: "Yunika", family: "Upa" } while keeping institutional names intact.
 */
function normalizeCrossrefAuthor(a: CrossrefAuthor): { family: string; given?: string } {
  const rawFamily = cleanCrossrefText(a.family || a.name || '');
  const rawGiven = cleanCrossrefText(a.given || '');
  if (rawGiven) {
    return { family: rawFamily, given: rawGiven };
  }
  const parts = rawFamily.split(/\s+/).filter(Boolean);
  if (parts.length === 2 && !INSTITUTION_NAME_RX.test(rawFamily)) {
    return { given: parts[0], family: parts[1] };
  }
  return { family: rawFamily };
}

function formatInTextCitationForWork(
  work: CrossrefWorkMeta,
  style: string
): string {
  const fams = work.authors
    .map((a) => normalizeCrossrefAuthor(a).family)
    .filter(Boolean);
  if (fams.length === 0) return `(${work.year})`;
  if (fams.length === 1) return `(${fams[0]}, ${work.year})`;
  if (fams.length === 2) {
    const conj = style === 'APA' ? '&' : 'and';
    return `(${fams[0]} ${conj} ${fams[1]}, ${work.year})`;
  }
  return `(${fams[0]} et al., ${work.year})`;
}

/**
 * Queries Crossref REST API in parallel with Perplexity to build a 100% real,
 * complete scholarly bibliography pack ([S1]..[S12]) containing ONLY peer-reviewed
 * works with full Author(s), Year, Title, Journal, Volume/Pages, and real DOI.
 */
async function fetchVerifiedCrossrefDossier(
  session: WriterSession,
  signal?: AbortSignal
): Promise<string> {
  const coreTopic = (session.topic || session.title || '').trim();
  const coreSubject = (session.subject || '').trim();
  const query = `${coreTopic} ${coreSubject}`.trim().slice(0, 220);
  if (!query) return '';

  const params = new URLSearchParams({
    'query.bibliographic': query,
    filter: 'type:journal-article,from-pub-date:2017',
    rows: '18',
    sort: 'relevance',
    select:
      'DOI,title,author,issued,published,container-title,volume,issue,page,type,publisher',
  });

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8500);
  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort);

  try {
    const res = await fetch(
      `https://api.crossref.org/works?${params.toString()}`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );
    if (!res.ok) return '';
    const json = (await res.json()) as {
      message?: {
        items?: Array<{
          DOI?: string;
          title?: string[];
          author?: CrossrefAuthor[];
          issued?: { 'date-parts'?: number[][] };
          published?: { 'date-parts'?: number[][] };
          'container-title'?: string[];
          volume?: string;
          issue?: string;
          page?: string;
          type?: string;
          publisher?: string;
        }>;
      };
    };
    const items = json?.message?.items || [];
    const verifiedBlocks: string[] = [];
    const seenDois = new Set<string>();

    for (const it of items) {
      const authors = (it.author || []).filter((a) =>
        Boolean((a.family || a.name || '').trim())
      );
      const title = cleanCrossrefText(it.title?.[0]);
      const containerTitle = cleanCrossrefText(it['container-title']?.[0]);
      const year =
        it.issued?.['date-parts']?.[0]?.[0] ||
        it.published?.['date-parts']?.[0]?.[0] ||
        0;
      const doi = (it.DOI || '').trim();

      // Require ALL essential academic bibliographic elements
      if (
        authors.length === 0 ||
        !title ||
        title.length < 15 ||
        !containerTitle ||
        !year ||
        year < 1990 ||
        !doi ||
        seenDois.has(doi.toLowerCase())
      ) {
        continue;
      }
      seenDois.add(doi.toLowerCase());

      const meta: CrossrefWorkMeta = {
        doi,
        title,
        authors,
        year,
        containerTitle,
        volume: it.volume,
        issue: it.issue,
        page: it.page,
        type: it.type,
        publisher: it.publisher,
      };
      const inText = formatInTextCitationForWork(meta, session.citationStyle);
      const fullRef = formatCrossrefReference(meta, session.citationStyle);
      verifiedBlocks.push(
        `[S${verifiedBlocks.length + 1}] In-Text: ${inText}\n    Full ${session.citationStyle}: ${fullRef}`
      );
      if (verifiedBlocks.length >= 12) break;
    }

    if (verifiedBlocks.length === 0) return '';
    return `=== VERIFIED CROSSREF ACADEMIC SOURCES (100% REAL PEER-REVIEWED METADATA — COMPLETE AUTHOR, YEAR, TITLE, JOURNAL, DOI) ===\n${verifiedBlocks.join(
      '\n'
    )}`;
  } catch {
    return '';
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

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

  // Run Crossref Academic Search IN PARALLEL with Perplexity so every paper starts with verified complete sources!
  const crossrefPromise = fetchVerifiedCrossrefDossier(session, signal);

  // Fast, ultra-cheap Perplexity Search API (POST /search — raw web results, 0 LLM output tokens, ~1-2s)
  if (researchProfile.model === 'perplexity-search') {
    const [res, crossrefDossier] = await Promise.all([
      callAiChatbotDetailed({
        profile: researchProfile,
        systemPrompt: '',
        userPrompt: compactSearchQuery,
        enableWebSearch: true,
        isResearchStep: true,
        signal,
      }),
      crossrefPromise,
    ]);

    const perplexityBlock = `=== PERPLEXITY REAL-TIME WEB RESEARCH (BACKGROUND CONTEXT — ONLY CITE AN ENTRY IF IT EXPLICITLY SHOWS AN AUTHOR SURNAME + YEAR; NEVER CITE AN ARTICLE TITLE IN PARENTHESES!) ===\n${res.text}`;
    return [crossrefDossier, perplexityBlock].filter(Boolean).join('\n\n').trim();
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

  const [res, crossrefDossier] = await Promise.all([
    callAiChatbotDetailed({
      profile: researchProfile,
      systemPrompt,
      userPrompt,
      enableWebSearch: true,
      isResearchStep: true,
      maxOutputTokens: 1800,
      searchFallbackQuery: compactSearchQuery,
      signal,
    }),
    crossrefPromise,
  ]);

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

  const perplexityBlock = `${res.text}${urlAppendix}`.trim();
  return [crossrefDossier, perplexityBlock].filter(Boolean).join('\n\n').trim();
}

function compactResearchedSourcesForPrompt(
  rawSources: string,
  mode: 'outline' | 'body'
): string {
  const trimmed = (rawSources || '').trim();
  if (!trimmed) return '';
  const perpMarker = '=== PERPLEXITY REAL-TIME WEB RESEARCH';
  const splitIdx = trimmed.indexOf(perpMarker);
  if (splitIdx === -1) {
    return trimmed.slice(0, mode === 'outline' ? 2400 : 4800);
  }
  const crossrefPart = trimmed.slice(0, splitIdx).trim();
  if (mode === 'outline') {
    // Outline generation only needs the verified [S1]..[S12] Crossref titles/citations (saves ~3,000 tokens!)
    return crossrefPart.slice(0, 3200);
  }
  // Body writing keeps 100% of verified [S1]..[S12] Crossref pack + compact capped Perplexity web context
  const perplexityPart = trimmed.slice(splitIdx).trim().slice(0, 2600);
  return `${crossrefPart}\n\n${perplexityPart}`.trim();
}

export function buildSkillsAndContextSystemPrompt(
  session: WriterSession,
  skills: SkillDocument[],
  mode: 'outline' | 'body' = 'body'
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

  // Pass ALL attached client documents & drafts 100% verbatim with NO character limit
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

  const compactSources = compactResearchedSourcesForPrompt(
    session.researchedSources || '',
    mode
  );

  const researchedSourcesBlock = compactSources
    ? `\n\n=== VERIFIED REAL-TIME ACADEMIC & WEB SOURCES (CROSSREF + PERPLEXITY) ===
STRICT CLOSED-BOOK CITATION & DATA LOCK (ZERO EXCEPTIONS):
1. ONLY cite sources with COMPLETE bibliographic metadata (Author(s), Year, Title, Venue) from [S1]..[SN] below, attached Context Files, or complete Perplexity entries with an explicit Author + Year.
2. NEVER invent/recall citations from memory. NEVER cite an article title in parentheses (e.g., NEVER "(Enhancing EFL..., 2026)"). If a Perplexity snippet lacks an explicit author name, DO NOT cite it AND DO NOT copy specific quantitative numbers/scores (e.g., "72.20 to 85.44") from it.
3. Copy exact author surname spelling and year from [S1]..[SN] (zero typos like Emyliani vs Emyliana; 100% 1-to-1 with References).
4. NEVER guess DOIs, page ranges, or thesis degrees not supported by the sources/files.
${compactSources}`
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
  const systemPrompt = buildSkillsAndContextSystemPrompt(
    session,
    skills,
    'outline'
  );
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
2. Tổng "targetWords" của các mục nội dung thân bài (KHÔNG tính Tài liệu tham khảo) xấp xỉ ${session.targetWordCount} từ. Riêng mục Tài liệu tham khảo đặt "targetWords": 0 (không giới hạn số từ).
3. Trong "guidanceNotes" của mỗi chương lớn (>= 400 từ), nêu rõ 2-3 tiểu mục con đánh số chuẩn (VD: "Gồm các tiểu mục: 1.1. ..., 1.2. ...") để Word tự tạo Mục lục chuẩn. TUYỆT ĐỐI KHÔNG dùng dấu '#' hay '##' trong tiêu đề.
4. CHỈ trả về duy nhất một mảng JSON hợp lệ (không giải thích thêm) với mỗi phần tử gồm:
   - "title": string (tiêu đề tiếng Việt chuẩn, VD: "LỜI MỞ ĐẦU", "CHƯƠNG 1. CƠ SỞ LÝ LUẬN", "TÀI LIỆU THAM KHẢO (${session.citationStyle})")
   - "headingLevel": "h1" | "h2" | "h3"
   - "targetWords": number
   - "guidanceNotes": string (luận điểm chính, tiểu mục con, số liệu/trích dẫn cần triển khai bằng tiếng Việt)`
    : `Based on the assignment brief, rubric, target total word count (${session.targetWordCount} words), citation style (${session.citationStyle}), and all active Skill files, design a comprehensive, publication-grade academic outline with a clear Table of Contents hierarchy.

REQUIREMENTS:
1. Divide the paper into well-proportioned sections following a standard university thesis / academic report Table of Contents structure (e.g., numbered H1 chapters such as "1. Introduction", "2. Literature Review & Theoretical Framework", "3. Empirical Analysis & Discussion", "4. Strategic Recommendations", "5. Conclusion", plus H2 sub-sections like "2.1 ...", "2.2 ..." for longer papers, and a final "References (${session.citationStyle})" section).
2. The sum of "targetWords" across all body prose sections (EXCLUDING References) should equal approximately ${session.targetWordCount} words. Set "targetWords": 0 for the References section (unlimited words).
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

export function isReferencesSectionTitle(title: string): boolean {
  const normalized = (title || '').replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
  return /^(references|bibliography|works cited|tài liệu tham khảo|danh mục tài liệu tham khảo)/i.test(
    normalized
  );
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
        const rawTitle = (item.title || `Section ${idx + 1}`).trim();
        const isRef = isReferencesSectionTitle(rawTitle);
        // APA 7 / Harvard standard: heading is simply "References" (strip trailing "(APA)" / "(Harvard)" etc.)
        const cleanTitle = isRef
          ? rawTitle.replace(/\s*\((?:APA|Harvard|MLA|IEEE|Chicago)[^)]*\)\s*$/i, '').trim() || 'References'
          : rawTitle;
        return {
          id: `sec_${Date.now()}_${idx}`,
          order: idx + 1,
          title: cleanTitle,
          headingLevel: level,
          targetWords: isRef ? 0 : Math.max(80, Number(item.targetWords) || 300),
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
      title: 'References',
      headingLevel: 'h1',
      targetWords: 0,
      guidanceNotes: `Complete list of all scholarly sources cited across all sections above formatted strictly in ${citationStyle} (unlimited word count).`,
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
  //    For secondary citations like (Creswell, 2013, as cited in Kusumawati & Arifin, 2024),
  //    APA/Harvard rules require ONLY the primary read source (right of "cited in") in References.
  const parenRegex = /\(([^()]{2,160}(?:19|20)\d{2}[a-z]?[^()]{0,60})\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRegex.exec(text)) !== null) {
    // Split multi-citation parentheses by ';' so each citation is handled individually
    const parts = m[1].split(';').map((p) => p.trim()).filter(Boolean);
    for (const rawPart of parts) {
      const secondarySplit = rawPart.split(/\b(?:as\s+)?cited\s+in\b/i);
      const part =
        secondarySplit.length > 1
          ? secondarySplit[secondarySplit.length - 1].trim()
          : rawPart;
      if (/(?:19|20)\d{2}/.test(part) && /[A-Za-zÀ-ỹ]{2,}/.test(part)) {
        addCit(`(${part})`);
      }
    }
  }

  // 2. Narrative citations supporting 1, 2, 3, or 4+ authors (horizontal spaces ONLY so headings on the previous line never glue onto author names):
  //    Fredricks, Blumenfeld and Paris (2004) | Xu, Yang and He (2023) | Vardal Ocaklı (2019) | Hiver et al. (2024)
  const authorToken = "[A-ZÀ-Ỹ][A-Za-zÀ-ỹ'’-]+(?:[ \\t]+[A-ZÀ-Ỹ][A-Za-zÀ-ỹ'’-]+)?";
  const narrativeRegex = new RegExp(
    `\\b${authorToken}(?:,[ \\t]*${authorToken})*(?:,?[ \\t]+(?:&|and|và)[ \\t]+${authorToken}|[ \\t]+et[ \\t]+al\\.?)?[ \\t]*\\((?:19|20)\\d{2}[a-z]?\\)`,
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

// ---------------------------------------------------------------------------
// Crossref-Grounded References Engine
// Builds every reference entry from REAL Crossref metadata (title, journal,
// volume, pages, DOI) instead of letting the LLM guess them.
// ---------------------------------------------------------------------------

export interface ParsedCitationKey {
  raw: string;
  surnames: string[];
  firstSurname: string;
  year: string;
  hasEtAl: boolean;
  expectedAuthorCount: 'exact1' | 'exact2' | '3plus';
}

function normName(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const CONTEXT_STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'they', 'them', 'their', 'there', 'these', 'those',
  'have', 'been', 'were', 'being', 'which', 'what', 'when', 'where', 'while', 'about',
  'into', 'over', 'after', 'before', 'between', 'under', 'through', 'during', 'without',
  'within', 'against', 'among', 'study', 'studies', 'research', 'article', 'paper',
  'review', 'analysis', 'findings', 'results', 'using', 'based', 'approach', 'method',
  'methods', 'journal', 'international', 'university', 'press', 'also', 'more', 'most',
  'such', 'than', 'only', 'other', 'some', 'many', 'much', 'very', 'however', 'therefore',
  'của', 'trong', 'những', 'được', 'không', 'nghiên', 'cứu', 'bài', 'viết', 'phương', 'pháp',
]);

function extractMeaningfulTokens(text: string): Set<string> {
  const words = (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !CONTEXT_STOP_WORDS.has(w));
  return new Set(words);
}

function countTokenOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  a.forEach((tok) => {
    if (b.has(tok)) count++;
  });
  return count;
}

function extractCitationSentenceContext(
  bodyText: string,
  key: ParsedCitationKey
): string {
  if (!bodyText) return '';
  const sentences = bodyText.split(/(?<=[.!?])\s+|\r?\n+/);
  const normFirst = normName(key.firstSurname);
  const matched: string[] = [];
  for (const sent of sentences) {
    if (!sent.includes(key.year)) continue;
    const normSent = normName(sent);
    if (normFirst.length >= 2 && normSent.includes(normFirst)) {
      matched.push(sent.trim());
      if (matched.length >= 2) break;
    }
  }
  return matched.join(' ').slice(0, 320);
}

export function parseCitationKey(cite: string): ParsedCitationKey | null {
  const inner = cite.replace(/^\(|\)$/g, '').trim();
  const yearMatch = inner.match(/(?:19|20)\d{2}[a-z]?/);
  if (!yearMatch) return null;
  const year = yearMatch[0].slice(0, 4);
  const beforeYear = inner.slice(0, yearMatch.index);
  const hasEtAl = /\bet\s+al\.?/i.test(beforeYear);
  const authorPart = beforeYear
    .replace(/\(/g, ' ')
    .replace(/\bet\s+al\.?/gi, ' ')
    .replace(/[,\s]+$/g, '')
    .trim();
  const surnames = authorPart
    .split(/\s*(?:,|&|\band\b|\bvà\b)\s*/i)
    .map((s) => s.trim())
    .filter((s) => /^[A-ZÀ-Ỹ]/.test(s) && s.length >= 2);
  if (surnames.length === 0) return null;
  const expectedAuthorCount: ParsedCitationKey['expectedAuthorCount'] =
    hasEtAl || surnames.length >= 3
      ? '3plus'
      : surnames.length === 2
      ? 'exact2'
      : 'exact1';
  return {
    raw: cite,
    surnames,
    firstSurname: surnames[0],
    year,
    hasEtAl,
    expectedAuthorCount,
  };
}

interface CrossrefAuthor {
  family?: string;
  given?: string;
  name?: string;
}

interface CrossrefWorkMeta {
  doi?: string;
  title: string;
  authors: CrossrefAuthor[];
  year: number;
  containerTitle?: string;
  volume?: string;
  issue?: string;
  page?: string;
  type?: string;
  publisher?: string;
}

function cleanCrossrefText(raw?: string): string {
  return (raw || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function surnameMatches(citedSurname: string, family: string): boolean {
  const a = normName(citedSurname);
  const b = normName(family);
  if (!a || !b) return false;
  if (a === b) return true;
  // Handle compound surnames: "Vardal Ocaklı" vs "Ocaklı", "Rakıcıoğlu-Söylemez" vs "Rakıcıoğlu Söylemez"
  const aParts = citedSurname.split(/[\s-]+/).map(normName).filter((p) => p.length >= 3);
  const bParts = family.split(/[\s-]+/).map(normName).filter((p) => p.length >= 3);
  return aParts.some((p) => bParts.includes(p));
}

async function searchCrossrefWorkForCitation(
  key: ParsedCitationKey,
  bibliographicHint: string,
  contextTokens: Set<string>,
  draftTitleTokens: Set<string>,
  signal?: AbortSignal
): Promise<CrossrefWorkMeta | null> {
  const y = Number(key.year);
  const params = new URLSearchParams({
    'query.author': key.surnames.join(' '),
    rows: '8',
    select:
      'DOI,title,author,issued,published,container-title,volume,issue,page,type,publisher',
    filter: `from-pub-date:${y - 1},until-pub-date:${y + 1}`,
  });
  if (bibliographicHint.trim()) {
    params.set('query.bibliographic', bibliographicHint.trim().slice(0, 220));
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort);

  try {
    const res = await fetch(`https://api.crossref.org/works?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      message?: {
        items?: Array<{
          DOI?: string;
          title?: string[];
          author?: CrossrefAuthor[];
          issued?: { 'date-parts'?: number[][] };
          published?: { 'date-parts'?: number[][] };
          'container-title'?: string[];
          volume?: string;
          issue?: string;
          page?: string;
          type?: string;
          publisher?: string;
        }>;
      };
    };
    const items = json?.message?.items || [];
    const candidates: Array<{ meta: CrossrefWorkMeta; score: number }> = [];

    for (const it of items) {
      const authors = it.author || [];
      const title = cleanCrossrefText(it.title?.[0]);
      const itemYear =
        it.issued?.['date-parts']?.[0]?.[0] ||
        it.published?.['date-parts']?.[0]?.[0] ||
        0;
      if (!title || authors.length === 0 || !itemYear) continue;

      const firstFamily = authors[0]?.family || authors[0]?.name || '';
      if (!surnameMatches(key.firstSurname, firstFamily)) continue;

      // Pillar 1: Author-Count Lock (domain-agnostic) — prevents 1-author citations like (Creswell, 2013)
      // from matching a 4-author homonym paper by J. D. Creswell et al. (2013)
      if (key.expectedAuthorCount === 'exact1' && authors.length !== 1) continue;
      if (key.expectedAuthorCount === 'exact2' && authors.length !== 2) continue;
      if (key.expectedAuthorCount === '3plus' && authors.length < 3) continue;

      // If the in-text citation names 2+ authors, every named co-author must exist in Crossref's author list
      const coAuthorsOk = key.surnames
        .slice(1)
        .every((s) => authors.some((a) => surnameMatches(s, a.family || a.name || '')));
      if (!coAuthorsOk) continue;

      const yearDiff = Math.abs(itemYear - y);
      if (yearDiff > 1) continue;

      const containerTitle = cleanCrossrefText(it['container-title']?.[0]);

      // Pillar 2: Dynamic Context-Overlap Gate (domain-agnostic) — candidate title/journal MUST share
      // meaningful keywords with the paper's citation sentence / topic or the clean draft title.
      const candidateTokens = extractMeaningfulTokens(
        `${title} ${containerTitle}`
      );
      const draftOverlap = countTokenOverlap(draftTitleTokens, candidateTokens);
      const contextOverlap = countTokenOverlap(contextTokens, candidateTokens);

      const minContextNeeded = contextTokens.size >= 4 ? 2 : 1;
      const passesSemanticGate =
        draftTitleTokens.size >= 2
          ? draftOverlap >= 1 || contextOverlap >= minContextNeeded
          : contextOverlap >= minContextNeeded;
      if (!passesSemanticGate) continue;

      candidates.push({
        meta: {
          doi: it.DOI,
          title,
          authors,
          year: itemYear,
          containerTitle,
          volume: it.volume,
          issue: it.issue,
          page: it.page,
          type: it.type,
          publisher: it.publisher,
        },
        score:
          (yearDiff === 0 ? 10 : 0) +
          draftOverlap * 5 +
          contextOverlap * 3,
      });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    // Keep the citation year exactly as written in the body so in-text & list stay 1-to-1
    return { ...candidates[0].meta, year: y };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

function initialsOf(given: string | undefined, withSpaces: boolean): string {
  if (!given) return '';
  const parts = given
    .replace(/\./g, ' ')
    .split(/[\s]+/)
    .filter(Boolean)
    .map((p) =>
      p
        .split('-')
        .map((h) => `${h.charAt(0).toUpperCase()}.`)
        .join('-')
    );
  return parts.join(withSpaces ? ' ' : '');
}

const PROPER_NOUN_WORDS_APA = new Set([
  'english', 'indonesian', 'vietnamese', 'japanese', 'chinese', 'korean', 'thai',
  'german', 'french', 'spanish', 'arabic', 'russian', 'turkish', 'afghan', 'indian',
  'american', 'british', 'australian', 'canadian', 'european', 'asian', 'african',
  'indonesia', 'vietnam', 'japan', 'china', 'korea', 'thailand', 'germany', 'france',
  'spain', 'turkey', 'afghanistan', 'india', 'malaysia', 'singapore', 'philippines',
  'depok', 'batam', 'jakarta', 'hanoi', 'merdeka', 'cambridge', 'oxford', 'harvard',
  'bloomsbury', 'sage', 'springer', 'elsevier', 'routledge', 'wiley', 'google',
]);

/**
 * Converts Title Case or ALL CAPS article/book titles to strict APA 7th Sentence case:
 * keeps first word, first word after ':'/'?'/'!', all-caps acronyms (EFL, AI, TED, STEM),
 * and proper geographical/language nouns capitalized.
 */
function toApaSentenceCase(rawTitle: string): string {
  const clean = cleanCrossrefText(rawTitle);
  if (!clean) return clean;
  const words = clean.split(/(\s+)/);
  let capitalizeNext = true;
  return words
    .map((tok) => {
      if (/^\s+$/.test(tok)) return tok;
      // Preserve acronyms like EFL, ESL, AI, TED, STEM, COVID-19, L1, L2
      const stripped = tok.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
      const isAcronym =
        /^[A-Z]{2,6}(?:-[A-Z0-9]+)?$/.test(stripped) ||
        /^L[12]$/.test(stripped) ||
        /^(?:iOS|iPad|e-Learning|ChatGPT|YouTube|WhatsApp|TikTok)$/i.test(stripped);

      let out = tok;
      if (isAcronym) {
        out = tok;
      } else if (capitalizeNext || PROPER_NOUN_WORDS_APA.has(stripped.toLowerCase())) {
        // Capitalize first letter, keep rest lowercase if it was ALL CAPS
        const isAllCaps = stripped.length >= 3 && stripped === stripped.toUpperCase();
        out = isAllCaps
          ? tok.toLowerCase().replace(/[A-Za-zÀ-ỹ]/, (c) => c.toUpperCase())
          : tok.replace(/[A-Za-zÀ-ỹ]/, (c) => c.toUpperCase());
      } else {
        out = tok.toLowerCase();
      }

      capitalizeNext = /[:?!—–]$/.test(tok.trim());
      return out;
    })
    .join('');
}

function formatCrossrefReference(
  work: CrossrefWorkMeta,
  style: string
): string {
  const doiUrl = work.doi ? `https://doi.org/${work.doi}` : '';
  const authors = work.authors.slice(0, 20).map(normalizeCrossrefAuthor);
  const fam = (a: { family: string; given?: string }) => a.family;
  const pages = (work.page || '').replace(/-/g, '–');
  const isBook = work.type === 'book' || work.type === 'monograph';
  const isChapter = work.type === 'book-chapter';

  if (style === 'APA') {
    const apaTitle = toApaSentenceCase(work.title);
    const names = authors.map((a) => {
      const ini = initialsOf(a.given, true);
      return ini ? `${fam(a)}, ${ini}` : fam(a);
    });
    const authorStr =
      names.length <= 1
        ? names[0] || ''
        : `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
    if (isBook) {
      return `${authorStr} (${work.year}). ${apaTitle}. ${work.publisher || ''}.${doiUrl ? ` ${doiUrl}` : ''}`.replace(/\s+\./g, '.');
    }
    const volIssue = `${work.volume || ''}${work.issue ? `(${work.issue})` : ''}`;
    return `${authorStr} (${work.year}). ${apaTitle}. ${work.containerTitle || work.publisher || ''}${
      volIssue ? `, ${volIssue}` : ''
    }${pages ? `, ${pages}` : ''}.${doiUrl ? ` ${doiUrl}` : ''}`;
  }

  if (style === 'MLA') {
    const first = authors[0];
    const firstStr = first
      ? `${fam(first)}${first.given ? `, ${cleanCrossrefText(first.given)}` : ''}`
      : '';
    const authorStr =
      authors.length >= 3
        ? `${firstStr}, et al.`
        : authors.length === 2
        ? `${firstStr}, and ${cleanCrossrefText(authors[1].given || '')} ${fam(authors[1])}`.replace(/\s+/g, ' ')
        : firstStr;
    return `${authorStr}. "${work.title}." ${work.containerTitle || work.publisher || ''}${
      work.volume ? `, vol. ${work.volume}` : ''
    }${work.issue ? `, no. ${work.issue}` : ''}, ${work.year}${pages ? `, pp. ${pages}` : ''}.${
      doiUrl ? ` ${doiUrl}.` : ''
    }`;
  }

  if (style === 'IEEE') {
    const names = authors.map((a) => {
      const ini = initialsOf(a.given, true);
      return ini ? `${ini} ${fam(a)}` : fam(a);
    });
    const authorStr =
      names.length <= 2
        ? names.join(' and ')
        : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
    return `${authorStr}, "${work.title}," ${work.containerTitle || work.publisher || ''}${
      work.volume ? `, vol. ${work.volume}` : ''
    }${work.issue ? `, no. ${work.issue}` : ''}${pages ? `, pp. ${pages}` : ''}, ${work.year}${
      work.doi ? `, doi: ${work.doi}` : ''
    }.`;
  }

  // Harvard (Cite Them Right) default
  const names = authors.map((a) => {
    const ini = initialsOf(a.given, false);
    return ini ? `${fam(a)}, ${ini}` : fam(a);
  });
  const authorStr =
    names.length <= 1
      ? names[0] || ''
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  if (isBook) {
    return `${authorStr} (${work.year}) ${work.title}. ${work.publisher || ''}.${
      doiUrl ? ` Available at: ${doiUrl}.` : ''
    }`.replace(/\s+\./g, '.');
  }
  if (isChapter) {
    return `${authorStr} (${work.year}) '${work.title}', in ${work.containerTitle || ''}. ${
      work.publisher || ''
    }${pages ? `, pp. ${pages}` : ''}.${doiUrl ? ` Available at: ${doiUrl}.` : ''}`.replace(/\s+\./g, '.');
  }
  const volIssue = `${work.volume || ''}${work.issue ? `(${work.issue})` : ''}`;
  return `${authorStr} (${work.year}) '${work.title}', ${work.containerTitle || work.publisher || ''}${
    volIssue ? `, ${volIssue}` : ''
  }${pages ? `, pp. ${pages}` : ''}.${doiUrl ? ` Available at: ${doiUrl}.` : ''}`;
}

/** Extracts the title-ish portion of a reference entry (text after the year, before the journal). */
export function extractReferenceTitle(entry: string): string {
  const afterYear = entry.split(/\((?:19|20)\d{2}[a-z]?\)\.?/)[1] || '';
  const quoted = afterYear.match(/['‘"“]([^'’"”]{12,})['’"”]/);
  const raw = quoted ? quoted[1] : afterYear.split(/\.\s|,\s(?=[A-Z])/)[0] || '';
  return raw.trim();
}

function normTitleKey(raw: string): string {
  return normName(raw).slice(0, 60);
}

function referenceStartsWithSurname(entry: string, surname: string): boolean {
  const head = entry.slice(0, Math.max(40, surname.length + 25));
  const firstChunk = head.split(/[,(]/)[0] || '';
  return surnameMatches(surname, firstChunk);
}

export interface CrossrefReferencesResult {
  content: string;
  verifiedCount: number;
  keptUnverifiedCount: number;
  droppedDuplicateCount: number;
  unverifiedCitations: string[];
  missingCitations: string[];
  changeSummary: string;
}

/**
 * Rebuilds the full References list 1-to-1 with in-text citations:
 * - Each cited work is looked up on Crossref; when found, the entry is rebuilt from REAL metadata.
 * - When not on Crossref (e.g. theses), exactly ONE best existing entry is kept (DOIs stripped unless verified).
 * - Variant duplicates (same surname, different initials/years), entries with a reused title,
 *   or entries whose title is the assignment's own topic are dropped.
 */
export async function buildCrossrefVerifiedReferences(
  session: WriterSession,
  existingRefText: string,
  onProgress?: (label: string) => void,
  signal?: AbortSignal
): Promise<CrossrefReferencesResult> {
  const refSectionIdx = session.outline.findIndex((s) =>
    /^(references|bibliography|works cited|tài liệu tham khảo|danh mục tài liệu tham khảo)/i.test(
      s.title.replace(/^\d+(\.\d+)*\.?\s*/, '').trim()
    )
  );
  const bodyText = session.outline
    .filter((_, idx) => idx !== refSectionIdx)
    .map((s) => s.content || '')
    .join('\n\n');

  const citations = extractInTextCitations(bodyText);
  const keys: ParsedCitationKey[] = [];
  const seenKeys = new Set<string>();
  for (const c of citations) {
    const k = parseCitationKey(c);
    if (!k) continue;
    const id = `${normName(k.firstSurname)}_${k.year}`;
    if (seenKeys.has(id)) continue;
    seenKeys.add(id);
    keys.push(k);
  }

  const existingEntries = existingRefText
    .split(/\r?\n\s*\r?\n+/)
    .map((e) => e.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter((e) => e.length >= 15);

  const topicKey = normTitleKey(session.topic || session.title || '');
  const titleCounts = new Map<string, number>();
  for (const e of existingEntries) {
    const t = normTitleKey(extractReferenceTitle(e));
    if (t.length >= 15) titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
  }
  const isPoisonedTitle = (entry: string): boolean => {
    const t = normTitleKey(extractReferenceTitle(entry));
    if (t.length < 15) return false;
    if (topicKey.length >= 15 && (t.startsWith(topicKey.slice(0, 40)) || topicKey.startsWith(t.slice(0, 40)))) {
      return true;
    }
    return (titleCounts.get(t) || 0) > 1;
  };
  const isStubEntry = (entry: string): boolean => {
    const afterYear = entry.split(/\((?:19|20)\d{2}[a-z]?\)\.?/)[1] || '';
    return afterYear.replace(/[^A-Za-zÀ-ỹ]/g, '').length < 12;
  };

  const topicHint = (session.topic || session.title || '').slice(0, 120);
  const finalEntries: string[] = [];
  const usedExisting = new Set<number>();
  const unverifiedCitations: string[] = [];
  const missingCitations: string[] = [];
  let verifiedCount = 0;
  let keptUnverifiedCount = 0;

  const CONCURRENCY = 4;
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const batch = keys.slice(i, i + CONCURRENCY);
    onProgress?.(
      `Đang tra cứu Crossref để lấy metadata thật cho nguồn ${i + 1}–${Math.min(
        keys.length,
        i + CONCURRENCY
      )}/${keys.length}...`
    );

    const results = await Promise.all(
      batch.map(async (key) => {
        // Find existing entries for this exact citation (first surname + year)
        const matchingIdx = existingEntries
          .map((e, idx) => ({ e, idx }))
          .filter(
            ({ e }) =>
              referenceStartsWithSurname(e, key.firstSurname) &&
              e.includes(`(${key.year}`)
          );
        const cleanHintEntry = matchingIdx.find(({ e }) => !isPoisonedTitle(e) && !isStubEntry(e));
        const draftTitle = cleanHintEntry ? extractReferenceTitle(cleanHintEntry.e) : '';
        const sentenceCtx = extractCitationSentenceContext(bodyText, key);
        const contextTokens = extractMeaningfulTokens(
          `${sentenceCtx} ${session.subject || ''} ${topicHint}`
        );
        const draftTitleTokens = extractMeaningfulTokens(draftTitle);

        const hint = draftTitle
          ? `${draftTitle} ${sentenceCtx.slice(0, 100)}`
          : `${sentenceCtx.slice(0, 120)} ${topicHint}`;

        let work = await searchCrossrefWorkForCitation(
          key,
          hint,
          contextTokens,
          draftTitleTokens,
          signal
        );
        if (!work && hint !== topicHint) {
          work = await searchCrossrefWorkForCitation(
            key,
            topicHint,
            contextTokens,
            draftTitleTokens,
            signal
          );
        }
        return { key, work, matchingIdx, cleanHintEntry, contextTokens };
      })
    );

    for (const { key, work, matchingIdx, cleanHintEntry, contextTokens } of results) {
      matchingIdx.forEach(({ idx }) => usedExisting.add(idx));
      if (work) {
        finalEntries.push(formatCrossrefReference(work, session.citationStyle));
        verifiedCount++;
        continue;
      }
      // Not on Crossref: keep ONE best existing non-stub entry that ALSO passes author-count & semantic checks
      const candidateFallbacks = [
        ...(cleanHintEntry ? [cleanHintEntry] : []),
        ...matchingIdx.filter((m) => m !== cleanHintEntry),
      ].filter(({ e }) => !isStubEntry(e));

      const validFallback = candidateFallbacks.find(({ e }) => {
        const authorHead = (e.split(/\((?:19|20)\d{2}/)[0] || '').trim();
        const looksMultiAuthor =
          /\s(?:&|and|và)\s/i.test(authorHead) ||
          (authorHead.match(/,/g) || []).length >= 2;
        if (key.expectedAuthorCount === 'exact1' && looksMultiAuthor) {
          return false;
        }
        // Reject completely off-topic homonym entries (e.g. Chemical Engineering CFD paper in an Education essay)
        // while keeping legitimate regional-journal articles that share at least 1 topic/context keyword
        const entryTokens = extractMeaningfulTokens(e);
        if (
          contextTokens.size >= 5 &&
          entryTokens.size >= 4 &&
          countTokenOverlap(contextTokens, entryTokens) === 0
        ) {
          return false;
        }
        return true;
      });

      if (validFallback) {
        let kept = cleanCrossrefText(validFallback.e);
        const dois = kept.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/g) || [];
        for (const rawDoi of dois) {
          const check = await verifyDoiWithCrossref(normalizeExtractedDoi(rawDoi), signal);
          const ok =
            check.exists &&
            !check.networkError &&
            (!check.firstAuthorSurname ||
              surnameMatches(key.firstSurname, check.firstAuthorSurname));
          if (!ok && !check.networkError) {
            kept = kept
              .replace(
                new RegExp(
                  `(?:Available at:\\s*)?(?:https?:\\/\\/(?:dx\\.)?doi\\.org\\/|doi:\\s*)?${escapeRegExpForDoi(
                    rawDoi
                  )}[.)\\],;]*`,
                  'gi'
                ),
                ''
              )
              .trim();
          }
        }
        kept = kept
          .replace(/\s*,\s*\./g, '.')
          .replace(/\.\s*\./g, '.')
          .replace(/\s{2,}/g, ' ')
          .trim();
        // In APA 7, do NOT put a trailing period after a DOI URL
        if (session.citationStyle === 'APA' && /https?:\/\/doi\.org\/\S+\.$/.test(kept)) {
          kept = kept.slice(0, -1);
        } else if (!/[.!?)\]]$/.test(kept) && !/https?:\/\/\S+$/.test(kept)) {
          kept = `${kept}.`;
        }
        finalEntries.push(kept);
        keptUnverifiedCount++;
        if (isPoisonedTitle(validFallback.e)) {
          unverifiedCitations.push(key.raw);
        }
      } else {
        missingCitations.push(key.raw);
      }
    }
  }

  // Keep orphan entries (not matched to any detected citation) only if they are clean & not variant duplicates
  const citedSurnames = keys.map((k) => k.firstSurname);
  let droppedDuplicateCount = 0;
  existingEntries.forEach((e, idx) => {
    if (usedExisting.has(idx)) {
      return;
    }
    const isVariantOfCited = citedSurnames.some((s) => referenceStartsWithSurname(e, s));
    if (isVariantOfCited || isPoisonedTitle(e) || isStubEntry(e)) {
      droppedDuplicateCount++;
      return;
    }
    finalEntries.push(e);
  });
  // Count dropped duplicates from multi-matched citations too
  droppedDuplicateCount += Math.max(0, usedExisting.size - keptUnverifiedCount - verifiedCount);

  const dedup: string[] = [];
  const seen = new Set<string>();
  for (const e of finalEntries) {
    const k = normName(e).slice(0, 70);
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(e);
  }
  if (session.citationStyle !== 'IEEE') {
    dedup.sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));
  }

  const parts: string[] = [`xác minh & dựng lại ${verifiedCount} nguồn từ metadata thật trên Crossref`];
  if (droppedDuplicateCount > 0) parts.push(`loại ${droppedDuplicateCount} nguồn trùng/biến thể/gán sai tên bài`);
  if (keptUnverifiedCount > 0) parts.push(`giữ ${keptUnverifiedCount} nguồn không có trên Crossref (luận văn/sách) sau khi gỡ DOI sai`);
  if (unverifiedCitations.length + missingCitations.length > 0) {
    parts.push(`${unverifiedCitations.length + missingCitations.length} trích dẫn cần kiểm tra thủ công`);
  }

  return {
    content: dedup.join('\n\n'),
    verifiedCount,
    keptUnverifiedCount,
    droppedDuplicateCount,
    unverifiedCitations,
    missingCitations,
    changeSummary: `Đã ${parts.join('; ')}.`,
  };
}

function getCitationStyleGrammarRule(style: string): string {
  if (style === 'APA') {
    return 'APA 7th In-Text Rules: 1 author = (Smith, 2024) or Smith (2024); 2 authors = (Smith & Lee, 2024) in parentheses / Smith and Lee (2024) in narrative; 3+ authors = (Smith et al., 2024) or Smith et al. (2024).';
  }
  if (style === 'Harvard') {
    return 'Harvard (Cite Them Right) In-Text Rules: 1 author = (Smith, 2024) or Smith (2024); 2 authors = (Smith and Lee, 2024) or Smith and Lee (2024); 3+ authors = (Smith et al., 2024) or Smith et al. (2024). NEVER use "&" in Harvard.';
  }
  if (style === 'MLA') {
    return 'MLA 9th In-Text Rules: (Smith) or (Smith 45); 2 authors = (Smith and Lee); 3+ authors = (Smith et al.).';
  }
  if (style === 'IEEE') {
    return 'IEEE In-Text Rules: Use consistent author-year or numbered citations [1], [2] matching the verified source list.';
  }
  return `Follow strict ${style} in-text citation grammar consistently throughout every paragraph.`;
}

function buildVerifiedCitationWhitelistBlock(session: WriterSession): string {
  const verifiedLines: string[] = [];
  const rawSources = session.researchedSources || '';
  const sMatches = rawSources.match(/^\[S\d+\]\s+In-Text:.*$/gm) || [];
  if (sMatches.length > 0) {
    verifiedLines.push(...sMatches.slice(0, 14));
  }
  if (verifiedLines.length === 0) return '';
  return `\n=== VERIFIED IN-TEXT CITATION WHITELIST (USE THESE EXACT AUTHOR-YEAR CITATIONS) ===\n${verifiedLines.join(
    '\n'
  )}\n`;
}

function isAiRefusalOrDisclaimerLine(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  if (
    /^(?:no verified|to avoid fabricating|i cannot|i'm unable|unable to verify|cannot find|note:|please note|disclaimer:|sorry,|unfortunately,|the provided sources do not|no bibliographic data|missing bibliographic)/i.test(
      s
    )
  ) {
    return true;
  }
  if (
    /\b(?:was found in the provided sources|not found in the provided sources|to avoid fabricating|cannot be verified from the provided|no verified bibliographic data)\b/i.test(
      s
    )
  ) {
    return true;
  }
  return false;
}

function stripInlineAiMetaNotes(text: string): string {
  return text
    .replace(
      /\s*[([]\s*(?:no verified|doi unavailable|no doi|unverified|missing (?:journal|doi|publisher|pages|volume)|not available in provided sources|journal(?:\s+or\s+doi)?\s+unavailable)[^)\]]*[)\]]/gi,
      ''
    )
    .replace(/\s+\./g, '.')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
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
Format ONLY clean, publication-ready ${session.citationStyle} reference entries matching the exact in-text citations provided.
REQUIRED VS. OPTIONAL ELEMENTS:
- REQUIRED (4 core fields): Author(s) in exact order, Year, Title, and Publication venue (Journal/Publisher/University).
- OPTIONAL (OMIT SILENTLY IF UNKNOWN): DOI, URL, issue number, page range, access date, place of publication. If an optional field is unavailable, simply leave it out cleanly — do NOT write any placeholder or explanation.
CRITICAL ANTI-HALLUCINATION & ZERO-META RULES:
- Preserve EVERY author name in exact order (NEVER drop the first author of a 3-author citation like "Fredricks, Blumenfeld and Paris" or "Xu, Yang and He").
- NEVER invent, guess, or fabricate a DOI (especially sequential numbers like 123456, 1123456, 1156789) or URL.
- NEVER copy or reuse one source's DOI, URL, or paper title onto a different author.
- ONLY include a DOI or URL if it appears verbatim in the VERIFIED SOURCES list for THAT exact author and work; otherwise silently omit the DOI/URL.
- NEVER output incomplete author-year stubs without a title and publication venue (e.g., NEVER write "Norman, R. E., & King, J. (2020).").
- ZERO ERROR MESSAGES / ZERO META-NOTES (STRICTLY FORBIDDEN): NEVER write apologies, refusal sentences, or parenthetical disclaimers into the output (e.g., NEVER write "No verified bibliographic data...", "To avoid fabricating...", "(no verified journal or DOI available...)", "[DOI unavailable]", "Note:").
- Output each reference entry on a SINGLE line (do not insert line breaks inside one entry), separated from the next entry by a blank line. No headings, no markdown '#', no commentary.`;

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
        let line = stripInlineAiMetaNotes(
          stripMarkdownHashesFromText(rawEntry)
            .replace(/\s*\n+\s*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        );
        if (!line || line.length < 18 || isAiRefusalOrDisclaimerLine(line)) continue;
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
          maxOutputTokens: 1800,
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

      const aiDraftRefs = mergeAndSortRefs(accumulatedEntries);
      // Ground every entry on REAL Crossref metadata (fixes reused titles, stub entries, fake DOIs, variant duplicates)
      try {
        onPartialText?.(aiDraftRefs, 'Đang đối chiếu Crossref để xác minh từng nguồn...');
        const verified = await buildCrossrefVerifiedReferences(
          session,
          aiDraftRefs,
          (label) => onPartialText?.(aiDraftRefs, label),
          signal
        );
        if (verified.content.trim()) {
          return verified.content;
        }
      } catch (err) {
        if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
          throw err;
        }
      }
      return aiDraftRefs;
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
        `${i + 1}. ${s.title}${s.targetWords > 0 ? ` (~${s.targetWords}w)` : ''}`
    )
    .join('\n');

  const priorWrittenSections = buildSmartPriorContext(
    session.outline.slice(0, sectionIdx),
    isConclusionSection ? 'conclusion' : 'body'
  );

  const verifiedWhitelistBlock = buildVerifiedCitationWhitelistBlock(session);
  const citationGrammarRule = getCitationStyleGrammarRule(session.citationStyle);

  const userPrompt = `Write ONLY Section ${sectionIdx + 1}: "${targetSection.title}".

=== OUTLINE ===
${fullOutlineMap}
${
  priorWrittenSections
    ? `\n=== PRIOR SECTIONS (CONTINUITY) ===\n${priorWrittenSections}\n`
    : ''
}${verifiedWhitelistBlock}
=== CURRENT SECTION ===
- Title: ${targetSection.title} | Target: ~${targetSection.targetWords} words | Style: ${session.citationStyle} (${citationGrammarRule}) | Language: ${session.writingLanguage}
- Guidance: ${targetSection.guidanceNotes || 'Develop scholarly arguments with peer-reviewed citations.'}

MANDATORY RULES:
1. Do NOT repeat "${targetSection.title}" on line 1; NEVER use markdown '#'/'##'/'###' or code fences.
2. Sub-headings: if >= 350w (${targetSection.headingLevel}), use 2–4 paired numbered sub-headings (never orphan X.1 without X.2); every paragraph must strictly match its sub-heading topic.
3. Citations & Data: ONLY cite verified sources from the Whitelist/Context Files (exact author surname spelling & year). NEVER cite article titles in parentheses, NEVER copy unattributed numbers/scores from anonymous web snippets, and aim for 2–5 natural citations per major subsection.
4. Keep facts (thesis degree, sample size N, instruments) 100% consistent with Context Files & Prior Sections. End cleanly with full punctuation. Output ONLY the section prose.`;

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
    taskDirective = `Strengthen unsupported claims in this text ONLY with verified ${session.citationStyle} in-text citations drawn strictly from the verified source list or attached context files. NEVER invent or guess new authors or years.`;
  } else if (action === 'rubric_check') {
    taskDirective =
      'Critically upgrade this text so that it directly satisfies every single criterion in the Grading Rubric at a High Distinction (HD) level without inventing unverified citations.';
  }

  const verifiedWhitelistBlock = buildVerifiedCitationWhitelistBlock(session);
  const citationGrammarRule = getCitationStyleGrammarRule(session.citationStyle);

  const userPrompt = `Section: "${sectionTitle}"
Task: ${taskDirective}
${customInstruction.trim() ? `Additional User Instruction: ${customInstruction.trim()}\n` : ''}
Citation Style: ${session.citationStyle} (${citationGrammarRule})
Language: ${session.writingLanguage}
${verifiedWhitelistBlock}
STRICT CITATION & INTEGRITY RULES:
- ONLY use citations from the verified whitelist above, the attached context files, or citations already present in the original text. NEVER fabricate new authors, years, DOIs, or statistics.
- Keep sub-headings accurately aligned with their paragraphs and ensure the text ends cleanly without truncation.

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
  signal?: AbortSignal,
  auditFixMode?: boolean
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

  const actionGoal = auditFixMode
    ? `You are fixing defects flagged by the academic QA examiner. FIXING EVERY LISTED DEFECT TAKES PRIORITY over preserving the draft wording: you MAY rename sub-headings, split content into correctly titled sub-sections (e.g. add the missing "x.2"), move paragraphs, and rewrite passages so every sub-heading accurately describes its body. Keep all correct arguments, facts and ${session.citationStyle} citations (do not invent new authors). Keep approximately ${targetSection.targetWords} words.`
    : action === 'expand'
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
  /** Exact offending sentence/excerpt inside the section for inline red highlight & exact scroll */
  matchSnippet?: string;
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

    // Check for leaked AI refusal / meta-disclaimer messages (e.g., "No verified bibliographic data...", "(no verified journal or DOI available...)")
    const leakedAiLines = trimmed
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .filter(
        (line) =>
          isAiRefusalOrDisclaimerLine(line) ||
          /[([]\s*(?:no verified|doi unavailable|no doi|unverified|missing (?:journal|doi|publisher))[^)\]]*[)\]]/i.test(
            line
          )
      );
    if (leakedAiLines.length > 0) {
      pushIssue({
        severity: 'critical',
        category: sec.id === refSection?.id ? 'doi_and_sources' : 'completeness',
        title: `Phát hiện ${leakedAiLines.length} câu thông báo lỗi/ghi chú của AI lọt vào mục "${sec.title}"`,
        detail: `Ví dụ: "${leakedAiLines[0].trim().slice(0, 120)}..." — cần xóa sạch và chỉ giữ nội dung học thuật chuẩn.`,
        sectionId: sec.id,
        sectionTitle: sec.title,
        autoFixable: true,
        matchSnippet: leakedAiLines[0].trim(),
        fixHint:
          'Xóa toàn bộ câu thông báo lỗi/ghi chú ngoặc đơn của AI; bỏ qua âm thầm các yếu tố không bắt buộc (DOI/URL/Issue/Trang) nếu nguồn không có.',
      });
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

    // Check for article titles mistakenly placed inside parenthetical citations instead of author surnames
    // e.g., (Teacher challenges and adaptive pedagogical responses, 2026) or (Beyond single exposure, 2026)
    if (sec.id !== refSection?.id) {
      const titleAsAuthorMatches: string[] = [];
      const parenCiteRx = /\(([A-ZÀ-Ỹ][^()]{12,120}),\s*(?:19|20)\d{2}[a-z]?\)/g;
      let tm: RegExpExecArray | null;
      while ((tm = parenCiteRx.exec(trimmed)) !== null) {
        const leftPart = tm[1].trim();
        if (/\b(?:as\s+)?cited\s+in\b/i.test(leftPart) || leftPart.includes(';')) {
          continue;
        }
        const words = leftPart.split(/\s+/).filter(Boolean);
        const lowercaseNonParticleWords = words.filter(
          (w) =>
            /^[a-zà-ỹ]{3,}$/.test(w.replace(/[^a-zà-ỹ]/g, '')) &&
            !/^(?:and|et|al|van|von|der|den|del|de|da|la|le|di|du|el|bin|binti|và|của)$/i.test(
              w.replace(/[^a-zà-ỹ]/gi, '')
            )
        );
        // An author surname list never has 2+ lowercase common words (whereas an article title in sentence case does)
        if (words.length >= 3 && lowercaseNonParticleWords.length >= 2) {
          titleAsAuthorMatches.push(tm[0]);
        }
      }
      if (titleAsAuthorMatches.length > 0) {
        pushIssue({
          severity: 'critical',
          category: 'citation_sync',
          title: `Trích dẫn sai chuẩn: lấy Tên bài báo thay cho Họ tác giả (${titleAsAuthorMatches.length} chỗ) trong "${sec.title}"`,
          detail: `Các cụm sai chuẩn: ${titleAsAuthorMatches
            .slice(0, 4)
            .join('; ')} — chuẩn ${session.citationStyle} bắt buộc ghi (Họ tác giả, Năm), tuyệt đối không chép tên bài báo vào ngoặc đơn.`,
          sectionId: sec.id,
          sectionTitle: sec.title,
          autoFixable: true,
          matchSnippet: titleAsAuthorMatches[0],
          fixHint:
            'Thay các trích dẫn bằng tiêu đề bài báo sang trích dẫn chuẩn (Họ tác giả, Năm) từ kho nguồn đã xác minh, hoặc bỏ trích dẫn nếu nguồn không có tên tác giả.',
        });
      }
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
        matchSnippet: lastLine.slice(-110),
        fixHint: 'Hoàn thiện trọn vẹn câu/đoạn cuối bị cắt cụt, không để dang dở.',
      });
    }
  }

  // 2. Check orphan sub-heading numbering (e.g., 4.1 without 4.2)
  const subByParent = new Map<string, string[]>();
  const subOwnerSection = new Map<string, WriterOutlineSection>();
  for (const sec of bodySections) {
    const candidates = [
      sec.title.trim(),
      ...(sec.content || '')
        .split(/\r?\n/)
        .map((l) => l.replace(/^[ \t]*#{1,6}[ \t]*/, '').trim())
        .filter((l) => l.length > 3 && l.length < 140 && /^\d+\.\d+\s+[A-Za-zÀ-ỹ]/.test(l)),
    ];
    for (const heading of candidates) {
      const m = heading.match(/^(\d+)\.(\d+)\b/);
      if (!m) continue;
      const parent = m[1];
      const list = subByParent.get(parent) || [];
      if (!list.includes(heading)) list.push(heading);
      subByParent.set(parent, list);
      subOwnerSection.set(heading, sec);
    }
  }
  for (const [parentNum, subs] of subByParent.entries()) {
    if (subs.length === 1 && /^(\d+)\.1\b/.test(subs[0])) {
      const targetSec = subOwnerSection.get(subs[0]);
      pushIssue({
        severity: 'warning',
        category: 'structure_and_content',
        title: `Đánh số tiểu mục lẻ: có ${subs[0]} nhưng thiếu mục ${parentNum}.2`,
        detail:
          'Trong học thuật, khi đã chia tiểu mục (ví dụ 4.1) thì nên có ít nhất tiểu mục 4.2 hoặc gộp thẳng vào mục chính.',
        sectionId: targetSec?.id,
        sectionTitle: targetSec?.title,
        autoFixable: Boolean(targetSec),
        matchSnippet: subs[0],
        fixHint: `Kiểm tra tiêu đề "${subs[0]}" có khớp nội dung bên dưới không; tách phần còn lại thành tiểu mục ${parentNum}.2 với tiêu đề đúng nội dung (ví dụ phân biệt Personal vs Social facilitators).`,
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
          matchSnippet: entry.slice(0, 140),
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
            matchSnippet: entry.slice(0, 140),
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
          matchSnippet: matchedEntries[0]?.slice(0, 140) || lowerDoi,
          fixHint: `Loại bỏ DOI bị trùng ${lowerDoi} khỏi các tác giả không khớp và xây dựng lại danh mục References chuẩn.`,
        });
      }
    }

    // 3a-2. Same article title reused for different authors / assignment topic pasted as a title / stub entries
    const topicKeyAudit = normTitleKey(session.topic || session.title || '');
    const titleToEntries = new Map<string, string[]>();
    for (const entry of refEntries) {
      const t = normTitleKey(extractReferenceTitle(entry));
      if (t.length < 15) continue;
      const list = titleToEntries.get(t) || [];
      list.push(entry);
      titleToEntries.set(t, list);
    }
    for (const [, list] of titleToEntries.entries()) {
      if (list.length > 1) {
        pushIssue({
          severity: 'critical',
          category: 'doi_and_sources',
          title: `Cùng 1 tên bài báo bị gán cho ${list.length} tác giả khác nhau`,
          detail: `Tên bài "${extractReferenceTitle(list[0]).slice(0, 90)}" xuất hiện ở: ${list
            .map((e) => e.split('(')[0].trim())
            .slice(0, 6)
            .join('; ')}.`,
          sectionId: refSection.id,
          sectionTitle: refSection.title,
          autoFixable: true,
          matchSnippet: list[0]?.slice(0, 140),
          fixHint: 'Dựng lại từng nguồn từ metadata thật trên Crossref (tên bài, tạp chí, số trang, DOI).',
        });
      }
    }
    const topicPasted = refEntries.filter((e) => {
      const t = normTitleKey(extractReferenceTitle(e));
      return (
        t.length >= 15 &&
        topicKeyAudit.length >= 15 &&
        (t.startsWith(topicKeyAudit.slice(0, 40)) || topicKeyAudit.startsWith(t.slice(0, 40)))
      );
    });
    if (topicPasted.length > 0) {
      pushIssue({
        severity: 'critical',
        category: 'doi_and_sources',
        title: `${topicPasted.length} nguồn bị lấy nguyên tên đề tài bài làm làm tên bài báo`,
        detail: `Các nguồn: ${topicPasted.map((e) => e.split('(')[0].trim()).slice(0, 6).join('; ')}.`,
        sectionId: refSection.id,
        sectionTitle: refSection.title,
        autoFixable: true,
        matchSnippet: topicPasted[0]?.slice(0, 140),
        fixHint: 'Thay bằng tên bài thật của từng tác giả lấy từ Crossref.',
      });
    }
    const stubEntries = refEntries.filter((e) => {
      const afterYear = e.split(/\((?:19|20)\d{2}[a-z]?\)\.?/)[1];
      return afterYear !== undefined && afterYear.replace(/[^A-Za-zÀ-ỹ]/g, '').length < 12;
    });
    if (stubEntries.length > 0) {
      pushIssue({
        severity: 'critical',
        category: 'doi_and_sources',
        title: `${stubEntries.length} nguồn cụt lủn (chỉ có tác giả + năm, thiếu tên bài/tạp chí)`,
        detail: `Ví dụ: ${stubEntries.slice(0, 4).join(' | ')}`,
        sectionId: refSection.id,
        sectionTitle: refSection.title,
        autoFixable: true,
        matchSnippet: stubEntries[0]?.slice(0, 140),
        fixHint: 'Bổ sung đầy đủ tên bài, tạp chí, tập/số, trang từ metadata Crossref.',
      });
    }
    // Variant duplicates: same first surname listed multiple times with different initials/years
    const surnameBuckets = new Map<string, string[]>();
    for (const e of refEntries) {
      const sur = normName(e.split(/[,(]/)[0] || '');
      if (sur.length < 3) continue;
      const list = surnameBuckets.get(sur) || [];
      list.push(e);
      surnameBuckets.set(sur, list);
    }
    for (const [, list] of surnameBuckets.entries()) {
      if (list.length < 2) continue;
      const titles = new Set(list.map((e) => normTitleKey(extractReferenceTitle(e))));
      const authorsHeads = new Set(list.map((e) => e.split('(')[0].replace(/\s+/g, '')));
      if (titles.size < list.length || authorsHeads.size > 1) {
        pushIssue({
          severity: 'warning',
          category: 'doi_and_sources',
          title: `Một tác giả bị tách thành ${list.length} nguồn biến thể khác nhau`,
          detail: list.map((e) => e.slice(0, 70)).join(' | '),
          sectionId: refSection.id,
          sectionTitle: refSection.title,
          autoFixable: true,
          matchSnippet: list[0]?.slice(0, 140),
          fixHint: 'Gộp về đúng 1 nguồn thật, khớp 1-1 với trích dẫn trong bài.',
        });
      }
    }

    // 3a-3. Thesis type contradiction between body and References (doctoral vs master's)
    const bodyAll = bodySections.map((s) => s.content || '').join('\n');
    const bodySaysDoctoral = /\b(doctoral (thesis|dissertation)|ph\.?d\.? (thesis|dissertation)|luận án tiến sĩ)\b/i.test(bodyAll);
    const bodySaysMaster = /\b(master'?s (thesis|dissertation)|ma thesis|luận văn thạc sĩ)\b/i.test(bodyAll);
    const refSaysDoctoral = /\b(doctoral|ph\.?d\.?)\b[^.]{0,30}\b(thesis|dissertation)\b/i.test(refSection.content);
    const refSaysMaster = /\b(master'?s?|ma)\b[^.]{0,30}\b(thesis|dissertation)\b/i.test(refSection.content);
    if ((bodySaysDoctoral && refSaysMaster && !bodySaysMaster) || (bodySaysMaster && refSaysDoctoral && !bodySaysDoctoral)) {
      pushIssue({
        severity: 'critical',
        category: 'structure_and_content',
        title: 'Mâu thuẫn loại luận văn giữa nội dung bài và References',
        detail: bodySaysDoctoral
          ? 'Thân bài gọi nghiên cứu là luận án Tiến sĩ (doctoral thesis) nhưng References lại ghi Master\'s thesis.'
          : 'Thân bài gọi nghiên cứu là luận văn Thạc sĩ nhưng References lại ghi Doctoral/PhD thesis.',
        sectionId: refSection.id,
        sectionTitle: refSection.title,
        autoFixable: true,
        fixHint: 'Đối chiếu tài liệu gốc trong đề bài/tài liệu đính kèm rồi thống nhất cả thân bài và References.',
      });
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
              matchSnippet: entry.slice(0, 140),
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
                matchSnippet: entry.slice(0, 140),
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
    const typoMismatches: Array<{ cite: string; refAuthor: string; sectionId?: string }> = [];
    const levenshtein1 = (a: string, b: string): boolean => {
      if (Math.abs(a.length - b.length) > 1 || a.length < 4 || b.length < 4) return false;
      let diffs = 0;
      let i = 0;
      let j = 0;
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
          i++;
          j++;
        } else {
          diffs++;
          if (diffs > 1) return false;
          if (a.length > b.length) i++;
          else if (b.length > a.length) j++;
          else {
            i++;
            j++;
          }
        }
      }
      return diffs + (a.length - i) + (b.length - j) === 1;
    };

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
        // Check that first author appears near the start of the reference entry (within first 70 chars)
        return (
          normEntry.slice(0, 70).replace(/[^a-z0-9]/g, '').includes(normAuthor) &&
          normEntry.includes(year)
        );
      });

      if (!hasEntry) {
        // Check if it's a 1-char spelling typo against an existing Reference (e.g., Emyliani vs Emyliana)
        const nearEntry = refEntries.find((entry) => {
          if (!entry.includes(year)) return false;
          const refFirstSurname = normalizeSurnameToken(entry.split(/[,(\s]/)[0] || '');
          return levenshtein1(normAuthor, refFirstSurname);
        });
        if (nearEntry) {
          const refAuthorWord = nearEntry.split(/[,(\s]/)[0] || '';
          const owningSec = bodySections.find((s) =>
            (s.content || '').toLowerCase().includes(firstAuthor.toLowerCase())
          );
          typoMismatches.push({
            cite,
            refAuthor: refAuthorWord,
            sectionId: owningSec?.id,
          });
        } else if (!normalizedRefText.includes(`${normAuthor}`)) {
          missingCitations.push(cite);
        } else {
          missingCitations.push(cite);
        }
      }
    }

    for (const typo of typoMismatches) {
      const ownerSec = bodySections.find((s) => s.id === typo.sectionId);
      pushIssue({
        severity: 'critical',
        category: 'citation_sync',
        title: `Sai chính tả họ tác giả giữa thân bài và References: "${typo.cite}" vs "${typo.refAuthor}"`,
        detail: `Trong bài ghi "${typo.cite}" nhưng danh mục References ghi "${typo.refAuthor}". Cần đồng bộ chính xác từng chữ cái.`,
        sectionId: ownerSec?.id || refSection.id,
        sectionTitle: ownerSec?.title || refSection.title,
        autoFixable: true,
        matchSnippet: typo.cite.replace(/^\(|\)$/g, ''),
        fixHint: `Đổi chính tả họ tác giả trong bài cho khớp chính xác với "${typo.refAuthor}" trong References.`,
      });
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
      const lines = text.split(/\r?\n/);
      const subHeadingDigest: string[] = [];
      if (!isRef) {
        lines.forEach((line, li) => {
          const clean = line.replace(/^[ \t]*#{1,6}[ \t]*/, '').trim();
          if (/^\d+\.\d+(\.\d+)?\s+[A-Za-zÀ-ỹ]/.test(clean) && clean.length < 140) {
            const nextPara = lines
              .slice(li + 1)
              .find((l) => l.trim().length > 40)
              ?.trim()
              .slice(0, 320);
            subHeadingDigest.push(`  >> SUB-HEADING "${clean}" → body starts: "${nextPara || '[EMPTY]'}"`);
          }
        });
      }
      return `--- SECTION ${idx + 1} (id: ${sec.id}) | TITLE: "${sec.title}" | WORDS: ${words}/${sec.targetWords} ---\n${preview || '[EMPTY]'}${
        subHeadingDigest.length > 0 ? `\n${subHeadingDigest.join('\n')}` : ''
      }`;
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
1. Heading vs. Content Mismatch (e.g., heading says "Personal Facilitators" while body discusses "Social Facilitators"). Check EVERY ">> SUB-HEADING" line against its "body starts" text.
5. Inconsistent page ranges/volume numbers for the same cited work across the paper.
6. Homonym Author / Wrong Work Mismatch (CRITICAL): Compare EVERY Reference entry's title and journal against the actual claim/field where that author is cited in the body. Flag any case where the Reference points to a different author with the same surname or a different work by the same author whose topic does NOT match the body's claim (e.g., body cites a methodology textbook or qualitative sampling while Reference lists an unrelated medical/psychology article; or body cites contextual language exposure while Reference lists a vocabulary-size measurement study). Set severity: "critical", autoFixable: true, and copy the exact Reference entry into "excerpt".
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
      "excerpt": "exact verbatim 6-15 word phrase copied from the offending sentence/sub-heading in that section so the UI can highlight & scroll to it",
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
          excerpt?: string;
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
            matchSnippet: (item.excerpt || '').trim() || undefined,
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
    .map((e) =>
      stripInlineAiMetaNotes(
        e.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()
      )
    )
    .filter((e) => Boolean(e) && !isAiRefusalOrDisclaimerLine(e));

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
Generate ONLY clean, publication-ready ${session.citationStyle} reference entries for the exact missing in-text citations listed below.
CRITICAL RULES:
- PRESERVE THE EXACT FIRST AUTHOR SURNAME AND YEAR from each listed citation (e.g., if listed "Eren and Rakıcıoğlu-Söylemez (2023)", entry MUST start with "Eren, ... (2023)").
- OPTIONAL FIELDS (DOI, URL, issue, page range, access date, city): If unavailable, OMIT THEM SILENTLY. DO NOT INVENT OR GUESS ANY DOI/URL.
- ZERO META-COMMENTARY OR ERROR MESSAGES: NEVER output sentences like "No verified bibliographic data...", "To avoid fabricating...", or parenthetical notes like "(no verified journal or DOI available...)".
- Output ONLY the clean reference entries (one complete entry per paragraph, separated by a blank line). No markdown '#', no numbering, no intro/outro.`;

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
        stripInlineAiMetaNotes(
          stripMarkdownHashesFromText(blk)
            .replace(/\r?\n+/g, ' ')
            .replace(/^\d+[.)]\s+/, '')
            .replace(/\s{2,}/g, ' ')
            .trim()
        )
      )
      .filter((blk) => blk.length >= 20 && !isAiRefusalOrDisclaimerLine(blk));

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

/**
 * Resolves a doctoral-vs-master's thesis contradiction using ONLY evidence from the brief,
 * uploaded context files and researched sources. Returns 'unknown' if no evidence exists
 * (we never guess facts), so the issue stays flagged for manual verification.
 */
export async function resolveThesisTypeFromEvidence(
  session: WriterSession,
  profile: AiProviderProfile,
  signal?: AbortSignal
): Promise<{ type: 'doctoral' | 'master' | 'unknown'; evidence: string }> {
  const evidenceText = [
    session.instructions || '',
    session.rubricNotes || '',
    ...(session.contextFiles || []).map((f) => `[${f.name}]\n${(f.content || '').slice(0, 6000)}`),
    session.researchedSources || '',
  ]
    .join('\n\n')
    .slice(0, 14000);

  // Deterministic first: explicit wording in the evidence
  const docHits = (evidenceText.match(/\b(doctoral (thesis|dissertation)|ph\.?\s?d\.? (thesis|dissertation)|doctor of philosophy|luận án tiến sĩ)\b/gi) || []).length;
  const maHits = (evidenceText.match(/\b(master'?s (thesis|dissertation)|ma thesis|master of arts|luận văn thạc sĩ)\b/gi) || []).length;
  if (docHits > 0 && maHits === 0) return { type: 'doctoral', evidence: 'Tài liệu đề bài/đính kèm ghi rõ là luận án Tiến sĩ.' };
  if (maHits > 0 && docHits === 0) return { type: 'master', evidence: 'Tài liệu đề bài/đính kèm ghi rõ là luận văn Thạc sĩ.' };
  if (!evidenceText.trim()) return { type: 'unknown', evidence: 'Không có tài liệu gốc để đối chiếu.' };

  try {
    const raw = await callAiChatbot({
      profile,
      systemPrompt:
        'You are a fact checker. Answer ONLY from the provided evidence. Reply with exactly one token: DOCTORAL, MASTER, or UNKNOWN.',
      userPrompt: `Is the main analyzed study in this assignment a doctoral (PhD) thesis or a master's thesis?\n\nEVIDENCE:\n${evidenceText}`,
      enableWebSearch: false,
      maxOutputTokens: 20,
      reasoningEffort: 'low',
      signal,
    });
    const ans = raw.trim().toUpperCase();
    if (ans.startsWith('DOCTORAL')) return { type: 'doctoral', evidence: 'AI xác nhận từ tài liệu gốc: luận án Tiến sĩ.' };
    if (ans.startsWith('MASTER')) return { type: 'master', evidence: 'AI xác nhận từ tài liệu gốc: luận văn Thạc sĩ.' };
  } catch (err) {
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') throw err;
  }
  return { type: 'unknown', evidence: 'Tài liệu gốc không nêu rõ loại luận văn.' };
}

/** Deterministically aligns thesis-type wording in a text block to the resolved type. */
export function alignThesisTypeWording(text: string, type: 'doctoral' | 'master'): string {
  if (type === 'doctoral') {
    return text
      .replace(/\b[Uu]npublished [Mm]aster'?s (thesis|dissertation)\b/g, 'Unpublished doctoral $1')
      .replace(/\b[Mm]aster'?s (thesis|dissertation)\b/g, (m, w) => (m[0] === 'M' ? `Doctoral ${w}` : `doctoral ${w}`))
      .replace(/\bMA thesis\b/g, 'PhD thesis')
      .replace(/luận văn thạc sĩ/gi, 'luận án tiến sĩ');
  }
  return text
    .replace(/\b[Dd]octoral (thesis|dissertation)\b/g, (m, w) => (m[0] === 'D' ? `Master's ${w}` : `master's ${w}`))
    .replace(/\bPh\.?\s?D\.? (thesis|dissertation)\b/g, "Master's $1")
    .replace(/luận án tiến sĩ/gi, 'luận văn thạc sĩ');
}
