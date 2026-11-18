import {
  AiChatbotSettingsStore,
  AiProviderProfile,
  DEFAULT_AI_SETTINGS,
  DEFAULT_BUILTIN_SKILLS,
  SkillDocument,
  WriterOutlineSection,
  WriterSession,
} from '../components/admin/writer/types';

const AI_SETTINGS_STORAGE_KEY = 'assigntrack_ai_writer_settings_v1';
const SKILL_LIBRARY_STORAGE_KEY = 'assigntrack_ai_skill_library_v1';
const WRITER_SESSIONS_STORAGE_KEY = 'assigntrack_ai_writer_sessions_v1';

export function loadAiChatbotSettings(): AiChatbotSettingsStore {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AiChatbotSettingsStore>;
    return {
      activeProvider: parsed.activeProvider || DEFAULT_AI_SETTINGS.activeProvider,
      profiles: {
        perplexity: {
          ...DEFAULT_AI_SETTINGS.profiles.perplexity,
          ...(parsed.profiles?.perplexity || {}),
        },
        gemini: {
          ...DEFAULT_AI_SETTINGS.profiles.gemini,
          ...(parsed.profiles?.gemini || {}),
        },
        openai: {
          ...DEFAULT_AI_SETTINGS.profiles.openai,
          ...(parsed.profiles?.openai || {}),
        },
        anthropic: {
          ...DEFAULT_AI_SETTINGS.profiles.anthropic,
          ...(parsed.profiles?.anthropic || {}),
        },
        custom_openai: {
          ...DEFAULT_AI_SETTINGS.profiles.custom_openai,
          ...(parsed.profiles?.custom_openai || {}),
        },
      },
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiChatbotSettings(store: AiChatbotSettingsStore): void {
  try {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota errors
  }
}

export function loadGlobalSkillLibrary(): SkillDocument[] {
  try {
    const raw = localStorage.getItem(SKILL_LIBRARY_STORAGE_KEY);
    if (!raw) return DEFAULT_BUILTIN_SKILLS;
    const parsed = JSON.parse(raw) as SkillDocument[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_BUILTIN_SKILLS;
    }
    return parsed;
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

export function loadWriterSessions(): WriterSession[] {
  try {
    const raw = localStorage.getItem(WRITER_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WriterSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWriterSessions(sessions: WriterSession[]): void {
  try {
    localStorage.setItem(WRITER_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
}

export interface AiGenerateRequest {
  profile: AiProviderProfile;
  systemPrompt: string;
  userPrompt: string;
}

const GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
];

async function callGeminiDirectBrowser(
  profile: AiProviderProfile,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = profile.apiKey.trim();
  const cleanBase = (
    profile.baseUrl.trim() ||
    'https://generativelanguage.googleapis.com/v1beta'
  ).replace(/\/+$/, '');

  const requestedModel = (profile.model.trim() || 'gemini-2.5-flash').replace(
    /^models\//i,
    ''
  );
  const candidateModels = Array.from(
    new Set([requestedModel, ...GEMINI_FALLBACK_MODELS])
  );

  let lastError = '';

  for (const modelName of candidateModels) {
    const url = `${cleanBase}/models/${encodeURIComponent(
      modelName
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: profile.temperature,
      },
    };
    if (systemPrompt.trim()) {
      payload.systemInstruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await resp.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (resp.ok) {
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const firstCandidate = candidates[0] as
        | { content?: { parts?: { text?: string }[] } }
        | undefined;
      const text = (firstCandidate?.content?.parts || [])
        .map((p) => p.text || '')
        .join('')
        .trim();
      if (text) return text;
    }

    const errObj = data.error as
      | { message?: string; status?: string; code?: number }
      | undefined;
    const errMsg = errObj?.message || `HTTP ${resp.status}`;
    lastError = errMsg;

    // If model is not found (404), try the next fallback Gemini model
    if (resp.status === 404) {
      continue;
    }

    // If billing / quota / invalid key error (400, 403, 429), surface exact instructions
    if (resp.status === 403 || resp.status === 429 || /billing|quota|payment/i.test(errMsg)) {
      throw new Error(
        `Google Gemini từ chối Key (${errMsg}). Lưu ý: Nếu trên Google AI Studio dự án đang báo "Payment required", bạn hãy bấm "Create API key in a new project" trên AI Studio để tạo Key Free Tier mới.`
      );
    }

    throw new Error(`Google Gemini API lỗi: ${errMsg}`);
  }

  throw new Error(
    `Không tìm thấy Model Gemini phù hợp hoặc Project Google Cloud của Key này đang bị khóa ("Payment required"). Chi tiết từ Google: ${lastError}`
  );
}

async function callOpenAiCompatibleDirectFromBrowser(
  profile: AiProviderProfile,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = profile.apiKey.trim();
  const defaultBase =
    profile.provider === 'perplexity'
      ? 'https://api.perplexity.ai'
      : 'https://api.openai.com/v1';
  const cleanBase = (profile.baseUrl.trim() || defaultBase)
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '');
  const url =
    profile.provider === 'perplexity'
      ? `${cleanBase.replace(/\/v1$/i, '')}/chat/completions`
      : cleanBase.endsWith('/v1')
      ? `${cleanBase}/chat/completions`
      : `${cleanBase}/v1/chat/completions`;

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userPrompt });

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: profile.model.trim() || 'gpt-4.1',
      messages,
      temperature: profile.temperature,
    }),
  });

  const rawText = await resp.text().catch(() => '');
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    // non-json
  }

  if (!resp.ok) {
    const errObj = data.error as { message?: string } | undefined;
    const detail =
      errObj?.message ||
      (typeof data.detail === 'string' ? data.detail : '') ||
      (typeof data.title === 'string' ? data.title : '') ||
      rawText.trim().slice(0, 180);
    throw new Error(
      detail ||
        `API (${url}) trả về lỗi HTTP ${resp.status}.`
    );
  }

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const firstChoice = choices[0] as
    | { message?: { content?: string } }
    | undefined;
  const text = (firstChoice?.message?.content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();

  if (!text) {
    throw new Error('Chatbot phản hồi rỗng. Vui lòng kiểm tra lại Model.');
  }
  return text;
}

export async function callAiChatbot({
  profile,
  systemPrompt,
  userPrompt,
}: AiGenerateRequest): Promise<string> {
  const apiKey = profile.apiKey.trim();
  if (!apiKey) {
    throw new Error(
      `Chưa có API Key cho ${profile.label}. Hãy bấm nút "Cài đặt API" ở góc trên để nhập key.`
    );
  }

  // For Gemini, call Google's CORS-enabled endpoint directly first (with automatic model fallback)
  if (profile.provider === 'gemini') {
    return await callGeminiDirectBrowser(profile, systemPrompt, userPrompt);
  }

  try {
    const resp = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: profile.provider,
        apiKey,
        baseUrl: profile.baseUrl.trim(),
        model: profile.model.trim(),
        temperature: profile.temperature,
        systemPrompt,
        userPrompt,
      }),
    });

    const rawRespText = await resp.text().catch(() => '');
    let data: {
      text?: string;
      model?: string;
      error?: string;
    } = {};
    try {
      data = JSON.parse(rawRespText) as typeof data;
    } catch {
      // non-json response
    }

    if (resp.ok && data.text?.trim()) {
      return data.text.trim();
    }

    // If the web app is currently hosted on a static-only host where /api/ai/generate returns 404
    // (no JSON `data.error` from our Express route), try calling the OpenAI/Perplexity endpoint directly
    if (
      resp.status === 404 &&
      (!data.error || data.error === 'API endpoint not found.')
    ) {
      if (profile.provider !== 'anthropic') {
        try {
          return await callOpenAiCompatibleDirectFromBrowser(
            profile,
            systemPrompt,
            userPrompt
          );
        } catch (directErr) {
          if (
            directErr instanceof TypeError &&
            /integrate\.api\.nvidia\.com/i.test(profile.baseUrl)
          ) {
            throw new Error(
              'Máy chủ Web hiện tại chưa nạp route Backend (/api/ai/generate trả về 404) và NVIDIA NIM chặn gọi trực tiếp từ trình duyệt (CORS). Hãy đợi Vercel hoàn tất Build bản mới hoặc chạy lệnh `npm run dev` trên máy.'
            );
          }
          throw directErr;
        }
      }
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
  } catch (err) {
    if (
      err instanceof TypeError &&
      profile.provider !== 'anthropic'
    ) {
      return await callOpenAiCompatibleDirectFromBrowser(
        profile,
        systemPrompt,
        userPrompt
      );
    }
    throw err;
  }
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

  return `You are an elite Academic Researcher & University Writing Specialist assisting inside an academic research & drafting studio.

=== ACTIVE SKILL FILES & SYSTEM INSTRUCTIONS ===
${skillBlock}${contextBlock}

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
  profile: AiProviderProfile
): Promise<WriterOutlineSection[]> {
  const systemPrompt = buildSkillsAndContextSystemPrompt(session, skills);
  const userPrompt = `Based on the assignment brief, rubric, target total word count (${session.targetWordCount} words), citation style (${session.citationStyle}), and all active Skill files, design a comprehensive, logical step-by-step academic outline.

REQUIREMENTS:
1. Divide the paper into well-proportioned sections (e.g., Title/Abstract if needed, Introduction, thematic Body / Analysis / Literature / Methodology / Discussion sections tailored specifically to the topic & rubric, Conclusion, and a final References / Bibliography section).
2. The sum of "targetWords" across all prose sections should equal approximately ${session.targetWordCount} words (set targetWords for the References section to ~150-300).
3. Return ONLY a valid JSON array (no extra commentary) where each item has:
   - "title": string (exact academic heading, e.g. "1. Introduction", "2. Theoretical Framework & Literature Review", "References")
   - "headingLevel": "h1" | "h2" | "h3"
   - "targetWords": number
   - "guidanceNotes": string (detailed bullet points of arguments, key concepts, rubric criteria, and types of citations to cover in this section)

Example JSON schema:
[
  {
    "title": "1. Introduction",
    "headingLevel": "h1",
    "targetWords": 300,
    "guidanceNotes": "Define core problem, research background, thesis statement, and structure."
  }
]`;

  const rawText = await callAiChatbot({
    profile,
    systemPrompt,
    userPrompt,
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
          guidanceNotes: (item.guidanceNotes || '').trim(),
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

export async function generateSectionWithAi(
  session: WriterSession,
  targetSectionId: string,
  skills: SkillDocument[],
  profile: AiProviderProfile
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

  const priorWrittenSections = session.outline
    .slice(0, sectionIdx)
    .filter((s) => s.content.trim().length > 0)
    .map((s) => `### ${s.title}\n${s.content.trim()}`)
    .join('\n\n');

  const isReferencesSection =
    /^(references|bibliography|works cited|tài liệu tham khảo)/i.test(
      targetSection.title.replace(/^\d+(\.\d+)*\s*/, '').trim()
    );

  const userPrompt = isReferencesSection
    ? `Now write ONLY the final "${targetSection.title}" section for this paper.

=== FULL PAPER OUTLINE ===
${fullOutlineMap}

=== PREVIOUSLY WRITTEN SECTIONS (EXTRACT ALL IN-TEXT CITATIONS FROM HERE) ===
${priorWrittenSections || '(No prior sections drafted yet; provide authoritative scholarly references for this topic.)'}

INSTRUCTIONS FOR "${targetSection.title}":
- Compile EVERY single in-text citation used in the previously written sections above into a complete, strictly formatted ${session.citationStyle} reference list.
- Sort alphabetically by author surname (or numbered [1], [2]... if IEEE).
- Include full bibliographic details (Authors, Year, Article/Book Title, Journal/Publisher, Volume(Issue), Page range, and DOI/URL where applicable).
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
2. Write well-structured, cohesive academic paragraphs in ${session.writingLanguage} with authentic ${session.citationStyle} in-text citations.
3. Ensure smooth transition from the previous section and strictly fulfill the rubric and active Skill files.
4. Output ONLY the academic text for this section, with zero meta-commentary or markdown code fences.`;

  return callAiChatbot({
    profile,
    systemPrompt,
    userPrompt,
  });
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
  profile: AiProviderProfile
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

Return ONLY the revised academic text for this section (no conversational intro or outro).`;

  return callAiChatbot({
    profile,
    systemPrompt,
    userPrompt,
  });
}
