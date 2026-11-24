import fs from 'node:fs/promises';
import path from 'node:path';

const SITE_ORIGIN = 'https://assigntrack.site';
const DIST_DIR = path.resolve('dist');
const SAMPLES_PUBLIC_DIR = path.resolve('public/samples');

const SHORT_SCHOOL_MAP = {
  'RMIT University': 'RMIT',
  'University of Northampton': 'Northampton',
  'Swinburne University': 'Swinburne',
  'La Trobe University': 'La Trobe',
  'Kaplan Business School': 'Kaplan',
  'Coventry University': 'Coventry',
  'Deakin University': 'Deakin',
  'University of Melbourne': 'UniMelb',
  'International University': 'IU - VNU',
  'Torrens University': 'Torrens',
  'Sydney Metro College': 'Sydney Metro',
  'University of South Australia': 'UniSA',
  'York University': 'York Uni',
  'Australian Catholic University': 'ACU',
  'University of Wollongong': 'Wollongong',
  'Laureate Australia': 'Laureate',
  'Kent University': 'Kent',
  ICMS: 'ICMS',
  'University of Tasmania': 'UTAS',
  'UC Berkeley': 'UC Berkeley',
  'University of Adelaide': 'Adelaide',
  'University of Newcastle': 'Newcastle',
  'University of Western Australia': 'UWA',
  'University of Pennsylvania': 'UPenn',
  'William Angliss Institute': 'William Angliss',
};

function getShortSchoolName(school) {
  return SHORT_SCHOOL_MAP[school] || school;
}

function toSchoolSlug(schoolName) {
  return String(schoolName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTags(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractUnlockedParagraphsText(html, totalWords, ratio = 0.35) {
  const paragraphMatches = String(html || '').match(/<(?:p|h1|h2|h3|li)[^>]*>[\s\S]*?<\/(?:p|h1|h2|h3|li)>/gi) || [];
  const targetWords = Math.max(180, Math.round((totalWords || 1800) * ratio));
  let count = 0;
  const blocks = [];
  for (const rawBlock of paragraphMatches) {
    const clean = stripTags(rawBlock);
    if (!clean) continue;
    const words = clean.split(/\s+/).length;
    blocks.push(clean);
    count += words;
    if (count >= targetWords && blocks.length >= 3) break;
  }
  return blocks;
}

function inferCitation(item) {
  const s = `${item.country || ''} ${item.school || ''}`.toLowerCase();
  if (
    s.includes('anh') ||
    s.includes('rmit') ||
    s.includes('swinburne') ||
    s.includes('deakin') ||
    s.includes('la trobe') ||
    s.includes('coventry') ||
    s.includes('northampton')
  ) {
    return 'Harvard';
  }
  return 'APA';
}

function buildSampleSeoTitle(item) {
  const shortSchool = getShortSchoolName(item.school);
  const grade = item.gradeLabel || 'HD';
  if (item.courseCode) {
    const cleanName = item.title
      .replace(new RegExp(`\\b${item.courseCode}\\b`, 'gi'), '')
      .replace(/\bSample\s*(HD|DI|CR)?\b/gi, '')
      .replace(/^[\s–—-]+|[\s–—-]+$/g, '')
      .replace(/\s*[–—-]\s*[–—-]\s*/g, ' – ')
      .trim();
    return `${item.courseCode}${cleanName ? ` ${cleanName}` : ''} — Bài Mẫu ${grade} ${shortSchool} & Phân Tích Rubric | AssignTrack`;
  }
  return `${item.title} — Bài Mẫu ${grade} ${shortSchool} & Hướng Dẫn Rubric | AssignTrack`;
}

function buildSampleSeoDescription(item) {
  const codeText = item.courseCode ? `mã môn ${item.courseCode} ` : '';
  const bits = [`${Number(item.wordCount || 0).toLocaleString('vi-VN')} từ`];
  if (item.tableCount > 0) bits.push(`${item.tableCount} bảng dữ liệu`);
  if (item.imageCount > 0) bits.push(`${item.imageCount} biểu đồ`);
  if (item.hasReferences) bits.push('References học thuật');
  return `Tham khảo bài mẫu đạt ${item.gradeLabel || 'HD'} ${codeText}tại ${item.school} (${item.major} · ${bits.join(', ')}). Xem phân tích bẫy mất điểm Rubric và nhận bài viết mới độc bản 0% Turnitin & AI cho kỳ học hiện tại.`;
}

function buildCourseFaqs(item) {
  const shortSchool = getShortSchoolName(item.school);
  const subjectLabel = item.courseCode
    ? `môn ${item.courseCode} (${item.school})`
    : `bài ${item.title} (${shortSchool})`;
  const citation = inferCitation(item);

  return [
    {
      question: `Làm thế nào để đạt điểm ${item.gradeLabel || 'HD'} cho ${subjectLabel}?`,
      answer: `Để ăn trọn thang điểm High Distinction / Distinction cho ${subjectLabel}, bài viết cần bám sát từng tiêu chí trong Marking Rubric của ${shortSchool}, kết hợp lập luận phản biện (critical analysis), số liệu minh chứng cập nhật${
        item.tableCount > 0 ? ` (như hệ thống ${item.tableCount} bảng phân tích trong bài mẫu)` : ''
      } và trích dẫn chuẩn ${citation} từ các bài báo khoa học có DOI thực tế.`,
    },
    {
      question: `Tôi có thể copy hoặc paraphrase lại bài mẫu ${item.courseCode || shortSchool} này để nộp không?`,
      answer: `Tuyệt đối không nên. Toàn bộ bài mẫu tham khảo trên mạng và kho dữ liệu các khóa trước đều đã được hệ thống Turnitin quét lập chỉ mục. Việc sao chép hoặc đảo từ thủ công sẽ bị đánh dấu đạo văn (Similarity cao hoặc cờ giải trình học thuật). Bạn chỉ nên tham khảo bố cục triển khai và đặt viết bài mới độc bản 100% theo đúng đề kỳ học hiện tại.`,
    },
    {
      question: `AssignTrack hỗ trợ làm bài mới môn ${item.courseCode || item.major} trong bao lâu?`,
      answer: `Đội ngũ Writer chuyên ngành ${item.major} tại AssignTrack nhận triển khai bài viết mới 100% cho sinh viên ${shortSchool} theo tiến độ tiêu chuẩn 3–7 ngày hoặc hỗ trợ ca gấp 12h–24h đêm khuya, bàn giao kèm báo cáo kiểm tra Turnitin & AI 0% và cho phép xem trước bài trên Portal trước khi tất toán.`,
    },
  ];
}

function injectSeoIntoShell(shellHtml, { title, description, canonicalUrl, ogType = 'website', jsonLd, rootInnerHtml }) {
  let out = shellHtml;

  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  out = out.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(description)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:type" content="${escapeHtml(ogType)}" />`
  );

  if (jsonLd) {
    const safeJson = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
    const ldTag = `<script id="assigntrack-static-jsonld" type="application/ld+json">${safeJson}</script>\n  </head>`;
    out = out.replace(/<\/head>/i, ldTag);
  }

  if (rootInnerHtml) {
    out = out.replace(
      /<div id="root"><\/div>/i,
      `<div id="root">${rootInnerHtml}</div>`
    );
  }

  return out;
}

async function main() {
  const shellPath = path.join(DIST_DIR, 'index.html');
  const shellHtml = await fs.readFile(shellPath, 'utf8');

  const catalogRaw = await fs.readFile(path.join(SAMPLES_PUBLIC_DIR, 'index.json'), 'utf8');
  const catalog = JSON.parse(catalogRaw);
  const allItems = Array.isArray(catalog.items) ? catalog.items : [];
  const schools = Array.isArray(catalog.schools) ? catalog.schools : [];

  // Deduplicate items by slug (guard reserved directory names)
  const RESERVED_SLUGS = new Set(['articles', 'logos', 'media', 'index.json']);
  const uniqueItemsMap = new Map();
  for (const item of allItems) {
    if (!item?.slug || RESERVED_SLUGS.has(String(item.slug).toLowerCase())) continue;
    if (!uniqueItemsMap.has(item.slug)) {
      uniqueItemsMap.set(item.slug, item);
    }
  }
  const uniqueItems = Array.from(uniqueItemsMap.values());

  const todayIso = new Date().toISOString().slice(0, 10);
  const sitemapEntries = [
    { loc: `${SITE_ORIGIN}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE_ORIGIN}/samples`, priority: '0.95', changefreq: 'daily' },
  ];

  // 1. Enhance Root Homepage dist/index.html with Organization + WebSite JSON-LD & crawlable semantic shell
  const homeJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        name: 'AssignTrack Academic Support',
        url: `${SITE_ORIGIN}/`,
        logo: `${SITE_ORIGIN}/assets/assigntrack-og.png`,
        description:
          'Nền tảng hỗ trợ Assignment, Essay, Report, SPSS Data Lab & Luận văn Đại học Quốc tế chuẩn High Distinction.',
      },
      {
        '@type': 'WebSite',
        name: 'AssignTrack',
        url: `${SITE_ORIGIN}/`,
      },
    ],
  };

  const homeSemanticHtml = `
    <main style="max-width:1120px;margin:0 auto;padding:32px 16px;font-family:sans-serif">
      <h1>AssignTrack — Hỗ trợ Assignment, Essay &amp; Luận văn Đại học Quốc tế chuẩn High Distinction</h1>
      <p>Viết bài đúng chuyên ngành, bám sát Marking Rubric từng môn học tại RMIT, Swinburne, Melbourne, Deakin, Coventry, Northampton và các đại học Anh, Úc, Mỹ, Canada.</p>
      <nav aria-label="Danh mục học thuật">
        <a href="/samples">Kho 122+ Bài Mẫu &amp; Phân Tích Mã Môn Học Quốc Tế</a>
        ${schools
          .slice(0, 12)
          .map(
            (s) =>
              ` · <a href="/uni/${escapeHtml(toSchoolSlug(s.name))}">${escapeHtml(
                s.name
              )} (${s.count})</a>`
          )
          .join('')}
      </nav>
    </main>`;

  const enhancedHomeHtml = injectSeoIntoShell(shellHtml, {
    title:
      'AssignTrack — Hỗ trợ Assignment, Essay & Luận văn Đại học Quốc tế chuẩn High Distinction',
    description:
      'Viết bài Assignment, Essay, Report & Luận văn đúng chuyên ngành, bám sát Rubric RMIT, Swinburne, Melbourne, UK/Úc/Mỹ. Cam kết 100% nguồn trích dẫn thật, tặng báo cáo Turnitin & AI 0%.',
    canonicalUrl: `${SITE_ORIGIN}/`,
    ogType: 'website',
    jsonLd: homeJsonLd,
    rootInnerHtml: homeSemanticHtml,
  });
  await fs.writeFile(shellPath, enhancedHomeHtml, 'utf8');

  // 2. Generate /samples Hub Page (dist/samples/index.html)
  const samplesHubUrl = `${SITE_ORIGIN}/samples`;
  const samplesHubHtml = injectSeoIntoShell(shellHtml, {
    title:
      'Kho 122+ Bài Mẫu Assignment Đại Học Quốc Tế & Tra Cứu Mã Môn RMIT, Swinburne, Melbourne | AssignTrack',
    description:
      'Tra cứu 122+ bài mẫu Assignment, Report, Essay chuẩn High Distinction theo đúng mã môn học của 25 trường Đại học Quốc tế (RMIT, Swinburne, Deakin, Melbourne, Coventry...). Bóc tách Rubric & hỗ trợ viết bài mới độc bản 24/7.',
    canonicalUrl: samplesHubUrl,
    ogType: 'CollectionPage',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Thư viện Bài mẫu & Mã môn học Đại học Quốc tế AssignTrack',
      url: samplesHubUrl,
      numberOfItems: uniqueItems.length,
    },
    rootInnerHtml: `
      <main style="max-width:1120px;margin:0 auto;padding:32px 16px;font-family:sans-serif">
        <h1>Tra Cứu Mã Môn Học &amp; Bài Mẫu Đại Học Quốc Tế Chuẩn High Distinction (${uniqueItems.length} Bài Mẫu)</h1>
        <p>Tổng hợp phân tích Marking Rubric, bố cục đạt điểm HD/DI và hướng dẫn triển khai bài viết mới độc bản 0% Turnitin &amp; AI cho 25 trường Đại học Quốc tế.</p>
        <section>
          <h2>Danh mục theo Trường Đại học (${schools.length} trường)</h2>
          <ul>
            ${schools
              .map(
                (s) =>
                  `<li><a href="/uni/${escapeHtml(toSchoolSlug(s.name))}">Bài mẫu Assignment ${escapeHtml(
                    s.name
                  )} (${s.count} mã môn)</a></li>`
              )
              .join('\n')}
          </ul>
        </section>
        <section>
          <h2>Danh sách Mã môn học &amp; Bài mẫu tiêu biểu</h2>
          <ul>
            ${uniqueItems
              .map(
                (it) =>
                  `<li><a href="/samples/${escapeHtml(it.slug)}">${
                    it.courseCode ? `<strong>${escapeHtml(it.courseCode)}</strong> — ` : ''
                  }${escapeHtml(it.title)} (${escapeHtml(it.school)} · ${Number(
                    it.wordCount || 0
                  ).toLocaleString('vi-VN')} từ)</a></li>`
              )
              .join('\n')}
          </ul>
        </section>
      </main>`,
  });
  await fs.mkdir(path.join(DIST_DIR, 'samples'), { recursive: true });
  await fs.writeFile(path.join(DIST_DIR, 'samples', 'index.html'), samplesHubHtml, 'utf8');

  // 3. Generate 25 University Hub Pages (dist/uni/<school-slug>/index.html)
  let generatedSchoolCount = 0;
  for (const uni of schools) {
    const schoolSlug = toSchoolSlug(uni.name);
    if (!schoolSlug) continue;
    const uniItems = uniqueItems.filter((i) => i.school === uni.name);
    const shortUni = getShortSchoolName(uni.name);
    const uniCodes = Array.from(
      new Set(uniItems.filter((i) => i.courseCode).map((i) => i.courseCode))
    ).slice(0, 8);
    const uniUrl = `${SITE_ORIGIN}/uni/${encodeURIComponent(schoolSlug)}`;

    sitemapEntries.push({
      loc: uniUrl,
      priority: uniItems.length >= 4 ? '0.88' : '0.80',
      changefreq: 'weekly',
    });

    const uniTitle = `Bài Mẫu Assignment ${uni.name} (${shortUni}) — ${uniItems.length} Mã Môn Chuẩn HD | AssignTrack`;
    const uniDesc = `Tổng hợp ${uniItems.length} bài mẫu Assignment, Essay, Report đạt HD/DI tại ${uni.name}${
      uniCodes.length > 0 ? ` (gồm mã môn ${uniCodes.join(', ')})` : ''
    }. Xem phân tích Rubric và đặt bài viết mới độc bản 0% Turnitin & AI.`;

    const uniHtml = injectSeoIntoShell(shellHtml, {
      title: uniTitle,
      description: uniDesc,
      canonicalUrl: uniUrl,
      ogType: 'CollectionPage',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: uniTitle,
        description: uniDesc,
        url: uniUrl,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: uniItems.length,
          itemListElement: uniItems.map((it, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: `${SITE_ORIGIN}/samples/${encodeURIComponent(it.slug)}`,
            name: it.courseCode ? `${it.courseCode} — ${it.title}` : it.title,
          })),
        },
      },
      rootInnerHtml: `
        <main style="max-width:1120px;margin:0 auto;padding:32px 16px;font-family:sans-serif">
          <nav><a href="/">Trang chủ</a> / <a href="/samples">Thư viện Bài mẫu</a> / <span>${escapeHtml(
            uni.name
          )}</span></nav>
          <h1>Kho Bài Mẫu Assignment &amp; Phân Tích Rubric ${escapeHtml(uni.name)} (${escapeHtml(
            shortUni
          )})</h1>
          <p>${escapeHtml(uniDesc)}</p>
          <ul>
            ${uniItems
              .map(
                (it) =>
                  `<li><a href="/samples/${escapeHtml(it.slug)}">${
                    it.courseCode ? `<strong>${escapeHtml(it.courseCode)}</strong> — ` : ''
                  }${escapeHtml(it.title)} (${escapeHtml(it.major)} · ${
                    it.gradeLabel || 'HD'
                  } · ${Number(it.wordCount || 0).toLocaleString('vi-VN')} từ)</a></li>`
              )
              .join('\n')}
          </ul>
        </main>`,
    });

    const outUniDir = path.join(DIST_DIR, 'uni', schoolSlug);
    await fs.mkdir(outUniDir, { recursive: true });
    await fs.writeFile(path.join(outUniDir, 'index.html'), uniHtml, 'utf8');
    generatedSchoolCount++;
  }

  // 4. Generate Individual Course-Code Sniper Pages (dist/samples/<slug>/index.html)
  let generatedSampleCount = 0;
  for (const item of uniqueItems) {
    const articlePath = path.join(SAMPLES_PUBLIC_DIR, 'articles', `${item.slug}.json`);
    let article = null;
    try {
      article = JSON.parse(await fs.readFile(articlePath, 'utf8'));
    } catch {
      article = { ...item, toc: [], html: `<p>${escapeHtml(item.excerpt || '')}</p>` };
    }

    const canonicalUrl = `${SITE_ORIGIN}/samples/${encodeURIComponent(item.slug)}`;
    const schoolSlug = toSchoolSlug(item.school);
    const schoolHubUrl = `${SITE_ORIGIN}/uni/${encodeURIComponent(schoolSlug)}`;
    const seoTitle = buildSampleSeoTitle(item);
    const seoDesc = buildSampleSeoDescription(item);
    const faqs = buildCourseFaqs(item);
    const unlockedParagraphs = extractUnlockedParagraphsText(
      article.html || '',
      item.wordCount || 2000,
      0.35
    );
    const tocList = Array.isArray(article.toc) ? article.toc : [];
    const related = uniqueItems
      .filter((r) => r.slug !== item.slug && r.school === item.school)
      .slice(0, 6);

    sitemapEntries.push({
      loc: canonicalUrl,
      priority: item.courseCode ? '0.90' : '0.82',
      changefreq: 'monthly',
    });

    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Trang chủ AssignTrack', item: `${SITE_ORIGIN}/` },
            { '@type': 'ListItem', position: 2, name: 'Thư viện Bài mẫu', item: `${SITE_ORIGIN}/samples` },
            { '@type': 'ListItem', position: 3, name: item.school, item: schoolHubUrl },
            {
              '@type': 'ListItem',
              position: 4,
              name: item.courseCode ? `${item.courseCode} — ${item.title}` : item.title,
              item: canonicalUrl,
            },
          ],
        },
        {
          '@type': 'ScholarlyArticle',
          headline: seoTitle,
          name: item.title,
          description: seoDesc,
          url: canonicalUrl,
          inLanguage: ['en', 'vi'],
          wordCount: item.wordCount || 2000,
          educationalLevel: item.level || 'University',
          about: [item.courseCode, item.major, item.school].filter(Boolean),
          isAccessibleForFree: false,
          hasPart: {
            '@type': 'WebPageElement',
            isAccessibleForFree: false,
            cssSelector: '.seo-paywall-locked',
          },
          publisher: {
            '@type': 'Organization',
            name: 'AssignTrack Academic Support',
            url: `${SITE_ORIGIN}/`,
          },
        },
        {
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: f.answer,
            },
          })),
        },
      ],
    };

    const codeLabel = item.courseCode || getShortSchoolName(item.school);
    const rootInnerHtml = `
      <main style="max-width:960px;margin:0 auto;padding:32px 16px;font-family:sans-serif">
        <nav aria-label="Breadcrumb">
          <a href="/">Trang chủ</a> / <a href="/samples">Thư viện Bài mẫu</a> / <a href="/uni/${escapeHtml(
            schoolSlug
          )}">${escapeHtml(item.school)}</a> / <span>${escapeHtml(codeLabel)}</span>
        </nav>
        <article>
          <header>
            <h1>${escapeHtml(
              item.courseCode && !item.title.toUpperCase().includes(item.courseCode.toUpperCase())
                ? `${item.courseCode} – ${item.title}`
                : item.title
            )}</h1>
            <p>Trường: <strong>${escapeHtml(item.school)}</strong> · Ngành: <strong>${escapeHtml(
              item.major
            )}</strong>${
              item.courseCode ? ` · Mã học phần: <strong>${escapeHtml(item.courseCode)}</strong>` : ''
            } · Độ dài chuẩn: ${Number(item.wordCount || 0).toLocaleString('vi-VN')} từ · Mốc điểm: ${escapeHtml(
              item.gradeLabel || 'HD'
            )}</p>
          </header>

          ${
            tocList.length > 0
              ? `<section>
                  <h2>Cấu trúc bài viết &amp; Mục lục chuẩn Rubric (${tocList.length} mục)</h2>
                  <ol>
                    ${tocList.map((t) => `<li>${escapeHtml(t.text)}</li>`).join('\n')}
                  </ol>
                </section>`
              : ''
          }

          <section>
            <h2>Trích đoạn 35% mở đầu bài mẫu đạt ${escapeHtml(item.gradeLabel || 'HD')}</h2>
            ${unlockedParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
          </section>

          <section class="seo-paywall-locked">
            <h2>Nhận bài viết mới độc bản 100% cho kỳ học hiện tại của môn ${escapeHtml(codeLabel)}</h2>
            <p>65% nội dung phân tích chuyên sâu, bảng kết quả và danh mục References đang được khóa bảo vệ. Không sao chép trực tiếp bài mẫu công khai để tránh trùng lặp Turnitin — đặt viết bài mới độc bản bám sát Rubric kỳ hiện tại tại AssignTrack (0% Turnitin &amp; AI).</p>
          </section>

          <section>
            <h2>Câu hỏi thường gặp môn ${escapeHtml(codeLabel)} (${escapeHtml(
              getShortSchoolName(item.school)
            )})</h2>
            ${faqs
              .map(
                (f) =>
                  `<div><h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p></div>`
              )
              .join('\n')}
          </section>

          ${
            related.length > 0
              ? `<section>
                  <h2>Mã môn học liên quan tại ${escapeHtml(item.school)}</h2>
                  <ul>
                    ${related
                      .map(
                        (r) =>
                          `<li><a href="/samples/${escapeHtml(r.slug)}">${
                            r.courseCode ? `${escapeHtml(r.courseCode)} — ` : ''
                          }${escapeHtml(r.title)}</a></li>`
                      )
                      .join('\n')}
                  </ul>
                </section>`
              : ''
          }
        </article>
      </main>`;

    const pageHtml = injectSeoIntoShell(shellHtml, {
      title: seoTitle,
      description: seoDesc,
      canonicalUrl,
      ogType: 'article',
      jsonLd,
      rootInnerHtml,
    });

    const outSampleDir = path.join(DIST_DIR, 'samples', item.slug);
    await fs.mkdir(outSampleDir, { recursive: true });
    await fs.writeFile(path.join(outSampleDir, 'index.html'), pageHtml, 'utf8');
    generatedSampleCount++;

    // Also generate ultra-clean /course/<courseCode> static entry (canonicalized to /samples/<slug>)
    if (item.courseCode) {
      const cleanCodeLower = String(item.courseCode)
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
      if (cleanCodeLower) {
        const courseAliasDir = path.join(DIST_DIR, 'course', cleanCodeLower);
        await fs.mkdir(courseAliasDir, { recursive: true });
        await fs.writeFile(path.join(courseAliasDir, 'index.html'), pageHtml, 'utf8');
      }
    }
  }

  // 5. Generate dist/sitemap.xml
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (u) => `  <url>
    <loc>${escapeHtml(u.loc)}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
  await fs.writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml, 'utf8');
  await fs.writeFile(path.resolve('public', 'robots.txt'), `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`, 'utf8');
  await fs.writeFile(path.join(DIST_DIR, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`, 'utf8');

  console.log(
    `[SEO Generator] Built ${generatedSampleCount} course sniper pages, ${generatedSchoolCount} university hubs, /samples hub, robots.txt, and sitemap.xml (${sitemapEntries.length} URLs).`
  );
}

main().catch((err) => {
  console.error('[SEO Generator] Failed:', err);
  process.exit(1);
});
