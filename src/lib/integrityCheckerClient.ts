import {
  analyzeDocumentIntegrity,
  type AnalyzedSentence,
  type DetectedAiPhrase,
  type IntegrityAnalysisReport,
  type IntegrityCheckOptions,
  type MatchedSourceItem,
} from '../../server/integrityAnalyzer';

export type {
  AnalyzedSentence,
  DetectedAiPhrase,
  IntegrityAnalysisReport,
  IntegrityCheckOptions,
  MatchedSourceItem,
};

export const SAMPLE_ACADEMIC_TEXT = `Financial inclusion plays a pivotal role in fostering sustainable economic development across emerging Southeast Asian economies. In today's rapidly evolving financial landscape, digital banking services and mobile payment platforms have become a testament to technological transformation in rural areas. Moreover, empirical evidence suggests that expanding access to formal credit significantly reduces household vulnerability to income shocks (Demirgüç-Kunt et al., 2022). Additionally, it is crucial to note that regulatory frameworks established by central banks underscore the importance of consumer protection alongside fintech innovation.

However, adoption gaps remain stubbornly uneven across provinces. In northern Vietnam, smallholder households still face collateral constraints, high informal borrowing rates, and patchy smartphone literacy. Field surveys from 2023 show that while urban merchants settle over 60% of daily invoices via QR transfers, rural agricultural cooperatives rely heavily on cash advances from local aggregators.

Digital financial literacy is not merely technical familiarity; it encompasses risk evaluation, fee transparency, and long-term savings discipline. Furthermore, strengthening collaboration between commercial banks, microfinance institutions, and provincial authorities creates a comprehensive framework for inclusive credit expansion. Without targeted training programs at the commune level, digital banking tools risk widening rather than closing regional inequality gaps.

References
Demirgüç-Kunt, A., Klapper, L., Singer, D., & Ansar, S. (2022). The Global Findex Database 2021: Financial inclusion, digital payments, and resilience in the age of COVID-19. World Bank Group.`;

export async function runIntegrityCheck(params: {
  text: string;
  title?: string;
  excludeReferences?: boolean;
  excludeQuotes?: boolean;
}): Promise<IntegrityAnalysisReport> {
  try {
    const resp = await fetch('/api/check/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const rawText = await resp.text().catch(() => '');
    let parsed: (IntegrityAnalysisReport & { error?: string }) | null = null;
    try {
      parsed = JSON.parse(rawText) as IntegrityAnalysisReport & { error?: string };
    } catch {
      // non-json response
    }

    if (resp.ok && parsed && Array.isArray(parsed.sentences)) {
      return parsed;
    }

    // If serverless endpoint fails (e.g. 500/502/504/404), execute directly in browser via CORS-enabled scholarly APIs
    if (resp.status >= 500 || resp.status === 404 || !parsed) {
      return await analyzeDocumentIntegrity(params.text, {
        title: params.title,
        excludeReferences: params.excludeReferences,
        excludeQuotes: params.excludeQuotes,
      });
    }

    throw new Error(
      parsed.error || `Không thể phân tích tài liệu (HTTP ${resp.status}).`
    );
  } catch (err) {
    if (err instanceof TypeError) {
      return await analyzeDocumentIntegrity(params.text, {
        title: params.title,
        excludeReferences: params.excludeReferences,
        excludeQuotes: params.excludeQuotes,
      });
    }
    throw err;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function openPrintableIntegrityReport(
  report: IntegrityAnalysisReport
): boolean {
  const win = window.open('', '_blank', 'width=960,height=800');
  if (!win) return false;

  const paragraphsMap = new Map<number, AnalyzedSentence[]>();
  for (const s of report.sentences) {
    const list = paragraphsMap.get(s.paragraphIndex) || [];
    list.push(s);
    paragraphsMap.set(s.paragraphIndex, list);
  }

  const sourceColorMap = new Map<number, string>(
    report.sources.map((src) => [src.id, src.badgeColor])
  );

  const paragraphsHtml = Array.from(paragraphsMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, sents]) => {
      const spans = sents
        .map((s) => {
          if (s.isExcludedReference || s.isExcludedQuote) {
            return `<span style="color:#71717a;font-style:italic;">${escapeHtml(
              s.text
            )}</span>`;
          }
          if (s.matchedSourceId !== null) {
            const color = sourceColorMap.get(s.matchedSourceId) || '#DC2626';
            return `<span style="background:${color}18;border-bottom:2px solid ${color};padding:1px 2px;border-radius:3px;"><sup style="background:${color};color:#fff;font-size:9px;font-weight:700;padding:0 4px;border-radius:3px;margin-right:3px;">${s.matchedSourceId}</sup>${escapeHtml(
              s.text
            )}</span>`;
          }
          if (s.aiLevel === 'ai_high') {
            return `<span style="background:#fef3c7;border-bottom:2px solid #d97706;padding:1px 2px;border-radius:3px;">${escapeHtml(
              s.text
            )}</span>`;
          }
          if (s.aiLevel === 'mixed') {
            return `<span style="background:#ede9fe;padding:1px 2px;border-radius:3px;">${escapeHtml(
              s.text
            )}</span>`;
          }
          return escapeHtml(s.text);
        })
        .join(' ');
      return `<p style="margin:0 0 12px 0;line-height:1.7;font-size:13px;color:#0f172a;">${spans}</p>`;
    })
    .join('');

  const sourcesRows =
    report.sources.length > 0
      ? report.sources
          .map(
            (src) => `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e4e7;">
              <span style="display:inline-block;background:${src.badgeColor};color:#fff;font-weight:700;font-size:11px;padding:2px 6px;border-radius:4px;">${src.id}</span>
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e4e7;">
              <div style="font-weight:600;color:#0f172a;font-size:12px;">${escapeHtml(
                src.title
              )}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(
                src.authorOrVenue
              )}${src.year ? ` (${escapeHtml(src.year)})` : ''} · <a href="${escapeHtml(
              src.url
            )}" style="color:#4338ca;">${escapeHtml(src.url)}</a></div>
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid #e4e4e7;text-align:right;font-family:monospace;font-weight:700;color:#0f172a;">
              ${src.similarityPercent}%
            </td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="3" style="padding:14px;text-align:center;color:#64748b;font-size:12px;">Không phát hiện nguồn trùng lặp đáng kể trong cơ sở dữ liệu Crossref, OpenAlex & Internet.</td></tr>`;

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Báo cáo Kiểm định Đạo văn & AI — ${escapeHtml(report.reportId)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 32px; color: #0f172a; background: #fff; }
    @media print { body { margin: 16mm; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:20px;">
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#4338ca;">AssignTrack Integrity Verification Report</div>
      <h1 style="margin:4px 0 6px 0;font-size:20px;">${escapeHtml(report.title)}</h1>
      <div style="font-size:12px;color:#52525b;">Mã báo cáo: <strong>${escapeHtml(
        report.reportId
      )}</strong> · Thời gian quét: ${escapeHtml(
    new Date(report.analyzedAt).toLocaleString('vi-VN')
  )}</div>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:8px 16px;background:#4338ca;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">In / Lưu PDF</button>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px;">
    <div style="border:1px solid #e4e4e7;border-radius:10px;padding:14px;background:#fafafa;">
      <div style="font-size:11px;color:#52525b;font-weight:600;text-transform:uppercase;">Chỉ số Trùng lặp (Similarity)</div>
      <div style="font-size:28px;font-weight:800;color:#dc2626;margin:4px 0;">${report.overallSimilarityPercent}%</div>
      <div style="font-size:11px;color:#64748b;">Publications: ${report.publicationsSimilarityPercent}% · Internet: ${report.internetSimilarityPercent}%</div>
    </div>
    <div style="border:1px solid #e4e4e7;border-radius:10px;padding:14px;background:#fafafa;">
      <div style="font-size:11px;color:#52525b;font-weight:600;text-transform:uppercase;">Chỉ số Khả năng AI (AI Score)</div>
      <div style="font-size:28px;font-weight:800;color:#d97706;margin:4px 0;">${report.overallAiPercent}%</div>
      <div style="font-size:11px;color:#64748b;">Burstiness: ${report.forensics.burstinessScore}/100 · Diversity: ${report.forensics.lexicalDiversityScore}/100</div>
    </div>
    <div style="border:1px solid #e4e4e7;border-radius:10px;padding:14px;background:#fafafa;">
      <div style="font-size:11px;color:#52525b;font-weight:600;text-transform:uppercase;">Quy mô Văn bản</div>
      <div style="font-size:28px;font-weight:800;color:#0f172a;margin:4px 0;">${report.totalWords.toLocaleString(
        'vi-VN'
      )} từ</div>
      <div style="font-size:11px;color:#64748b;">Đã phân tích: ${report.analyzedWords.toLocaleString(
        'vi-VN'
      )} từ (${report.totalSentences} câu)</div>
    </div>
  </div>

  <h2 style="font-size:15px;margin:0 0 10px 0;">1. Danh sách Nguồn đối chiếu (Crossref, OpenAlex &amp; Internet)</h2>
  <table style="width:100%;border-collapse:collapse;border:1px solid #e4e4e7;margin-bottom:24px;">
    <thead>
      <tr style="background:#f4f4f5;text-align:left;font-size:11px;color:#52525b;">
        <th style="padding:8px 10px;width:48px;">Nguồn</th>
        <th style="padding:8px 10px;">Tên tài liệu / Tác giả / Liên kết</th>
        <th style="padding:8px 10px;text-align:right;width:80px;">Tỷ lệ</th>
      </tr>
    </thead>
    <tbody>${sourcesRows}</tbody>
  </table>

  <h2 style="font-size:15px;margin:0 0 10px 0;">2. Chi tiết Văn bản Đánh dấu Màu (Đỏ/Màu: Trùng lặp · Vàng: AI cao · Tím nhạt: Pha trộn)</h2>
  <div style="border:1px solid #e4e4e7;border-radius:10px;padding:18px 22px;background:#fff;">
    ${paragraphsHtml}
  </div>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
