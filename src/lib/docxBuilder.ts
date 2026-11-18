import JSZip from 'jszip';
import {
  DocumentFormatConfig,
  WriterSession,
} from '../components/admin/writer/types';
import { parseDocxFile } from './wordHumanizer';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
  return await file.text();
}

interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
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
    beforeTwips = 240;
  } else if (role === 'h2') {
    sizeHalfPt = baseHalfPt + 2; // +1pt
    jc = 'left';
    forceBold = true;
    pStyle = '<w:pStyle w:val="Heading2"/>';
    beforeTwips = 180;
  } else if (role === 'h3') {
    sizeHalfPt = baseHalfPt;
    jc = 'left';
    forceBold = true;
    forceItalic = true;
    pStyle = '<w:pStyle w:val="Heading3"/>';
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
      <w:spacing w:before="${beforeTwips}" w:after="${afterTwips}" w:line="${lineTwips}" w:lineRule="auto"/>
      ${indentXml}
      <w:jc w:val="${jc}"/>
    </w:pPr>
    ${runsXml}
  </w:p>`;
}

/**
 * Compile a WriterSession into paragraphs and build a real OpenXML .docx File
 * preserving all typography, spacing, margin, and alignment settings.
 */
export async function buildFormattedDocxFromSession(
  session: WriterSession,
  customFileName?: string
): Promise<File> {
  const { format } = session;
  const paragraphsXml: string[] = [];

  // Paper Title at top if topic is present
  if (session.topic.trim()) {
    paragraphsXml.push(
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

      if (trimmed.startsWith('### ')) {
        paragraphsXml.push(
          buildParagraphXml({
            text: trimmed.slice(4).trim(),
            format,
            role: 'h3',
          })
        );
      } else if (trimmed.startsWith('## ')) {
        paragraphsXml.push(
          buildParagraphXml({
            text: trimmed.slice(3).trim(),
            format,
            role: 'h2',
          })
        );
      } else if (trimmed.startsWith('# ')) {
        paragraphsXml.push(
          buildParagraphXml({
            text: trimmed.slice(2).trim(),
            format,
            role: 'h1',
          })
        );
      } else if (/^[-*•]\s+/.test(trimmed)) {
        const cleanBullet = trimmed.replace(/^[-*•]\s+/, '• ');
        paragraphsXml.push(
          buildParagraphXml({
            text: cleanBullet,
            format,
            role: 'bullet',
          })
        );
      } else if (/^\d+\.\s+/.test(trimmed) && !isRefSection) {
        paragraphsXml.push(
          buildParagraphXml({
            text: trimmed,
            format,
            role: 'numbered',
          })
        );
      } else {
        paragraphsXml.push(
          buildParagraphXml({
            text: trimmed,
            format,
            role: isRefSection ? 'reference' : 'body',
          })
        );
      }
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
        paragraphsXml.push(
          buildParagraphXml({
            text: sec.title.trim(),
            format,
            role: sec.headingLevel || 'h1',
          })
        );
      }
      if (sec.content.trim()) {
        pushBlockParagraphs(sec.content, isRefSection);
      }
    }
  }

  if (paragraphsXml.length === 0) {
    paragraphsXml.push(
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
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml.join('\n    ')}
    <w:sectPr>
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
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/styles.xml', stylesXml);
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
