export type ColumnType = 'number' | 'date' | 'boolean' | 'string';

export interface ColumnSchema {
  name: string;
  type: ColumnType;
  distinctCount: number;
  nullCount: number;
  sampleValues: string[];
  min?: number | string;
  max?: number | string;
}

export interface DatasetSchema {
  fileName: string;
  rowCount: number;
  columns: ColumnSchema[];
  sampleRows: Record<string, unknown>[];
}

export interface KpiSpec {
  label: string;
  measureName: string;
  format: string;
}

export type VisualType =
  | 'bar'
  | 'column'
  | 'line'
  | 'pie'
  | 'donut'
  | 'area'
  | 'scatter'
  | 'table'
  | 'card'
  | 'map';

export interface VisualSpec {
  type: VisualType;
  title: string;
  xField?: string;
  yField?: string;
  seriesField?: string;
  aggregation?: 'sum' | 'average' | 'count' | 'min' | 'max' | 'distinctCount';
  description: string;
}

export interface PageSpec {
  name: string;
  purpose: string;
  kpis: KpiSpec[];
  visuals: VisualSpec[];
  filters: string[];
}

export interface DaxMeasure {
  name: string;
  expression: string;
  description: string;
}

export interface ThemeSpec {
  name: string;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  chartPalette: string[];
}

export interface DashboardConcept {
  id: string;
  name: string;
  summary: string;
  audience: string;
  theme: ThemeSpec;
  pages: PageSpec[];
  daxMeasures: DaxMeasure[];
  dataModelNotes: string[];
}

export interface GeneratePlanResponse {
  concepts: DashboardConcept[];
}
