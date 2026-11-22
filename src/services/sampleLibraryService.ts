export interface SampleCatalogSchool {
  name: string;
  count: number;
  logoUrl: string;
}

export interface SampleTocItem {
  id: string;
  text: string;
  level: 1 | 2;
}

export interface SampleCatalogItem {
  id: string;
  wpId: number;
  slug: string;
  title: string;
  courseCode: string;
  school: string;
  schools: string[];
  major: string;
  majors: string[];
  level: string;
  levels: string[];
  category: string;
  categories: string[];
  country: string;
  countries: string[];
  subjects: string[];
  gradeLabel: string;
  wordCount: number;
  publishedDate: string;
  excerpt: string;
  logoUrl: string;
  tableCount: number;
  imageCount: number;
  hasAppendix: boolean;
  hasReferences: boolean;
}

export interface SampleCatalogIndex {
  generatedAt: string;
  totalCount: number;
  schools: SampleCatalogSchool[];
  items: SampleCatalogItem[];
}

export interface SampleArticleDetail extends SampleCatalogItem {
  toc: SampleTocItem[];
  html: string;
}

let catalogPromise: Promise<SampleCatalogIndex> | null = null;
const articleCache = new Map<string, SampleArticleDetail>();
const inFlightArticles = new Map<string, Promise<SampleArticleDetail>>();

export function fetchSampleCatalog(forceReload = false): Promise<SampleCatalogIndex> {
  if (!forceReload && catalogPromise) {
    return catalogPromise;
  }

  const request = fetch('/samples/index.json', { cache: 'default' })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Không thể tải danh mục bài mẫu (HTTP ${res.status})`);
      }
      const data = (await res.json()) as SampleCatalogIndex;
      if (!data || !Array.isArray(data.items)) {
        throw new Error('Dữ liệu danh mục bài mẫu không hợp lệ');
      }
      return data;
    })
    .catch((err) => {
      catalogPromise = null;
      throw err;
    });

  catalogPromise = request;
  return request;
}

export function fetchSampleArticle(slug: string): Promise<SampleArticleDetail> {
  const cached = articleCache.get(slug);
  if (cached) {
    return Promise.resolve(cached);
  }

  const existing = inFlightArticles.get(slug);
  if (existing) {
    return existing;
  }

  const request = fetch(`/samples/articles/${encodeURIComponent(slug)}.json`, {
    cache: 'default',
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Không thể tải nội dung bài mẫu (HTTP ${res.status})`);
      }
      const data = (await res.json()) as SampleArticleDetail;
      articleCache.set(slug, data);
      inFlightArticles.delete(slug);
      return data;
    })
    .catch((err) => {
      inFlightArticles.delete(slug);
      throw err;
    });

  inFlightArticles.set(slug, request);
  return request;
}

export function getShortSchoolName(school: string): string {
  const map: Record<string, string> = {
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
  return map[school] || school;
}

export function getSchoolInitials(school: string): string {
  const words = school
    .replace(/\b(of|the|and|for)\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'UN';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}
