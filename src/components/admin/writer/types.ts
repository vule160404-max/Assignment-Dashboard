import { CitationStyle } from '../../../types/domain';

export type AiProviderType =
  | 'perplexity'
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'custom_openai';

export interface AiProviderProfile {
  provider: AiProviderType;
  label: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
}

export interface AiHybridPipelineConfig {
  enabled: boolean;
  /** Perplexity preset or Sonar model used ONLY to research up-to-date web sources & citations */
  researchModel: string;
  /** Provider used for writing the full essay */
  writerProvider: AiProviderType;
  /** Model used for writing the full essay (e.g. perplexity/glm-5.3-flash, perplexity/glm-5.3, z-ai/glm-5.3-flash) */
  writerModel: string;
}

export interface AiChatbotSettingsStore {
  activeProvider: AiProviderType;
  profiles: Record<AiProviderType, AiProviderProfile>;
  hybridPipeline?: AiHybridPipelineConfig;
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

export type CoverPageTemplateId =
  | 'classic_vn_thesis'
  | 'academic_international'
  | 'internship_report'
  | 'modern_executive';

export interface CoverPageFieldsVisibility {
  showUniversity: boolean;
  showFaculty: boolean;
  showDocumentType: boolean;
  showTopic: boolean;
  showSubject: boolean;
  showMajor: boolean;
  showStudentName: boolean;
  showStudentId: boolean;
  showClassName: boolean;
  showSupervisor: boolean;
  showInternshipUnit: boolean;
  showWordCount: boolean;
  showSubmissionDate: boolean;
}

export interface CoverPageConfig {
  enabled: boolean;
  templateId: CoverPageTemplateId;
  universityName: string;
  facultyName: string;
  documentTypeLabel: string;
  majorName: string;
  studentName: string;
  studentId: string;
  className: string;
  supervisorName: string;
  internshipUnit: string;
  locationAndDate: string;
  showBorder: boolean;
  fields: CoverPageFieldsVisibility;
}

export const DEFAULT_COVER_PAGE_CONFIG: CoverPageConfig = {
  enabled: false,
  templateId: 'classic_vn_thesis',
  universityName: 'TRƯỜNG ĐẠI HỌC KINH TẾ QUỐC DÂN',
  facultyName: 'KHOA QUẢN TRỊ KINH DOANH',
  documentTypeLabel: 'BÀI LUẬN / KHÓA LUẬN TỐT NGHIỆP',
  majorName: 'Quản trị Kinh doanh Quốc tế',
  studentName: '',
  studentId: '',
  className: '',
  supervisorName: '',
  internshipUnit: '',
  locationAndDate: `Hà Nội, ${new Date().getFullYear()}`,
  showBorder: true,
  fields: {
    showUniversity: true,
    showFaculty: true,
    showDocumentType: true,
    showTopic: true,
    showSubject: true,
    showMajor: true,
    showStudentName: true,
    showStudentId: true,
    showClassName: false,
    showSupervisor: true,
    showInternshipUnit: false,
    showWordCount: false,
    showSubmissionDate: true,
  },
};

export interface CoverPageTemplateMeta {
  id: CoverPageTemplateId;
  name: string;
  subtitle: string;
  badge: string;
  recommendedDocType: string;
  defaultBorder: boolean;
  recommendedFields: Partial<CoverPageFieldsVisibility>;
}

export const COVER_PAGE_TEMPLATES: CoverPageTemplateMeta[] = [
  {
    id: 'classic_vn_thesis',
    name: 'Chuẩn Luận văn Việt Nam',
    subtitle: 'Khung viền đôi trang trọng, Tên Trường/Khoa phía trên, Tên đề tài ở giữa, khối GVHD & Sinh viên cân đối.',
    badge: 'Phổ biến nhất',
    recommendedDocType: 'KHÓA LUẬN / LUẬN VĂN TỐT NGHIỆP',
    defaultBorder: true,
    recommendedFields: {
      showUniversity: true,
      showFaculty: true,
      showDocumentType: true,
      showTopic: true,
      showSubject: false,
      showMajor: true,
      showStudentName: true,
      showStudentId: true,
      showClassName: true,
      showSupervisor: true,
      showInternshipUnit: false,
      showWordCount: false,
      showSubmissionDate: true,
    },
  },
  {
    id: 'academic_international',
    name: 'Quốc tế (Harvard / UK / APA)',
    subtitle: 'Tối giản thanh lịch không khung, căn giữa chuẩn đại học Anh/Úc/Mỹ, hiển thị Module & Word Count.',
    badge: 'English / APA',
    recommendedDocType: 'ACADEMIC RESEARCH PAPER / DISSERTATION',
    defaultBorder: false,
    recommendedFields: {
      showUniversity: true,
      showFaculty: true,
      showDocumentType: true,
      showTopic: true,
      showSubject: true,
      showMajor: true,
      showStudentName: true,
      showStudentId: true,
      showClassName: false,
      showSupervisor: true,
      showInternshipUnit: false,
      showWordCount: true,
      showSubmissionDate: true,
    },
  },
  {
    id: 'internship_report',
    name: 'Báo cáo Thực tập / Đồ án',
    subtitle: 'Bổ sung nổi bật Đơn vị thực tập / Doanh nghiệp, Giảng viên hướng dẫn, Chuyên ngành và Khóa/Lớp.',
    badge: 'Thực tập',
    recommendedDocType: 'BÁO CÁO THỰC TẬP TỐT NGHIỆP',
    defaultBorder: true,
    recommendedFields: {
      showUniversity: true,
      showFaculty: true,
      showDocumentType: true,
      showTopic: true,
      showSubject: false,
      showMajor: true,
      showStudentName: true,
      showStudentId: true,
      showClassName: true,
      showSupervisor: true,
      showInternshipUnit: true,
      showWordCount: false,
      showSubmissionDate: true,
    },
  },
  {
    id: 'modern_executive',
    name: 'Hiện đại (Navy & Gold Accent)',
    subtitle: 'Thanh nhấn học thuật Navy & Vàng đồng tinh tế, phù hợp Assignment, Capstone & Case Study.',
    badge: 'Hiện đại',
    recommendedDocType: 'ASSIGNMENT / CAPSTONE PROJECT',
    defaultBorder: false,
    recommendedFields: {
      showUniversity: true,
      showFaculty: false,
      showDocumentType: true,
      showTopic: true,
      showSubject: true,
      showMajor: true,
      showStudentName: true,
      showStudentId: true,
      showClassName: false,
      showSupervisor: true,
      showInternshipUnit: false,
      showWordCount: true,
      showSubmissionDate: true,
    },
  },
];

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
  includeTableOfContents?: boolean;
  coverPage?: CoverPageConfig;
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

export type WriterBatchStatus =
  | 'idle'
  | 'queued'
  | 'outlining'
  | 'writing_sections'
  | 'paused'
  | 'completed'
  | 'error';

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
  batchStatus?: WriterBatchStatus;
  batchErrorMsg?: string;
  researchedSources?: string;
  researchedSourcesTopic?: string;
  historyStack: string[];
  historyIndex: number;
  updatedAt: string;
}

export const AI_PROVIDER_SUGGESTED_MODELS: Record<AiProviderType, string[]> = {
  perplexity: [
    'fast-search',
    'pro-search',
    'deep-research',
    'advanced-deep-research',
    'perplexity/glm-5.3-flash',
    'perplexity/glm-5.3',
    'google/gemini-3.5-flash',
    'google/gemini-3.8-flash',
    'perplexity/kimi-k3',
    'xai/grok-4.7',
  ],
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
    'nvidia/nemotron-3-ultra-550b-a55b',
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'nvidia/nemotron-3.5-super-vl-120b-a12b',
    'mistralai/mistral-large-4-1t-a52b',
    'moonshotai/kimi-k3.1-pro',
    'z-ai/glm-5.3-flash',
    'minimaxai/minimax-m3.1-flash',
    'google/gemma-4-31b-it',
    'stepfun-ai/step-5-preview',
    'deepseek-chat',
    'deepseek-reasoner',
    'llama-3.3-70b-versatile',
  ],
};

export const DEFAULT_HYBRID_PIPELINE: AiHybridPipelineConfig = {
  enabled: false,
  researchModel: 'perplexity-search',
  writerProvider: 'perplexity',
  writerModel: 'perplexity/glm-5.3-flash',
};

export const DEFAULT_AI_SETTINGS: AiChatbotSettingsStore = {
  activeProvider: 'perplexity',
  hybridPipeline: DEFAULT_HYBRID_PIPELINE,
  profiles: {
    perplexity: {
      provider: 'perplexity',
      label: 'Perplexity Agent API (Web-Grounded)',
      apiKey: '',
      model: 'pro-search',
      baseUrl: 'https://api.perplexity.ai/v1/agent',
      temperature: 0.2,
    },
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
      includeTableOfContents: true,
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
      includeTableOfContents: true,
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
      includeTableOfContents: true,
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
      includeTableOfContents: true,
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
    name: 'Strict References & Citation Integrity Skill',
    fileName: 'strict-references-citation.skill.md',
    description:
      'Ép AI chỉ liệt kê các nguồn học thuật/báo cáo thực sự được trích dẫn trong bài ở phần References; tuyệt đối KHÔNG trích dẫn Rubric, đề bài hay hướng dẫn làm bài.',
    enabled: true,
    isBuiltIn: true,
    updatedAt: new Date().toISOString(),
    content: `# Skill: Strict References & Citation Integrity (No Rubric / Prompt Leakage)
- NEVER cite, list, or reference the assignment brief, grading rubric, marking criteria, lecturer instructions, syllabus, or uploaded skill files as entries in the References / Bibliography section.
- Compile ONLY authentic scholarly, statistical, regulatory, and industry sources that are actually cited in-text in the body of the paper (aim for 20-35 high-quality references for full research papers, or proportional to paper length).
- Enforce 1-to-1 citation consistency: every in-text citation used in earlier sections MUST have a matching full entry in References, and every entry in References MUST be cited in-text.
- Strict Citation Style formatting (e.g., APA 7th: Author, A. A. (Year). Title of work. *Source*, Volume(Issue), Page range. https://doi.org/... or URL).
- Ensure source diversity where relevant to the topic: peer-reviewed journal articles, official statistical yearbooks & government/central bank reports, reputable industry reports (e.g., World Bank, McKinsey, CGAP), and seminal academic textbooks.
- Order entries strictly alphabetically by first author surname (or sequentially [1], [2]... for IEEE).`,
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
  {
    id: 'skill_toc_hierarchy',
    name: 'Thesis Table of Contents & Multi-Level Heading Skill',
    fileName: 'thesis-table-of-contents.skill.md',
    description:
      'Chuẩn hóa cấu trúc Mục lục (Table of Contents) đa cấp (H1 / H2 / H3: 1., 1.1, 1.2, 2., 2.1...) chuẩn luận văn, khóa luận và báo cáo học thuật.',
    enabled: true,
    isBuiltIn: true,
    updatedAt: new Date().toISOString(),
    content: `# Skill: Standard Thesis Table of Contents & Multi-Level Heading Hierarchy
- Structure every research paper, report, or thesis with a clean, hierarchical numbering system suitable for an automatic Word Table of Contents (TOC levels 1 to 3):
  * Level 1 (H1): Major chapters or primary sections (e.g., "1. Introduction", "2. Literature Review & Theoretical Framework", "3. Methodology / Analytical Evaluation", "4. Findings & Strategic Recommendations", "5. Conclusion", "References").
  * Level 2 (H2): Thematic sub-sections within major chapters using clean hierarchical numbering WITHOUT markdown '#' symbols (e.g., "2.1 Conceptual Foundations", "2.2 Empirical Evidence & Market Reality").
  * Level 3 (H3): Granular sub-topics when needed for long sections (>= 600 words) using clean hierarchical numbering (e.g., "2.2.1 Regulatory & Institutional Factors").
- Strictly DO NOT prepend markdown hashtags (#, ##, ###) at the beginning of headings or sentences; write clean plain-text titles ready for Microsoft Word.
- Keep all heading titles concise, formal, parallel in grammatical structure, and directly aligned with the assignment brief and grading rubric so the generated Table of Contents reads like a publication-grade university dissertation.
- Never use markdown headings inside the final References / Bibliography list.`,
  },
];
