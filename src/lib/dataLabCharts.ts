import { FullStatsAnalysis, SurveyProject } from '../types/dataLab';
import { fmtNum, fmtP } from './statsEngine';

export interface GeneratedDataChart {
  id: string;
  fileName: string;
  caption: string;
  dataUrl: string;
  width: number;
  height: number;
}

const CHART_W = 1200;
const CHART_H = 680;

function createCanvas(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = CHART_W;
  canvas.height = CHART_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ Canvas 2D để vẽ biểu đồ.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CHART_W, CHART_H);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CHART_W - 2, CHART_H - 2);
  return { canvas, ctx };
}

function drawChartHeader(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string
): void {
  ctx.fillStyle = '#0B2559';
  ctx.fillRect(48, 36, 8, 52);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 72, 62);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px "DM Sans", system-ui, sans-serif';
  ctx.fillText(subtitle, 72, 88);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

export function renderConstructMeansChart(
  project: SurveyProject,
  analysis: FullStatsAnalysis
): GeneratedDataChart | null {
  const items = analysis.constructDescriptives;
  if (items.length === 0 || analysis.validN === 0) return null;

  const { canvas, ctx } = createCanvas();
  const maxScale = project.likertScale;

  drawChartHeader(
    ctx,
    'Điểm trung bình (Mean) & Độ lệch chuẩn (SD) các nhân tố',
    `Thang đo Likert ${maxScale} mức · Cỡ mẫu hợp lệ N = ${analysis.validN}`
  );

  const plotLeft = 100;
  const plotRight = CHART_W - 64;
  const plotTop = 140;
  const plotBottom = CHART_H - 115;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  // Horizontal grid lines
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.font = '600 16px "JetBrains Mono", monospace';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'right';
  for (let tick = 0; tick <= maxScale; tick += 1) {
    const y = plotBottom - (tick / maxScale) * plotH;
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotRight, y);
    ctx.stroke();
    ctx.fillText(String(tick), plotLeft - 14, y + 6);
  }

  const slotW = plotW / items.length;
  const barW = Math.min(110, Math.max(44, slotW * 0.52));

  items.forEach((item, idx) => {
    const cx = plotLeft + slotW * idx + slotW / 2;
    const barH = Math.max(4, (item.mean / maxScale) * plotH);
    const barX = cx - barW / 2;
    const barY = plotBottom - barH;

    ctx.fillStyle = item.role === 'dependent' ? '#EA580C' : '#12489B';
    drawRoundedRect(ctx, barX, barY, barW, barH, 10);

    // Value label above bar
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${fmtNum(item.mean, 2)}`, cx, barY - 26);
    ctx.fillStyle = '#64748B';
    ctx.font = '500 14px "JetBrains Mono", monospace';
    ctx.fillText(`(SD=${fmtNum(item.sd, 2)})`, cx, barY - 8);

    // X-axis label
    ctx.fillStyle = '#0B2559';
    ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(item.code, cx, plotBottom + 32);

    ctx.fillStyle = '#475569';
    ctx.font = '500 14px "DM Sans", system-ui, sans-serif';
    const shortName =
      item.name.length > 22 ? `${item.name.slice(0, 20)}…` : item.name;
    ctx.fillText(shortName, cx, plotBottom + 56);
  });

  // Legend
  ctx.fillStyle = '#12489B';
  drawRoundedRect(ctx, plotLeft, CHART_H - 36, 16, 16, 4);
  ctx.fillStyle = '#334155';
  ctx.font = '600 14px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Biến độc lập', plotLeft + 24, CHART_H - 23);

  ctx.fillStyle = '#EA580C';
  drawRoundedRect(ctx, plotLeft + 150, CHART_H - 36, 16, 16, 4);
  ctx.fillStyle = '#334155';
  ctx.fillText('Biến phụ thuộc', plotLeft + 174, CHART_H - 23);

  return {
    id: 'chart_means',
    fileName: 'Chart_Construct_Means.png',
    caption: `Giá trị trung bình (Mean) và độ lệch chuẩn (SD) của các nhân tố nghiên cứu (N = ${analysis.validN})`,
    dataUrl: canvas.toDataURL('image/png'),
    width: CHART_W,
    height: CHART_H,
  };
}

export function renderRegressionBetaChart(
  analysis: FullStatsAnalysis
): GeneratedDataChart | null {
  const reg = analysis.regression;
  if (!reg || reg.coefficients.length === 0) return null;

  const { canvas, ctx } = createCanvas();
  const sorted = [...reg.coefficients].sort(
    (a, b) => Math.abs(b.beta) - Math.abs(a.beta)
  );

  drawChartHeader(
    ctx,
    `Mức độ tác động chuẩn hóa (Beta) lên ${reg.dependentName} (${reg.dependentCode})`,
    `Adjusted R² = ${fmtNum(reg.adjRSquare)} (${(reg.adjRSquare * 100).toFixed(
      1
    )}%) · F = ${fmtNum(reg.anova.fStat, 2)} (Sig. ${fmtP(
      reg.anova.pValue
    )}) · N = ${reg.n}`
  );

  const plotLeft = 320;
  const plotRight = CHART_W - 150;
  const plotTop = 145;
  const plotBottom = CHART_H - 80;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  const maxBeta = Math.max(
    0.5,
    ...sorted.map((c) => Math.abs(c.beta) * 1.18)
  );

  // Vertical grid lines
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'center';
  const steps = 5;
  for (let i = 0; i <= steps; i += 1) {
    const val = (maxBeta / steps) * i;
    const x = plotLeft + (val / maxBeta) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, plotTop);
    ctx.lineTo(x, plotBottom);
    ctx.stroke();
    ctx.fillText(val.toFixed(2), x, plotBottom + 28);
  }

  const rowH = plotH / sorted.length;
  const barH = Math.min(54, Math.max(28, rowH * 0.54));

  sorted.forEach((coef, idx) => {
    const cy = plotTop + rowH * idx + rowH / 2;
    const barY = cy - barH / 2;
    const barW = Math.max(6, (Math.abs(coef.beta) / maxBeta) * plotW);

    // Label on left
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0B2559';
    ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(coef.code, plotLeft - 18, cy - 2);
    ctx.fillStyle = '#475569';
    ctx.font = '500 14px "DM Sans", system-ui, sans-serif';
    const shortLabel =
      coef.name.length > 30 ? `${coef.name.slice(0, 28)}…` : coef.name;
    ctx.fillText(shortLabel, plotLeft - 18, cy + 18);

    // Bar
    ctx.fillStyle = coef.supported ? '#0B2559' : '#94A3B8';
    drawRoundedRect(ctx, plotLeft, barY, barW, barH, 8);

    // Beta + Sig label on right of bar
    ctx.textAlign = 'left';
    ctx.fillStyle = coef.supported ? '#059669' : '#64748B';
    ctx.font = '700 17px "JetBrains Mono", monospace';
    ctx.fillText(
      `β = ${fmtNum(coef.beta, 3)} (p ${fmtP(coef.p)})`,
      plotLeft + barW + 14,
      cy + 6
    );
  });

  return {
    id: 'chart_regression',
    fileName: 'Chart_Regression_Beta.png',
    caption: `Hệ số hồi quy chuẩn hóa (Beta) tác động lên ${reg.dependentName} (Adjusted R² = ${fmtNum(
      reg.adjRSquare
    )})`,
    dataUrl: canvas.toDataURL('image/png'),
    width: CHART_W,
    height: CHART_H,
  };
}

export function renderDemographicChart(
  analysis: FullStatsAnalysis
): GeneratedDataChart | null {
  const primaryDemo =
    analysis.demographicStats.find((d) => d.buckets.length >= 3 && d.total > 0) ||
    analysis.demographicStats.find((d) => d.total > 0);
  if (!primaryDemo) return null;

  const { canvas, ctx } = createCanvas();
  drawChartHeader(
    ctx,
    `Cơ cấu mẫu khảo sát theo ${primaryDemo.label}`,
    `Tổng số phản hồi hợp lệ: n = ${primaryDemo.total}`
  );

  const plotLeft = 100;
  const plotRight = CHART_W - 64;
  const plotTop = 140;
  const plotBottom = CHART_H - 105;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  const maxPct = Math.max(
    40,
    ...primaryDemo.buckets.map((b) => Math.ceil((b.percent * 1.2) / 10) * 10)
  );

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i += 1) {
    const pct = (maxPct / 4) * i;
    const y = plotBottom - (pct / maxPct) * plotH;
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotRight, y);
    ctx.stroke();
    ctx.fillText(`${pct.toFixed(0)}%`, plotLeft - 14, y + 5);
  }

  const palette = ['#0B2559', '#12489B', '#0284C7', '#D97706', '#059669'];
  const slotW = plotW / primaryDemo.buckets.length;
  const barW = Math.min(120, Math.max(48, slotW * 0.5));

  primaryDemo.buckets.forEach((b, idx) => {
    const cx = plotLeft + slotW * idx + slotW / 2;
    const barH = Math.max(4, (b.percent / maxPct) * plotH);
    const barX = cx - barW / 2;
    const barY = plotBottom - barH;

    ctx.fillStyle = palette[idx % palette.length];
    drawRoundedRect(ctx, barX, barY, barW, barH, 10);

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${b.percent.toFixed(1)}%`, cx, barY - 26);
    ctx.fillStyle = '#64748B';
    ctx.font = '500 14px "JetBrains Mono", monospace';
    ctx.fillText(`(n = ${b.count})`, cx, barY - 8);

    ctx.fillStyle = '#1E293B';
    ctx.font = '600 16px "DM Sans", system-ui, sans-serif';
    ctx.fillText(b.option, cx, plotBottom + 36);
  });

  return {
    id: 'chart_demographic',
    fileName: `Chart_Demographic_${primaryDemo.code}.png`,
    caption: `Phân bố mẫu khảo sát theo ${primaryDemo.label} (n = ${primaryDemo.total})`,
    dataUrl: canvas.toDataURL('image/png'),
    width: CHART_W,
    height: CHART_H,
  };
}
