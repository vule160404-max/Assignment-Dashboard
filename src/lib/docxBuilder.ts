import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import {
  DocumentFormatConfig,
  SectionHeadingLevel,
  WriterSession,
} from '../components/admin/writer/types';
import { countWords, parseDocxFile } from './wordHumanizer';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function extractTextFromPdfFile(file: File): Promise<string> {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      let currentLine = '';
      const lines: string[] = [];
      for (const item of textContent.items) {
        if (!('str' in item)) continue;
        const text = item.str;
        currentLine += text;
        if ('hasEOL' in item && item.hasEOL) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = '';
        } else if (text && !text.endsWith(' ')) {
          currentLine += ' ';
        }
      }
      if (currentLine.trim()) lines.push(currentLine.trim());
      const pageText = lines.join('\n').trim();
      if (pageText) {
        pages.push(pageText);
      }
    }
    const result = pages.join('\n\n').trim();
    if (!result) {
      throw new Error(
        `Không đọc được chữ từ file PDF "${file.name}" (có thể file chỉ chứa ảnh scan).`
      );
    }
    return result;
  } finally {
    await loadingTask.destroy();
  }
}

export async function extractTextFromSkillFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.docx')) {
    const parsed = await parseDocxFile(file);
    return parsed.paragraphs
      .filter((p) => !p.isEmpty)
      .map((p) => (p.isHeading ? `## ${p.text}` : p.text))
      .join('\n\n');
  }
  if (lower.endsWith('.pdf')) {
    return await extractTextFromPdfFile(file);
  }
  return await file.text();
}

interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface CollectedTocHeading {
  title: string;
  level: SectionHeadingLevel;
  pageNumber: number;
}

/**
 * Parses inline markdown/HTML-lite markers:
 * **bold**, *italic*, __underline__
 */
function parseInlineRuns(line: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIdx) {
      runs.push({ text: line.slice(lastIdx, match.index) });
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      runs.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('__') && token.endsWith('__')) {
      runs.push({ text: token.slice(2, -2), underline: true });
    } else if (token.startsWith('*') && token.endsWith('*')) {
      runs.push({ text: token.slice(1, -1), italic: true });
    } else {
      runs.push({ text: token });
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < line.length) {
    runs.push({ text: line.slice(lastIdx) });
  }

  if (runs.length === 0) {
    runs.push({ text: line });
  }

  return runs;
}

function stripInlineMarkdown(str: string): string {
  return str
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

function mapAlignmentToWordJc(
  align: DocumentFormatConfig['textAlign']
): 'left' | 'center' | 'right' | 'both' {
  if (align === 'justify') return 'both';
  return align;
}

function buildRunXml(
  run: InlineRun,
  fontFamily: string,
  sizeHalfPt: number,
  forceBold = false,
  forceItalic = false
): string {
  const escapedFont = escapeXml(fontFamily);
  const isBold = Boolean(run.bold || forceBold);
  const isItalic = Boolean(run.italic || forceItalic);
  const isUnderline = Boolean(run.underline);

  return `<w:r>
    <w:rPr>
      <w:rFonts w:ascii="${escapedFont}" w:hAnsi="${escapedFont}" w:cs="${escapedFont}"/>
      ${isBold ? '<w:b/><w:bCs/>' : ''}
      ${isItalic ? '<w:i/><w:iCs/>' : ''}
      ${isUnderline ? '<w:u w:val="single"/>' : ''}
      <w:sz w:val="${sizeHalfPt}"/>
      <w:szCs w:val="${sizeHalfPt}"/>
    </w:rPr>
    <w:t xml:space="preserve">${escapeXml(run.text)}</w:t>
  </w:r>`;
}

function buildParagraphXml(opts: {
  text: string;
  format: DocumentFormatConfig;
  role: 'title' | 'h1' | 'h2' | 'h3' | 'body' | 'bullet' | 'numbered' | 'reference';
}): string {
  const { text, format, role } = opts;
  const font = format.fontFamily;
  const baseHalfPt = Math.round(format.fontSizePt * 2);
  const lineTwips = Math.round(format.lineSpacing * 240);
  const afterTwips = Math.round((format.paragraphSpacingAfterPt || 0) * 20);

  let sizeHalfPt = baseHalfPt;
  let jc = mapAlignmentToWordJc(format.textAlign);
  let forceBold = false;
  let forceItalic = false;
  let pStyle = '';
  let outlineLvlXml = '';
  let indentXml = '';
  let beforeTwips = 0;

  if (role === 'title') {
    sizeHalfPt = baseHalfPt + 6; // +3pt
    jc = 'center';
    forceBold = true;
    pStyle = '<w:pStyle w:val="Title"/>';
    beforeTwips = 120;
  } else if (role === 'h1') {
    sizeHalfPt = baseHalfPt + 4; // +2pt
    jc = format.preset === 'APA7' ? 'center' : 'left';
    forceBold = true;
    pStyle = '<w:pStyle w:val="Heading1"/>';
    outlineLvlXml = '<w:outlineLvl w:val="0"/>';
    beforeTwips = 240;
  } else if (role === 'h2') {
    sizeHalfPt = baseHalfPt + 2; // +1pt
    jc = 'left';
    forceBold = true;
    pStyle = '<w:pStyle w:val="Heading2"/>';
    outlineLvlXml = '<w:outlineLvl w:val="1"/>';
    beforeTwips = 180;
  } else if (role === 'h3') {
    sizeHalfPt = baseHalfPt;
    jc = 'left';
    forceBold = true;
    forceItalic = true;
    pStyle = '<w:pStyle w:val="Heading3"/>';
    outlineLvlXml = '<w:outlineLvl w:val="2"/>';
    beforeTwips = 120;
  } else if (role === 'bullet' || role === 'numbered') {
    indentXml = '<w:ind w:left="720" w:hanging="360"/>';
  } else if (role === 'reference') {
    // Hanging indent 0.5 inch (720 twips) standard for APA/MLA/Harvard references
    indentXml = '<w:ind w:left="720" w:hanging="720"/>';
  } else if (role === 'body' && format.firstLineIndent) {
    // First-line indent 0.5 inch = 720 twips
    indentXml = '<w:ind w:firstLine="720"/>';
  }

  const runs = parseInlineRuns(text);
  const runsXml = runs
    .map((r) => buildRunXml(r, font, sizeHalfPt, forceBold, forceItalic))
    .join('');

  return `<w:p>
    <w:pPr>
      ${pStyle}
      ${outlineLvlXml}
      <w:spacing w:before="${beforeTwips}" w:after="${afterTwips}" w:line="${lineTwips}" w:lineRule="auto"/>
      ${indentXml}
      <w:jc w:val="${jc}"/>
    </w:pPr>
    ${runsXml}
  </w:p>`;
}

/**
 * Builds an authentic Word Table of Contents (<w:sdt> + TOC field + pre-populated dot-leader entries)
 * followed by a page break so thesis chapters begin on the next page.
 */
function buildTableOfContentsXml(opts: {
  tocTitle: string;
  entries: CollectedTocHeading[];
  format: DocumentFormatConfig;
}): string {
  const { tocTitle, entries, format } = opts;
  if (entries.length === 0) return '';

  const escapedFont = escapeXml(format.fontFamily);
  const baseHalfPt = Math.round(format.fontSizePt * 2);
  const headingHalfPt = baseHalfPt + 4;
  const marginTwips = Math.round((format.marginInch || 1.0) * 1440);
  const rightTabPosTwips = Math.max(6000, 11906 - marginTwips * 2);

  const tocHeadingParagraph = `<w:p>
        <w:pPr>
          <w:pStyle w:val="TOCHeading"/>
          <w:spacing w:before="120" w:after="200" w:line="276" w:lineRule="auto"/>
          <w:jc w:val="center"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="${escapedFont}" w:hAnsi="${escapedFont}" w:cs="${escapedFont}"/>
            <w:b/><w:bCs/>
            <w:sz w:val="${headingHalfPt}"/>
            <w:szCs w:val="${headingHalfPt}"/>
          </w:rPr>
          <w:t>${escapeXml(tocTitle)}</w:t>
        </w:r>
      </w:p>`;

  const entryParagraphs = entries.map((entry, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === entries.length - 1;
    const styleId =
      entry.level === 'h3' ? 'TOC3' : entry.level === 'h2' ? 'TOC2' : 'TOC1';
    const leftIndentTwips =
      entry.level === 'h3' ? 480 : entry.level === 'h2' ? 240 : 0;
    const isBold = entry.level === 'h1';
    const isItalic = entry.level === 'h3';
    const cleanTitle = stripInlineMarkdown(entry.title);

    const rPrXml = `<w:rPr>
            <w:rFonts w:ascii="${escapedFont}" w:hAnsi="${escapedFont}" w:cs="${escapedFont}"/>
            ${isBold ? '<w:b/><w:bCs/>' : ''}
            ${isItalic ? '<w:i/><w:iCs/>' : ''}
            <w:sz w:val="${baseHalfPt}"/>
            <w:szCs w:val="${baseHalfPt}"/>
          </w:rPr>`;

    const fieldBeginXml = isFirst
      ? `<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>
        <w:r><w:instrText xml:space="preserve"> TOC \\o &quot;1-3&quot; \\h \\z \\u </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="separate"/></w:r>`
      : '';

    const fieldEndXml = isLast
      ? `<w:r><w:fldChar w:fldCharType="end"/></w:r>`
      : '';

    return `<w:p>
        <w:pPr>
          <w:pStyle w:val="${styleId}"/>
          <w:tabs>
            <w:tab w:val="right" w:leader="dot" w:pos="${rightTabPosTwips}"/>
          </w:tabs>
          ${leftIndentTwips > 0 ? `<w:ind w:left="${leftIndentTwips}"/>` : ''}
          <w:spacing w:before="60" w:after="60" w:line="276" w:lineRule="auto"/>
          <w:jc w:val="left"/>
        </w:pPr>
        ${fieldBeginXml}
        <w:r>
          ${rPrXml}
          <w:t xml:space="preserve">${escapeXml(cleanTitle)}</w:t>
        </w:r>
        <w:r>
          ${rPrXml}
          <w:tab/>
        </w:r>
        <w:r>
          ${rPrXml}
          <w:t>${entry.pageNumber}</w:t>
        </w:r>
        ${fieldEndXml}
      </w:p>`;
  });

  const pageBreakParagraph = `<w:p>
      <w:r>
        <w:br w:type="page"/>
      </w:r>
    </w:p>`;

  return `<w:sdt>
      <w:sdtPr>
        <w:docPartObj>
          <w:docPartGallery w:val="Table of Contents"/>
          <w:docPartUnique/>
        </w:docPartObj>
      </w:sdtPr>
      <w:sdtContent>
        ${tocHeadingParagraph}
        ${entryParagraphs.join('\n        ')}
      </w:sdtContent>
    </w:sdt>
    ${pageBreakParagraph}`;
}

/**
 * Compile a WriterSession into paragraphs and build a real OpenXML .docx File
 * preserving all typography, spacing, margin, alignment, and Table of Contents settings.
 */
export async function buildFormattedDocxFromSession(
  session: WriterSession,
  customFileName?: string
): Promise<File> {
  const { format } = session;
  const includeToc = format.includeTableOfContents ?? true;
  const titleParagraphsXml: string[] = [];
  const bodyParagraphsXml: string[] = [];
  const collectedHeadings: CollectedTocHeading[] = [];

  let cumulativeWords = 0;
  const wordsPerPage = format.lineSpacing >= 2.0 ? 275 : 350;
  const startPageOffset = includeToc ? 2 : 1;

  // Paper Title at top if topic is present
  if (session.topic.trim()) {
    titleParagraphsXml.push(
      buildParagraphXml({
        text: session.topic.trim(),
        format,
        role: 'title',
      })
    );
  }

  const pushBlockParagraphs = (rawContent: string, isRefSection = false) => {
    const lines = rawContent.split(/\r?\n/);
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      const currentPage =
        startPageOffset + Math.floor(cumulativeWords / wordsPerPage);

      if (trimmed.startsWith('### ')) {
        const headingText = trimmed.slice(4).trim();
        collectedHeadings.push({
          title: headingText,
          level: 'h3',
          pageNumber: currentPage,
        });
        bodyParagraphsXml.push(
          buildParagraphXml({
            text: headingText,
            format,
            role: 'h3',
          })
        );
      } else if (trimmed.startsWith('## ')) {
        const headingText = trimmed.slice(3).trim();
        collectedHeadings.push({
          title: headingText,
          level: 'h2',
          pageNumber: currentPage,
        });
        bodyParagraphsXml.push(
          buildParagraphXml({
            text: headingText,
            format,
            role: 'h2',
          })
        );
      } else if (trimmed.startsWith('# ')) {
        const headingText = trimmed.slice(2).trim();
        collectedHeadings.push({
          title: headingText,
          level: 'h1',
          pageNumber: currentPage,
        });
        bodyParagraphsXml.push(
          buildParagraphXml({
            text: headingText,
            format,
            role: 'h1',
          })
        );
      } else if (/^[-*•]\s+/.test(trimmed)) {
        const cleanBullet = trimmed.replace(/^[-*•]\s+/, '• ');
        bodyParagraphsXml.push(
          buildParagraphXml({
            text: cleanBullet,
            format,
            role: 'bullet',
          })
        );
      } else if (/^\d+\.\s+/.test(trimmed) && !isRefSection) {
        bodyParagraphsXml.push(
          buildParagraphXml({
            text: trimmed,
            format,
            role: 'numbered',
          })
        );
      } else {
        bodyParagraphsXml.push(
          buildParagraphXml({
            text: trimmed,
            format,
            role: isRefSection ? 'reference' : 'body',
          })
        );
      }
      cumulativeWords += countWords(trimmed);
    }
  };

  if (session.viewMode === 'full_paper' && session.fullPaperOverride?.trim()) {
    pushBlockParagraphs(session.fullPaperOverride);
  } else {
    for (const sec of session.outline) {
      const isRefSection =
        /^(references|bibliography|works cited|tài liệu tham khảo)/i.test(
          sec.title.replace(/^\d+(\.\d+)*\s*/, '').trim()
        );
      if (sec.title.trim()) {
        const headingLevel = sec.headingLevel || 'h1';
        const currentPage =
          startPageOffset + Math.floor(cumulativeWords / wordsPerPage);
        collectedHeadings.push({
          title: sec.title.trim(),
          level: headingLevel,
          pageNumber: currentPage,
        });
        bodyParagraphsXml.push(
          buildParagraphXml({
            text: sec.title.trim(),
            format,
            role: headingLevel,
          })
        );
      }
      if (sec.content.trim()) {
        pushBlockParagraphs(sec.content, isRefSection);
      } else {
        cumulativeWords += sec.targetWords || 250;
      }
    }
  }

  const tocTitle =
    session.writingLanguage === 'Vietnamese' ? 'MỤC LỤC' : 'TABLE OF CONTENTS';
  const tocXml =
    includeToc && collectedHeadings.length > 0
      ? buildTableOfContentsXml({
          tocTitle,
          entries: collectedHeadings,
          format,
        })
      : '';

  const allParagraphsXml = [
    ...titleParagraphsXml,
    ...(tocXml ? [tocXml] : []),
    ...bodyParagraphsXml,
  ];

  if (allParagraphsXml.length === 0) {
    allParagraphsXml.push(
      buildParagraphXml({
        text: session.topic || 'Blank Academic Document',
        format,
        role: 'body',
      })
    );
  }

  // Page size A4 (11906 x 16838 twips) and margins (1 inch = 1440 twips)
  const marginTwips = Math.round((format.marginInch || 1.0) * 1440);
  const escapedFont = escapeXml(format.fontFamily);
  const baseHalfPt = Math.round(format.fontSizePt * 2);
  const lineTwips = Math.round(format.lineSpacing * 240);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${allParagraphsXml.join('\n    ')}
    <w:sectPr>
      ${format.includePageNumbers ? '<w:footerReference w:type="default" r:id="rId3"/>' : ''}
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="${marginTwips}" w:right="${marginTwips}" w:bottom="${marginTwips}" w:left="${marginTwips}" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${escapedFont}" w:hAnsi="${escapedFont}" w:cs="${escapedFont}"/>
        <w:sz w:val="${baseHalfPt}"/>
        <w:szCs w:val="${baseHalfPt}"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="${Math.round((format.paragraphSpacingAfterPt || 0) * 20)}" w:line="${lineTwips}" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:outlineLvl w:val="2"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TOCHeading">
    <w:name w:val="TOC Heading"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:outlineLvl w:val="9"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TOC1">
    <w:name w:val="toc 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TOC2">
    <w:name w:val="toc 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TOC3">
    <w:name w:val="toc 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
  </w:style>
</w:styles>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:updateFields w:val="true"/>
</w:settings>`;

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="${escapedFont}" w:hAnsi="${escapedFont}" w:cs="${escapedFont}"/>
        <w:sz w:val="${Math.max(18, baseHalfPt - 2)}"/>
        <w:szCs w:val="${Math.max(18, baseHalfPt - 2)}"/>
      </w:rPr>
      <w:fldChar w:fldCharType="begin"/>
    </w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="${escapedFont}" w:hAnsi="${escapedFont}" w:cs="${escapedFont}"/>
        <w:sz w:val="${Math.max(18, baseHalfPt - 2)}"/>
        <w:szCs w:val="${Math.max(18, baseHalfPt - 2)}"/>
      </w:rPr>
      <w:instrText xml:space="preserve"> PAGE </w:instrText>
    </w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="${escapedFont}" w:hAnsi="${escapedFont}" w:cs="${escapedFont}"/>
        <w:sz w:val="${Math.max(18, baseHalfPt - 2)}"/>
        <w:szCs w:val="${Math.max(18, baseHalfPt - 2)}"/>
      </w:rPr>
      <w:fldChar w:fldCharType="end"/>
    </w:r>
  </w:p>
</w:ftr>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/settings.xml', settingsXml);
  zip.file('word/footer1.xml', footerXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const safeBaseName =
    customFileName ||
    `${session.linkedOrderCode || 'Research'}_${(session.topic || 'Paper')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 40)}.docx`;

  const finalName = safeBaseName.toLowerCase().endsWith('.docx')
    ? safeBaseName
    : `${safeBaseName}.docx`;

  return new File([blob], finalName, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
