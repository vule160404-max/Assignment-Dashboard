import { CitationStyle } from '../types/domain';
import {
  CoverPageTemplateId,
  FontFamilyOption,
  LineSpacingOption,
  TextAlignmentOption,
  WriterSession,
} from '../components/admin/writer/types';
import { extractInTextCitations, isReferencesSectionTitle } from './aiWriterClient';
import { countWords } from './wordHumanizer';

export interface CohortPoolSourceItem {
  doi: string;
  title: string;
  authors: Array<{ family: string; given?: string }>;
  year: number;
  containerTitle: string;
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
}

export interface CohortStructuralArchetype {
  id: string;
  label: string;
  shortTag: string;
  outlineDirectiveEn: string;
  outlineDirectiveVi: string;
  proseDirectiveEn: string;
  proseDirectiveVi: string;
  fontEn: FontFamilyOption;
  fontSizeEn: number;
  lineSpacingEn: LineSpacingOption;
  alignEn: TextAlignmentOption;
  coverTemplate: CoverPageTemplateId;
  wordJitterRatio: number;
}

export interface CohortMethodologyOption {
  id: string;
  label: string;
  shortTag: string;
  crossrefHint: string;
  outlineDirectiveEn: string;
  outlineDirectiveVi: string;
  proseDirectiveEn: string;
  proseDirectiveVi: string;
}

export const COHORT_METHODOLOGIES: CohortMethodologyOption[] = [
  {
    id: 'auto_by_lens',
    label: 'Theo đề gốc / Tự động theo Lăng kính',
    shortTag: 'Theo đề gốc',
    crossrefHint: '',
    outlineDirectiveEn:
      'Follow the exact methodological or analytical structure implied by the prompt while differentiating chapter titles and analytical sequencing via the assigned structural lens.',
    outlineDirectiveVi:
      'Bám sát cấu trúc đề bài gốc nhưng tổ chức lại tên mục và trình tự phân tích theo lăng kính đã chọn.',
    proseDirectiveEn:
      'Maintain natural disciplinary methodology alignment with varied paragraph transitions and distinct empirical framing.',
    proseDirectiveVi:
      'Giữ đúng mạch phương pháp của đề gốc nhưng đổi hoàn toàn cách dẫn chứng và triển khai lập luận.',
  },
  {
    id: 'qualitative_thematic',
    label: 'Định tính · Phỏng vấn sâu & Mã hóa Chủ đề (Thematic)',
    shortTag: 'Định tính Thematic',
    crossrefHint: 'qualitative thematic analysis semi-structured interview findings',
    outlineDirectiveEn:
      'Design an empirical QUALITATIVE research structure: include qualitative research philosophy (interpretivist), purposive semi-structured interview sampling, Braun & Clarke thematic coding steps, qualitative theme-by-theme findings, and trustworthiness discussion.',
    outlineDirectiveVi:
      'Thiết kế dàn ý theo hướng NGHIÊN CỨU ĐỊNH TÍNH: làm rõ phương pháp chọn mẫu có chủ đích, phỏng vấn bán cấu trúc, quy trình mã hóa chủ đề (Thematic Analysis), kết quả phân tích theo từng nhóm chủ đề (Themes) và tính tin cậy dữ liệu.',
    proseDirectiveEn:
      'Frame evidence qualitatively around lived experiences, managerial perceptions, contextual mechanisms, purposive sample depth, and thematic synthesis rather than survey regression statistics.',
    proseDirectiveVi:
      'Phân tích sâu cơ chế vận hành, nhận thức chủ thể, trích thuật quan điểm nhóm phỏng vấn và bóc tách từng chủ đề nghiên cứu thay vì dùng công thức hồi quy.',
  },
  {
    id: 'quantitative_survey',
    label: 'Định lượng · Khảo sát Likert & Hồi quy Thống kê (SPSS)',
    shortTag: 'Định lượng SPSS',
    crossrefHint: 'quantitative survey structural equation modeling regression reliability',
    outlineDirectiveEn:
      'Design an empirical QUANTITATIVE research structure: include explicit research hypotheses (H1–H4) or testable propositions, structured Likert-scale measurement items, sampling frame, reliability/validity & regression evaluation, and empirical hypothesis testing discussion.',
    outlineDirectiveVi:
      'Thiết kế dàn ý theo hướng NGHIÊN CỨU ĐỊNH LƯỢNG: xây dựng giả thuyết nghiên cứu (H1–H4), thang đo Likert chi tiết theo biến quan sát, phương pháp chọn mẫu định lượng, kiểm định độ tin cậy (Cronbach Alpha / hồi quy) và thảo luận bác bỏ/chấp nhận giả thuyết.',
    proseDirectiveEn:
      'Emphasize operationalized constructs, independent/dependent variable relationships, empirical effect directions, measurement validity, and statistical rigor in clear, direct prose.',
    proseDirectiveVi:
      'Nhấn mạnh mối quan hệ biến độc lập – biến phụ thuộc, thang đo lường, tính hợp lệ của mẫu khảo sát và giải thích ý nghĩa thực tiễn của từng giả thuyết.',
  },
  {
    id: 'comparative_case_study',
    label: 'Tình huống So sánh Đối chiếu (Multi-Case Study)',
    shortTag: 'So sánh Case Study',
    crossrefHint: 'comparative case study cross-case organizational analysis',
    outlineDirectiveEn:
      'Organize the outline as a COMPARATIVE MULTI-CASE STUDY: establish clear case-selection criteria comparing 2 contrasting real-world organizations/markets (e.g., high-performing benchmark vs. constrained adapter), conduct structured cross-case pattern matching, and derive transferable strategic lessons.',
    outlineDirectiveVi:
      'Tổ chức dàn ý dạng NGHIÊN CỨU TÌNH HUỐNG SO SÁNH (Multi-Case Study): nêu tiêu chí chọn ít nhất 2 doanh nghiệp/bối cảnh đối lập, phân tích từng trường hợp rồi lập ma trận đối chiếu chéo tìm điểm tương đồng và khác biệt cốt lõi.',
    proseDirectiveEn:
      'Anchor every middle section in explicit side-by-side cross-case comparisons, highlighting institutional contrasts, boundary conditions, and structural divergence between cases.',
    proseDirectiveVi:
      'Triển khai lập luận song song theo phép đối chiếu giữa các Case Study, chỉ rõ vì sao cùng một giải pháp lại thành công ở bối cảnh này nhưng gặp rào cản ở bối cảnh kia.',
  },
  {
    id: 'mixed_methods',
    label: 'Hỗn hợp · Định lượng + Định tính (Mixed-Methods)',
    shortTag: 'Mixed-Methods',
    crossrefHint: 'mixed methods explanatory sequential triangulation empirical',
    outlineDirectiveEn:
      'Design a MIXED-METHODS triangulation outline: structure methodology and analysis into two complementary phases (Phase 1 broad quantitative trend / survey benchmark + Phase 2 targeted qualitative explanation of why patterns occur) followed by integrated meta-inference synthesis.',
    outlineDirectiveVi:
      'Xây dựng dàn ý PHƯƠNG PHÁP HỖN HỢP (Mixed-Methods): tách rõ 2 pha bổ trợ (Pha 1 đo lường xu hướng định lượng tổng quát + Pha 2 giải thích cơ chế sâu bằng định tính) và chương tổng hợp đối chiếu chéo (Triangulation).',
    proseDirectiveEn:
      'Connect macro empirical patterns explicitly with micro qualitative mechanisms, showing where numerical findings and practitioner explanations reinforce or complicate one another.',
    proseDirectiveVi:
      'Kết nối chặt chẽ giữa bức tranh số liệu tổng quan ở Pha 1 với lý giải nguyên nhân bản chất ở Pha 2 để tạo chiều sâu học thuật.',
  },
  {
    id: 'systematic_literature_review',
    label: 'Tổng quan Hệ thống & Ma trận Khoảng trống (SLR / PRISMA)',
    shortTag: 'Systematic Review',
    crossrefHint: 'systematic literature review PRISMA synthesis research gaps',
    outlineDirectiveEn:
      'Design a SYSTEMATIC LITERATURE REVIEW (SLR) structure: include explicit search strings, database screening & inclusion/exclusion protocol (PRISMA logic), chronological/thematic taxonomy of reviewed studies, critical synthesis of methodological contradictions, and a future research agenda.',
    outlineDirectiveVi:
      'Thiết kế dàn ý TỔNG QUAN TÀI LIỆU CÓ HỆ THỐNG (SLR / PRISMA): quy trình tìm kiếm từ khóa và tiêu chí sàng lọc tài liệu, phân loại cụm chủ đề nghiên cứu theo thời gian/trường phái, bảng tổng hợp mâu thuẫn học thuật và khoảng trống nghiên cứu tương lai.',
    proseDirectiveEn:
      'Synthesize across multiple scholarly clusters rigorously, comparing study designs, geographic scopes, and conflicting findings across published articles without claiming fake primary data collection.',
    proseDirectiveVi:
      'Tổng hợp đối chiếu nhiều nhóm công trình đã công bố theo tiêu chí rõ ràng, làm nổi bật sự tiến hóa của học thuật và khoảng trống nghiên cứu.',
  },
  {
    id: 'secondary_empirical_data',
    label: 'Dữ liệu Thứ cấp · Số liệu Ngành / Tài chính / Vĩ mô',
    shortTag: 'Dữ liệu Thứ cấp',
    crossrefHint: 'secondary data industry report panel longitudinal empirical performance',
    outlineDirectiveEn:
      'Structure the paper as a SECONDARY EMPIRICAL ANALYSIS: rely strictly on verifiable published industry metrics, institutional/financial indicators, and longitudinal archival trends rather than primary interviews or self-administered surveys, followed by ratio/trend evaluation and policy/managerial implications.',
    outlineDirectiveVi:
      'Thiết kế dàn ý PHÂN TÍCH DỮ LIỆU THỨ CẤP: sử dụng báo cáo ngành, chỉ số tài chính/vĩ mô, dữ liệu công bố công khai qua nhiều năm (không tự bịa bảng khảo sát sơ cấp) để đánh giá biến động và đề xuất giải pháp quản trị.',
    proseDirectiveEn:
      'Focus tightly on verified macro/industry evidence, longitudinal shifts, cost-benefit structure, and institutional constraints grounded cleanly in cited reports and scholarly papers.',
    proseDirectiveVi:
      'Bám sát diễn biến số liệu ngành/tài chính theo giai đoạn, phân tích tương quan chi phí – hiệu quả và ràng buộc thực tiễn từ tài liệu công bố.',
  },
  {
    id: 'conceptual_critical_essay',
    label: 'Phân tích Lý thuyết Thuần & Phản biện Học thuật',
    shortTag: 'Lý thuyết & Phản biện',
    crossrefHint: 'theoretical framework critical conceptual review debate',
    outlineDirectiveEn:
      'Organize the outline as a CRITICAL CONCEPTUAL ESSAY: deconstruct core theoretical assumptions, contrast two or more competing scholarly schools directly, critique practical applicability limits across modern contexts, and formulate an integrated conceptual proposition.',
    outlineDirectiveVi:
      'Tổ chức dàn ý dạng TIỂU LUẬN LÝ THUYẾT & PHẢN BIỆN SÂU: giải cấu trúc các giả định lý thuyết gốc, đặt 2–3 trường phái học thuật đối lập lên bàn cân, phản biện giới hạn ứng dụng thực tế và đề xuất khung khái niệm tổng hợp.',
    proseDirectiveEn:
      'Prioritize conceptual precision, theoretical trade-offs, and persuasive critical reasoning built strictly around peer-reviewed arguments rather than empirical field-study mechanics.',
    proseDirectiveVi:
      'Ưu tiên độ sắc sảo của lập luận khái niệm, chỉ rõ ưu – nhược điểm từng học thuyết và điều kiện biên khi áp dụng vào bối cảnh đương đại.',
  },
];

export const COHORT_STRUCTURAL_ARCHETYPES: CohortStructuralArchetype[] = [
  {
    id: 'deductive_theoretical',
    label: 'Lăng kính Lý thuyết → Kiểm chứng Thực nghiệm',
    shortTag: 'Bản A · Deductive',
    outlineDirectiveEn:
      'Organize the paper deductively: open with conceptual definitions and theoretical foundations first, then test those propositions against empirical industry evidence, followed by operational trade-offs and targeted managerial actions. Coin specific, concrete noun-phrase headings (avoid generic boilerplate headings like "Literature Review" or "Main Body").',
    outlineDirectiveVi:
      'Tổ chức dàn ý theo hướng diễn dịch từ khung lý thuyết cốt lõi xuống đối chiếu dữ liệu thực tiễn, sau đó phân tích các đánh đổi vận hành và giải pháp trọng tâm. Đặt tiêu đề chương/mục cụ thể sát nội dung phân tích, tránh rập khuôn máy móc.',
    proseDirectiveEn:
      'Lead paragraphs with analytical claims anchored in narrative citations (e.g., "Author (Year) demonstrates that..."). Favor medium-to-crisp sentence cadence with concrete operational mechanisms.',
    proseDirectiveVi:
      'Mở đoạn bằng luận điểm phân tích trực diện gắn với trích dẫn tường thuật (VD: "Theo Nghiên cứu của X (Năm)..."), nhịp câu dứt khoát, tập trung phân tích cơ chế vận hành.',
    fontEn: 'Times New Roman',
    fontSizeEn: 12,
    lineSpacingEn: 2.0,
    alignEn: 'left',
    coverTemplate: 'academic_international',
    wordJitterRatio: 1.0,
  },
  {
    id: 'diagnostic_problem_led',
    label: 'Lăng kính Chẩn đoán Nút thắt & Hệ quả',
    shortTag: 'Bản B · Diagnostic',
    outlineDirectiveEn:
      'Structure the paper around problem diagnosis: frame the opening around practical market/organizational tensions, organize middle sections by root-cause diagnostic dimensions and empirical performance gaps, and conclude with a prioritized intervention matrix. Phrase all H1/H2 headings using diagnostic or causal terminology completely distinct from a textbook chapter list.',
    outlineDirectiveVi:
      'Xây dựng dàn ý theo hướng chẩn đoán vấn đề thực tiễn: đi từ mâu thuẫn/nút thắt hiện hữu, mổ xẻ nguyên nhân gốc rễ qua các chiều kích đánh giá, rồi đề xuất lộ trình can thiệp theo thứ tự ưu tiên.',
    proseDirectiveEn:
      'Open paragraphs with empirical observations or concrete tensions before synthesizing parenthetical citations at clause end (e.g., "... (Author, Year; Author, Year)"). Vary short punchy sentences against compound analytical clauses.',
    proseDirectiveVi:
      'Mở đoạn từ hiện tượng thực tế hoặc con số đối chứng rồi mới lồng trích dẫn cuối mệnh đề, kết hợp câu ngắn nhấn ý xen kẽ câu ghép phân tích nguyên nhân – hệ quả.',
    fontEn: 'Calibri',
    fontSizeEn: 11,
    lineSpacingEn: 1.5,
    alignEn: 'justify',
    coverTemplate: 'modern_executive',
    wordJitterRatio: 1.03,
  },
  {
    id: 'stakeholder_governance',
    label: 'Lăng kính Đa bên Liên quan & Quản trị Rủi ro',
    shortTag: 'Bản C · Stakeholder',
    outlineDirectiveEn:
      'Organize the outline through institutional, stakeholder, and risk-governance lenses: examine how internal actors, external regulators/customers, and resource constraints interact, followed by comparative evaluation and risk-adjusted implementation steps. Use active, domain-specific section titles.',
    outlineDirectiveVi:
      'Triển khai dàn ý theo góc nhìn các bên liên quan và quản trị rủi ro: phân tích sự tương tác giữa nội lực tổ chức, khách hàng/thị trường và rào cản nguồn lực trước khi đưa ra giải pháp kiểm soát.',
    proseDirectiveEn:
      'Emphasize comparative contrasts across stakeholder groups and organizational contexts. Mix synthesis citations across multiple scholars and ground every recommendation in a concrete boundary condition.',
    proseDirectiveVi:
      'Nhấn mạnh phép đối chiếu giữa các nhóm đối tượng và điều kiện áp dụng thực tế; tổng hợp chéo nhiều nguồn học thuật trong cùng lập luận một cách tự nhiên.',
    fontEn: 'Georgia',
    fontSizeEn: 11.5,
    lineSpacingEn: 1.5,
    alignEn: 'left',
    coverTemplate: 'academic_international',
    wordJitterRatio: 0.98,
  },
  {
    id: 'comparative_dialectical',
    label: 'Lăng kính Đối chứng Hai Chiều & Phản biện',
    shortTag: 'Bản D · Dialectical',
    outlineDirectiveEn:
      'Design a dialectical, critical-evaluation outline: structure body chapters around competing scholarly schools of thought, methodological limitations, and real-world boundary tests before synthesizing a contingent strategic pathway. Ensure zero generic single-word headings.',
    outlineDirectiveVi:
      'Thiết kế dàn ý theo lối phản biện đối chứng: đặt các luồng quan điểm học thuật cạnh nhau, chỉ rõ giới hạn áp dụng thực tế rồi mới tổng hợp hướng giải quyết phù hợp bối cảnh.',
    proseDirectiveEn:
      'Foreground critical tension and scope conditions (when a framework works vs. when it breaks down). Alternate evidence-first openings with methodological critique.',
    proseDirectiveVi:
      'Đặt trọng tâm vào phân tích giới hạn và điều kiện biên của từng giải pháp, tránh lối liệt kê một chiều, giọng văn điềm tĩnh khách quan.',
    fontEn: 'Cambria',
    fontSizeEn: 12,
    lineSpacingEn: 2.0,
    alignEn: 'justify',
    coverTemplate: 'modern_executive',
    wordJitterRatio: 1.04,
  },
  {
    id: 'value_chain_process',
    label: 'Lăng kính Chuỗi Giá trị & Tiến trình Vận hành',
    shortTag: 'Bản E · Process',
    outlineDirectiveEn:
      'Map the outline chronologically or along the operational value chain (upstream inputs/drivers → core transformation mechanisms → downstream outcomes & KPI measurement → capability building). Use crisp process-oriented headings.',
    outlineDirectiveVi:
      'Chia bố cục theo chuỗi giá trị hoặc tiến trình vận hành (đầu vào & động lực → cơ chế chuyển hóa cốt lõi → kết quả đầu ra & đo lường hiệu quả → kiện toàn năng lực).',
    proseDirectiveEn:
      'Focus on causal mechanisms, workflow linkages, and measurable indicators. Keep transitions direct and concrete without formulaic signposting.',
    proseDirectiveVi:
      'Tập trung làm rõ mối liên kết nhân quả giữa các khâu thực thi và chỉ tiêu đo lường cụ thể, chuyển ý tự nhiên không dùng khuôn sáo.',
    fontEn: 'Arial',
    fontSizeEn: 11,
    lineSpacingEn: 1.5,
    alignEn: 'left',
    coverTemplate: 'academic_international',
    wordJitterRatio: 0.97,
  },
  {
    id: 'capability_resource_view',
    label: 'Lăng kính Nguồn lực Nội tại & Thích ứng Dài hạn',
    shortTag: 'Bản F · Capability',
    outlineDirectiveEn:
      'Frame the outline around organizational capabilities, dynamic adaptation, and structural constraints: evaluate internal capability readiness, external environmental shifts, empirical case lessons, and staged capability upgrades.',
    outlineDirectiveVi:
      'Tổ chức dàn ý xoay quanh năng lực nội tại và khả năng thích ứng dài hạn trước biến động môi trường, kết hợp bài học thực nghiệm và lộ trình nâng cấp theo giai đoạn.',
    proseDirectiveEn:
      'Anchor arguments in resource allocation, organizational learning, and long-horizon sustainability. Use varied clause lengths and grounded examples.',
    proseDirectiveVi:
      'Lập luận xoay quanh bài toán phân bổ nguồn lực, tính khả thi tài chính – nhân sự và hiệu quả bền vững dài hạn.',
    fontEn: 'Times New Roman',
    fontSizeEn: 12,
    lineSpacingEn: 1.5,
    alignEn: 'justify',
    coverTemplate: 'classic_vn_thesis',
    wordJitterRatio: 1.02,
  },
];

const INSTITUTION_RX =
  /\b(?:university|faculty|ministry|department|institute|association|organization|organisation|center|centre|council|board|commission|committee|office|agency|bank|academy|foundation|society|world|united|national|international|who|oecd|unesco|unicef|imf)\b/i;

function cleanXmlEntities(raw?: string): string {
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

function normalizeAuthorEntry(a: {
  family?: string;
  given?: string;
  name?: string;
}): { family: string; given?: string } {
  const rawFamily = cleanXmlEntities(a.family || a.name || '');
  const rawGiven = cleanXmlEntities(a.given || '');
  if (rawGiven) return { family: rawFamily, given: rawGiven };
  const parts = rawFamily.split(/\s+/).filter(Boolean);
  if (parts.length === 2 && !INSTITUTION_RX.test(rawFamily)) {
    return { given: parts[0], family: parts[1] };
  }
  return { family: rawFamily };
}

function formatInitials(given?: string): string {
  if (!given) return '';
  return given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(' ');
}

export function formatPoolSourceInText(
  work: CohortPoolSourceItem,
  style: CitationStyle
): string {
  const fams = work.authors.map((a) => a.family).filter(Boolean);
  if (fams.length === 0) return `(${work.year})`;
  if (fams.length === 1) return `(${fams[0]}, ${work.year})`;
  if (fams.length === 2) {
    const conj = style === 'APA' ? '&' : 'and';
    return `(${fams[0]} ${conj} ${fams[1]}, ${work.year})`;
  }
  return `(${fams[0]} et al., ${work.year})`;
}

export function formatPoolSourceFullRef(
  work: CohortPoolSourceItem,
  style: CitationStyle
): string {
  const doiUrl = `https://doi.org/${work.doi}`;
  const authorStrings = work.authors.map((a) => {
    const init = formatInitials(a.given);
    return init ? `${a.family}, ${init}` : a.family;
  });

  let authorBlock = '';
  if (authorStrings.length === 1) {
    authorBlock = authorStrings[0];
  } else if (authorStrings.length === 2) {
    authorBlock =
      style === 'APA'
        ? `${authorStrings[0]}, & ${authorStrings[1]}`
        : `${authorStrings[0]} and ${authorStrings[1]}`;
  } else if (authorStrings.length > 2) {
    const head = authorStrings.slice(0, -1).join(', ');
    const last = authorStrings[authorStrings.length - 1];
    authorBlock = style === 'APA' ? `${head}, & ${last}` : `${head} and ${last}`;
  }

  const volIssue = work.volume
    ? work.issue
      ? `${work.volume}(${work.issue})`
      : work.volume
    : '';
  const pages = work.page ? `, ${work.page}` : '';

  if (style === 'Harvard') {
    return `${authorBlock} (${work.year}) '${work.title}', ${work.containerTitle}${
      volIssue ? `, ${volIssue}` : ''
    }${work.page ? `, pp. ${work.page}` : ''}. doi: ${work.doi}.`;
  }

  if (style === 'MLA') {
    const first = work.authors[0];
    const mlaAuthor =
      work.authors.length > 1
        ? `${first.family}, ${first.given || ''}, et al.`
        : `${first.family}, ${first.given || ''}.`;
    return `${mlaAuthor.replace(/\.\.$/, '.')} "${work.title}." ${
      work.containerTitle
    }${work.volume ? `, vol. ${work.volume}` : ''}${
      work.issue ? `, no. ${work.issue}` : ''
    }, ${work.year}${work.page ? `, pp. ${work.page}` : ''}, ${doiUrl}.`;
  }

  // APA 7 default
  return `${authorBlock} (${work.year}). ${work.title}. ${work.containerTitle}${
    volIssue ? `, ${volIssue}` : ''
  }${pages}. ${doiUrl}`;
}

async function queryCrossrefSlice(
  queryStr: string,
  rows: number,
  fromYear: number,
  signal?: AbortSignal
): Promise<CohortPoolSourceItem[]> {
  if (!queryStr.trim()) return [];
  const params = new URLSearchParams({
    'query.bibliographic': queryStr.trim().slice(0, 220),
    filter: `type:journal-article,from-pub-date:${fromYear}`,
    rows: String(rows),
    sort: 'relevance',
    select:
      'DOI,title,author,issued,published,container-title,volume,issue,page,publisher',
  });

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch(
      `https://api.crossref.org/works?${params.toString()}`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      message?: {
        items?: Array<{
          DOI?: string;
          title?: string[];
          author?: Array<{ family?: string; given?: string; name?: string }>;
          issued?: { 'date-parts'?: number[][] };
          published?: { 'date-parts'?: number[][] };
          'container-title'?: string[];
          volume?: string;
          issue?: string;
          page?: string;
          publisher?: string;
        }>;
      };
    };

    const parsed: CohortPoolSourceItem[] = [];
    for (const it of data?.message?.items || []) {
      const authors = (it.author || [])
        .map(normalizeAuthorEntry)
        .filter((a) => Boolean(a.family));
      const title = cleanXmlEntities(it.title?.[0]);
      const containerTitle = cleanXmlEntities(it['container-title']?.[0]);
      const year =
        it.issued?.['date-parts']?.[0]?.[0] ||
        it.published?.['date-parts']?.[0]?.[0] ||
        0;
      const doi = (it.DOI || '').trim();
      if (
        authors.length === 0 ||
        !title ||
        title.length < 15 ||
        !containerTitle ||
        !year ||
        year < 1995 ||
        !doi
      ) {
        continue;
      }
      parsed.push({
        doi,
        title,
        authors,
        year,
        containerTitle,
        volume: it.volume,
        issue: it.issue,
        page: it.page,
        publisher: it.publisher,
      });
    }
    return parsed;
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Fetches a rich Master Pool (30-45 real peer-reviewed CrossRef works) for a shared
 * class assignment so each classmate clone can randomly draw `K` (e.g. 15) sources
 * with natural, realistic classroom overlap rather than rigid artificial partitioning.
 */
export async function fetchCohortMasterCrossrefPool(
  baseSession: WriterSession,
  signal?: AbortSignal
): Promise<CohortPoolSourceItem[]> {
  const topic = (baseSession.topic || baseSession.title || '').trim();
  const subject = (baseSession.subject || '').trim();
  const extraKeywords = `${baseSession.instructions || ''} ${baseSession.rubricNotes || ''}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  const primaryQuery = `${topic} ${subject}`.trim();
  const secondaryQuery = extraKeywords
    ? `${subject} ${extraKeywords}`.trim()
    : `${topic} empirical framework analysis`.trim();

  const [batchA, batchB] = await Promise.all([
    queryCrossrefSlice(primaryQuery, 35, 2018, signal),
    queryCrossrefSlice(secondaryQuery, 28, 2016, signal),
  ]);

  const merged: CohortPoolSourceItem[] = [];
  const seenDois = new Set<string>();
  const seenAuthorYear = new Set<string>();

  for (const work of [...batchA, ...batchB]) {
    const doiKey = work.doi.toLowerCase();
    const firstFam = (work.authors[0]?.family || '').toLowerCase();
    const ayKey = `${firstFam}_${work.year}`;
    if (seenDois.has(doiKey) || seenAuthorYear.has(ayKey)) continue;
    seenDois.add(doiKey);
    // Avoid ambiguous same-surname-same-year collisions inside one bibliography
    seenAuthorYear.add(ayKey);
    merged.push(work);
    if (merged.length >= 45) break;
  }

  return merged;
}

function cryptoRandomShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  const randBuf = new Uint32Array(copy.length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randBuf);
  } else {
    for (let i = 0; i < copy.length; i++) {
      randBuf[i] = Math.floor(Math.random() * 0xffffffff);
    }
  }
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randBuf[i] % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Fetches supplementary targeted CrossRef works for a student's specific sub-topic,
 * case focus, theoretical framework, or methodology, then blends + randomly draws
 * `sourcesPerPaper` (e.g. 15) sources from `[targeted + masterPool]` cleanly.
 */
export async function fetchCohortTargetedCrossrefCache(
  slots: Array<{
    customTopic?: string;
    customCaseFocus?: string;
    customFramework?: string;
    methodologyId?: string;
  }>,
  baseSubject: string,
  signal?: AbortSignal
): Promise<Map<string, CohortPoolSourceItem[]>> {
  const queryMap = new Map<string, string>();
  for (const slot of slots) {
    const methodObj = COHORT_METHODOLOGIES.find(
      (m) => m.id === slot.methodologyId
    );
    const pieces = [
      (slot.customTopic || '').trim(),
      (slot.customFramework || '').trim(),
      (slot.customCaseFocus || '').trim(),
      (methodObj?.crossrefHint || '').trim(),
    ].filter(Boolean);
    if (pieces.length === 0) continue;
    const rawQuery = `${pieces.join(' ')} ${baseSubject || ''}`
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);
    const key = rawQuery.toLowerCase();
    if (!queryMap.has(key)) {
      queryMap.set(key, rawQuery);
    }
  }

  const resultsCache = new Map<string, CohortPoolSourceItem[]>();
  if (queryMap.size === 0) return resultsCache;

  const entries = Array.from(queryMap.entries()).slice(0, 8);
  await Promise.all(
    entries.map(async ([key, q]) => {
      const works = await queryCrossrefSlice(q, 16, 2017, signal);
      resultsCache.set(key, works);
    })
  );
  return resultsCache;
}

export function buildSlotQueryCacheKey(
  slot: {
    customTopic?: string;
    customCaseFocus?: string;
    customFramework?: string;
    methodologyId?: string;
  },
  baseSubject: string
): string {
  const methodObj = COHORT_METHODOLOGIES.find(
    (m) => m.id === slot.methodologyId
  );
  const pieces = [
    (slot.customTopic || '').trim(),
    (slot.customFramework || '').trim(),
    (slot.customCaseFocus || '').trim(),
    (methodObj?.crossrefHint || '').trim(),
  ].filter(Boolean);
  if (pieces.length === 0) return '';
  return `${pieces.join(' ')} ${baseSubject || ''}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
    .toLowerCase();
}

/**
 * Randomly draws `sourcesPerPaper` (e.g. 15) sources from `[targetedPool + masterPool]`
 * in a freshly shuffled order for one student's paper.
 */
export function buildRandomSampledDossierForClone(
  masterPool: CohortPoolSourceItem[],
  citationStyle: CitationStyle,
  sourcesPerPaper: number,
  sharedWebAppendix = '',
  targetedPool: CohortPoolSourceItem[] = []
): { dossier: string; sampledCount: number } {
  const safeTarget = Math.max(5, Math.min(30, sourcesPerPaper || 15));

  // Deduplicate targeted works vs master pool by DOI and Author+Year
  const seenDois = new Set<string>();
  const seenAuthorYear = new Set<string>();
  const cleanTargeted: CohortPoolSourceItem[] = [];
  const cleanMaster: CohortPoolSourceItem[] = [];

  for (const w of targetedPool) {
    const dk = w.doi.toLowerCase();
    const ay = `${(w.authors[0]?.family || '').toLowerCase()}_${w.year}`;
    if (seenDois.has(dk) || seenAuthorYear.has(ay)) continue;
    seenDois.add(dk);
    seenAuthorYear.add(ay);
    cleanTargeted.push(w);
  }

  for (const w of masterPool) {
    const dk = w.doi.toLowerCase();
    const ay = `${(w.authors[0]?.family || '').toLowerCase()}_${w.year}`;
    if (seenDois.has(dk) || seenAuthorYear.has(ay)) continue;
    seenDois.add(dk);
    seenAuthorYear.add(ay);
    cleanMaster.push(w);
  }

  // Blend targeted works (~40-60% of quota when present) + randomly drawn core course works
  let sampled: CohortPoolSourceItem[];
  if (cleanTargeted.length > 0) {
    const targetedQuota = Math.min(
      cleanTargeted.length,
      Math.max(4, Math.ceil(safeTarget * 0.5))
    );
    const pickedTargeted = cryptoRandomShuffle(cleanTargeted).slice(
      0,
      targetedQuota
    );
    const remainingQuota = Math.max(0, safeTarget - pickedTargeted.length);
    const pickedMaster = cryptoRandomShuffle(cleanMaster).slice(
      0,
      remainingQuota
    );
    sampled = cryptoRandomShuffle([...pickedTargeted, ...pickedMaster]).slice(
      0,
      safeTarget
    );
  } else {
    sampled = cryptoRandomShuffle(cleanMaster).slice(0, safeTarget);
  }

  const crossrefBlock =
    sampled.length > 0
      ? `=== VERIFIED CROSSREF ACADEMIC SOURCES (RANDOMLY SAMPLED FOR THIS STUDENT: ${sampled.length} REAL PEER-REVIEWED WORKS — COMPLETE AUTHOR, YEAR, TITLE, JOURNAL, DOI) ===\n` +
        sampled
          .map((w, idx) => {
            const inText = formatPoolSourceInText(w, citationStyle);
            const fullRef = formatPoolSourceFullRef(w, citationStyle);
            return `[S${idx + 1}] In-Text: ${inText}\n    Full ${sessionCitationSafe(citationStyle)}: ${fullRef}`;
          })
          .join('\n')
      : '';

  const combined = [crossrefBlock, sharedWebAppendix.trim()]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return {
    dossier: combined,
    sampledCount: sampled.length,
  };
}

function sessionCitationSafe(style: CitationStyle): string {
  return style || 'APA';
}

/**
 * Builds the comprehensive differentiation & anti-cross-similarity instruction block
 * injected into BOTH Outline Generation and Section Prose Writing for Cohort Clones.
 */
export function buildCohortAntiSimilarityPromptBlock(
  session: WriterSession,
  mode: 'outline' | 'body'
): string {
  const meta = session.cohortMeta;
  if (!meta) return '';

  const archetype =
    COHORT_STRUCTURAL_ARCHETYPES.find((a) => a.id === meta.archetypeId) ||
    COHORT_STRUCTURAL_ARCHETYPES[
      (Math.max(1, meta.cloneIndex) - 1) % COHORT_STRUCTURAL_ARCHETYPES.length
    ];

  const methodology =
    COHORT_METHODOLOGIES.find((m) => m.id === meta.methodologyId) ||
    COHORT_METHODOLOGIES[0];

  const isVi = session.writingLanguage === 'Vietnamese';
  const focusParts: string[] = [];

  if (meta.customTopic?.trim()) {
    focusParts.push(
      isVi
        ? `- ĐỀ TÀI / NHÁNH CHỦ ĐỀ ĐỘC QUYỀN CỦA BẢN NÀY: "${meta.customTopic.trim()}"`
        : `- STUDENT'S SPECIFIC SUB-TOPIC / RESEARCH ANGLE: "${meta.customTopic.trim()}"`
    );
  }
  if (meta.customFramework?.trim()) {
    focusParts.push(
      isVi
        ? `- MÔ HÌNH / KHUNG LÝ THUYẾT BẮT BUỘC: Vận dụng trực tiếp "${meta.customFramework.trim()}" làm trục phân tích.`
        : `- ASSIGNED THEORETICAL MODEL / FRAMEWORK: Explicitly ground analysis in "${meta.customFramework.trim()}".`
    );
  }
  if (meta.customCaseFocus?.trim()) {
    focusParts.push(
      isVi
        ? `- TÌNH HUỐNG / DOANH NGHIỆP / BỐI CẢNH MINH HỌA: "${meta.customCaseFocus.trim()}" làm minh chứng chủ đạo xuyên suốt bài.`
        : `- EMPIRICAL CASE / INDUSTRY / SAMPLE CONTEXT: Anchor applied illustrations specifically around "${meta.customCaseFocus.trim()}".`
    );
  } else {
    focusParts.push(
      isVi
        ? `- PHÂN NHÁNH VÍ DỤ ĐỘC LẬP (Bản #${meta.cloneIndex}/${meta.cohortSize}): Không chọn ví dụ doanh nghiệp đầu bảng quá phổ biến mà các bạn cùng lớp hay lấy giống nhau; hãy chọn bối cảnh/ví dụ minh họa đặc thù riêng.`
        : `- INDEPENDENT EMPIRICAL ILLUSTRATION (Student Paper #${meta.cloneIndex} of ${meta.cohortSize}): Avoid cliché default textbook company examples when the brief allows open choices; select distinct real-world examples.`
    );
  }
  if (meta.customInstructions?.trim()) {
    focusParts.push(
      isVi
        ? `- YÊU CẦU BỔ SUNG RIÊNG CHO BÀI NÀY: ${meta.customInstructions.trim()}`
        : `- INDIVIDUAL STUDENT BRIEF CONSTRAINTS: ${meta.customInstructions.trim()}`
    );
  }

  if (isVi) {
    return `\n\n=== CHẾ ĐỘ ĐA HÌNH CÙNG LỚP — BÀI #${meta.cloneIndex}/${meta.cohortSize} (${methodology.shortTag} · ${archetype.label}) ===
Bài này thuộc nhóm ${meta.cohortSize} sinh viên học CÙNG MỘT HỌC PHẦN nộp chung hệ thống kiểm tra chéo. Danh mục trích dẫn có thể giao thoa tự nhiên từ bể nguồn chung, NHƯNG PHƯƠNG PHÁP, CHỦ ĐỀ TIẾP CẬN, TÊN ĐỀ MỤC VÀ CÂU CHỮ THÂN BÀI PHẢI ĐỘC LẬP HOÀN TOÀN (KHÔNG TRÙNG CỤM >= 5 TỪ):
1. PHƯƠNG PHÁP NGHIÊN CỨU & PHÂN TÍCH RIÊNG (${methodology.label}): ${
      mode === 'outline' ? methodology.outlineDirectiveVi : methodology.proseDirectiveVi
    }
2. LĂNG KÍNH BỐ CỤC DÀN Ý RIÊNG (${archetype.label}): ${
      mode === 'outline' ? archetype.outlineDirectiveVi : archetype.proseDirectiveVi
    }
3. CẤM SAO CHÉP NGUYÊN VĂN CÂU ĐỀ BÀI: Tuyệt đối không lặp lại nguyên xi câu hỏi đề bài hay tiêu chí Rubric dài quá 4 từ liên tiếp làm tiêu đề mục hoặc câu mở đoạn.
${focusParts.join('\n')}
5. TÍCH HỢP NGUỒN NGẪU NHIÊN: Sử dụng linh hoạt khoảng ${meta.sampledSourceCount} nguồn đã cấp ([S1]..[S${meta.sampledSourceCount}]), không liệt kê máy móc theo đúng thứ tự đánh số.`;
  }

  return `\n\n=== SAME-CLASS COHORT DIFFERENTIATION & ANTI-SIMILARITY ENGINE (PAPER #${meta.cloneIndex} OF ${meta.cohortSize} · ${methodology.shortTag} · ${archetype.shortTag}) ===
CRITICAL CONTEXT: ${meta.cohortSize} students in the SAME class are submitting papers for this shared course brief. Natural overlap in foundational references is completely acceptable, BUT METHODOLOGY, ANALYTICAL ANGLE, SECTION HEADINGS, AND BODY PROSE MUST HAVE ZERO CONTIGUOUS PHRASE OVERLAP (>= 5 WORDS):
1. ASSIGNED RESEARCH METHODOLOGY (${methodology.label}): ${
    mode === 'outline' ? methodology.outlineDirectiveEn : methodology.proseDirectiveEn
  }
2. ASSIGNED STRUCTURAL & RHETORICAL LENS (${archetype.shortTag}): ${
    mode === 'outline' ? archetype.outlineDirectiveEn : archetype.proseDirectiveEn
  }
3. NEVER PARROT PROMPT OR RUBRIC PHRASING: Never copy 5+ consecutive words verbatim from the assignment brief or rubric descriptors into your headings or topic sentences.
${focusParts.join('\n')}
5. NATURAL RANDOMIZED SOURCE INTEGRATION: Weave sources organically from this paper's sampled bibliography pack ([S1]..[S${meta.sampledSourceCount}]), varying citation placement and synthesis style.`;
}

// ---------------------------------------------------------------------------
// Fast Client-Side Pairwise Turnitin Cross-Student Shingle Similarity Scanner
// ---------------------------------------------------------------------------

export interface CohortCollisionSnippet {
  sectionIdA: string;
  sectionTitleA: string;
  sentenceA: string;
  sectionIdB: string;
  sectionTitleB: string;
  sentenceB: string;
  sharedPhrase: string;
  sharedWordCount: number;
}

export interface CohortPairSimilarity {
  sessionIdA: string;
  titleA: string;
  sessionIdB: string;
  titleB: string;
  /** Turnitin-style 5-word contiguous body shingle overlap % (excludes References) */
  bodySimilarityPercent: number;
  status: 'safe' | 'caution' | 'danger';
  sharedCitationCount: number;
  totalCitationsA: number;
  totalCitationsB: number;
  collisions: CohortCollisionSnippet[];
}

export interface CohortSimilarityMatrixReport {
  computedAt: string;
  sessionCount: number;
  maxSimilarityPercent: number;
  avgSimilarityPercent: number;
  pairs: CohortPairSimilarity[];
}

interface IndexedSentence {
  sectionId: string;
  sectionTitle: string;
  raw: string;
  tokens: string[];
}

function tokenizeNormalizedWords(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/\[figure:\s*[^\]]+\]/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function extractBodySentencesForSession(session: WriterSession): IndexedSentence[] {
  const out: IndexedSentence[] = [];
  for (const sec of session.outline || []) {
    if (isReferencesSectionTitle(sec.title)) continue;
    const rawContent = (sec.content || '').trim();
    if (!rawContent) continue;
    const rawSentences = rawContent
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 28);
    for (const s of rawSentences) {
      const tokens = tokenizeNormalizedWords(s);
      if (tokens.length >= 6) {
        out.push({
          sectionId: sec.id,
          sectionTitle: sec.title,
          raw: s,
          tokens,
        });
      }
    }
  }
  return out;
}

function buildShingleSet(
  sentences: IndexedSentence[],
  shingleSize: number,
  ignoredShingles: Set<string>
): { allShingles: Set<string>; totalWordCount: number } {
  const allShingles = new Set<string>();
  let totalWordCount = 0;
  for (const sent of sentences) {
    totalWordCount += sent.tokens.length;
    for (let i = 0; i <= sent.tokens.length - shingleSize; i++) {
      const sh = sent.tokens.slice(i, i + shingleSize).join(' ');
      if (!ignoredShingles.has(sh)) {
        allShingles.add(sh);
      }
    }
  }
  return { allShingles, totalWordCount };
}

function findLongestCommonContiguousPhrase(
  tokensA: string[],
  tokensB: string[],
  ignoredShingles: Set<string>
): { phrase: string; length: number } {
  const minLen = 5;
  if (tokensA.length < minLen || tokensB.length < minLen) {
    return { phrase: '', length: 0 };
  }

  let bestLen = 0;
  let bestStartA = 0;

  // Compact DP over word indices for two single sentences
  const prev = new Uint16Array(tokensB.length + 1);
  const curr = new Uint16Array(tokensB.length + 1);

  for (let i = 1; i <= tokensA.length; i++) {
    for (let j = 1; j <= tokensB.length; j++) {
      if (tokensA[i - 1] === tokensB[j - 1]) {
        const len = prev[j - 1] + 1;
        curr[j] = len;
        if (len >= minLen && len > bestLen) {
          const candidate5 = tokensA.slice(i - minLen, i).join(' ');
          if (!ignoredShingles.has(candidate5)) {
            bestLen = len;
            bestStartA = i - len;
          }
        }
      } else {
        curr[j] = 0;
      }
    }
    prev.set(curr);
    curr.fill(0);
  }

  if (bestLen < minLen) return { phrase: '', length: 0 };
  return {
    phrase: tokensA.slice(bestStartA, bestStartA + bestLen).join(' '),
    length: bestLen,
  };
}

/**
 * Computes Turnitin-style pairwise contiguous 5-word body similarity across all
 * drafted papers in a cohort (excluding References, while also reporting shared
 * citation counts separately for transparency).
 */
export function computeCohortSimilarityReport(
  sessions: WriterSession[]
): CohortSimilarityMatrixReport {
  const drafted = sessions.filter((s) =>
    s.outline.some(
      (sec) => !isReferencesSectionTitle(sec.title) && countWords(sec.content) >= 40
    )
  );

  // Build ignored shingle set from the assignment prompt topic/subject so legitimate
  // mentions of the assigned course title aren't falsely flagged
  const ignoredShingles = new Set<string>();
  for (const s of drafted) {
    const topicTokens = tokenizeNormalizedWords(`${s.topic} ${s.subject}`);
    for (let i = 0; i <= topicTokens.length - 5; i++) {
      ignoredShingles.add(topicTokens.slice(i, i + 5).join(' '));
    }
  }

  const prepared = drafted.map((s) => {
    const sentences = extractBodySentencesForSession(s);
    const { allShingles, totalWordCount } = buildShingleSet(
      sentences,
      5,
      ignoredShingles
    );
    const bodyText = s.outline
      .filter((sec) => !isReferencesSectionTitle(sec.title))
      .map((sec) => sec.content)
      .join('\n');
    const cits = extractInTextCitations(bodyText).map((c) =>
      c.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    return {
      session: s,
      sentences,
      shingles: allShingles,
      totalWordCount: Math.max(1, totalWordCount),
      citationSet: new Set(cits),
    };
  });

  const pairs: CohortPairSimilarity[] = [];

  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const A = prepared[i];
      const B = prepared[j];

      // Count matched words covered by shared 5-word shingles in A & B
      const sharedShingles = new Set<string>();
      A.shingles.forEach((sh) => {
        if (B.shingles.has(sh)) sharedShingles.add(sh);
      });

      let matchedTokenPositionsA = 0;
      if (sharedShingles.size > 0) {
        for (const sent of A.sentences) {
          const hitFlags = new Uint8Array(sent.tokens.length);
          for (let k = 0; k <= sent.tokens.length - 5; k++) {
            const sh = sent.tokens.slice(k, k + 5).join(' ');
            if (sharedShingles.has(sh)) {
              for (let m = k; m < k + 5; m++) hitFlags[m] = 1;
            }
          }
          for (let m = 0; m < hitFlags.length; m++) {
            if (hitFlags[m]) matchedTokenPositionsA++;
          }
        }
      }

      const rawPct = (matchedTokenPositionsA / A.totalWordCount) * 100;
      const bodySimilarityPercent = Math.min(
        100,
        Math.round(rawPct * 10) / 10
      );

      // Extract top colliding sentence pairs if sharedShingles > 0
      const collisions: CohortCollisionSnippet[] = [];
      if (sharedShingles.size > 0) {
        const seenSentA = new Set<string>();
        for (const sentA of A.sentences) {
          let hasHit = false;
          for (let k = 0; k <= sentA.tokens.length - 5; k++) {
            if (sharedShingles.has(sentA.tokens.slice(k, k + 5).join(' '))) {
              hasHit = true;
              break;
            }
          }
          if (!hasHit) continue;

          for (const sentB of B.sentences) {
            const common = findLongestCommonContiguousPhrase(
              sentA.tokens,
              sentB.tokens,
              ignoredShingles
            );
            if (common.length >= 5) {
              const keyA = `${sentA.sectionId}:${sentA.raw.slice(0, 60)}`;
              if (!seenSentA.has(keyA)) {
                seenSentA.add(keyA);
                collisions.push({
                  sectionIdA: sentA.sectionId,
                  sectionTitleA: sentA.sectionTitle,
                  sentenceA: sentA.raw,
                  sectionIdB: sentB.sectionId,
                  sectionTitleB: sentB.sectionTitle,
                  sentenceB: sentB.raw,
                  sharedPhrase: common.phrase,
                  sharedWordCount: common.length,
                });
              }
              break;
            }
          }
          if (collisions.length >= 12) break;
        }
        collisions.sort((x, y) => y.sharedWordCount - x.sharedWordCount);
      }

      let sharedCitationCount = 0;
      A.citationSet.forEach((c) => {
        if (B.citationSet.has(c)) sharedCitationCount++;
      });

      const status: CohortPairSimilarity['status'] =
        bodySimilarityPercent >= 8
          ? 'danger'
          : bodySimilarityPercent >= 3
          ? 'caution'
          : 'safe';

      pairs.push({
        sessionIdA: A.session.id,
        titleA: A.session.linkedOrderCode
          ? `#${A.session.linkedOrderCode} · ${A.session.title}`
          : A.session.title,
        sessionIdB: B.session.id,
        titleB: B.session.linkedOrderCode
          ? `#${B.session.linkedOrderCode} · ${B.session.title}`
          : B.session.title,
        bodySimilarityPercent,
        status,
        sharedCitationCount,
        totalCitationsA: A.citationSet.size,
        totalCitationsB: B.citationSet.size,
        collisions,
      });
    }
  }

  pairs.sort((a, b) => b.bodySimilarityPercent - a.bodySimilarityPercent);

  const maxSimilarityPercent =
    pairs.length > 0 ? pairs[0].bodySimilarityPercent : 0;
  const avgSimilarityPercent =
    pairs.length > 0
      ? Math.round(
          (pairs.reduce((acc, p) => acc + p.bodySimilarityPercent, 0) /
            pairs.length) *
            10
        ) / 10
      : 0;

  return {
    computedAt: new Date().toLocaleTimeString('vi-VN'),
    sessionCount: drafted.length,
    maxSimilarityPercent,
    avgSimilarityPercent,
    pairs,
  };
}
