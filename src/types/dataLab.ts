export interface DemographicQuestion {
  id: string;
  code: string; // e.g. 'GioiTinh', 'DoTuoi'
  label: string; // e.g. 'Giới tính', 'Độ tuổi'
  options: string[];
}

export interface LikertItem {
  code: string; // e.g. 'CL1'
  label: string;
}

export interface LikertConstruct {
  id: string;
  code: string; // e.g. 'CL', 'GC', 'HL'
  name: string; // e.g. 'Chất lượng dịch vụ'
  role: 'independent' | 'dependent';
  items: LikertItem[];
}

export type SurveyResponseRow = {
  id: string;
  createdAt: string;
  demographics: Record<string, string>;
  values: Record<string, number | null>;
};

export interface SurveyProject {
  id: string;
  title: string;
  description: string;
  likertScale: 5 | 7;
  demographics: DemographicQuestion[];
  constructs: LikertConstruct[];
  rows: SurveyResponseRow[];
  updatedAt: string;
}

export interface DemographicFreqResult {
  code: string;
  label: string;
  total: number;
  buckets: Array<{ option: string; count: number; percent: number }>;
}

export interface ItemDescriptiveStat {
  code: string;
  label: string;
  constructCode: string;
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  skewness: number;
  kurtosis: number;
}

export interface ConstructDescriptiveStat {
  code: string;
  name: string;
  role: 'independent' | 'dependent';
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  skewness: number;
  kurtosis: number;
}

export interface CronbachItemRow {
  code: string;
  label: string;
  mean: number;
  sd: number;
  correctedItemTotal: number;
  alphaIfDeleted: number;
  flagged: boolean;
}

export interface CronbachConstructResult {
  code: string;
  name: string;
  role: 'independent' | 'dependent';
  itemCount: number;
  alpha: number;
  passed: boolean;
  items: CronbachItemRow[];
}

export interface CorrelationCell {
  r: number;
  p: number;
  n: number;
  stars: '' | '*' | '**';
}

export interface CorrelationMatrixResult {
  constructCodes: string[];
  constructNames: Record<string, string>;
  matrix: Record<string, Record<string, CorrelationCell>>;
}

export interface RegressionCoefficientRow {
  code: string;
  name: string;
  b: number;
  se: number;
  beta: number;
  t: number;
  p: number;
  vif: number;
  supported: boolean;
}

export interface RegressionResult {
  dependentCode: string;
  dependentName: string;
  n: number;
  r: number;
  rSquare: number;
  adjRSquare: number;
  stdError: number;
  durbinWatson: number;
  anova: {
    ssRegression: number;
    dfRegression: number;
    msRegression: number;
    ssResidual: number;
    dfResidual: number;
    msResidual: number;
    ssTotal: number;
    dfTotal: number;
    fStat: number;
    pValue: number;
  };
  intercept: { b: number; se: number; t: number; p: number };
  coefficients: RegressionCoefficientRow[];
}

export interface GroupDifferenceResult {
  demographicCode: string;
  demographicLabel: string;
  dependentCode: string;
  testType: 't-test' | 'anova';
  groups: Array<{ name: string; n: number; mean: number; sd: number }>;
  statLabel: string; // 't' or 'F'
  statValue: number;
  dfLabel: string;
  pValue: number;
  significant: boolean;
}

export interface FullStatsAnalysis {
  validN: number;
  totalRows: number;
  missingRowsCount: number;
  straightLinerIds: string[];
  demographicStats: DemographicFreqResult[];
  itemDescriptives: ItemDescriptiveStat[];
  constructDescriptives: ConstructDescriptiveStat[];
  cronbachResults: CronbachConstructResult[];
  correlationMatrix: CorrelationMatrixResult | null;
  regression: RegressionResult | null;
  groupDifferences: GroupDifferenceResult[];
}
