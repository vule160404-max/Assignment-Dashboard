import { PDFDocument } from 'pdf-lib';
import {
  DEFAULT_COVER_PAGE_CONFIG,
  WriterSession,
} from '../components/admin/writer/types';
import {
  findSessionImageByTag,
  parseFigureMarkerTag,
} from './writerImageUtils';

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không tải được ảnh để xuất PDF.'));
    img.src = src;
  });
}

// A4 dimensions in points (72 DPI) and 2x render canvas (144 DPI = crisp print quality)
const A4_PT_W = 595.28;
const A4_PT_H = 841.89;
const SCALE = 2;
const CANVAS_W = Math.round(A4_PT_W * SCALE); // 1191 px
const CANVAS_H = Math.round(A4_PT_H * SCALE); // 1684 px

function stripMarkdown(raw: string): string {
  return raw
    .replace(/^[ \t]*#{1,6}[ \t]*/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  firstLineIndentPx = 0
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const lineLimit = lines.length === 0 ? maxWidth - firstLineIndentPx : maxWidth;
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= lineLimit || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function createBlankPageCanvas(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ Canvas để tạo tệp PDF.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#0F172A';
  ctx.textBaseline = 'top';
  return { canvas, ctx };
}

function drawJustifiedLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  targetWidth: number,
  isLastLine: boolean
): void {
  const words = line.split(' ').filter(Boolean);
  if (isLastLine || words.length <= 1) {
    ctx.fillText(line, x, y);
    return;
  }
  const wordsWidth = words.reduce((acc, w) => acc + ctx.measureText(w).width, 0);
  const gap = (targetWidth - wordsWidth) / (words.length - 1);
  if (gap <= 0 || gap > 36) {
    ctx.fillText(line, x, y);
    return;
  }
  let cursorX = x;
  for (let i = 0; i < words.length; i++) {
    ctx.fillText(words[i], cursorX, y);
    cursorX += ctx.measureText(words[i]).width + gap;
  }
}

export async function exportWriterSessionToPdf(
  session: WriterSession
): Promise<string> {
  const fmt = session.format;
  const isVi = session.writingLanguage === 'Vietnamese';
  const cover = fmt.coverPage?.enabled
    ? { ...DEFAULT_COVER_PAGE_CONFIG, ...fmt.coverPage }
    : null;
  const includeToc = fmt.includeTableOfContents ?? true;

  const fontStack = `"${fmt.fontFamily}", "Times New Roman", Arial, sans-serif`;
  const marginPx = Math.round((fmt.marginInch || 1) * 72 * SCALE); // 1in = 144px at 2x
  const contentW = CANVAS_W - marginPx * 2;
  const topY = marginPx;
  const bottomLimitY = CANVAS_H - marginPx - 28;
  const baseFontPx = Math.round((fmt.fontSizePt || 12) * (96 / 72) * SCALE * 0.78);
  const lineHeightPx = Math.round(baseFontPx * (fmt.lineSpacing || 1.5));
  const paraGapPx = Math.round(((fmt.paragraphSpacingAfterPt || 6) + 4) * SCALE * 0.85);
  const firstLineIndentPx = fmt.firstLineIndent ? Math.round(36 * SCALE) : 0;

  const totalWords = session.outline.reduce((sum, sec) => {
    const w = sec.content.trim() ? sec.content.trim().split(/\s+/).length : 0;
    return sum + w;
  }, 0);

  const pageCanvases: HTMLCanvasElement[] = [];

  // --- 1. COVER PAGE ---
  if (cover) {
    const { canvas, ctx } = createBlankPageCanvas();
    const f = cover.fields;
    const isModern = cover.templateId === 'modern_executive';

    if (cover.showBorder) {
      ctx.strokeStyle = '#0B2559';
      ctx.lineWidth = 4;
      ctx.strokeRect(marginPx - 24, marginPx - 24, contentW + 48, CANVAS_H - marginPx * 2 + 48);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(marginPx - 14, marginPx - 14, contentW + 28, CANVAS_H - marginPx * 2 + 28);
    } else if (isModern) {
      ctx.fillStyle = '#0B2559';
      ctx.fillRect(marginPx, marginPx, contentW, 10);
      ctx.fillStyle = '#D97706';
      ctx.fillRect(marginPx, CANVAS_H - marginPx - 6, contentW, 6);
    }

    // Top zone
    let cy = marginPx + 36;
    ctx.textAlign = 'center';
    if (f.showUniversity && cover.universityName.trim()) {
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 ${Math.round(13.5 * SCALE)}px ${fontStack}`;
      for (const l of wrapTextLines(ctx, cover.universityName.trim().toUpperCase(), contentW - 40)) {
        ctx.fillText(l, CANVAS_W / 2, cy);
        cy += Math.round(20 * SCALE);
      }
    }
    if (f.showFaculty && cover.facultyName.trim()) {
      ctx.fillStyle = '#334155';
      ctx.font = `600 ${Math.round(12 * SCALE)}px ${fontStack}`;
      for (const l of wrapTextLines(ctx, cover.facultyName.trim().toUpperCase(), contentW - 40)) {
        ctx.fillText(l, CANVAS_W / 2, cy);
        cy += Math.round(18 * SCALE);
      }
    }
    if (f.showDocumentType && cover.documentTypeLabel.trim()) {
      cy += Math.round(36 * SCALE);
      ctx.fillStyle = '#0B2559';
      ctx.font = `700 ${Math.round(13.5 * SCALE)}px ${fontStack}`;
      ctx.fillText(cover.documentTypeLabel.trim().toUpperCase(), CANVAS_W / 2, cy);
    }

    // Middle zone: Topic + Metadata
    let midY = Math.round(CANVAS_H * 0.34);
    if (f.showTopic) {
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 ${Math.round(17.5 * SCALE)}px ${fontStack}`;
      const topicText = (session.topic || session.title || 'ACADEMIC PAPER').trim();
      const rawTopicParagraphs = topicText.split(/\r?\n/);
      for (const para of rawTopicParagraphs) {
        const trimmedPara = para.trim();
        if (!trimmedPara) {
          midY += Math.round(14 * SCALE);
          continue;
        }
        const wrapped = wrapTextLines(ctx, trimmedPara, contentW - 60);
        for (const l of wrapped) {
          ctx.fillText(l, CANVAS_W / 2, midY);
          midY += Math.round(25 * SCALE);
        }
      }
    }

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

    if (metaRows.length > 0) {
      let metaY = Math.max(midY + Math.round(44 * SCALE), Math.round(CANVAS_H * 0.54));
      const boxLeft = marginPx + 64;
      const labelW = 240;
      const valueMaxW = contentW - 128 - labelW;
      ctx.textAlign = 'left';
      const metaFontPx = Math.round(11.5 * SCALE);
      const metaLineH = Math.round(18 * SCALE);

      for (const row of metaRows) {
        ctx.fillStyle = '#334155';
        ctx.font = `700 ${metaFontPx}px ${fontStack}`;
        ctx.fillText(row.label, boxLeft, metaY);

        ctx.fillStyle = '#0F172A';
        ctx.font = `400 ${metaFontPx}px ${fontStack}`;
        const valLines = wrapTextLines(ctx, row.value, valueMaxW);
        for (let i = 0; i < valLines.length; i++) {
          ctx.fillText(valLines[i], boxLeft + labelW, metaY + i * metaLineH);
        }
        metaY += Math.max(1, valLines.length) * metaLineH + Math.round(6 * SCALE);
      }
    }

    // Bottom zone: Location & Date
    if (f.showSubmissionDate && cover.locationAndDate.trim()) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0F172A';
      ctx.font = `700 ${Math.round(12 * SCALE)}px ${fontStack}`;
      ctx.fillText(
        cover.locationAndDate.trim(),
        CANVAS_W / 2,
        CANVAS_H - marginPx - Math.round(34 * SCALE)
      );
    }

    pageCanvases.push(canvas);
  }

  // --- 2. RENDER BODY PAGES FIRST SO WE KNOW EXACT PAGE NUMBERS FOR TABLE OF CONTENTS ---
  const bodyCanvases: HTMLCanvasElement[] = [];
  const tocEntries: Array<{ title: string; level: 1 | 2; bodyPageIndex: number }> = [];

  let current = createBlankPageCanvas();
  let cursorY = topY;

  const commitBodyPage = () => {
    bodyCanvases.push(current.canvas);
    current = createBlankPageCanvas();
    cursorY = topY;
  };

  const ensureSpace = (neededPx: number) => {
    if (cursorY + neededPx > bottomLimitY && cursorY > topY) {
      commitBodyPage();
    }
  };

  let pdfFigureCounter = 0;

  for (const sec of session.outline) {
    const cleanSecTitle = stripMarkdown(sec.title);
    const isRefSec =
      /^(references|bibliography|works cited|tài liệu tham khảo|danh mục tài liệu tham khảo)/i.test(
        cleanSecTitle.replace(/^\d+(\.\d+)*\.?\s*/, '').trim()
      );

    // Heading
    const headingFontPx =
      sec.headingLevel === 'h1'
        ? Math.round(baseFontPx * 1.25)
        : sec.headingLevel === 'h2'
        ? Math.round(baseFontPx * 1.12)
        : baseFontPx;
    const headingLineH = Math.round(headingFontPx * 1.35);

    current.ctx.font = `700 ${headingFontPx}px ${fontStack}`;
    current.ctx.fillStyle = '#0F172A';
    current.ctx.textAlign = 'left';

    const hLines = wrapTextLines(current.ctx, cleanSecTitle, contentW);
    ensureSpace(hLines.length * headingLineH + lineHeightPx * 2);

    // Re-apply font & color after potential page break in ensureSpace
    current.ctx.font = `700 ${headingFontPx}px ${fontStack}`;
    current.ctx.fillStyle = '#0F172A';
    current.ctx.textAlign = 'left';

    tocEntries.push({
      title: cleanSecTitle,
      level: sec.headingLevel === 'h1' ? 1 : 2,
      bodyPageIndex: bodyCanvases.length,
    });

    if (cursorY > topY) {
      cursorY += Math.round(10 * SCALE);
    }
    for (const hl of hLines) {
      current.ctx.fillText(hl, marginPx, cursorY);
      cursorY += headingLineH;
    }
    cursorY += Math.round(6 * SCALE);

    // Body paragraphs
    const rawParas = sec.content
      .split(/\r?\n+/)
      .map((l) => stripMarkdown(l))
      .filter(Boolean);

    for (const para of rawParas) {
      const figTag = parseFigureMarkerTag(para);
      if (figTag) {
        const matchedImg = findSessionImageByTag(session.contextImages, figTag);
        if (matchedImg) {
          try {
            const loaded = await loadHtmlImage(matchedImg.dataUrl);
            pdfFigureCounter += 1;
            const maxDrawW = Math.round(contentW * 0.88);
            const maxDrawH = Math.round(330 * SCALE);
            const natW = Math.max(1, loaded.naturalWidth || matchedImg.width || 800);
            const natH = Math.max(1, loaded.naturalHeight || matchedImg.height || 500);
            const ratio = Math.min(maxDrawW / natW, maxDrawH / natH, 1);
            const drawW = Math.round(natW * ratio);
            const drawH = Math.round(natH * ratio);
            const captionFontPx = Math.max(18, Math.round(baseFontPx * 0.9));
            const captionBlockH = Math.round(34 * SCALE);

            ensureSpace(drawH + captionBlockH + Math.round(16 * SCALE));
            cursorY += Math.round(8 * SCALE);
            const drawX = Math.round((CANVAS_W - drawW) / 2);
            current.ctx.drawImage(loaded, drawX, cursorY, drawW, drawH);
            current.ctx.strokeStyle = '#E2E8F0';
            current.ctx.lineWidth = 1;
            current.ctx.strokeRect(drawX, cursorY, drawW, drawH);
            cursorY += drawH + Math.round(16 * SCALE);

            const figPrefix =
              session.writingLanguage === 'Vietnamese'
                ? `Hình ${pdfFigureCounter}.`
                : `Figure ${pdfFigureCounter}.`;
            const captionStr = `${figPrefix} ${matchedImg.caption || matchedImg.name}`;
            current.ctx.font = `italic ${captionFontPx}px ${fontStack}`;
            current.ctx.fillStyle = '#334155';
            current.ctx.textAlign = 'center';
            const capLines = wrapTextLines(current.ctx, captionStr, contentW);
            for (const cl of capLines) {
              current.ctx.fillText(cl, CANVAS_W / 2, cursorY);
              cursorY += Math.round(captionFontPx * 1.35);
            }
            current.ctx.textAlign = 'left';
            cursorY += paraGapPx;
            continue;
          } catch {
            // fall through if image fails to load
          }
        }
      }

      const isSubHeading =
        !isRefSec &&
        /^\d+\.\d+(?:\.\d+)?\.?\s+\S/.test(para) &&
        para.length <= 130;

      if (isSubHeading) {
        const subFontPx = Math.round(baseFontPx * 1.08);
        const subLineH = Math.round(subFontPx * 1.35);
        current.ctx.font = `700 ${subFontPx}px ${fontStack}`;
        current.ctx.fillStyle = '#0F172A';
        current.ctx.textAlign = 'left';
        const subLines = wrapTextLines(current.ctx, para, contentW);
        ensureSpace(subLines.length * subLineH + lineHeightPx);

        // Re-apply font & color after potential page break
        current.ctx.font = `700 ${subFontPx}px ${fontStack}`;
        current.ctx.fillStyle = '#0F172A';
        current.ctx.textAlign = 'left';

        tocEntries.push({
          title: para,
          level: 2,
          bodyPageIndex: bodyCanvases.length,
        });

        cursorY += Math.round(6 * SCALE);
        for (const sl of subLines) {
          current.ctx.fillText(sl, marginPx, cursorY);
          cursorY += subLineH;
        }
        cursorY += Math.round(4 * SCALE);
        continue;
      }

      current.ctx.font = `400 ${baseFontPx}px ${fontStack}`;
      current.ctx.fillStyle = '#0F172A';
      current.ctx.textAlign = 'left';

      const hangIndent = isRefSec ? Math.round(32 * SCALE) : 0;
      const indent0 = isRefSec ? 0 : firstLineIndentPx;
      const pLines = wrapTextLines(
        current.ctx,
        para,
        isRefSec ? contentW - hangIndent : contentW,
        indent0
      );

      for (let li = 0; li < pLines.length; li++) {
        ensureSpace(lineHeightPx);
        // Re-apply font & color after potential page break
        current.ctx.font = `400 ${baseFontPx}px ${fontStack}`;
        current.ctx.fillStyle = '#0F172A';
        current.ctx.textAlign = 'left';
        const line = pLines[li];
        const x =
          marginPx + (li === 0 ? indent0 : isRefSec ? hangIndent : 0);
        const availW =
          contentW - (li === 0 ? indent0 : isRefSec ? hangIndent : 0);

        if (!isRefSec && fmt.textAlign === 'justify') {
          drawJustifiedLine(
            current.ctx,
            line,
            x,
            cursorY,
            availW,
            li === pLines.length - 1
          );
        } else {
          current.ctx.fillText(line, x, cursorY);
        }
        cursorY += lineHeightPx;
      }
      cursorY += paraGapPx;
    }
  }

  if (cursorY > topY || bodyCanvases.length === 0) {
    bodyCanvases.push(current.canvas);
  }

  // --- 3. BUILD TABLE OF CONTENTS PAGE(S) WITH REAL PAGE NUMBERS ---
  const tocCanvases: HTMLCanvasElement[] = [];
  if (includeToc && tocEntries.length > 0) {
    const tocPageCountEst = Math.max(1, Math.ceil(tocEntries.length / 26));
    const bodyPageOffset = (cover ? 1 : 0) + tocPageCountEst + 1;

    let tocPage = createBlankPageCanvas();
    let ty = topY;

    tocPage.ctx.textAlign = 'center';
    tocPage.ctx.fillStyle = '#0F172A';
    tocPage.ctx.font = `700 ${Math.round(14.5 * SCALE)}px ${fontStack}`;
    tocPage.ctx.fillText(
      isVi ? 'MỤC LỤC' : 'TABLE OF CONTENTS',
      CANVAS_W / 2,
      ty
    );
    ty += Math.round(30 * SCALE);

    const tocFontPx = Math.round(11.5 * SCALE);
    const tocLineH = Math.round(22 * SCALE);

    for (const item of tocEntries) {
      if (ty + tocLineH > bottomLimitY) {
        tocCanvases.push(tocPage.canvas);
        tocPage = createBlankPageCanvas();
        ty = topY;
      }

      const indent = item.level === 2 ? Math.round(22 * SCALE) : 0;
      if (item.level === 1 && ty > topY + Math.round(34 * SCALE)) {
        ty += Math.round(4 * SCALE);
      }

      const pageNumStr = String(bodyPageOffset + item.bodyPageIndex);
      tocPage.ctx.font = `${item.level === 1 ? '700' : '400'} ${tocFontPx}px ${fontStack}`;
      tocPage.ctx.fillStyle = '#0F172A';
      tocPage.ctx.textAlign = 'left';

      const maxTitleW = contentW - indent - 70;
      let displayTitle = item.title;
      while (
        tocPage.ctx.measureText(displayTitle).width > maxTitleW &&
        displayTitle.length > 12
      ) {
        displayTitle = `${displayTitle.slice(0, -4)}...`;
      }

      const titleX = marginPx + indent;
      tocPage.ctx.fillText(displayTitle, titleX, ty);

      const pageNumW = tocPage.ctx.measureText(pageNumStr).width;
      const pageNumX = CANVAS_W - marginPx - pageNumW;
      tocPage.ctx.fillText(pageNumStr, pageNumX, ty);

      // Dotted leader
      const dotsStartX = titleX + tocPage.ctx.measureText(displayTitle).width + 12;
      const dotsEndX = pageNumX - 12;
      if (dotsEndX > dotsStartX + 12) {
        tocPage.ctx.save();
        tocPage.ctx.strokeStyle = '#94A3B8';
        tocPage.ctx.lineWidth = 1.5;
        tocPage.ctx.setLineDash([2, 6]);
        tocPage.ctx.beginPath();
        tocPage.ctx.moveTo(dotsStartX, ty + tocFontPx - 4);
        tocPage.ctx.lineTo(dotsEndX, ty + tocFontPx - 4);
        tocPage.ctx.stroke();
        tocPage.ctx.restore();
      }

      ty += tocLineH;
    }

    tocCanvases.push(tocPage.canvas);
  }

  // Assemble all pages & stamp clean centered page numbers on non-cover pages
  const allCanvases = [...pageCanvases, ...tocCanvases, ...bodyCanvases];
  if (fmt.includePageNumbers !== false) {
    for (let idx = 0; idx < allCanvases.length; idx++) {
      if (cover && idx === 0) continue; // No page number on cover page
      const ctx = allCanvases[idx].getContext('2d');
      if (!ctx) continue;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748B';
      ctx.font = `400 ${Math.round(10 * SCALE)}px ${fontStack}`;
      ctx.fillText(
        String(idx + 1),
        CANVAS_W / 2,
        CANVAS_H - Math.round(marginPx * 0.55)
      );
    }
  }

  // --- 4. PACK INTO A REAL .PDF FILE VIA PDF-LIB & DOWNLOAD DIRECTLY ---
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(session.topic || session.title || 'Academic Paper');
  pdfDoc.setCreator('AssignTrack Academic Studio');

  for (const pageCanvas of allCanvases) {
    const jpegDataUrl = pageCanvas.toDataURL('image/jpeg', 0.92);
    const base64 = jpegDataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const embeddedImg = await pdfDoc.embedJpg(bytes);
    const pdfPage = pdfDoc.addPage([A4_PT_W, A4_PT_H]);
    pdfPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: A4_PT_W,
      height: A4_PT_H,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const safeBaseName = (
    session.linkedOrderCode
      ? `${session.linkedOrderCode}_${session.topic || session.title}`
      : session.topic || session.title || 'AssignTrack_Paper'
  )
    .replace(/[^a-zA-Z0-9À-ỹ_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 64);
  const fileName = `${safeBaseName || 'AssignTrack_Paper'}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);

  return fileName;
}
