import { CitationStyle } from '../../../types/domain';

export type AiProviderType = 'gemini' | 'openai' | 'anthropic' | 'custom_openai';

export interface AiProviderProfile {
  provider: AiProviderType;
  label: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
}

export interface AiChatbotSettingsStore {
  activeProvider: AiProviderType;
  profiles: Record<AiProviderType, AiProviderProfile>;
}

export interface SkillDocument {
  id: string;
  name: string;
  fileName: string;
  description: string;
  content: string;
  enabled: boolean;
  isBuiltIn?: boolean;
  updatedAt: string;
}

export type AcademicPresetKey = 'APA7' | 'MLA9' | 'HARVARD' | 'IEEE' | 'CUSTOM';

export type FontFamilyOption =
  | 'Times New Roman'
  | 'Arial'
  | 'Calibri'
  | 'Georgia'
  | 'Cambria';

export type TextAlignmentOption = 'left' | 'center' | 'right' | 'justify';

export type LineSpacingOption = 1.0 | 1.15 | 1.5 | 2.0;

export type MarginPresetInch = 1.0 | 0.5 | 1.25;

export interface DocumentFormatConfig {
  preset: AcademicPresetKey;
  fontFamily: FontFamilyOption;
  fontSizePt: number;
  lineSpacing: LineSpacingOption;
  textAlign: TextAlignmentOption;
  marginInch: MarginPresetInch;
  firstLineIndent: boolean;
  paragraphSpacingAfterPt: number;
  runningHeader: string;
  includePageNumbers: boolean;
}

export type SectionHeadingLevel = 'h1' | 'h2' | 'h3';

export type OutlineSectionStatus = 'idle' | 'generating' | 'completed' | 'error';

export interface WriterOutlineSection {
  id: string;
  order: number;
  title: string;
  headingLevel: SectionHeadingLevel;
  targetWords: number;
  guidanceNotes: string;
  content: string;
  status: OutlineSectionStatus;
  errorMsg?: string;
}

export interface SessionContextFile {
  id: string;
  name: string;
  content: string;
  wordCount: number;
  uploadedAt: string;
}

export interface WriterSession {
  id: string;
  title: string;
  linkedOrderCode: string;
  subject: string;
  topic: string;
  targetWordCount: number;
  citationStyle: CitationStyle;
  writingLanguage: 'English' | 'Vietnamese' | 'Bilingual';
  academicTone: string;
  instructions: string;
  rubricNotes: string;
  format: DocumentFormatConfig;
  outline: WriterOutlineSection[];
  contextFiles: SessionContextFile[];
  activeSectionId: string;
  viewMode: 'sections' | 'full_paper';
  fullPaperOverride?: string;
  historyStack: string[];
  historyIndex: number;
  updatedAt: string;
}

export const AI_PROVIDER_SUGGESTED_MODELS: Record<AiProviderType, string[]> = {
  gemini: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash-latest',
  ],
  openai: [
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
    'o3',
    'o4-mini',
    'o3-mini',
    'o1',
  ],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-7-sonnet-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
  ],
  custom_openai: [
    'deepseek-chat',
    'deepseek-reasoner',
    'llama-3.3-70b-versatile',
    'qwen/qwen-2.5-72b-instruct',
    'anthropic/claude-3.7-sonnet',
    'google/gemini-2.5-pro',
    'openai/gpt-4.1',
  ],
};

export const DEFAULT_AI_SETTINGS: AiChatbotSettingsStore = {
  activeProvider: 'gemini',
  profiles: {
    gemini: {
      provider: 'gemini',
      label: 'Google Gemini API',
      apiKey: '',
      model: 'gemini-2.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      temperature: 0.4,
    },
    openai: {
      provider: 'openai',
      label: 'OpenAI (ChatGPT)',
      apiKey: '',
      model: 'gpt-4.1',
      baseUrl: 'https://api.openai.com/v1',
      temperature: 0.4,
    },
    anthropic: {
      provider: 'anthropic',
      label: 'Anthropic Claude',
      apiKey: '',
      model: 'claude-3-7-sonnet-latest',
      baseUrl: 'https://api.anthropic.com/v1',
      temperature: 0.4,
    },
    custom_openai: {
      provider: 'custom_openai',
      label: 'Custom OpenAI-Compatible (OpenRouter / DeepSeek / Groq)',
      apiKey: '',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com/v1',
      temperature: 0.4,
    },
  },
};

export const ACADEMIC_FORMAT_PRESETS: Record<
  Exclude<AcademicPresetKey, 'CUSTOM'>,
  { label: string; description: string; config: Omit<DocumentFormatConfig, 'runningHeader'> }
> = {
  APA7: {
    label: 'APA 7th Edition',
    description: 'Times New Roman 12pt, giãn dòng 2.0 (Double), lề 1 inch, thụt đầu dòng 0.5"',
    config: {
      preset: 'APA7',
      fontFamily: 'Times New Roman',
      fontSizePt: 12,
      lineSpacing: 2.0,
      textAlign: 'left',
      marginInch: 1.0,
      firstLineIndent: true,
      paragraphSpacingAfterPt: 0,
      includePageNumbers: true,
    },
  },
  MLA9: {
    label: 'MLA 9th Edition',
    description: 'Times New Roman 12pt, giãn dòng 2.0, căn trái, lề 1 inch, thụt đầu dòng 0.5"',
    config: {
      preset: 'MLA9',
      fontFamily: 'Times New Roman',
      fontSizePt: 12,
      lineSpacing: 2.0,
      textAlign: 'left',
      marginInch: 1.0,
      firstLineIndent: true,
      paragraphSpacingAfterPt: 0,
      includePageNumbers: true,
    },
  },
  HARVARD: {
    label: 'Harvard Academic',
    description: 'Arial 12pt, giãn dòng 1.5, căn đều 2 bên (Justify), lề 1 inch, cách đoạn 6pt',
    config: {
      preset: 'HARVARD',
      fontFamily: 'Arial',
      fontSizePt: 12,
      lineSpacing: 1.5,
      textAlign: 'justify',
      marginInch: 1.0,
      firstLineIndent: false,
      paragraphSpacingAfterPt: 6,
      includePageNumbers: true,
    },
  },
  IEEE: {
    label: 'IEEE Technical',
    description: 'Times New Roman 10pt, giãn dòng 1.0 (Single), căn đều 2 bên, lề 0.5 inch',
    config: {
      preset: 'IEEE',
      fontFamily: 'Times New Roman',
      fontSizePt: 10,
      lineSpacing: 1.0,
      textAlign: 'justify',
      marginInch: 0.5,
      firstLineIndent: true,
      paragraphSpacingAfterPt: 4,
      includePageNumbers: true,
    },
  },
};

export const DEFAULT_BUILTIN_SKILLS: SkillDocument[] = [
  {
    id: 'skill_academic_rigor',
    name: 'Academic Writing & Critical Analysis Skill',
    fileName: 'academic-critical-writing.skill.md',
    description:
      'Quy chuẩn viết học thuật chuyên sâu: lập luận đa chiều, cấu trúc đoạn MEAL/PEEL, dẫn chứng thực nghiệm và giọng văn khách quan.',
    enabled: true,
    isBuiltIn: true,
    updatedAt: new Date().toISOString(),
    content: `# Skill: Academic Writing & Critical Analysis
- Maintain a rigorous, objective third-person academic tone unless reflection is explicitly required by the brief.
- Structure analytical paragraphs using the PEEL/MEAL framework (Main Idea / Point, Evidence & Peer-Reviewed Citation, Critical Evaluation/Analysis, Link back to thesis and rubric).
- Avoid superficial bullet lists in prose sections unless requested; write cohesive, well-transitioned academic paragraphs.
- Synthesize multiple scholarly perspectives rather than describing sources one by one. Compare findings, highlight methodological limitations, and link directly to the assignment case or topic.
- Strictly adhere to the target word count of each section (+/- 5%).`,
  },
  {
    id: 'skill_citation_mastery',
    name: 'In-Text Citation & Reference Precision Skill',
    fileName: 'citation-reference-rules.skill.md',
    description:
      'Đảm bảo trích dẫn trong bài (in-text citations) khớp 100% với danh mục Tài liệu tham khảo cuối bài theo đúng chuẩn APA/Harvard/MLA/IEEE.',
    enabled: true,
    isBuiltIn: true,
    updatedAt: new Date().toISOString(),
    content: `# Skill: Citation & Reference Integrity
- Every factual claim, theoretical framework, or empirical statistic must include an authentic scholarly in-text citation matching the requested Citation Style (e.g., (Author, Year) for APA/Harvard; [1] for IEEE).
- Prefer peer-reviewed journal articles, university press books, and authoritative institutional reports published within the last 5-10 years alongside seminal foundational works.
- In the final References / Bibliography section, compile and alphabetically sort (or number for IEEE) every single source cited across all earlier sections with complete bibliographic details (Author, Year, Title, Journal/Publisher, Volume(Issue), Pages, DOI).`,
  },
  {
    id: 'skill_rubric_maximizer',
    name: 'Rubric High-Distinction Alignment Skill',
    fileName: 'rubric-hd-alignment.skill.md',
    description:
      'Đối chiếu từng tiêu chí trong Rubric chấm điểm để tối đa hóa điểm số ở mức High Distinction (HD / 85%+).',
    enabled: true,
    isBuiltIn: true,
    updatedAt: new Date().toISOString(),
    content: `# Skill: Rubric High-Distinction Alignment
- Before drafting each section, map the section's arguments directly to the grading rubric criteria and weighting.
- Address all command verbs in the prompt (e.g., "Critically evaluate", "Compare and contrast", "Propose evidence-based recommendations").
- Ensure terminology and sub-headings clearly signal to the grader where each rubric criterion is being fulfilled.`,
  },
];
