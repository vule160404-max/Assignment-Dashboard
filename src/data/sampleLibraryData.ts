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
    | 'Hospitality & Tourism'
    | 'Professional Communication'
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
  {
    id: 'mktg1205-integrated-marketing-communications-hd',
    title: 'RMIT – Integrated Marketing Communications – MKTG1205 – Sample HD',
    courseCode: 'MKTG1205',
    discipline: 'Marketing',
    institution: 'RMIT University',
    institutionShort: 'RMIT',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Business Report',
    gradeScore: '85/100',
    gradeLabel: 'HD',
    wordCount: 2240,
    citationStyle: 'Harvard',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '09/03/2026',
    excerpt:
      'Kế hoạch truyền thông marketing tích hợp (IMC) 12 tháng ứng dụng mô hình AIDA và chiến lược đa điểm chạm cho thương hiệu F&B bền vững tại Úc.',
    tags: ['IMC', 'Marketing', 'RMIT', 'Úc', 'HD 85'],
    rubricHighlights: [
      { criterion: 'Target Persona & Insight Depth', score: '26/30' },
      { criterion: 'Creative Big Idea & Message Strategy', score: '26/30' },
      { criterion: 'Media Mix & Budget Schedule', score: '17/20' },
      { criterion: 'Evaluation Metrics & Harvard Style', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Campaign Objectives & Communication Hierarchy',
        paragraphs: [
          'This integrated marketing communications plan establishes a two-stage behavioural funnel for launching a zero-waste specialty coffee line across Melbourne and Sydney metropolitan commuters. Using the hierarchy-of-effects model, the first quarter prioritizes aided brand recall among eco-conscious urban professionals aged 22–38, while quarters two and three shift budget weight toward trial conversion and subscription retention.',
        ],
      },
      {
        heading: '2. Cross-Channel Media Schedule & Cost Efficiency',
        paragraphs: [
          'Media allocation balances high-frequency digital video and commuter out-of-home placements with point-of-sale sampling activations.',
        ],
        table: {
          caption: 'Table 1. 12-Month IMC Channel Allocation & Target Reach',
          headers: ['Media Channel', 'Objective Role', 'Budget Share', 'Projected Reach', 'Primary KPI'],
          rows: [
            ['Digital Short-Form Video', 'Awareness & Trial', '35%', '1.4M impressions', 'VTR ≥ 42%'],
            ['Transit & Café OOH', 'Local Salience', '25%', '680K commuters', 'Aided Recall +18%'],
            ['Micro-Creator Seeding', 'Credibility & Proof', '25%', '420K engaged views', 'CPE < $0.45'],
            ['CRM Loyalty & Sampling', 'Repeat Subscription', '15%', '35K redemptions', '90-Day Retention ≥ 31%'],
          ],
        },
      },
    ],
    references: [
      'Belch, G.E. and Belch, M.A. (2021) Advertising and promotion: an integrated marketing communications perspective. 12th edn. New York: McGraw-Hill.',
      'Percy, L. (2023) Strategic integrated marketing communications. 4th edn. London: Routledge.',
    ],
  },
  {
    id: 'omgt2229-global-logistics-optimization-di',
    title: 'RMIT – Global Logistics & Freight Management – OMGT2229 – Sample DI',
    courseCode: 'OMGT2229',
    discipline: 'Logistics & Supply Chain',
    institution: 'RMIT University',
    institutionShort: 'RMIT',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Case Study',
    gradeScore: '79/100',
    gradeLabel: 'DI',
    wordCount: 2100,
    citationStyle: 'Harvard',
    turnitinPercent: 5,
    aiPercent: 0,
    publishedDate: '01/03/2026',
    excerpt:
      'Phân tích tối ưu hóa tuyến vận tải đa phương thức (Sea-Air Intermodal) và kiểm soát chi phí lưu kho lạnh cho chuỗi xuất khẩu nông sản.',
    tags: ['Logistics', 'OMGT2229', 'RMIT', 'Úc', 'DI 79'],
    rubricHighlights: [
      { criterion: 'Modal Choice & Cost-Time Analysis', score: '24/30' },
      { criterion: 'Cold-Chain Risk Mitigation', score: '24/30' },
      { criterion: 'Incoterms & Customs Compliance', score: '16/20' },
      { criterion: 'Report Formatting & References', score: '15/20' },
    ],
    sections: [
      {
        heading: '1. Multimodal Route Trade-Off Analysis',
        paragraphs: [
          'Exporting perishable horticultural products requires balancing freight expenditure against shelf-life decay curves. While full-container-load (FCL) reefer ocean freight minimizes cost per kilogram, transit variability of 18–22 days degrades retail shelf life by up to 35%.',
        ],
        table: {
          caption: 'Table 1. Comparative Cost and Transit Performance Across Transport Modes',
          headers: ['Transport Mode', 'Door-to-Door Transit', 'Unit Freight Cost', 'Spoilage Rate', 'Net Margin Impact'],
          rows: [
            ['100% Ocean Reefer (FCL)', '20 days', '$1.15 / kg', '11.4%', 'Baseline'],
            ['Sea–Air Hub Transshipment', '9 days', '$2.45 / kg', '3.2%', '+6.8% net margin'],
            ['Direct Air Cargo', '2 days', '$4.90 / kg', '0.9%', '-4.1% net margin'],
          ],
        },
      },
    ],
    references: [
      'Mangan, J., Lalwani, C. and Calatayud, A. (2021) Global logistics and supply chain management. 4th edn. Chichester: Wiley.',
      'Rushton, A., Croucher, P. and Baker, P. (2022) The handbook of logistics and distribution management. 7th edn. London: Kogan Page.',
    ],
  },
  {
    id: 'acfi1001-accounting-financial-statement-analysis-hd',
    title: 'Monash – Financial Statement & Ratio Analysis – ACFI1001 – Sample HD',
    courseCode: 'ACFI1001',
    discipline: 'Finance & Accounting',
    institution: 'Monash University',
    institutionShort: 'MONASH',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Business Report',
    gradeScore: '83/100',
    gradeLabel: 'HD',
    wordCount: 2050,
    citationStyle: 'APA 7th',
    turnitinPercent: 3,
    aiPercent: 0,
    publishedDate: '22/02/2026',
    excerpt:
      'Phân tích báo cáo tài chính 3 năm bằng mô hình DuPont ROE, chỉ số thanh khoản, vòng quay vốn lưu động và khuyến nghị đầu tư cổ phiếu.',
    tags: ['Accounting', 'DuPont ROE', 'Monash', 'Úc', 'HD 83'],
    rubricHighlights: [
      { criterion: 'DuPont & Profitability Decomposition', score: '26/30' },
      { criterion: 'Liquidity & Solvency Interpretation', score: '25/30' },
      { criterion: 'Cash Flow Quality Assessment', score: '16/20' },
      { criterion: 'APA 7th Presentation', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Three-Step DuPont Decomposition',
        paragraphs: [
          'Decomposing Return on Equity (ROE) across FY2023–FY2025 reveals that the 340-basis-point expansion in shareholder return was driven primarily by operating margin recovery and inventory turnover efficiency rather than financial leverage.',
        ],
        table: {
          caption: 'Table 1. DuPont ROE & Liquidity Ratio Summary (FY2023–FY2025)',
          headers: ['Financial Metric', 'FY2023', 'FY2024', 'FY2025', 'Industry Peer Median'],
          rows: [
            ['Net Profit Margin', '7.8%', '8.9%', '9.6%', '8.2%'],
            ['Total Asset Turnover', '1.32x', '1.41x', '1.48x', '1.35x'],
            ['Equity Multiplier', '1.65x', '1.62x', '1.59x', '1.74x'],
            ['Return on Equity (ROE)', '16.99%', '20.33%', '22.59%', '19.26%'],
            ['Current Ratio', '1.42x', '1.56x', '1.68x', '1.45x'],
          ],
        },
      },
    ],
    references: [
      'Palepu, K. G., Healy, P. M., Wright, S., Bradbury, M., & Coulton, J. (2021). Business analysis and valuation: Using financial statements (3rd Asia-Pacific ed.). Cengage Learning.',
      'Penman, S. H. (2020). Financial statement analysis and security valuation (6th ed.). McGraw-Hill.',
    ],
  },
  {
    id: 'bafi1005-financial-markets-portfolio-risk-di',
    title: 'RMIT – Financial Markets & Portfolio Risk – BAFI1005 – Sample DI',
    courseCode: 'BAFI1005',
    discipline: 'Finance & Accounting',
    institution: 'RMIT University',
    institutionShort: 'RMIT',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Assignment / Essay',
    gradeScore: '78/100',
    gradeLabel: 'DI',
    wordCount: 1920,
    citationStyle: 'Harvard',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '15/02/2026',
    excerpt:
      'Đánh giá rủi ro danh mục đầu tư đa tài sản, chính sách tiền tệ của Ngân hàng Dự trữ Úc (RBA) và chiến lược phòng vệ lãi suất bằng hợp đồng kỳ hạn.',
    tags: ['Finance', 'BAFI1005', 'RMIT', 'Portfolio Risk', 'DI 78'],
    rubricHighlights: [
      { criterion: 'Monetary Policy Transmission Analysis', score: '24/30' },
      { criterion: 'Bond Duration & Yield Curve Valuation', score: '23/30' },
      { criterion: 'Hedging Strategy Design', score: '16/20' },
      { criterion: 'Harvard Citation Accuracy', score: '15/20' },
    ],
    sections: [
      {
        heading: '1. Yield Curve Shifts & Fixed-Income Duration Risk',
        paragraphs: [
          'Tightening monetary policy increases discount rates across short- and medium-term maturities, compressing the market value of fixed-coupon bond portfolios in proportion to their modified duration. Shortening portfolio duration from 6.4 years to 3.2 years limits mark-to-market drawdown during a 75-basis-point parallel yield shift.',
        ],
      },
    ],
    references: [
      'Bodie, Z., Kane, A. and Marcus, A.J. (2024) Investments. 13th edn. New York: McGraw-Hill.',
      'Mishkin, F.S. and Eakins, S.G. (2021) Financial markets and institutions. 9th edn. Harlow: Pearson.',
    ],
  },
  {
    id: 'hosp2015-sustainable-hotel-revenue-management-hd',
    title: 'Griffith – Hospitality Revenue & Guest Experience – HOSP2015 – Sample HD',
    courseCode: 'HOSP2015',
    discipline: 'Hospitality & Tourism',
    institution: 'Griffith University',
    institutionShort: 'GRIFFITH',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Case Study',
    gradeScore: '84/100',
    gradeLabel: 'HD',
    wordCount: 2180,
    citationStyle: 'APA 7th',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '07/02/2026',
    excerpt:
      'Chiến lược tối ưu hóa doanh thu phòng (RevPAR), định giá linh hoạt theo mùa vụ và nâng cao trải nghiệm du lịch xanh tại khu nghỉ dưỡng 5 sao.',
    tags: ['Hospitality', 'RevPAR', 'Griffith', 'Úc', 'HD 84'],
    rubricHighlights: [
      { criterion: 'RevPAR & ADR Yield Diagnosis', score: '26/30' },
      { criterion: 'Service Blueprint & Guest Journey', score: '25/30' },
      { criterion: 'ESG Sustainability Integration', score: '17/20' },
      { criterion: 'APA 7th Referencing', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Dynamic Pricing & Channel Mix Optimization',
        paragraphs: [
          'Over-reliance on third-party online travel agencies (OTAs) charging 18–22% commission erodes net room yield despite high headline occupancy. Shifting 20% of shoulder-season bookings to direct member channels via value-added resort credits lifts Net RevPAR by 9.4%.',
        ],
        table: {
          caption: 'Table 1. Booking Channel Mix & Net RevPAR Comparison',
          headers: ['Distribution Channel', 'Room Share', 'Gross ADR', 'CommissionCost', 'Net ADR'],
          rows: [
            ['OTA Aggregators', '48%', '$240', '20%', '$192'],
            ['Direct Brand Website', '32%', '$235', '3%', '$228'],
            ['Corporate & MICE Packages', '20%', '$225', '5%', '$214'],
          ],
        },
      },
    ],
    references: [
      'Hayes, D. K., Ninemeier, J. D., & Miller, A. A. (2021). Hotel operations management (4th ed.). Pearson.',
      'Kimes, S. E., & Wirtz, J. (2015). Revenue management: Advanced strategies and tools to enhance firm profitability. Foundations and Trends in Marketing, 8(1), 1–68.',
    ],
  },
  {
    id: 'comm2384-crisis-communication-stakeholder-trust-di',
    title: 'UTS – Corporate Crisis Communication Strategy – COMM2384 – Sample DI',
    courseCode: 'COMM2384',
    discipline: 'Professional Communication',
    institution: 'University of Technology Sydney',
    institutionShort: 'UTS',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Case Study',
    gradeScore: '79/100',
    gradeLabel: 'DI',
    wordCount: 1890,
    citationStyle: 'APA 7th',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '30/01/2026',
    excerpt:
      'Ứng dụng lý thuyết truyền thông khủng hoảng theo tình huống (SCCT) của Coombs để xử lý khủng hoảng rò rỉ dữ liệu khách hàng và phục hồi uy tín thương hiệu.',
    tags: ['Communication', 'SCCT', 'UTS', 'Úc', 'DI 79'],
    rubricHighlights: [
      { criterion: 'SCCT Attribution & Cluster Analysis', score: '24/30' },
      { criterion: 'Stakeholder Mapping & Messaging', score: '24/30' },
      { criterion: '48-Hour Response Timeline', score: '16/20' },
      { criterion: 'APA 7th Style & Clarity', score: '15/20' },
    ],
    sections: [
      {
        heading: '1. Situational Crisis Communication Theory (SCCT) Framing',
        paragraphs: [
          'Under Coombs’s SCCT framework, a preventable cybersecurity breach triggered by unpatched internal servers falls within the severe intentional/preventable cluster, generating high stakeholder attribution of organizational responsibility. Defensive denial or diminishment strategies intensify reputational damage; immediate rebuild and corrective-action postures are mandatory within the first six hours.',
        ],
      },
    ],
    references: [
      'Coombs, W. T. (2022). Ongoing crisis communication: Planning, managing, and responding (6th ed.). SAGE Publications.',
      'Ulmer, R. R., Sellnow, T. L., & Seeger, M. W. (2022). Effective crisis communication: Moving from crisis to opportunity (5th ed.). SAGE Publications.',
    ],
  },
  {
    id: 'busm4192-change-management-digital-transformation-hd',
    title: 'Melbourne – Leading Organizational Change – BUSM4192 – Sample HD',
    courseCode: 'BUSM4192',
    discipline: 'Management & HR',
    institution: 'University of Melbourne',
    institutionShort: 'UNIMELB',
    country: 'Úc',
    level: 'Master / PhD',
    docType: 'Assignment / Essay',
    gradeScore: '86/100',
    gradeLabel: 'HD',
    wordCount: 2750,
    citationStyle: 'APA 7th',
    turnitinPercent: 3,
    aiPercent: 0,
    publishedDate: '21/01/2026',
    excerpt:
      'Kết hợp mô hình 8 bước Kotter và khung ADKAR để vượt qua sự kháng cự của nhân sự cấp trung trong quá trình chuyển đổi số hệ thống ERP.',
    tags: ['Change Management', 'Kotter', 'Melbourne', 'Master / PhD', 'HD 86'],
    rubricHighlights: [
      { criterion: 'Critical Comparison of Change Models', score: '27/30' },
      { criterion: 'Resistance Diagnosis & Stakeholder Power', score: '26/30' },
      { criterion: 'Implementation Roadmap & KPIs', score: '17/20' },
      { criterion: 'Scholarly Depth & APA 7th', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Diagnosing Middle-Management Resistance to ERP Rollouts',
        paragraphs: [
          'Enterprise resource planning transformations fail less frequently from software defects than from unaddressed shifts in decision authority and role identity among middle managers. While Kotter’s eight-stage macro model builds executive urgency, pairing it with Prosci’s individual-level ADKAR sequence bridges the gap between executive vision and frontline adoption.',
        ],
      },
    ],
    references: [
      'Hiatt, J. M. (2006). ADKAR: A model for change in business, government and our community. Prosci Learning Center Publications.',
      'Kotter, J. P. (2012). Leading change. Harvard Business Review Press.',
    ],
  },
  {
    id: 'buv-mkt204-luxury-brand-equity-vietnam-hd',
    title: 'BUV – Consumer Behaviour & Brand Equity – MKT204 – Sample HD',
    courseCode: 'MKT204',
    discipline: 'Marketing',
    institution: 'British University Vietnam (BUV)',
    institutionShort: 'BUV',
    country: 'Việt Nam',
    level: 'Bachelor',
    docType: 'Business Report',
    gradeScore: '81/100',
    gradeLabel: 'HD',
    wordCount: 2200,
    citationStyle: 'Harvard',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '14/01/2026',
    excerpt:
      'Ứng dụng mô hình tài sản thương hiệu dựa trên khách hàng (Keller CBBE Pyramid) cho ngành mỹ phẩm cao cấp tại thị trường Hà Nội và TP.HCM.',
    tags: ['CBBE', 'Marketing', 'BUV', 'Việt Nam', 'HD 81'],
    rubricHighlights: [
      { criterion: 'Keller CBBE Pyramid Application', score: '25/30' },
      { criterion: 'Cultural & Consumer Segment Analysis', score: '24/30' },
      { criterion: 'Brand Resonance Recommendations', score: '16/20' },
      { criterion: 'Harvard Referencing', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Building Brand Resonance via Keller’s CBBE Model',
        paragraphs: [
          'In emerging luxury skincare markets, brand salience alone rarely converts into long-term equity without credible functional performance and aspirational community imagery. Audit findings show strong top-of-mind awareness but a gap at the judgments-and-feelings tier due to inconsistent dermatologist endorsement.',
        ],
      },
    ],
    references: [
      'Keller, K.L. and Swaminathan, V. (2020) Strategic brand management: building, measuring, and managing brand equity. 5th edn. Harlow: Pearson.',
      'Solomon, M.R. (2023) Consumer behavior: buying, having, and being. 14th edn. Harlow: Pearson.',
    ],
  },
  {
    id: 'coventry-7012mhr-strategic-hrm-talent-retention-di',
    title: 'Coventry – Strategic Human Resource Management – 7012MHR – Sample DI',
    courseCode: '7012MHR',
    discipline: 'Management & HR',
    institution: 'Coventry University',
    institutionShort: 'COVENTRY',
    country: 'Anh',
    level: 'Master / PhD',
    docType: 'Assignment / Essay',
    gradeScore: '76/100',
    gradeLabel: 'DI',
    wordCount: 2550,
    citationStyle: 'Harvard',
    turnitinPercent: 5,
    aiPercent: 0,
    publishedDate: '06/01/2026',
    excerpt:
      'Phân tích mô hình AMO (Ability–Motivation–Opportunity) và chiến lược giữ chân nhân tài công nghệ cao tại các tập đoàn đa quốc gia.',
    tags: ['HRM', 'AMO Model', 'Coventry', 'UK', 'DI 76'],
    rubricHighlights: [
      { criterion: 'AMO Framework & SHRM Theory', score: '23/30' },
      { criterion: 'Empirical Case Evidence', score: '23/30' },
      { criterion: 'Reward & Career Architecture', score: '15/20' },
      { criterion: 'Harvard Citations', score: '15/20' },
    ],
    sections: [
      {
        heading: '1. Applying the AMO Framework to Tech Talent Retention',
        paragraphs: [
          'High voluntary turnover among senior software engineers reflects deficits in the Opportunity dimension of the AMO model—specifically limited autonomy and opaque technical career tracks—rather than base compensation alone.',
        ],
      },
    ],
    references: [
      'Armstrong, M. and Taylor, S. (2023) Armstrong’s handbook of human resource management practice. 16th edn. London: Kogan Page.',
      'Boxall, P. and Purcell, J. (2022) Strategy and human resource management. 5th edn. London: Bloomsbury Academic.',
    ],
  },
  {
    id: 'deakin-mmm240-international-business-entry-mode-hd',
    title: 'Deakin – International Business Strategy – MMM240 – Sample HD',
    courseCode: 'MMM240',
    discipline: 'Business & Strategy',
    institution: 'Deakin University',
    institutionShort: 'DEAKIN',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Business Report',
    gradeScore: '82/100',
    gradeLabel: 'HD',
    wordCount: 2120,
    citationStyle: 'Harvard',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '28/12/2025',
    excerpt:
      'Đánh giá khoảng cách thể chế CAGE Framework và mô hình Uppsala cho chiến lược thâm nhập thị trường năng lượng tái tạo châu Á - Thái Bình Dương.',
    tags: ['International Business', 'CAGE', 'Deakin', 'Úc', 'HD 82'],
    rubricHighlights: [
      { criterion: 'CAGE Distance & Institutional Analysis', score: '25/30' },
      { criterion: 'Entry Mode Selection & OLI Paradigm', score: '25/30' },
      { criterion: 'Risk Mitigation Plan', score: '16/20' },
      { criterion: 'Harvard Style & Structure', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. CAGE Distance & Dunning’s OLI Advantage Assessment',
        paragraphs: [
          'Evaluating host-country institutional distance via Ghemawat’s CAGE framework highlights administrative and regulatory tariff barriers as the primary determinants of entry mode. Pairing proprietary grid-storage technology (Ownership advantage) with local utility licensing partners mitigates administrative friction.',
        ],
      },
    ],
    references: [
      'Dunning, J.H. and Lundan, S.M. (2008) Multinational enterprises and the global economy. 2nd edn. Cheltenham: Edward Elgar.',
      'Ghemawat, P. (2001) ‘Distance still matters: the hard reality of global expansion’, Harvard Business Review, 79(8), pp. 137–147.',
    ],
  },
  {
    id: 'swinburne-inf30029-cloud-cybersecurity-risk-hd',
    title: 'Swinburne – Enterprise Cloud Security & ISO 27001 – INF30029 – Sample HD',
    courseCode: 'INF30029',
    discipline: 'IT & Data',
    institution: 'Swinburne University',
    institutionShort: 'SWIN',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Business Report',
    gradeScore: '84/100',
    gradeLabel: 'HD',
    wordCount: 2340,
    citationStyle: 'IEEE',
    turnitinPercent: 3,
    aiPercent: 0,
    publishedDate: '19/12/2025',
    excerpt:
      'Kiến trúc bảo mật Zero-Trust và đánh giá tuân thủ ISO/IEC 27001 cho hạ tầng đám mây lai (Hybrid Cloud) trong lĩnh vực y tế số.',
    tags: ['Cybersecurity', 'ISO 27001', 'Swinburne', 'IEEE', 'HD 84'],
    rubricHighlights: [
      { criterion: 'Threat Modelling (STRIDE)', score: '26/30' },
      { criterion: 'Zero-Trust & ISO 27001 Controls', score: '25/30' },
      { criterion: 'Incident Recovery Architecture', score: '17/20' },
      { criterion: 'Technical Clarity & IEEE Style', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Zero-Trust Architecture & STRIDE Threat Mitigation',
        paragraphs: [
          'Migrating electronic health records to multi-tenant cloud infrastructure exposes API gateways to lateral privilege escalation. Enforcing mutual TLS, attribute-based access control (ABAC), and continuous session attestation eliminates implicit network trust.',
        ],
      },
    ],
    references: [
      '[1] S. Rose, O. Borchert, S. Mitchell, and S. Connelly, "Zero Trust Architecture," NIST Special Publication 800-207, Aug. 2020.',
      '[2] ISO/IEC, "Information security, cybersecurity and privacy protection — Information security management systems — Requirements," ISO/IEC 27001:2022, Oct. 2022.',
    ],
  },
  {
    id: 'macquarie-acst2001-corporate-derivative-hedging-di',
    title: 'Macquarie – FX & Commodity Hedging Strategy – ACST2001 – Sample DI',
    courseCode: 'ACST2001',
    discipline: 'Finance & Accounting',
    institution: 'Macquarie University',
    institutionShort: 'MQ',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Case Study',
    gradeScore: '78/100',
    gradeLabel: 'DI',
    wordCount: 1960,
    citationStyle: 'Harvard',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '11/12/2025',
    excerpt:
      'Chiến lược phòng vệ rủi ro tỷ giá AUD/USD bằng quyền chọn tiền tệ (Currency Collar Options) và hợp đồng tương lai cho doanh nghiệp xuất nhập khẩu.',
    tags: ['Derivatives', 'FX Hedging', 'Macquarie', 'Úc', 'DI 78'],
    rubricHighlights: [
      { criterion: 'Transaction Exposure Quantification', score: '24/30' },
      { criterion: 'Forward vs Option Payoff Analysis', score: '23/30' },
      { criterion: 'Hedge Accounting Recommendation', score: '16/20' },
      { criterion: 'Harvard Citations', score: '15/20' },
    ],
    sections: [
      {
        heading: '1. Zero-Cost Collar vs. Outright Forward Hedge',
        paragraphs: [
          'Locking 60% of USD payables via forward contracts secures budget certainty, while structuring a zero-cost collar on the remaining 40% caps downside depreciation risk while preserving upside participation if the AUD strengthens within a 4-cent corridor.',
        ],
      },
    ],
    references: [
      'Hull, J.C. (2022) Options, futures, and other derivatives. 11th edn. Harlow: Pearson.',
      'Eiteman, D.K., Stonehill, A.I. and Moffett, M.H. (2022) Multinational business finance. 16th edn. Harlow: Pearson.',
    ],
  },
  {
    id: 'rmit-comm2621-digital-pr-brand-storytelling-hd',
    title: 'RMIT – Public Relations & Digital Storytelling – COMM2621 – Sample HD',
    courseCode: 'COMM2621',
    discipline: 'Professional Communication',
    institution: 'RMIT University',
    institutionShort: 'RMIT',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Assignment / Essay',
    gradeScore: '83/100',
    gradeLabel: 'HD',
    wordCount: 2040,
    citationStyle: 'Harvard',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '03/12/2025',
    excerpt:
      'Xây dựng chiến dịch quan hệ công chúng số dựa trên mô hình đối thoại hai chiều đối xứng của Grunig & Hunt và PESO Media Model.',
    tags: ['Public Relations', 'PESO Model', 'RMIT', 'Úc', 'HD 83'],
    rubricHighlights: [
      { criterion: 'Two-Way Symmetrical PR Theory', score: '25/30' },
      { criterion: 'PESO Media Integration', score: '25/30' },
      { criterion: 'Earned Media Pitch & Story Arc', score: '17/20' },
      { criterion: 'Harvard Style & Writing', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Integrating Earned and Shared Media via the PESO Framework',
        paragraphs: [
          'Modern public relations campaigns achieve credibility when owned thought-leadership assets anchor earned journalist coverage and community-led shared advocacy, moving beyond one-way press-agentry toward Grunig and Hunt’s two-way symmetrical dialogue.',
        ],
      },
    ],
    references: [
      'Dietrich, G. (2020) Spin sucks: communication and reputation management in the digital age. 2nd edn. Indianapolis: Que Publishing.',
      'Grunig, J.E. and Hunt, T. (1984) Managing public relations. New York: Holt, Rinehart and Winston.',
    ],
  },
  {
    id: 'monash-mGF5960-esg-corporate-governance-hd',
    title: 'Monash – ESG Strategy & Corporate Governance – MGF5960 – Sample HD',
    courseCode: 'MGF5960',
    discipline: 'Business & Strategy',
    institution: 'Monash University',
    institutionShort: 'MONASH',
    country: 'Úc',
    level: 'Master / PhD',
    docType: 'Literature Review',
    gradeScore: '85/100',
    gradeLabel: 'HD',
    wordCount: 2680,
    citationStyle: 'APA 7th',
    turnitinPercent: 3,
    aiPercent: 0,
    publishedDate: '25/11/2025',
    excerpt:
      'Tổng quan nghiên cứu về mối liên hệ giữa công bố thông tin ESG minh bạch, cấu trúc hội đồng quản trị độc lập và chi phí vốn doanh nghiệp.',
    tags: ['ESG', 'Corporate Governance', 'Monash', 'Master / PhD', 'HD 85'],
    rubricHighlights: [
      { criterion: 'Agency vs Stakeholder Theory Synthesis', score: '26/30' },
      { criterion: 'Empirical ESG-Cost of Capital Evidence', score: '26/30' },
      { criterion: 'Greenwashing & Assurance Critique', score: '17/20' },
      { criterion: 'APA 7th Rigour', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Stakeholder Theory and Cost-of-Capital Channels',
        paragraphs: [
          'Empirical meta-analyses demonstrate that third-party assured Scope 1–3 emissions disclosures reduce information asymmetry between corporate insiders and institutional lenders, lowering debt risk premia by an average of 25–40 basis points.',
        ],
      },
    ],
    references: [
      'Freeman, R. E., Harrison, J. S., Wicks, A. C., Parmar, B. L., & de Colle, S. (2010). Stakeholder theory: The state of the art. Cambridge University Press.',
      'Friede, G., Busch, T., & Bassen, A. (2015). ESG and financial performance: Aggregated evidence from more than 2000 empirical studies. Journal of Sustainable Finance & Investment, 5(4), 210–233.',
    ],
  },
  {
    id: 'swinburne-scm2001-circular-economy-packaging-di',
    title: 'Swinburne – Sustainable Operations & Circular Supply Chain – SCM2001 – Sample DI',
    courseCode: 'SCM2001',
    discipline: 'Logistics & Supply Chain',
    institution: 'Swinburne University',
    institutionShort: 'SWIN',
    country: 'Úc',
    level: 'Bachelor',
    docType: 'Business Report',
    gradeScore: '77/100',
    gradeLabel: 'DI',
    wordCount: 1950,
    citationStyle: 'Harvard',
    turnitinPercent: 5,
    aiPercent: 0,
    publishedDate: '17/11/2025',
    excerpt:
      'Thiết kế mô hình logistics ngược (Reverse Logistics) và bao bì tuần hoàn khép kín cho ngành hàng tiêu dùng nhanh (FMCG).',
    tags: ['Circular Economy', 'Reverse Logistics', 'Swinburne', 'DI 77'],
    rubricHighlights: [
      { criterion: 'Closed-Loop Lifecycle Assessment', score: '24/30' },
      { criterion: 'Reverse Collection Network Design', score: '23/30' },
      { criterion: 'Cost-Benefit & Carbon Reduction', score: '15/20' },
      { criterion: 'Harvard Citations', score: '15/20' },
    ],
    sections: [
      {
        heading: '1. Reverse Logistics Economics in FMCG Packaging',
        paragraphs: [
          'Transitioning from single-use PET bottles to standardized refillable glass and high-density polymer crates requires deposit-return incentives of at least $0.20 per unit to achieve the 78% return threshold where closed-loop washing undercuts virgin resin costs.',
        ],
      },
    ],
    references: [
      'Geissdoerfer, M., Savaget, P., Bocken, N.M.P. and Hultink, E.J. (2017) ‘The Circular Economy – a new sustainability paradigm?’, Journal of Cleaner Production, 143, pp. 757–768.',
      'Grant, D.B., Trautrims, A. and Wong, C.Y. (2023) Sustainable logistics and supply chain management. 3rd edn. London: Kogan Page.',
    ],
  },
  {
    id: 'uoft-psyc310-workplace-burnout-mindfulness-hd',
    title: 'Toronto – Occupational Health Psychology & Burnout – PSYC310 – Sample HD',
    courseCode: 'PSYC310',
    discipline: 'Psychology',
    institution: 'University of Toronto',
    institutionShort: 'UofT',
    country: 'Canada',
    level: 'Bachelor',
    docType: 'Critical Review',
    gradeScore: '84/100',
    gradeLabel: 'HD',
    wordCount: 2260,
    citationStyle: 'APA 7th',
    turnitinPercent: 3,
    aiPercent: 0,
    publishedDate: '08/11/2025',
    excerpt:
      'Đánh giá phản biện mô hình Job Demands-Resources (JD-R) của Bakker & Demerouti đối với hội chứng kiệt sức nghề nghiệp của nhân viên y tế.',
    tags: ['Psychology', 'JD-R Model', 'Toronto', 'Canada', 'HD 84'],
    rubricHighlights: [
      { criterion: 'JD-R Theoretical Critique', score: '26/30' },
      { criterion: 'Methodological Evaluation of Trials', score: '25/30' },
      { criterion: 'Organizational vs Individual Interventions', score: '17/20' },
      { criterion: 'APA 7th Precision', score: '16/20' },
    ],
    sections: [
      {
        heading: '1. Job Demands–Resources (JD-R) Buffering Hypothesis',
        paragraphs: [
          'Individual mindfulness programs yield only transient reductions in emotional exhaustion when structural job demands—such as chronic understaffing and 12-hour shift rotations—remain unaltered. Consistent with Bakker and Demerouti’s JD-R model, job resources buffer strain most effectively when paired with workload redesign.',
        ],
      },
    ],
    references: [
      'Bakker, A. B., & Demerouti, E. (2017). Job demands–resources theory: Taking stock and looking forward. Journal of Occupational Health Psychology, 22(3), 273–285.',
      'Maslach, C., Schaufeli, W. B., & Leiter, M. P. (2001). Job burnout. Annual Review of Psychology, 52(1), 397–422.',
    ],
  },
  {
    id: 'rmit-hosp1092-airline-service-recovery-di',
    title: 'RMIT – Service Quality & Airline Recovery Paradox – HOSP1092 – Sample DI',
    courseCode: 'HOSP1092',
    discipline: 'Hospitality & Tourism',
    institution: 'RMIT University',
    institutionShort: 'RMIT',
    country: 'Úc',
    level: 'Diploma',
    docType: 'Case Study',
    gradeScore: '76/100',
    gradeLabel: 'DI',
    wordCount: 1740,
    citationStyle: 'Harvard',
    turnitinPercent: 4,
    aiPercent: 0,
    publishedDate: '29/10/2025',
    excerpt:
      'Ứng dụng mô hình 5 khoảng cách chất lượng dịch vụ (SERVQUAL) và hiệu ứng nghịch lý phục hồi dịch vụ (Service Recovery Paradox) trong ngành hàng không.',
    tags: ['Hospitality', 'SERVQUAL', 'RMIT', 'Diploma', 'DI 76'],
    rubricHighlights: [
      { criterion: 'SERVQUAL Gap Diagnosis', score: '23/30' },
      { criterion: 'Justice Theory in Service Recovery', score: '23/30' },
      { criterion: 'Frontline Empowerment Protocol', score: '15/20' },
      { criterion: 'Harvard Referencing', score: '15/20' },
    ],
    sections: [
      {
        heading: '1. Procedural, Interactional, and Distributive Justice in Flight Delays',
        paragraphs: [
          'Passenger dissatisfaction during irregular airline operations stems primarily from Gap 4 communication failures rather than the mechanical delay itself. Proactive mobile rebooking paired with instant meal-voucher push notifications restores perceived procedural and distributive fairness.',
        ],
      },
    ],
    references: [
      'Parasuraman, A., Zeithaml, V.A. and Berry, L.L. (1988) ‘SERVQUAL: a multiple-item scale for measuring consumer perceptions of service quality’, Journal of Retailing, 64(1), pp. 12–40.',
      'Wirtz, J. and Lovelock, C. (2022) Services marketing: people, technology, strategy. 9th edn. Hackensack: World Scientific.',
    ],
  },
];
