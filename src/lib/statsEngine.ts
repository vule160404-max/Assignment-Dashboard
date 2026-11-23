import {
  ConstructDescriptiveStat,
  CorrelationCell,
  CorrelationMatrixResult,
  CronbachConstructResult,
  CronbachItemRow,
  DemographicFreqResult,
  FullStatsAnalysis,
  GroupDifferenceResult,
  ItemDescriptiveStat,
  RegressionCoefficientRow,
  RegressionResult,
  SurveyProject,
  SurveyResponseRow,
} from '../types/dataLab';

// ============================================================================
// 1. Mathematical & Probability Distribution Helpers (Student-t & F p-values)
// ============================================================================

function logGamma(z: number): number {
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const zm1 = z - 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i += 1) {
    x += p[i] / (zm1 + i);
  }
  const t = zm1 + g + 0.5;
  return (
    0.5 * Math.log(2 * Math.PI) +
    (zm1 + 0.5) * Math.log(t) -
    t +
    Math.log(x)
  );
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) -
      logGamma(a) -
      logGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

export function studentTTwoTailedP(tStat: number, df: number): number {
  if (!Number.isFinite(tStat) || !Number.isFinite(df) || df <= 0) return 1;
  const t2 = tStat * tStat;
  const x = df / (df + t2);
  const p = regularizedIncompleteBeta(x, df / 2, 0.5);
  return Math.max(0, Math.min(1, p));
}

export function fDistUpperTailP(fStat: number, df1: number, df2: number): number {
  if (
    !Number.isFinite(fStat) ||
    fStat <= 0 ||
    !Number.isFinite(df1) ||
    !Number.isFinite(df2) ||
    df1 <= 0 ||
    df2 <= 0
  ) {
    return 1;
  }
  const x = df2 / (df2 + df1 * fStat);
  const p = regularizedIncompleteBeta(x, df2 / 2, df1 / 2);
  return Math.max(0, Math.min(1, p));
}

function calcMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calcSampleVariance(arr: number[], meanVal?: number): number {
  if (arr.length < 2) return 0;
  const m = meanVal ?? calcMean(arr);
  let sumSq = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const d = arr[i] - m;
    sumSq += d * d;
  }
  return sumSq / (arr.length - 1);
}

function calcSkewKurt(
  arr: number[],
  meanVal: number,
  sd: number
): { skewness: number; kurtosis: number } {
  const n = arr.length;
  if (n < 4 || sd === 0) return { skewness: 0, kurtosis: 0 };
  let m3 = 0;
  let m4 = 0;
  for (let i = 0; i < n; i += 1) {
    const z = (arr[i] - meanVal) / sd;
    m3 += z * z * z;
    m4 += z * z * z * z;
  }
  const skewness = (n / ((n - 1) * (n - 2))) * m3;
  const term1 = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * m4;
  const term2 = (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
  const kurtosis = term1 - term2;
  return { skewness, kurtosis };
}

function calcPearson(xs: number[], ys: number[]): { r: number; p: number; n: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return { r: 0, p: 1, n };
  const mx = calcMean(xs);
  const my = calcMean(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return { r: 0, p: 1, n };
  const r = Math.max(-1, Math.min(1, num / denom));
  if (Math.abs(r) >= 0.999999) return { r, p: 0, n };
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  const p = studentTTwoTailedP(t, n - 2);
  return { r, p, n };
}

/** Gauss-Jordan matrix inversion with partial pivoting */
function invertMatrix(mat: number[][]): number[][] | null {
  const n = mat.length;
  const aug: number[][] = mat.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(aug[r][col]) > maxVal) {
        maxVal = Math.abs(aug[r][col]);
        pivotRow = r;
      }
    }
    if (maxVal < 1e-12) return null;
    if (pivotRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[pivotRow];
      aug[pivotRow] = tmp;
    }
    const pivot = aug[col][col];
    for (let c = 0; c < 2 * n; c += 1) {
      aug[col][c] /= pivot;
    }
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let c = 0; c < 2 * n; c += 1) {
        aug[r][c] -= factor * aug[col][c];
      }
    }
  }
  return aug.map((row) => row.slice(n));
}

function fitOlsBasic(
  X: number[][], // n x k (without intercept)
  y: number[]
): {
  betas: number[]; // length k + 1 (index 0 = intercept)
  se: number[];
  rSquare: number;
  adjRSquare: number;
  stdError: number;
  ssReg: number;
  ssRes: number;
  ssTot: number;
  durbinWatson: number;
} | null {
  const n = y.length;
  const k = X[0]?.length || 0;
  if (n <= k + 2 || k === 0) return null;

  const p = k + 1;
  const design: number[][] = X.map((row) => [1, ...row]);

  // Compute XtX (p x p) and Xty (p)
  const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const Xty: number[] = Array(p).fill(0);

  for (let i = 0; i < n; i += 1) {
    const row = design[i];
    const yi = y[i];
    for (let a = 0; a < p; a += 1) {
      Xty[a] += row[a] * yi;
      for (let b = 0; b < p; b += 1) {
        XtX[a][b] += row[a] * row[b];
      }
    }
  }

  const XtXInv = invertMatrix(XtX);
  if (!XtXInv) return null;

  const betas: number[] = Array(p).fill(0);
  for (let a = 0; a < p; a += 1) {
    let s = 0;
    for (let b = 0; b < p; b += 1) {
      s += XtXInv[a][b] * Xty[b];
    }
    betas[a] = s;
  }

  const yMean = calcMean(y);
  let ssTot = 0;
  let ssRes = 0;
  const residuals: number[] = [];
  for (let i = 0; i < n; i += 1) {
    let yHat = 0;
    for (let a = 0; a < p; a += 1) {
      yHat += design[i][a] * betas[a];
    }
    const res = y[i] - yHat;
    residuals.push(res);
    ssRes += res * res;
    const dy = y[i] - yMean;
    ssTot += dy * dy;
  }

  const ssReg = Math.max(0, ssTot - ssRes);
  const dfRes = n - p;
  const msRes = ssRes / dfRes;
  const stdError = Math.sqrt(Math.max(0, msRes));
  const rSquare = ssTot > 0 ? Math.max(0, Math.min(1, ssReg / ssTot)) : 0;
  const adjRSquare = 1 - ((1 - rSquare) * (n - 1)) / dfRes;

  const se = Array.from({ length: p }, (_, idx) =>
    Math.sqrt(Math.max(0, msRes * XtXInv[idx][idx]))
  );

  let dwNum = 0;
  for (let i = 1; i < residuals.length; i += 1) {
    const diff = residuals[i] - residuals[i - 1];
    dwNum += diff * diff;
  }
  const durbinWatson = ssRes > 0 ? dwNum / ssRes : 2.0;

  return {
    betas,
    se,
    rSquare,
    adjRSquare,
    stdError,
    ssReg,
    ssRes,
    ssTot,
    durbinWatson,
  };
}

// ============================================================================
// 2. Full SPSS-Grade Statistical Analysis Pipeline
// ============================================================================

export function runFullSurveyAnalysis(project: SurveyProject): FullStatsAnalysis {
  const allItemCodes = project.constructs.flatMap((c) =>
    c.items.map((it) => it.code)
  );
  const totalRows = project.rows.length;

  let missingRowsCount = 0;
  const straightLinerIds: string[] = [];
  const validRows: SurveyResponseRow[] = [];

  for (const row of project.rows) {
    const vals: number[] = [];
    let hasMissing = false;
    for (const code of allItemCodes) {
      const v = row.values[code];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        hasMissing = true;
      } else {
        vals.push(v);
      }
    }
    if (hasMissing) {
      missingRowsCount += 1;
    } else {
      validRows.push(row);
      if (vals.length >= 6) {
        const first = vals[0];
        if (vals.every((x) => x === first)) {
          straightLinerIds.push(row.id);
        }
      }
    }
  }

  // 2.1 Demographic Frequencies
  const demographicStats: DemographicFreqResult[] = project.demographics.map(
    (dq) => {
      const counts = new Map<string, number>();
      dq.options.forEach((opt) => counts.set(opt, 0));
      let total = 0;
      for (const row of project.rows) {
        const val = (row.demographics[dq.code] || '').trim();
        if (!val) continue;
        counts.set(val, (counts.get(val) || 0) + 1);
        total += 1;
      }
      const buckets = Array.from(counts.entries()).map(([option, count]) => ({
        option,
        count,
        percent: total > 0 ? (count / total) * 100 : 0,
      }));
      return {
        code: dq.code,
        label: dq.label,
        total,
        buckets,
      };
    }
  );

  // 2.2 Item Descriptives
  const itemDescriptives: ItemDescriptiveStat[] = [];
  for (const c of project.constructs) {
    for (const item of c.items) {
      const vals = project.rows
        .map((r) => r.values[item.code])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const mean = calcMean(vals);
      const sd = Math.sqrt(calcSampleVariance(vals, mean));
      const { skewness, kurtosis } = calcSkewKurt(vals, mean, sd);
      itemDescriptives.push({
        code: item.code,
        label: item.label,
        constructCode: c.code,
        n: vals.length,
        mean,
        sd,
        min: vals.length > 0 ? Math.min(...vals) : 0,
        max: vals.length > 0 ? Math.max(...vals) : 0,
        skewness,
        kurtosis,
      });
    }
  }

  // Compute composite construct scores per valid row
  const constructVectors: Record<string, number[]> = {};
  for (const c of project.constructs) {
    constructVectors[c.code] = validRows.map((row) => {
      const vals = c.items.map((it) => row.values[it.code] as number);
      return calcMean(vals);
    });
  }

  // 2.3 Construct Descriptives
  const constructDescriptives: ConstructDescriptiveStat[] =
    project.constructs.map((c) => {
      const vec = constructVectors[c.code] || [];
      const mean = calcMean(vec);
      const sd = Math.sqrt(calcSampleVariance(vec, mean));
      const { skewness, kurtosis } = calcSkewKurt(vec, mean, sd);
      return {
        code: c.code,
        name: c.name,
        role: c.role,
        n: vec.length,
        mean,
        sd,
        min: vec.length > 0 ? Math.min(...vec) : 0,
        max: vec.length > 0 ? Math.max(...vec) : 0,
        skewness,
        kurtosis,
      };
    });

  // 2.4 Cronbach's Alpha per Construct
  const computeCronbachAlpha = (cols: number[][]): number => {
    const k = cols.length;
    const n = cols[0]?.length || 0;
    if (k < 2 || n < 3) return 0;
    let sumItemVar = 0;
    for (let j = 0; j < k; j += 1) {
      sumItemVar += calcSampleVariance(cols[j]);
    }
    const totals = Array.from({ length: n }, (_, i) => {
      let s = 0;
      for (let j = 0; j < k; j += 1) s += cols[j][i];
      return s;
    });
    const totalVar = calcSampleVariance(totals);
    if (totalVar <= 0) return 0;
    return (k / (k - 1)) * (1 - sumItemVar / totalVar);
  };

  const cronbachResults: CronbachConstructResult[] = project.constructs.map(
    (c) => {
      const cols = c.items.map((it) =>
        validRows.map((r) => r.values[it.code] as number)
      );
      const alpha = computeCronbachAlpha(cols);
      const items: CronbachItemRow[] = c.items.map((it, idx) => {
        const col = cols[idx] || [];
        const mean = calcMean(col);
        const sd = Math.sqrt(calcSampleVariance(col, mean));
        const otherCols = cols.filter((_, j) => j !== idx);
        const restSums = validRows.map((_, rowIdx) =>
          otherCols.reduce((acc, oc) => acc + oc[rowIdx], 0)
        );
        const citc =
          otherCols.length > 0 ? calcPearson(col, restSums).r : 0;
        const alphaIfDeleted =
          otherCols.length >= 2 ? computeCronbachAlpha(otherCols) : 0;
        return {
          code: it.code,
          label: it.label,
          mean,
          sd,
          correctedItemTotal: citc,
          alphaIfDeleted,
          flagged: citc < 0.3,
        };
      });
      return {
        code: c.code,
        name: c.name,
        role: c.role,
        itemCount: c.items.length,
        alpha,
        passed: alpha >= 0.6 && items.every((i) => !i.flagged),
        items,
      };
    }
  );

  // 2.5 Pearson Correlation Matrix
  let correlationMatrix: CorrelationMatrixResult | null = null;
  if (validRows.length >= 4 && project.constructs.length >= 2) {
    const constructCodes = project.constructs.map((c) => c.code);
    const constructNames: Record<string, string> = {};
    project.constructs.forEach((c) => {
      constructNames[c.code] = c.name;
    });
    const matrix: Record<string, Record<string, CorrelationCell>> = {};
    for (const cA of constructCodes) {
      matrix[cA] = {};
      for (const cB of constructCodes) {
        if (cA === cB) {
          matrix[cA][cB] = { r: 1, p: 0, n: validRows.length, stars: '' };
        } else {
          const { r, p, n } = calcPearson(
            constructVectors[cA],
            constructVectors[cB]
          );
          const stars: '' | '*' | '**' =
            p < 0.01 ? '**' : p < 0.05 ? '*' : '';
          matrix[cA][cB] = { r, p, n, stars };
        }
      }
    }
    correlationMatrix = { constructCodes, constructNames, matrix };
  }

  // 2.6 Multiple Linear Regression (OLS)
  let regression: RegressionResult | null = null;
  const depConstruct = project.constructs.find((c) => c.role === 'dependent');
  const indConstructs = project.constructs.filter(
    (c) => c.role === 'independent'
  );
  if (
    depConstruct &&
    indConstructs.length >= 1 &&
    validRows.length >= indConstructs.length + 5
  ) {
    const y = constructVectors[depConstruct.code];
    const X = validRows.map((_, rowIdx) =>
      indConstructs.map((ic) => constructVectors[ic.code][rowIdx])
    );
    const fit = fitOlsBasic(X, y);
    if (fit) {
      const n = y.length;
      const k = indConstructs.length;
      const dfReg = k;
      const dfRes = n - k - 1;
      const msReg = fit.ssReg / dfReg;
      const msRes = fit.ssRes / dfRes;
      const fStat = msRes > 0 ? msReg / msRes : 0;
      const fP = fDistUpperTailP(fStat, dfReg, dfRes);

      const ySd = Math.sqrt(calcSampleVariance(y));
      const coefficients: RegressionCoefficientRow[] = indConstructs.map(
        (ic, j) => {
          const b = fit.betas[j + 1];
          const se = fit.se[j + 1];
          const t = se > 0 ? b / se : 0;
          const p = studentTTwoTailedP(t, dfRes);
          const xVec = constructVectors[ic.code];
          const xSd = Math.sqrt(calcSampleVariance(xVec));
          const beta = ySd > 0 ? b * (xSd / ySd) : 0;

          // Compute VIF = 1 / (1 - R_j^2)
          let vif = 1;
          if (indConstructs.length >= 2) {
            const otherX = validRows.map((_, rowIdx) =>
              indConstructs
                .filter((_, idx) => idx !== j)
                .map((oc) => constructVectors[oc.code][rowIdx])
            );
            const auxFit = fitOlsBasic(otherX, xVec);
            if (auxFit && auxFit.rSquare < 0.9999) {
              vif = 1 / (1 - auxFit.rSquare);
            } else if (auxFit) {
              vif = 999;
            }
          }

          return {
            code: ic.code,
            name: ic.name,
            b,
            se,
            beta,
            t,
            p,
            vif,
            supported: p < 0.05 && b > 0,
          };
        }
      );

      const intB = fit.betas[0];
      const intSe = fit.se[0];
      const intT = intSe > 0 ? intB / intSe : 0;
      const intP = studentTTwoTailedP(intT, dfRes);

      regression = {
        dependentCode: depConstruct.code,
        dependentName: depConstruct.name,
        n,
        r: Math.sqrt(fit.rSquare),
        rSquare: fit.rSquare,
        adjRSquare: fit.adjRSquare,
        stdError: fit.stdError,
        durbinWatson: fit.durbinWatson,
        anova: {
          ssRegression: fit.ssReg,
          dfRegression: dfReg,
          msRegression: msReg,
          ssResidual: fit.ssRes,
          dfResidual: dfRes,
          msResidual: msRes,
          ssTotal: fit.ssTot,
          dfTotal: n - 1,
          fStat,
          pValue: fP,
        },
        intercept: { b: intB, se: intSe, t: intT, p: intP },
        coefficients,
      };
    }
  }

  // 2.7 Group Difference Tests (T-Test / One-Way ANOVA on Dependent Construct)
  const groupDifferences: GroupDifferenceResult[] = [];
  if (depConstruct && validRows.length >= 6) {
    const depVec = constructVectors[depConstruct.code];
    for (const dq of project.demographics) {
      const grouped = new Map<string, number[]>();
      validRows.forEach((row, idx) => {
        const g = (row.demographics[dq.code] || '').trim();
        if (!g) return;
        const arr = grouped.get(g) || [];
        arr.push(depVec[idx]);
        grouped.set(g, arr);
      });
      const validGroups = Array.from(grouped.entries()).filter(
        ([, arr]) => arr.length >= 2
      );
      if (validGroups.length < 2) continue;

      const groupSummaries = validGroups.map(([name, arr]) => {
        const m = calcMean(arr);
        const sd = Math.sqrt(calcSampleVariance(arr, m));
        return { name, n: arr.length, mean: m, sd };
      });

      if (validGroups.length === 2) {
        const g1 = validGroups[0][1];
        const g2 = validGroups[1][1];
        const m1 = calcMean(g1);
        const m2 = calcMean(g2);
        const v1 = calcSampleVariance(g1, m1);
        const v2 = calcSampleVariance(g2, m2);
        const df = g1.length + g2.length - 2;
        const pooledVar =
          ((g1.length - 1) * v1 + (g2.length - 1) * v2) / df;
        const se = Math.sqrt(pooledVar * (1 / g1.length + 1 / g2.length));
        const tVal = se > 0 ? (m1 - m2) / se : 0;
        const pVal = studentTTwoTailedP(tVal, df);
        groupDifferences.push({
          demographicCode: dq.code,
          demographicLabel: dq.label,
          dependentCode: depConstruct.code,
          testType: 't-test',
          groups: groupSummaries,
          statLabel: 't',
          statValue: tVal,
          dfLabel: String(df),
          pValue: pVal,
          significant: pVal < 0.05,
        });
      } else {
        const allVals = validGroups.flatMap(([, arr]) => arr);
        const grandMean = calcMean(allVals);
        let ssBetween = 0;
        let ssWithin = 0;
        for (const [, arr] of validGroups) {
          const gm = calcMean(arr);
          ssBetween += arr.length * (gm - grandMean) * (gm - grandMean);
          for (const v of arr) {
            ssWithin += (v - gm) * (v - gm);
          }
        }
        const df1 = validGroups.length - 1;
        const df2 = allVals.length - validGroups.length;
        const msBetween = ssBetween / df1;
        const msWithin = ssWithin / df2;
        const fVal = msWithin > 0 ? msBetween / msWithin : 0;
        const pVal = fDistUpperTailP(fVal, df1, df2);
        groupDifferences.push({
          demographicCode: dq.code,
          demographicLabel: dq.label,
          dependentCode: depConstruct.code,
          testType: 'anova',
          groups: groupSummaries,
          statLabel: 'F',
          statValue: fVal,
          dfLabel: `${df1}, ${df2}`,
          pValue: pVal,
          significant: pVal < 0.05,
        });
      }
    }
  }

  return {
    validN: validRows.length,
    totalRows,
    missingRowsCount,
    straightLinerIds,
    demographicStats,
    itemDescriptives,
    constructDescriptives,
    cronbachResults,
    correlationMatrix,
    regression,
    groupDifferences,
  };
}

// ============================================================================
// 3. Synthetic Correlated Survey Dataset Generator (Demo / Testing Sandbox)
// ============================================================================

function randomNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clampLikert(val: number, scale: 5 | 7): number {
  return Math.max(1, Math.min(scale, Math.round(val)));
}

export function generateSyntheticDataset(
  project: SurveyProject,
  sampleSize: number
): SurveyResponseRow[] {
  const n = Math.max(30, Math.min(1500, Math.round(sampleSize)));
  const scale = project.likertScale;
  const center = scale === 7 ? 4.9 : 3.7;
  const indConstructs = project.constructs.filter(
    (c) => c.role === 'independent'
  );
  const depConstructs = project.constructs.filter(
    (c) => c.role === 'dependent'
  );

  // Assign distinct realistic positive structural weights for independent constructs
  const weights = indConstructs.map((_, idx) => 0.34 - idx * 0.045);

  const rows: SurveyResponseRow[] = [];
  const baseTime = Date.now() - n * 60_000;

  for (let i = 0; i < n; i += 1) {
    const demographics: Record<string, string> = {};
    for (const dq of project.demographics) {
      if (dq.options.length === 0) continue;
      // Slightly realistic non-uniform distribution
      const r = Math.random();
      const idx = Math.min(
        dq.options.length - 1,
        Math.floor(Math.pow(r, 0.85) * dq.options.length)
      );
      demographics[dq.code] = dq.options[idx];
    }

    const latentScores: Record<string, number> = {};
    const sharedEnv = randomNormal() * 0.25;
    for (const ic of indConstructs) {
      latentScores[ic.code] = center + sharedEnv + randomNormal() * 0.72;
    }

    for (const dc of depConstructs) {
      let yLatent = center * 0.22;
      let totalW = 0;
      indConstructs.forEach((ic, idx) => {
        const w = Math.max(0.12, weights[idx] || 0.2);
        yLatent += w * latentScores[ic.code];
        totalW += w;
      });
      if (totalW > 0) {
        yLatent = (yLatent / (totalW + 0.22)) + randomNormal() * 0.42;
      } else {
        yLatent = center + randomNormal() * 0.75;
      }
      latentScores[dc.code] = yLatent;
    }

    const values: Record<string, number | null> = {};
    for (const c of project.constructs) {
      const latent = latentScores[c.code] ?? center;
      for (const item of c.items) {
        // High reliability loading + realistic item noise
        const score = latent + randomNormal() * 0.48;
        values[item.code] = clampLikert(score, scale);
      }
    }

    rows.push({
      id: `resp_${i + 1}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date(baseTime + i * 60_000).toISOString(),
      demographics,
      values,
    });
  }

  return rows;
}

// ============================================================================
// 4. CSV Import / Export & APA Report Summary Builder
// ============================================================================

export function exportSurveyProjectToCsv(project: SurveyProject): string {
  const demoCodes = project.demographics.map((d) => d.code);
  const itemCodes = project.constructs.flatMap((c) =>
    c.items.map((it) => it.code)
  );
  const headers = ['RespondentID', ...demoCodes, ...itemCodes];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(',')];
  project.rows.forEach((row, idx) => {
    const cols = [
      `R${String(idx + 1).padStart(3, '0')}`,
      ...demoCodes.map((c) => row.demographics[c] || ''),
      ...itemCodes.map((c) =>
        row.values[c] === null || row.values[c] === undefined
          ? ''
          : row.values[c]
      ),
    ];
    lines.push(cols.map(esc).join(','));
  });
  return '\uFEFF' + lines.join('\r\n');
}

export function parseCsvIntoSurveyRows(
  csvText: string,
  project: SurveyProject
): { rows: SurveyResponseRow[]; matchedColumns: number } {
  const cleanLines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (cleanLines.length < 2) {
    throw new Error('File CSV cần có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.');
  }

  const splitCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitCsvLine(cleanLines[0]);
  const headerIndexMap = new Map<string, number>();
  headers.forEach((h, idx) => headerIndexMap.set(h.toLowerCase(), idx));

  const demoCodes = project.demographics.map((d) => d.code);
  const itemCodes = project.constructs.flatMap((c) =>
    c.items.map((it) => it.code)
  );
  let matchedColumns = 0;
  [...demoCodes, ...itemCodes].forEach((code) => {
    if (headerIndexMap.has(code.toLowerCase())) matchedColumns += 1;
  });

  const rows: SurveyResponseRow[] = [];
  for (let r = 1; r < cleanLines.length; r += 1) {
    const cells = splitCsvLine(cleanLines[r]);
    const demographics: Record<string, string> = {};
    for (const code of demoCodes) {
      const idx = headerIndexMap.get(code.toLowerCase());
      demographics[code] = idx !== undefined ? cells[idx] || '' : '';
    }
    const values: Record<string, number | null> = {};
    for (const code of itemCodes) {
      const idx = headerIndexMap.get(code.toLowerCase());
      if (idx === undefined) {
        values[code] = null;
      } else {
        const num = Number(cells[idx]);
        values[code] = Number.isFinite(num) ? num : null;
      }
    }
    rows.push({
      id: `csv_${Date.now()}_${r}`,
      createdAt: new Date().toISOString(),
      demographics,
      values,
    });
  }

  return { rows, matchedColumns };
}

export function fmtNum(val: number, digits = 3): string {
  if (!Number.isFinite(val)) return '—';
  return val.toFixed(digits);
}

export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.001) return '< .001';
  return p.toFixed(3);
}

export function buildApaStatsReportText(
  project: SurveyProject,
  analysis: FullStatsAnalysis
): string {
  const lines: string[] = [
    `=== BÁO CÁO KẾT QUẢ PHÂN TÍCH DỮ LIỆU KHẢO SÁT (DATA LAB) ===`,
    `Tên khảo sát: ${project.title}`,
    `Thang đo Likert: ${project.likertScale} mức | Tổng phản hồi: ${analysis.totalRows} | Mẫu hợp lệ (N): ${analysis.validN}`,
    '',
    '1. THỐNG KÊ MÔ TẢ NHÂN KHẨU HỌC (DEMOGRAPHIC PROFILE):',
  ];

  for (const d of analysis.demographicStats) {
    lines.push(
      `- ${d.label} (n = ${d.total}): ` +
        d.buckets
          .map((b) => `${b.option}: ${b.count} (${b.percent.toFixed(1)}%)`)
          .join('; ')
    );
  }

  lines.push('', '2. ĐỘ TIN CẬY THANG ĐO (CRONBACH ALPHA) & ĐIỂM TRUNG BÌNH NHÂN TỐ:');
  for (const cr of analysis.cronbachResults) {
    const desc = analysis.constructDescriptives.find((d) => d.code === cr.code);
    lines.push(
      `- ${cr.code} (${cr.name}, ${cr.role === 'dependent' ? 'Biến phụ thuộc' : 'Biến độc lập'}): ` +
        `${cr.itemCount} biến quan sát | Cronbach's Alpha = ${fmtNum(cr.alpha)} (${
          cr.passed ? 'ĐẠT' : 'CẦN XEM LẠI'
        }) | Mean = ${fmtNum(desc?.mean || 0, 2)}, SD = ${fmtNum(desc?.sd || 0, 2)}`
    );
    for (const it of cr.items) {
      lines.push(
        `    * ${it.code}: Mean = ${fmtNum(it.mean, 2)}, SD = ${fmtNum(
          it.sd,
          2
        )}, Corrected Item-Total r = ${fmtNum(
          it.correctedItemTotal
        )}, Alpha if Deleted = ${fmtNum(it.alphaIfDeleted)}`
      );
    }
  }

  if (analysis.correlationMatrix) {
    lines.push('', '3. MA TRẬN TƯƠNG QUAN PEARSON (r, Sig.):');
    const codes = analysis.correlationMatrix.constructCodes;
    for (const cA of codes) {
      const rowPairs = codes
        .map((cB) => {
          const cell = analysis.correlationMatrix!.matrix[cA][cB];
          return `${cB}: r=${fmtNum(cell.r)}${cell.stars} (p=${fmtP(cell.p)})`;
        })
        .join(' | ');
      lines.push(`- ${cA}: ${rowPairs}`);
    }
  }

  if (analysis.regression) {
    const reg = analysis.regression;
    lines.push(
      '',
      `4. PHÂN TÍCH HỒI QUY TUYẾN TÍNH ĐA BIẾN (Biến phụ thuộc: ${reg.dependentCode} - ${reg.dependentName}, N = ${reg.n}):`,
      `- Model Summary: R = ${fmtNum(reg.r)}, R² = ${fmtNum(
        reg.rSquare
      )}, Adjusted R² = ${fmtNum(reg.adjRSquare)} (mô hình giải thích ${(
        reg.adjRSquare * 100
      ).toFixed(1)}% biến thiên), Std. Error = ${fmtNum(
        reg.stdError
      )}, Durbin-Watson = ${fmtNum(reg.durbinWatson, 2)}`,
      `- ANOVA: F(${reg.anova.dfRegression}, ${reg.anova.dfResidual}) = ${fmtNum(
        reg.anova.fStat,
        2
      )}, Sig. = ${fmtP(reg.anova.pValue)}`,
      `- Hệ số hồi quy (Coefficients):`
    );
    for (const coef of reg.coefficients) {
      lines.push(
        `    * ${coef.code} (${coef.name}): B = ${fmtNum(
          coef.b
        )}, SE = ${fmtNum(coef.se)}, Beta chuẩn hóa = ${fmtNum(
          coef.beta
        )}, t = ${fmtNum(coef.t, 2)}, Sig. = ${fmtP(coef.p)}, VIF = ${fmtNum(
          coef.vif,
          2
        )} => ${coef.supported ? 'CHẤP NHẬN GIẢ THUYẾT (p < 0.05)' : 'BÁC BỎ GIẢ THUYẾT'}`
      );
    }
  }

  if (analysis.groupDifferences.length > 0) {
    lines.push('', '5. KIỂM ĐỊNH KHÁC BIỆT THEO NHÂN KHẨU HỌC (T-TEST / ONE-WAY ANOVA):');
    for (const gd of analysis.groupDifferences) {
      lines.push(
        `- ${gd.demographicLabel} (${gd.testType.toUpperCase()}): ${gd.statLabel}(${
          gd.dfLabel
        }) = ${fmtNum(gd.statValue, 2)}, Sig. = ${fmtP(gd.pValue)} => ${
          gd.significant
            ? 'Có sự khác biệt có ý nghĩa thống kê (p < 0.05)'
            : 'Không có sự khác biệt có ý nghĩa thống kê (p >= 0.05)'
        }`
      );
    }
  }

  return lines.join('\n');
}

// ============================================================================
// 5. Built-in Academic Research Templates
// ============================================================================

export function createDefaultSurveyProject(): SurveyProject {
  const project: SurveyProject = {
    id: `proj_${Date.now()}`,
    title: 'Các nhân tố ảnh hưởng đến Sự hài lòng và Ý định sử dụng dịch vụ số',
    description:
      'Mô hình 3 biến độc lập (CL, GC, DT) tác động lên biến phụ thuộc (HL) — chuẩn luận văn Kinh tế / Quản trị / Marketing.',
    likertScale: 5,
    demographics: [
      {
        id: 'dq_gender',
        code: 'GioiTinh',
        label: 'Giới tính',
        options: ['Nam', 'Nữ'],
      },
      {
        id: 'dq_age',
        code: 'DoTuoi',
        label: 'Độ tuổi',
        options: ['18–22 tuổi', '23–30 tuổi', '31–40 tuổi', 'Trên 40 tuổi'],
      },
      {
        id: 'dq_income',
        code: 'ThuNhap',
        label: 'Thu nhập / Chi tiêu tháng',
        options: ['Dưới 5 triệu', '5–10 triệu', '10–20 triệu', 'Trên 20 triệu'],
      },
    ],
    constructs: [
      {
        id: 'c_cl',
        code: 'CL',
        name: 'Chất lượng dịch vụ',
        role: 'independent',
        items: [
          { code: 'CL1', label: 'Giao diện dịch vụ dễ thao tác và rõ ràng' },
          { code: 'CL2', label: 'Tốc độ xử lý yêu cầu nhanh và ổn định' },
          { code: 'CL3', label: 'Thông tin cung cấp chính xác và đáng tin cậy' },
          { code: 'CL4', label: 'Đội ngũ hỗ trợ phản hồi kịp thời khi có sự cố' },
        ],
      },
      {
        id: 'c_gc',
        code: 'GC',
        name: 'Giá trị cảm nhận & Chi phí',
        role: 'independent',
        items: [
          { code: 'GC1', label: 'Mức chi phí hợp lý so với chất lượng nhận được' },
          { code: 'GC2', label: 'Chính sách giá minh bạch, không phát sinh ẩn' },
          { code: 'GC3', label: 'Chương trình ưu đãi hấp dẫn và thiết thực' },
        ],
      },
      {
        id: 'c_dt',
        code: 'DT',
        name: 'Niềm tin & Bảo mật',
        role: 'independent',
        items: [
          { code: 'DT1', label: 'Tôi yên tâm về khả năng bảo mật thông tin cá nhân' },
          { code: 'DT2', label: 'Thương hiệu có uy tín và cam kết rõ ràng' },
          { code: 'DT3', label: 'Quy trình thanh toán an toàn và minh bạch' },
        ],
      },
      {
        id: 'c_hl',
        code: 'HL',
        name: 'Sự hài lòng chung',
        role: 'dependent',
        items: [
          { code: 'HL1', label: 'Tôi hài lòng với trải nghiệm tổng thể khi sử dụng' },
          { code: 'HL2', label: 'Dịch vụ đáp ứng tốt kỳ vọng ban đầu của tôi' },
          { code: 'HL3', label: 'Tôi sẵn sàng giới thiệu dịch vụ cho bạn bè' },
        ],
      },
    ],
    rows: [],
    updatedAt: new Date().toISOString(),
  };

  project.rows = generateSyntheticDataset(project, 180);
  return project;
}
