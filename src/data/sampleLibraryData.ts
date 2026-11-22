export interface SamplePaperTable {
  caption: string;
  headers: string[];
  rows: string[][];
  sourceNote?: string;
}

export interface SamplePaperSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  table?: SamplePaperTable;
}

export interface SamplePaperItem {
  id: string;
  title: string;
  courseCode: string;
  discipline:
    | 'Business & Strategy'
    | 'Marketing'
    | 'Finance & Accounting'
    | 'Education & ELT'
    | 'Management & HR'
    | 'Logistics & Supply Chain'
    | 'IT & Data'
    | 'Psychology';
  institution: string;
  institutionShort: string;
  country: 'Úc' | 'Anh' | 'Mỹ' | 'Canada' | 'Việt Nam';
  level: 'Bachelor' | 'Master / PhD' | 'Diploma';
  docType:
    | 'Assignment / Essay'
    | 'Case Study'
    | 'Critical Review'
    | 'Literature Review'
    | 'Business Report';
  gradeScore: string;
  gradeLabel: 'HD' | 'DI' | 'CR';
  wordCount: number;
  citationStyle: 'APA 7th' | 'Harvard' | 'IEEE';
  turnitinPercent: number;
  aiPercent: number;
  publishedDate: string;
  excerpt: string;
  tags: string[];
  /** Optional custom screenshot/image URL if you want to attach a real paper or Turnitin image */
  previewImageUrl?: string;
  rubricHighlights: Array<{ criterion: string; score: string }>;
  sections: SamplePaperSection[];
  references: string[];
}

export const SAMPLE_LIBRARY_ITEMS: SamplePaperItem[] = [
  {
    id: 'busm2570-business-decision-making-di',
    title: 'Business Decision Making – BUSM2570 – Strategic Retail Expansion',
    courseCode: 'BUSM2570',
    discipline: 'Business & Strategy',
    institution: 'RMIT University',
    institutionShort: 'RMIT',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Business Report',
    gradeScore: '78/100',
    gradeLabel: 'DI',
    wordCount: 1850,
    citationStyle: 'Harvard',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '18/05/2026',
    excerpt:
      'Báo cáo phân tích quyết định kinh doanh ứng dụng ma trận PESTEL, phân tích hòa vốn và mô hình đánh giá rủi ro đa tiêu chí cho kế hoạch mở rộng chuỗi bán lẻ tại thị trường Đông Nam Á.',
    tags: ['Business Report', 'RMIT', 'Úc', 'Harvard', 'Decision Matrix'],
    rubricHighlights: [
      { criterion: 'Problem Framing & Context', score: '16/20' },
      { criterion: 'Quantitative & Risk Analysis', score: '24/30' },
      { criterion: 'Strategic Recommendations', score: '23/30' },
      { criterion: 'Academic Writing & Harvard Citations', score: '15/20' },
    ],
    sections: [
      {
        heading: '1. Executive Summary',
        paragraphs: [
          'This report evaluates three strategic expansion options for a mid-sized omnichannel retailer entering Southeast Asia between 2026 and 2028. Using weighted multi-criteria decision analysis (MCDA) alongside sensitivity testing on capital expenditure and demand elasticity, the evaluation demonstrates that a phased franchise-hybrid model outperforms direct wholly owned entry on risk-adjusted return.',
          'While direct entry offers maximum brand control, high upfront lease commitments and regulatory lead times expose working capital to downside shocks. A joint-venture flagship paired with regional e-commerce fulfillment balances speed-to-market with manageable financial exposure.',
        ],
      },
      {
        heading: '2. Comparative Option Evaluation',
        paragraphs: [
          'Each strategic alternative was scored across five weighted criteria aligned with board governance priorities: net present value (30%), payback speed (20%), operational scalability (20%), regulatory risk exposure (15%), and brand consistency (15%).',
        ],
        table: {
          caption: 'Table 1. Weighted Multi-Criteria Decision Matrix for Market Entry Options',
          headers: ['Decision Criterion', 'Weight', 'Direct Entry', 'Hybrid JV', 'Pure E-Commerce'],
          rows: [
            ['3-Year Risk-Adjusted NPV', '30%', '6.5 / 10', '8.4 / 10', '7.8 / 10'],
            ['Capital Payback Period', '20%', '5.0 / 10', '7.9 / 10', '8.8 / 10'],
            ['Operational Scalability', '20%', '6.8 / 10', '8.5 / 10', '8.2 / 10'],
            ['Regulatory & Supply Risk', '15%', '5.5 / 10', '8.0 / 10', '7.2 / 10'],
            ['Brand Experience Control', '15%', '9.0 / 10', '7.8 / 10', '6.4 / 10'],
            ['Weighted Composite Score', '100%', '6.49', '8.18', '7.82'],
          ],
          sourceNote: 'Source: Author’s financial and strategic sensitivity modelling (2026).',
        },
      },
      {
        heading: '3. Actionable Recommendations',
        paragraphs: [
          'Management should adopt the Hybrid Joint-Venture pathway in two gated phases. Phase 1 (Months 1–9) establishes localized digital fulfillment and two flagship experience stores to validate unit economics before committing to broader retail leases in Phase 2.',
        ],
        bullets: [
          'Set a stage-gate threshold of 18% contribution margin before triggering Phase 2 store rollouts.',
          'Contract dual third-party logistics providers to hedge peak-season fulfillment delays.',
          'Implement monthly cohort retention dashboards to track omnichannel repeat purchase rates.',
        ],
      },
    ],
    references: [
      'Grant, R.M. (2022) Contemporary strategy analysis. 11th edn. Hoboken: Wiley.',
      'Johnson, G., Whittington, R., Regnér, P., Angwin, D. and Scholes, K. (2023) Exploring strategy: text and cases. 13th edn. Harlow: Pearson.',
      'Porter, M.E. (2008) ‘The five competitive forces that shape strategy’, Harvard Business Review, 86(1), pp. 78–93.',
    ],
  },
  {
    id: 'elt601-vocabulary-pedagogy-critical-review-hd',
    title: 'Critical Review – Primary EFL Vocabulary Teaching Techniques',
    courseCode: 'ELT601',
    discipline: 'Education & ELT',
    institution: 'Hong Duc University / International ELT',
    institutionShort: 'ELT',
    country: 'Việt Nam',
    level: 'Master / PhD',
    docType: 'Critical Review',
    gradeScore: '86/100',
    gradeLabel: 'HD',
    wordCount: 2420,
    citationStyle: 'APA 7th',
    turnitinPercent: 3,
    aiPercent: 0,
    publishedDate: '12/06/2026',
    excerpt:
      'Bài đánh giá phản biện chuyên sâu đối chiếu nghiên cứu thực nghiệm dạy từ vựng tiếng Anh tiểu học dưới lăng kính lý thuyết Nation (2001) và Involvement Load Hypothesis (Laufer & Hulstijn, 2001).',
    tags: ['Critical Review', 'APA 7th', 'ELT', 'Master / PhD', 'HD 86+'],
    rubricHighlights: [
      { criterion: 'Theoretical Grounding & Synthesis', score: '26/30' },
      { criterion: 'Methodological Appraisal', score: '22/25' },
      { criterion: 'Critical Discussion & Evidence', score: '22/25' },
      { criterion: 'APA 7th Rigour & Prose', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Purpose and Evaluative Thesis',
        paragraphs: [
          'This critical review evaluates the methodological credibility and pedagogical contribution of recent qualitative case-study research examining vocabulary teaching in resource-constrained primary EFL classrooms. While naturalistic classroom observation yields valuable ecological insight into how teachers balance repetition drills and translation under structural pressure, the absence of objective learner retention measures limits the evidential weight of hybrid-instruction claims.',
        ],
      },
      {
        heading: '2. Methodological Appraisal Summary',
        paragraphs: [
          'Evaluating the research design against qualitative trustworthiness criteria reveals a sharp contrast between strong ecological validity and underdeveloped analytic transparency.',
        ],
        table: {
          caption: 'Table 1. Trustworthiness Appraisal of the Reviewed Qualitative Case Study',
          headers: ['Criterion', 'Observed Practice', 'Critical Assessment'],
          rows: [
            ['Credibility', '3 observation cycles + interviews', 'Moderate — lacks member checking'],
            ['Dependability', 'Percentage tables of techniques', 'Weak — no coding scheme or audit trail'],
            ['Transferability', '3 urban schools, 3 female teachers', 'Limited — narrow purposive sample'],
            ['Confirmability', 'Raw interview quotes in appendix', 'Moderate — no inter-coder reliability'],
          ],
          sourceNote: 'Source: Evaluated against Lincoln & Guba trustworthiness criteria.',
        },
      },
    ],
    references: [
      'Hulstijn, J. H., & Laufer, B. (2001). Some empirical evidence for the involvement load hypothesis in vocabulary acquisition. Language Learning, 51(3), 539–558.',
      'Laufer, B., & Hulstijn, J. (2001). Incidental vocabulary acquisition in a second language: The construct of task-induced involvement. Applied Linguistics, 22(1), 1–26.',
      'Nation, I. S. P. (2001). Learning vocabulary in another language. Cambridge University Press.',
    ],
  },
  {
    id: 'mktg1045-digital-brand-strategy-hd',
    title: 'Digital Marketing Strategy – MKTG1045 – Gen Z Omnichannel Funnel',
    courseCode: 'MKTG1045',
    discipline: 'Marketing',
    institution: 'Swinburne University',
    institutionShort: 'SWIN',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Case Study',
    gradeScore: '84/100',
    gradeLabel: 'HD',
    wordCount: 2150,
    citationStyle: 'Harvard',
    turnitinPercent: 5,
    aiPercent: 0,
    publishedDate: '04/05/2026',
    excerpt:
      'Phân tích hành vi tiêu dùng Gen Z kết hợp mô hình RACE Framework, định vị giá trị thương hiệu và tối ưu tỷ lệ chuyển đổi trên TikTok Shop & Instagram.',
    tags: ['Case Study', 'Marketing', 'Swinburne', 'Úc', 'HD 84'],
    rubricHighlights: [
      { criterion: 'Consumer Behaviour Analysis', score: '25/30' },
      { criterion: 'RACE Digital Funnel Design', score: '26/30' },
      { criterion: 'KPI & Budget Allocation', score: '17/20' },
      { criterion: 'Harvard Referencing', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Strategic Context & Audience Insight',
        paragraphs: [
          'Gen Z apparel buyers exhibit non-linear discovery journeys driven by creator credibility, peer video reviews, and frictionless mobile checkout. Applying Chaffey’s RACE framework reveals that conversion drop-offs occur primarily between short-form video engagement and landing-page trust verification.',
        ],
      },
      {
        heading: '2. Channel KPI Allocation',
        paragraphs: [
          'Budget reallocation prioritizes creator-led social proof and automated retention flows over broad awareness impressions.',
        ],
        table: {
          caption: 'Table 1. Proposed 6-Month Digital Funnel KPIs',
          headers: ['RACE Stage', 'Primary Channel', 'Budget Share', 'Target KPI'],
          rows: [
            ['Reach', 'Short-form Creator Video', '35%', 'CPM < $4.80'],
            ['Act', 'Interactive Product Quiz', '20%', 'CTR ≥ 3.6%'],
            ['Convert', 'Retargeting + Social Proof', '30%', 'CVR ≥ 3.2%'],
            ['Engage', 'CRM Loyalty & Referral', '15%', 'Repeat Rate ≥ 28%'],
          ],
        },
      },
    ],
    references: [
      'Chaffey, D. and Ellis-Chadwick, F. (2022) Digital marketing: strategy, implementation and practice. 8th edn. Harlow: Pearson.',
      'Kotler, P., Kartajaya, H. and Setiawan, I. (2023) Marketing 6.0: the future is immersive. Hoboken: Wiley.',
    ],
  },
  {
    id: 'fina3012-capital-structure-valuation-hd',
    title: 'Corporate Finance – FINA3012 – Capital Structure & WACC Optimization',
    courseCode: 'FINA3012',
    discipline: 'Finance & Accounting',
    institution: 'University of Sydney',
    institutionShort: 'USYD',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Assignment / Essay',
    gradeScore: '82/100',
    gradeLabel: 'HD',
    wordCount: 2300,
    citationStyle: 'APA 7th',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '29/04/2026',
    excerpt:
      'Đánh giá cấu trúc vốn tối ưu, lá chắn thuế lãi vay và tác động của tỷ lệ đòn bẩy nợ lên chi phí vốn bình quân (WACC) của doanh nghiệp niêm yết.',
    tags: ['Finance', 'WACC', 'APA 7th', 'USYD', 'HD 82'],
    rubricHighlights: [
      { criterion: 'Financial Modelling Accuracy', score: '26/30' },
      { criterion: 'Trade-Off & Pecking Order Theory', score: '24/30' },
      { criterion: 'Risk Sensitivity Analysis', score: '16/20' },
      { criterion: 'Structure & APA Style', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Theoretical Positioning',
        paragraphs: [
          'Under the static trade-off theory, firms balance the present value of interest tax shields against the rising expected costs of financial distress. Empirical analysis of ASX-listed mid-cap industrials confirms a concave enterprise value curve peaking around a 30–35% debt-to-capital ratio.',
        ],
      },
      {
        heading: '2. WACC Sensitivity Across Leverage Scenarios',
        paragraphs: [
          'Modelling debt-to-value ratios from 10% to 50% highlights the inflection point where credit-spread widening offsets incremental tax shield benefits.',
        ],
        table: {
          caption: 'Table 1. Simulated Cost of Capital Across Leverage Ratios',
          headers: ['Debt / Value', 'Cost of Debt (Pre-Tax)', 'Levered Beta', 'Cost of Equity', 'WACC'],
          rows: [
            ['10%', '5.20%', '1.04', '9.64%', '9.04%'],
            ['25%', '5.60%', '1.18', '10.48%', '8.84%'],
            ['35%', '6.10%', '1.31', '11.26%', '8.81%'],
            ['50%', '7.80%', '1.62', '13.12%', '9.29%'],
          ],
        },
      },
    ],
    references: [
      'Berk, J., & DeMarzo, P. (2023). Corporate finance (6th ed.). Pearson.',
      'Myers, S. C. (2001). Capital structure. Journal of Economic Perspectives, 15(2), 81–102.',
    ],
  },
  {
    id: 'mgmt2104-hybrid-leadership-engagement-di',
    title: 'Organisational Behaviour – MGMT2104 – Hybrid Leadership & Trust',
    courseCode: 'MGMT2104',
    discipline: 'Management & HR',
    institution: 'University of Nottingham',
    institutionShort: 'NOTT',
    country: 'Anh',
    level: 'Master / PhD',
    docType: 'Literature Review',
    gradeScore: '76/100',
    gradeLabel: 'DI',
    wordCount: 2650,
    citationStyle: 'Harvard',
    turnitinPercent: 6,
    aiPercent: 0,
    publishedDate: '19/04/2026',
    excerpt:
      'Tổng quan tài liệu phản biện về ảnh hưởng của phong cách lãnh đạo chuyển đổi (Transformational Leadership) tới sự gắn kết nhân sự trong mô hình làm việc Hybrid.',
    tags: ['Management', 'Literature Review', 'UK', 'Harvard', 'DI 76'],
    rubricHighlights: [
      { criterion: 'Critical Thematic Synthesis', score: '24/30' },
      { criterion: 'Evidence Quality & Currency', score: '22/30' },
      { criterion: 'Identification of Research Gaps', score: '15/20' },
      { criterion: 'Academic Tone & Harvard Style', score: '15/20' },
    ],
    sections: [
      {
        heading: '1. Thematic Synthesis of Hybrid Leadership',
        paragraphs: [
          'Post-pandemic empirical studies converge on psychological safety and asynchronous clarity—rather than physical co-location—as the primary predictors of team cohesion. Transformational leadership behaviours sustain engagement only when translated into structured digital feedback loops that prevent proximity bias.',
        ],
      },
    ],
    references: [
      'Bass, B.M. and Riggio, R.E. (2006) Transformational leadership. 2nd edn. Mahwah: Lawrence Erlbaum Associates.',
      'Edmondson, A.C. (2019) The fearless organization: creating psychological safety in the workplace for learning, innovation, and growth. Hoboken: Wiley.',
    ],
  },
  {
    id: 'omgt2218-supply-chain-resilience-di',
    title: 'Supply Chain Management – OMGT2218 – Dual-Sourcing Resilience',
    courseCode: 'OMGT2218',
    discipline: 'Logistics & Supply Chain',
    institution: 'Deakin University',
    institutionShort: 'DEAKIN',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Case Study',
    gradeScore: '75/100',
    gradeLabel: 'DI',
    wordCount: 1980,
    citationStyle: 'Harvard',
    turnitinPercent: 5,
    aiPercent: 0,
    publishedDate: '08/04/2026',
    excerpt:
      'Nghiên cứu tình huống ứng dụng chiến lược đa nguồn cung (Dual-Sourcing) và phân tích tồn kho an toàn nhằm giảm rủi ro đứt gãy chuỗi cung ứng điện tử.',
    tags: ['Supply Chain', 'Case Study', 'Deakin', 'Úc', 'DI 75'],
    rubricHighlights: [
      { criterion: 'Risk Mapping & Diagnosis', score: '23/30' },
      { criterion: 'Inventory & Lead-Time Model', score: '22/30' },
      { criterion: 'Feasibility of Recommendations', score: '16/20' },
      { criterion: 'Referencing & Presentation', score: '14/20' },
    ],
    sections: [
      {
        heading: '1. Disruption Diagnosis & Resilience Trade-Offs',
        paragraphs: [
          'Lean single-sourcing minimizes unit procurement cost during stable periods but magnifies revenue loss during port congestion or geopolitical disruption. Splitting 70/30 volume between primary low-cost suppliers and nearshore secondary partners cuts expected stockout duration by 42% at an incremental unit cost of 2.8%.',
        ],
      },
    ],
    references: [
      'Christopher, M. (2022) Logistics & supply chain management. 6th edn. Harlow: Pearson.',
      'Sheffi, Y. (2015) The power of resilience: how the best companies manage the unexpected. Cambridge, MA: MIT Press.',
    ],
  },
  {
    id: 'cosc2640-ai-governance-enterprise-hd',
    title: 'Enterprise AI Governance – COSC2640 – Risk & Compliance Framework',
    courseCode: 'COSC2640',
    discipline: 'IT & Data',
    institution: 'University of Toronto',
    institutionShort: 'UofT',
    country: 'Canada',
    level: 'Master / PhD',
    docType: 'Assignment / Essay',
    gradeScore: '85/100',
    gradeLabel: 'HD',
    wordCount: 2500,
    citationStyle: 'IEEE',
    turnitinPercent: 3,
    aiPercent: 0,
    publishedDate: '27/03/2026',
    excerpt:
      'Thiết kế khung quản trị rủi ro AI tạo sinh trong doanh nghiệp tài chính dựa trên chuẩn NIST AI RMF và quy định phân tầng rủi ro của EU AI Act.',
    tags: ['IT & Data', 'AI Governance', 'Canada', 'IEEE', 'HD 85'],
    rubricHighlights: [
      { criterion: 'Regulatory Alignment (EU AI Act / NIST)', score: '26/30' },
      { criterion: 'Technical Controls Architecture', score: '26/30' },
      { criterion: 'Critical Evaluation of Trade-offs', score: '17/20' },
      { criterion: 'IEEE Citations & Clarity', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Layered AI Governance Architecture',
        paragraphs: [
          'Deploying large language models in regulated financial workflows requires technical guardrails across data lineage, prompt injection mitigation, retrieval grounding, and human-in-the-loop auditability. Mapping controls to NIST AI RMF functions (Govern, Map, Measure, Manage) provides verifiable compliance evidence.',
        ],
      },
    ],
    references: [
      '[1] National Institute of Standards and Technology, Artificial Intelligence Risk Management Framework (AI RMF 1.0), NIST AI 100-1, Jan. 2023.',
      '[2] European Parliament and Council, Regulation (EU) 2024/1689 laying down harmonised rules on artificial intelligence (Artificial Intelligence Act), Official Journal of the European Union, Jul. 2024.',
    ],
  },
  {
    id: 'psyc2091-cognitive-load-learning-di',
    title: 'Educational Psychology – PSYC2091 – Cognitive Load & Self-Regulation',
    courseCode: 'PSYC2091',
    discipline: 'Psychology',
    institution: 'University of Manchester',
    institutionShort: 'MANC',
    country: 'Anh',
    level: 'Bachelor',
    docType: 'Assignment / Essay',
    gradeScore: '77/100',
    gradeLabel: 'DI',
    wordCount: 2050,
    citationStyle: 'APA 7th',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '14/03/2026',
    excerpt:
      'Phân tích mối quan hệ giữa lý thuyết tải nhận thức (Cognitive Load Theory) và chiến lược tự điều chỉnh học tập trong môi trường học trực tuyến đại học.',
    tags: ['Psychology', 'APA 7th', 'UK', 'DI 77'],
    rubricHighlights: [
      { criterion: 'Theoretical Precision', score: '24/30' },
      { criterion: 'Empirical Evidence Integration', score: '23/30' },
      { criterion: 'Critical Evaluation', score: '15/20' },
      { criterion: 'APA 7th Formatting', score: '15/20' },
    ],
    sections: [
      {
        heading: '1. Extraneous Load in Digital Learning Environments',
        paragraphs: [
          'Sweller’s Cognitive Load Theory distinguishes intrinsic complexity from extraneous processing caused by poorly segmented multimedia interfaces. When extraneous load exceeds working memory capacity, learners abandon metacognitive monitoring and revert to passive re-reading.',
        ],
      },
    ],
    references: [
      'Sweller, J., van Merriënboer, J. J. G., & Paas, F. (2019). Cognitive architecture and instructional design: 20 years later. Educational Psychology Review, 31(2), 261–292.',
      'Zimmerman, B. J. (2002). Becoming a self-regulated learner: An overview. Theory Into Practice, 41(2), 64–70.',
    ],
  },
];
