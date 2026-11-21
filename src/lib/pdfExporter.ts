import {
  DEFAULT_COVER_PAGE_CONFIG,
  WriterSession,
} from '../components/admin/writer/types';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInlineMarkdown(raw: string): string {
  const escaped = escapeHtml(raw);
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<u>$1</u>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function stripLeadingHashes(line: string): string {
  return line.replace(/^[ \t]*#{1,6}[ \t]*/, '').trim();
}

export function exportWriterSessionToPdf(session: WriterSession): void {
  const fmt = session.format;
  const isVi = session.writingLanguage === 'Vietnamese';
  const cover = fmt.coverPage?.enabled
    ? { ...DEFAULT_COVER_PAGE_CONFIG, ...fmt.coverPage }
    : null;
  const includeToc = fmt.includeTableOfContents ?? true;

  const fontCss = `"${fmt.fontFamily}", "Times New Roman", Georgia, serif`;
  const marginCss = `${fmt.marginInch || 1}in`;
  const textAlign = fmt.textAlign || 'justify';
  const lineSpacing = fmt.lineSpacing || 1.5;
  const fontSizePt = fmt.fontSizePt || 12;
  const firstLineIndent = fmt.firstLineIndent ? '0.5in' : '0';

  const totalWords = session.outline.reduce((sum, sec) => {
    const w = sec.content.trim() ? sec.content.trim().split(/\s+/).length : 0;
    return sum + w;
  }, 0);

  // 1. Cover Page HTML
  let coverHtml = '';
  if (cover) {
    const f = cover.fields;
    const isModern = cover.templateId === 'modern_executive';
    const metaRows: Array<{ label: string; value: string }> = [];
    if (f.showSubject && session.subject.trim()) {
      metaRows.push({
        label: isVi ? 'Môn học / Học phần:' : 'Module / Course:',
        value: session.subject.trim(),
      });
    }
    if (f.showMajor && cover.majorName.trim()) {
      metaRows.push({
        label: isVi ? 'Chuyên ngành:' : 'Programme / Major:',
        value: cover.majorName.trim(),
      });
    }
    if (f.showSupervisor && cover.supervisorName.trim()) {
      metaRows.push({
        label: isVi ? 'Giảng viên hướng dẫn:' : 'Supervisor:',
        value: cover.supervisorName.trim(),
      });
    }
    if (f.showInternshipUnit && cover.internshipUnit.trim()) {
      metaRows.push({
        label: isVi ? 'Đơn vị thực tập:' : 'Host Organization:',
        value: cover.internshipUnit.trim(),
      });
    }
    if (f.showStudentName && cover.studentName.trim()) {
      metaRows.push({
        label: isVi ? 'Sinh viên thực hiện:' : 'Student Name:',
        value: cover.studentName.trim(),
      });
    }
    if (f.showStudentId && cover.studentId.trim()) {
      metaRows.push({
        label: isVi ? 'Mã số sinh viên:' : 'Student ID:',
        value: cover.studentId.trim(),
      });
    }
    if (f.showClassName && cover.className.trim()) {
      metaRows.push({
        label: isVi ? 'Lớp / Khóa:' : 'Class / Cohort:',
        value: cover.className.trim(),
      });
    }
    if (f.showWordCount && totalWords > 0) {
      metaRows.push({
        label: isVi ? 'Tổng số từ:' : 'Word Count:',
        value: `${totalWords.toLocaleString('en-US')} ${isVi ? 'từ' : 'words'}`,
      });
    }

    coverHtml = `
      <section class="cover-page ${cover.showBorder ? 'cover-bordered' : ''} ${
        isModern ? 'cover-modern' : ''
      }">
        <div class="cover-top">
          ${
            f.showUniversity && cover.universityName.trim()
              ? `<div class="cover-uni">${escapeHtml(cover.universityName.trim())}</div>`
              : ''
          }
          ${
            f.showFaculty && cover.facultyName.trim()
              ? `<div class="cover-faculty">${escapeHtml(cover.facultyName.trim())}</div>`
              : ''
          }
          ${
            f.showDocumentType && cover.documentTypeLabel.trim()
              ? `<div class="cover-doctype">${escapeHtml(cover.documentTypeLabel.trim())}</div>`
              : ''
          }
        </div>

        <div class="cover-middle">
          ${
            f.showTopic
              ? `<h1 class="cover-topic">${escapeHtml(
                  (session.topic || session.title || 'ACADEMIC PAPER').trim()
                )}</h1>`
              : ''
          }
          ${
            metaRows.length > 0
              ? `<div class="cover-meta">${metaRows
                  .map(
                    (row) =>
                      `<div class="cover-meta-row"><span class="cover-meta-label">${escapeHtml(
                        row.label
                      )}</span><span class="cover-meta-val">${escapeHtml(
                        row.value
                      )}</span></div>`
                  )
                  .join('')}</div>`
              : ''
          }
        </div>

        <div class="cover-bottom">
          ${
            f.showSubmissionDate && cover.locationAndDate.trim()
              ? `<div class="cover-date">${escapeHtml(cover.locationAndDate.trim())}</div>`
              : ''
          }
        </div>
      </section>
    `;
  }

  // 2. Table of Contents HTML
  let tocHtml = '';
  if (includeToc && session.outline.length > 0) {
    const basePage = (cover ? 1 : 0) + 1;
    let runningWords = 0;
    const wordsPerPage = Math.max(240, Math.round(420 / lineSpacing));
    const tocItems: string[] = [];

    for (const sec of session.outline) {
      const startPage = basePage + 1 + Math.floor(runningWords / wordsPerPage);
      const isH1 = sec.headingLevel === 'h1';
      tocItems.push(`
        <div class="toc-row ${isH1 ? 'toc-h1' : 'toc-h2'}">
          <span class="toc-title">${escapeHtml(stripLeadingHashes(sec.title))}</span>
          <span class="toc-dots"></span>
          <span class="toc-page">${startPage}</span>
        </div>
      `);
      const lines = sec.content.split(/\r?\n/);
      for (const l of lines) {
        const clean = stripLeadingHashes(l);
        if (/^\d+\.\d+(?:\.\d+)?\.?\s+\S/.test(clean) && clean.length <= 120) {
          const subPage = basePage + 1 + Math.floor(runningWords / wordsPerPage);
          tocItems.push(`
            <div class="toc-row toc-h2">
              <span class="toc-title">${escapeHtml(clean)}</span>
              <span class="toc-dots"></span>
              <span class="toc-page">${subPage}</span>
            </div>
          `);
        }
        runningWords += clean ? clean.split(/\s+/).length : 0;
      }
      if (!sec.content.trim()) {
        runningWords += sec.targetWords || 250;
      }
    }

    tocHtml = `
      <section class="toc-page">
        <h2 class="toc-heading">${isVi ? 'MỤC LỤC' : 'TABLE OF CONTENTS'}</h2>
        <div class="toc-list">${tocItems.join('')}</div>
      </section>
    `;
  }

  // 3. Body Sections HTML
  const sectionsHtml = session.outline
    .map((sec) => {
      const headingTag =
        sec.headingLevel === 'h1' ? 'h2' : sec.headingLevel === 'h2' ? 'h3' : 'h4';
      const isRefSec =
        /^(references|bibliography|works cited|tài liệu tham khảo|danh mục tài liệu tham khảo)/i.test(
          sec.title.replace(/^\d+(\.\d+)*\.?\s*/, '').trim()
        );
      const paragraphs = sec.content
        .split(/\r?\n+/)
        .map((line) => stripLeadingHashes(line))
        .filter(Boolean)
        .map((line) => {
          if (
            !isRefSec &&
            /^\d+\.\d+(?:\.\d+)?\.?\s+\S/.test(line) &&
            line.length <= 130
          ) {
            return `<h3 class="sub-heading">${renderInlineMarkdown(line)}</h3>`;
          }
          return `<p class="${isRefSec ? 'ref-entry' : 'body-para'}">${renderInlineMarkdown(
            line
          )}</p>`;
        })
        .join('');

      return `
        <div class="paper-section ${isRefSec ? 'ref-section' : ''}">
          <${headingTag} class="sec-heading sec-${sec.headingLevel}">${escapeHtml(
        stripLeadingHashes(sec.title)
      )}</${headingTag}>
          ${paragraphs}
        </div>
      `;
    })
    .join('');

  const safeTitle = escapeHtml(
    (session.linkedOrderCode
      ? `${session.linkedOrderCode}_${session.topic || session.title}`
      : session.topic || session.title || 'AssignTrack_Paper'
    ).slice(0, 90)
  );

  const html = `<!doctype html>
<html lang="${isVi ? 'vi' : 'en'}">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page {
      size: A4;
      margin: ${marginCss};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: ${fontCss};
      font-size: ${fontSizePt}pt;
      line-height: ${lineSpacing};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cover-page {
      min-height: calc(297mm - 2 * ${marginCss});
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      page-break-after: always;
      padding: 12mm 10mm;
    }
    .cover-bordered {
      border: 3px double #0B2559;
    }
    .cover-modern {
      border-top: 6px solid #0B2559;
      border-bottom: 3px solid #D97706;
    }
    .cover-uni { font-size: 13pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
    .cover-faculty { font-size: 12pt; font-weight: 600; text-transform: uppercase; margin-top: 4pt; }
    .cover-doctype { font-size: 13pt; font-weight: 700; color: #0B2559; text-transform: uppercase; margin-top: 18pt; letter-spacing: 0.8px; }
    .cover-middle { margin: auto 0; padding: 18pt 0; }
    .cover-topic { font-size: 17pt; font-weight: 700; line-height: 1.35; text-transform: uppercase; margin: 0 0 22pt; color: #0f172a; }
    .cover-meta { max-width: 135mm; margin: 0 auto; text-align: left; }
    .cover-meta-row { display: flex; gap: 10pt; margin-bottom: 6pt; font-size: 11.5pt; line-height: 1.45; }
    .cover-meta-label { width: 46mm; flex-shrink: 0; font-weight: 600; color: #334155; }
    .cover-meta-val { flex: 1; font-weight: 500; }
    .cover-date { font-size: 12pt; font-weight: 700; }
    .toc-page { page-break-after: always; }
    .toc-heading { text-align: center; font-size: 14pt; font-weight: 700; margin: 0 0 14pt; letter-spacing: 0.6px; }
    .toc-row { display: flex; align-items: baseline; gap: 6pt; margin-bottom: 4pt; font-size: 11.5pt; line-height: 1.45; }
    .toc-h1 { font-weight: 700; margin-top: 6pt; }
    .toc-h2 { padding-left: 16pt; font-weight: 400; }
    .toc-dots { flex: 1; border-bottom: 1px dotted #94a3b8; min-width: 12pt; transform: translateY(-3pt); }
    .toc-page { font-variant-numeric: tabular-nums; }
    .paper-section { margin-bottom: 14pt; }
    .ref-section { page-break-before: auto; }
    .sec-heading { font-weight: 700; color: #0f172a; page-break-after: avoid; margin: 14pt 0 6pt; }
    .sec-h1 { font-size: ${Math.min(16, fontSizePt + 2)}pt; }
    .sec-h2 { font-size: ${Math.min(14, fontSizePt + 1)}pt; }
    .sec-h3 { font-size: ${fontSizePt}pt; }
    .sub-heading { font-size: ${fontSizePt + 0.5}pt; font-weight: 700; margin: 10pt 0 4pt; page-break-after: avoid; }
    .body-para { text-align: ${textAlign}; text-indent: ${firstLineIndent}; margin: 0 0 ${fmt.paragraphSpacingAfterPt || 6}pt; }
    .ref-entry { text-align: left; padding-left: 0.45in; text-indent: -0.45in; margin: 0 0 6pt; }
  </style>
</head>
<body>
  ${coverHtml}
  ${tocHtml}
  <main>
    ${!cover && session.topic ? `<h1 class="cover-topic" style="text-align:center;margin-bottom:16pt;">${escapeHtml(session.topic)}</h1>` : ''}
    ${sectionsHtml}
  </main>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => {
        iframe.remove();
      }, 1500);
    }
  };

  window.setTimeout(triggerPrint, 250);
}
