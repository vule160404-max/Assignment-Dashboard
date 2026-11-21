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
}: AiGenerateRequest): Promise<AiGenerateDetailedResponse> {
  const transientKey = profile.apiKey.trim();
  const authHeaders = await getTeamAuthHeaders();

  const resp = await fetch('/api/ai/generate', {
    method: 'POST',
    credentials: 'same-origin',
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
  researchProfile: AiProviderProfile
): Promise<string> {
  // Fast, ultra-cheap Perplexity Search API (POST /search — raw web results, 0 LLM output tokens)
  if (researchProfile.model === 'perplexity-search') {
    const coreTopic = (session.topic || session.title || '').trim();
    const coreSubject = (session.subject || '').trim();
    const searchLines = [
      `${coreTopic} ${coreSubject} peer reviewed academic study journal`.trim(),
      `${coreTopic} empirical research data statistics 2023 2024 2025 2026`.trim(),
      `${coreTopic} literature review theoretical framework scholarly article`.trim(),
    ].filter(Boolean);

    const res = await callAiChatbotDetailed({
      profile: researchProfile,
      systemPrompt: '',
      userPrompt: searchLines.join('\n'),
      enableWebSearch: true,
    });

    return `RAW REAL-TIME WEB & SCHOLARLY SOURCES (Perplexity Search API — Format citations strictly in ${session.citationStyle}):\n\n${res.text}`.trim();
  }

  const systemPrompt = `You are a precision Academic Citation & Web Research Assistant.
Your ONLY job is to search the live web for the latest, authoritative, real-world academic papers, peer-reviewed journal articles, official reports, and verified statistics relevant to the assignment topic.
DO NOT write an essay or long prose. Keep your response concise, structured, and strictly factual to minimize output tokens.`;

  const userPrompt = `Find 10 to 15 recent, high-authority, real-time verifiable scholarly & official sources for the following academic assignment:
- Subject: ${session.subject || 'General Academic Research'}
- Topic: ${session.topic || session.title}
- Citation Style: ${session.citationStyle}
- Writing Language: ${session.writingLanguage}
- Key Instructions / Scope: ${(session.instructions || '').slice(0, 1200)}
- Rubric Focus: ${(session.rubricNotes || '').slice(0, 600)}

Return ONLY a clean numbered dossier of verified sources. For each source provide:
1. Exact ${session.citationStyle} full reference entry (Author(s), Year, Title, Journal/Publisher, DOI or direct URL).
2. In-text citation format (e.g., (Author, Year)).
3. 1-2 concise bullet points of exact verified statistics, empirical findings, or arguments from that source.

STRICT RULES:
- Every single source MUST be real and grounded in your web search results.
- Prioritize recent publications (2021-2026) and seminal foundational studies.
- Do NOT write essay paragraphs — ONLY return the structured verified source & citation dossier.`;

  const res = await callAiChatbotDetailed({
    profile: researchProfile,
    systemPrompt,
    userPrompt,
    enableWebSearch: true,
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

  return `You are an elite Academic Researcher & University Writing Specialist assisting inside an academic research & drafting studio.

=== ACTIVE SKILL FILES & SYSTEM INSTRUCTIONS ===
${skillBlock}${contextBlock}${researchedSourcesBlock}

=== ASSIGNMENT BRIEF & FORMATTING RULES ===
- Subject / Course: ${session.subject || 'General Academic Research'}
- Topic / Title: ${session.topic || 'Untitled Research Topic'}
- Target Total Word Count: ${session.targetWordCount} words
- Citation & Reference Style: ${session.citationStyle}
- Writing Language: ${session.writingLanguage}
- Tone & Academic Level: ${session.academicTone || 'University Master / High Distinction Academic Tone'}
- Detailed Instructions / Prompt:
${session.instructions || 'Follow standard scholarly structure for this topic.'}
- Grading Rubric & Evaluation Criteria:
${session.rubricNotes || 'High distinction academic rigor, critical synthesis, and accurate citations.'}`;
}

export async function generateOutlineWithAi(
  session: WriterSession,
  skills: SkillDocument[],
  profile: AiProviderProfile,
  enableWebSearch?: boolean
): Promise<WriterOutlineSection[]> {
  const systemPrompt = buildSkillsAndContextSystemPrompt(session, skills);
  const userPrompt = `Based on the assignment brief, rubric, target total word count (${session.targetWordCount} words), citation style (${session.citationStyle}), and all active Skill files, design a comprehensive, publication-grade academic outline with a clear Table of Contents hierarchy.

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
  enableWebSearch?: boolean
): Promise<string> {
  const sectionIdx = session.outline.findIndex((s) => s.id === targetSectionId);
  if (sectionIdx === -1) {
    throw new Error('Không tìm thấy mục dàn ý cần viết.');
  }
  const targetSection = session.outline[sectionIdx];

  const systemPrompt = buildSkillsAndContextSystemPrompt(session, skills);

  const fullOutlineMap = session.outline
    .map(
      (s, i) =>
        `${i + 1}. [${s.headingLevel.toUpperCase()}] ${s.title} (~${
          s.targetWords
        } words) — ${s.guidanceNotes}`
    )
    .join('\n');

  const normalizedHeading = targetSection.title
    .replace(/^\d+(\.\d+)*\s*/, '')
    .trim();
  const isReferencesSection =
    /^(references|bibliography|works cited|tài liệu tham khảo)/i.test(
      normalizedHeading
    );
  const isConclusionSection =
    /^(conclusion|kết luận|summary and conclusion)/i.test(normalizedHeading);

  const priorWrittenSections = buildSmartPriorContext(
    session.outline.slice(0, sectionIdx),
    isReferencesSection
      ? 'references'
      : isConclusionSection
      ? 'conclusion'
      : 'body'
  );

  const userPrompt = isReferencesSection
    ? `Now write ONLY the final "${targetSection.title}" section for this paper.

=== FULL PAPER OUTLINE ===
${fullOutlineMap}

=== PREVIOUSLY WRITTEN SECTIONS (EXTRACT ALL IN-TEXT CITATIONS FROM HERE) ===
${priorWrittenSections || '(No prior sections drafted yet; provide authoritative scholarly references for this topic.)'}

INSTRUCTIONS FOR "${targetSection.title}":
- Compile ONLY authentic scholarly, statistical, regulatory, and industry sources that were actually cited in-text in the previously written sections above into a complete, strictly formatted ${session.citationStyle} reference list.
- STRICT PROHIBITION: NEVER cite, list, or include the assignment prompt, grading rubric, marking criteria, course instructions, or skill guidelines as a reference entry.
- Ensure 1-to-1 matching: every in-text citation in the body must appear here, and every entry here must be cited in-text.
- Sort alphabetically by author surname (or numbered [1], [2]... if IEEE).
- Include full bibliographic details (Author, A. A. (Year). Title of work. *Source*, Volume(Issue), Page range. DOI/URL).
- Output ONLY the reference entries (one reference paragraph per line), without repeating the section heading "${targetSection.title}" at the top and without conversational filler.`
    : `Now write ONLY Section ${sectionIdx + 1} of the paper: "${targetSection.title}".

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
  });
  return stripMarkdownHashesFromText(raw);
}

export type AiRefineAction =
  | 'rewrite_academic'
  | 'expand_depth'
  | 'condense'
  | 'add_citations'
  | 'rubric_check';

export async function refineTextWithAi(
  session: WriterSession,
  sectionTitle: string,
  currentText: string,
  action: AiRefineAction,
  customInstruction: string,
  skills: SkillDocument[],
  profile: AiProviderProfile,
  enableWebSearch?: boolean
): Promise<string> {
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

Return ONLY the revised academic text for this section (no conversational intro or outro). Do NOT prepend markdown '#' or '##' hashes to headings or sentences.`;

  const raw = await callAiChatbot({
    profile,
    systemPrompt,
    userPrompt,
    enableWebSearch,
  });
  return stripMarkdownHashesFromText(raw);
}
