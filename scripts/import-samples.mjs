import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const OUT_DIR = path.resolve('public/samples');
const LOGOS_DIR = path.join(OUT_DIR, 'logos');
const MEDIA_DIR = path.join(OUT_DIR, 'media');
const ARTICLES_DIR = path.join(OUT_DIR, 'articles');

const SCHOOL_NORMALIZE_MAP = {
  'La Trobe Univesity': 'La Trobe University',
  'Conventry University': 'Coventry University',
  'RMIT': 'RMIT University',
  'Uni of South Australia': 'University of South Australia',
  'Uni of Adelaide': 'University of Adelaide',
  'Uni of Newcastle': 'University of Newcastle',
  'Uni of Western Australia': 'University of Western Australia',
  'York Uni': 'York University',
};

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rdquo;/gi, '”')
    .replace(/&ldquo;/gi, '“')
    .replace(/&hellip;/gi, '…');
}

function stripTags(html) {
  return decodeHtmlEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrlForFetch(rawUrl) {
  let clean = decodeHtmlEntities(rawUrl).trim();
  // Keep original query or try canonical without Jetpack proxy first if possible
  const jetpackMatch = clean.match(/^https?:\/\/i\d\.wp\.com\/(drnhanh\.com\/[^?#]+)/i);
  if (jetpackMatch) {
    return {
      primary: `https://${jetpackMatch[1]}`,
      fallback: clean,
    };
  }
  return {
    primary: clean,
    fallback: clean,
  };
}

function getSafeExt(urlStr, contentType) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('png')) return '.png';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('svg')) return '.svg';
  const cleanPath = urlStr.split('?')[0].split('#')[0];
  const ext = path.extname(cleanPath).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
    return ext === '.jpeg' ? '.jpg' : ext;
  }
  return '.png';
}

const downloadCache = new Map();

async function downloadAsset(rawUrl, targetDir, publicPrefix) {
  const decoded = decodeHtmlEntities(rawUrl).trim();
  if (!decoded || decoded.startsWith('data:')) return null;
  if (downloadCache.has(decoded)) return downloadCache.get(decoded);

  const { primary, fallback } = normalizeUrlForFetch(decoded);
  const hash = crypto.createHash('sha1').update(primary).digest('hex').slice(0, 14);

  const tryFetch = async (u) => {
    const res = await fetch(u, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AssignTrackImporter/1.0)',
        Accept: 'image/*,*/*;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 64) throw new Error('Empty buffer');
    return { buf, ct };
  };

  let fetched = null;
  try {
    fetched = await tryFetch(primary);
  } catch {
    if (fallback !== primary) {
      try {
        fetched = await tryFetch(fallback);
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }

  const ext = getSafeExt(primary, fetched.ct);
  const fileName = `${hash}${ext}`;
  const filePath = path.join(targetDir, fileName);
  await fs.writeFile(filePath, fetched.buf);
  const publicPath = `${publicPrefix}/${fileName}`;
  downloadCache.set(decoded, publicPath);
  return publicPath;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function formatDateVi(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '2026';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function detectCourseCode(title) {
  const m = title.match(/\b([A-Z]{2,6}\s?\d{3,5}[A-Z]?)\b/);
  return m ? m[1].replace(/\s+/g, '') : '';
}

function detectGradeLabel(title) {
  if (/\bHD\b|High Distinction/i.test(title)) return 'HD';
  if (/\bDI\b|Distinction/i.test(title)) return 'DI';
  if (/\bCR\b|Credit/i.test(title)) return 'CR';
  return 'HD';
}

function cleanAndAnnotateHtml(rawHtml, urlRewriteMap) {
  let html = rawHtml || '';

  // Remove dangerous tags
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Rewrite <img ...> tags to local assets and strip external srcset/sizes
  html = html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) return '';
    const origSrc = decodeHtmlEntities(srcMatch[1]).trim();
    const localSrc = urlRewriteMap.get(origSrc);
    if (!localSrc) {
      return '';
    }
    const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1].replace(/"/g, '&quot;') : 'Sample figure';
    return `<img src="${localSrc}" alt="${alt}" loading="lazy" decoding="async" />`;
  });

  // Remove empty spacer paragraphs (<p>&nbsp;</p>, <p> </p>)
  html = html.replace(/<p[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi, '');

  // Remove width="0" or inline font/color clutter on tables while keeping colspan/rowspan
  html = html.replace(/<table[^>]*>/gi, '<table>');

  // Extract TOC headings and inject anchor ids on h1/h2/h3/h4
  const toc = [];
  let headingCounter = 0;

  html = html.replace(/<(h[1-4])([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs, inner) => {
    const cleanText = stripTags(inner);
    if (!cleanText || cleanText.length < 2) return full;
    const id = `sec-${headingCounter++}`;
    const level = Number(tag.charAt(1));
    toc.push({ id, text: cleanText.slice(0, 110), level });
    const strippedAttrs = attrs.replace(/\bid\s*=\s*["'][^"']*["']/gi, '');
    return `<${tag} id="${id}"${strippedAttrs}>${inner}</${tag}>`;
  });

  // Fallback TOC extraction for papers that use <p><strong>1. Introduction</strong></p>
  if (toc.length < 2) {
    html = html.replace(
      /<p([^>]*)>\s*<(strong|b)>([^<]{3,110})<\/\2>\s*<\/p>/gi,
      (full, attrs, bTag, inner) => {
        const cleanText = stripTags(inner);
        if (
          !cleanText ||
          cleanText.length < 3 ||
          cleanText.length > 95 ||
          !/^(\d+(\.\d+)?\.?|[IVX]+\.?|Executive Summary|Introduction|Background|Conclusion|Recommendation|Reference|Appendix|Table of Contents|Abstract|Literature|Methodology|Discussion|Findings)/i.test(
            cleanText
          )
        ) {
          return full;
        }
        const id = `sec-${headingCounter++}`;
        toc.push({ id, text: cleanText, level: 2 });
        return `<h3 id="${id}" class="sample-inferred-heading">${inner}</h3>`;
      }
    );
  }

  return { html: html.trim(), toc: toc.slice(0, 40) };
}

async function main() {
  await fs.mkdir(LOGOS_DIR, { recursive: true });
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.mkdir(ARTICLES_DIR, { recursive: true });

  console.log('1. Fetching all sample posts from drnhanh.com WP REST API...');
  const rawPosts = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `https://drnhanh.com/wp-json/wp/v2/sample?per_page=50&page=${page}&_embed=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) {
      if (res.status === 400) break;
      throw new Error(`WP API failed on page ${page}: ${res.status}`);
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    rawPosts.push(...batch);
    if (batch.length < 50) break;
  }
  console.log(`Fetched ${rawPosts.length} sample posts.`);

  // Collect all unique logos and inline images
  const logoUrlSet = new Set();
  const mediaUrlSet = new Set();

  for (const post of rawPosts) {
    const logoUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
    if (logoUrl) logoUrlSet.add(decodeHtmlEntities(logoUrl).trim());

    const html = post.content?.rendered || '';
    for (const m of html.matchAll(/<img[^>]+src\s*=\s*["']([^"']+)["']/gi)) {
      const u = decodeHtmlEntities(m[1]).trim();
      if (u && !u.startsWith('data:')) mediaUrlSet.add(u);
    }
  }

  console.log(
    `2. Downloading ${logoUrlSet.size} unique university logos and ${mediaUrlSet.size} unique inline images...`
  );

  const logoList = [...logoUrlSet];
  const logoMap = new Map();
  await mapWithConcurrency(logoList, 8, async (url) => {
    const local = await downloadAsset(url, LOGOS_DIR, '/samples/logos');
    if (local) logoMap.set(url, local);
  });
  console.log(`Downloaded ${logoMap.size}/${logoList.length} logos.`);

  const mediaList = [...mediaUrlSet];
  const mediaMap = new Map();
  await mapWithConcurrency(mediaList, 8, async (url) => {
    const local = await downloadAsset(url, MEDIA_DIR, '/samples/media');
    if (local) mediaMap.set(url, local);
  });
  console.log(`Downloaded ${mediaMap.size}/${mediaList.length} inline article images.`);

  console.log('3. Processing and writing 122 article JSON files + catalog index...');
  const catalogItems = [];
  const schoolRegistry = new Map();

  for (const post of rawPosts) {
    const title = decodeHtmlEntities(post.title?.rendered || '').trim();
    const slug = String(post.slug || `sample-${post.id}`);
    const terms = (post._embedded?.['wp:term'] || []).flat();

    const getTerms = (tax) =>
      terms
        .filter((t) => t.taxonomy === tax)
        .map((t) => decodeHtmlEntities(t.name).trim())
        .filter(Boolean);

    const rawSchools = getTerms('school');
    const schools = rawSchools.map((s) => SCHOOL_NORMALIZE_MAP[s] || s);
    const primarySchool = schools[0] || 'International University';

    const majors = getTerms('majors');
    const primaryMajor = majors[0] || 'Business / Management';

    const levels = getTerms('level');
    const primaryLevel = levels[0] || 'Bachelor';

    const categories = getTerms('sample_category');
    const primaryCategory = categories[0] || 'Assignment/Essay/Report';

    const countries = getTerms('country');
    const primaryCountry = countries[0] || 'Quốc tế';

    const subjects = getTerms('subject');

    const rawLogo = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
    const localLogo = rawLogo ? logoMap.get(decodeHtmlEntities(rawLogo).trim()) || '' : '';

    const { html: cleanHtml, toc } = cleanAndAnnotateHtml(
      post.content?.rendered || '',
      mediaMap
    );

    const plainText = stripTags(cleanHtml);
    const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
    const excerpt =
      plainText.length > 260 ? `${plainText.slice(0, 257).trim()}...` : plainText;

    const tableCount = (cleanHtml.match(/<table\b/gi) || []).length;
    const imageCount = (cleanHtml.match(/<img\b/gi) || []).length;
    const hasAppendix = /\bappendix\b|\bappendices\b/i.test(plainText);
    const hasReferences = /\breferences?\b|\bbibliography\b|\bworks cited\b/i.test(
      plainText
    );
    const courseCode = detectCourseCode(title);
    const gradeLabel = detectGradeLabel(title);
    const publishedDate = formatDateVi(post.date);

    // Track school showcase entry with its best official logo
    if (!schoolRegistry.has(primarySchool)) {
      schoolRegistry.set(primarySchool, {
        name: primarySchool,
        country: primaryCountry,
        logoUrl: localLogo,
        count: 0,
      });
    }
    const sEntry = schoolRegistry.get(primarySchool);
    sEntry.count += 1;
    if (!sEntry.logoUrl && localLogo) {
      sEntry.logoUrl = localLogo;
    }

    const indexRecord = {
      id: slug,
      wpId: post.id,
      slug,
      title,
      courseCode,
      school: primarySchool,
      schools,
      major: primaryMajor,
      majors,
      level: primaryLevel,
      levels,
      category: primaryCategory,
      categories,
      country: primaryCountry,
      countries,
      subjects,
      gradeLabel,
      wordCount,
      publishedDate,
      excerpt,
      logoUrl: localLogo,
      tableCount,
      imageCount,
      hasAppendix,
      hasReferences,
    };

    catalogItems.push(indexRecord);

    const articlePayload = {
      ...indexRecord,
      toc,
      html: cleanHtml,
    };

    await fs.writeFile(
      path.join(ARTICLES_DIR, `${slug}.json`),
      JSON.stringify(articlePayload),
      'utf8'
    );
  }

  // Backfill any item missing a logo using its school's official logo
  for (const item of catalogItems) {
    if (!item.logoUrl) {
      const reg = schoolRegistry.get(item.school);
      if (reg?.logoUrl) {
        item.logoUrl = reg.logoUrl;
        const artPath = path.join(ARTICLES_DIR, `${item.slug}.json`);
        const art = JSON.parse(await fs.readFile(artPath, 'utf8'));
        art.logoUrl = reg.logoUrl;
        await fs.writeFile(artPath, JSON.stringify(art), 'utf8');
      }
    }
  }

  const schoolsSummary = [...schoolRegistry.values()].sort((a, b) => b.count - a.count);

  const indexPayload = {
    generatedAt: new Date().toISOString(),
    totalCount: catalogItems.length,
    schools: schoolsSummary,
    items: catalogItems,
  };

  await fs.writeFile(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify(indexPayload),
    'utf8'
  );

  console.log('DONE! Summary:');
  console.log(`  Total articles: ${catalogItems.length}`);
  console.log(`  Total universities: ${schoolsSummary.length}`);
  console.log(`  Total words across library: ${catalogItems.reduce((s, i) => s + i.wordCount, 0).toLocaleString()}`);
  console.log(`  Articles with tables: ${catalogItems.filter((i) => i.tableCount > 0).length}`);
  console.log(`  Articles with images: ${catalogItems.filter((i) => i.imageCount > 0).length}`);
  console.log(`  Articles with references: ${catalogItems.filter((i) => i.hasReferences).length}`);
  console.log(`  Articles with appendix: ${catalogItems.filter((i) => i.hasAppendix).length}`);
}

main().catch((err) => {
  console.error('IMPORT FAILED:', err);
  process.exit(1);
});
