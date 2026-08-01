import type { ColumnSchema, DatasetSchema, VisualSpec } from './types';

export interface ChartDatum {
  name: string;
  value: number;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[,\s%$]/g, ''));
  return Number.isNaN(n) ? null : n;
}

function aggregateValues(values: number[], aggregation: VisualSpec['aggregation']): number {
  if (values.length === 0) return 0;
  switch (aggregation) {
    case 'average':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'count':
      return values.length;
    case 'distinctCount':
      return new Set(values).size;
    case 'sum':
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

const MAX_CATEGORIES = 12;

/** Groups raw rows by the visual's xField and aggregates yField, for chart rendering. */
export function buildChartData(
  rows: Record<string, unknown>[],
  visual: VisualSpec,
  columns: ColumnSchema[]
): ChartDatum[] {
  if (!visual.xField) return [];

  const yFieldIsNumeric = columns.find((c) => c.name === visual.yField)?.type === 'number';
  const aggregation = visual.aggregation ?? (yFieldIsNumeric ? 'sum' : 'count');

  const groups = new Map<string, number[]>();

  for (const row of rows) {
    const key = String(row[visual.xField] ?? 'Unknown');
    const raw = visual.yField ? row[visual.yField] : row[visual.xField];
    const num = aggregation === 'count' || aggregation === 'distinctCount' ? toNumber(raw) ?? 0 : toNumber(raw);
    if (num === null && aggregation !== 'count') continue;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(num ?? 0);
  }

  let data: ChartDatum[] = Array.from(groups.entries()).map(([name, values]) => ({
    name,
    value: aggregateValues(values, aggregation),
  }));

  const xIsDate = columns.find((c) => c.name === visual.xField)?.type === 'date';
  if (xIsDate) {
    data.sort((a, b) => Date.parse(a.name) - Date.parse(b.name));
  } else {
    data.sort((a, b) => b.value - a.value);
  }

  if (data.length > MAX_CATEGORIES && !xIsDate) {
    data = data.slice(0, MAX_CATEGORIES);
  }

  return data;
}

/** Single aggregate number for a card/KPI visual, computed across the whole dataset. */
export function aggregateCardValue(
  rows: Record<string, unknown>[],
  fieldName: string | undefined,
  aggregation: VisualSpec['aggregation']
): number {
  if (!fieldName) return rows.length;
  const values = rows.map((r) => toNumber(r[fieldName])).filter((v): v is number => v !== null);
  if (aggregation === 'count') return rows.length;
  return aggregateValues(values, aggregation ?? 'sum');
}

export function formatNumber(value: number, format?: string): string {
  if (format?.includes('%')) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (format?.includes('$')) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
      value
    );
  }
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function inferNumericFields(schema: DatasetSchema): string[] {
  return schema.columns.filter((c) => c.type === 'number').map((c) => c.name);
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * KPI specs carry a DAX measure name, not a real column — for the live preview we
 * approximate which numeric column (and aggregation) the KPI is about by matching
 * words in its label/measure name against the dataset's column names.
 */
export function guessKpiSource(
  kpi: { label: string; measureName: string },
  columns: ColumnSchema[]
): { field?: string; aggregation: NonNullable<VisualSpec['aggregation']> } {
  const numericColumns = columns.filter((c) => c.type === 'number');
  const haystack = normalize(`${kpi.label} ${kpi.measureName}`);

  const aggregation: NonNullable<VisualSpec['aggregation']> = haystack.includes('average') || haystack.includes('avg')
    ? 'average'
    : haystack.includes('distinct')
      ? 'distinctCount'
      : haystack.includes('count') || haystack.includes('number of') || haystack.includes('total number')
        ? 'count'
        : 'sum';

  const matched = numericColumns.find((c) => haystack.includes(normalize(c.name)));
  if (matched) return { field: matched.name, aggregation };

  if (aggregation === 'count') return { aggregation };

  return { field: numericColumns[0]?.name, aggregation };
}
