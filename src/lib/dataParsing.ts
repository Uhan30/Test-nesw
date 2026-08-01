import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ColumnSchema, ColumnType, DatasetSchema } from './types';

const MAX_SAMPLE_ROWS = 12;
const MAX_ROWS_PARSED = 50_000; // guardrail against huge uploads

function looksLikeDate(value: string): boolean {
  if (!value || value.length < 6) return false;
  if (/^\d+(\.\d+)?$/.test(value)) return false; // plain numbers aren't dates
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function looksLikeNumber(value: string): boolean {
  if (value.trim() === '') return false;
  const cleaned = value.replace(/[,\s%$]/g, '');
  return /^-?\d+(\.\d+)?$/.test(cleaned);
}

function looksLikeBoolean(value: string): boolean {
  return ['true', 'false', 'yes', 'no'].includes(value.trim().toLowerCase());
}

function inferColumnType(values: string[]): ColumnType {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonEmpty.length === 0) return 'string';

  const sample = nonEmpty.slice(0, 200).map(String);
  const numberCount = sample.filter(looksLikeNumber).length;
  const dateCount = sample.filter(looksLikeDate).length;
  const boolCount = sample.filter(looksLikeBoolean).length;

  if (numberCount / sample.length > 0.9) return 'number';
  if (boolCount / sample.length > 0.9) return 'boolean';
  if (dateCount / sample.length > 0.9) return 'date';
  return 'string';
}

function buildColumnSchema(name: string, rawValues: unknown[]): ColumnSchema {
  const stringValues = rawValues.map((v) => (v === null || v === undefined ? '' : String(v)));
  const type = inferColumnType(stringValues);
  const nonEmpty = stringValues.filter((v) => v.trim() !== '');
  const distinct = new Set(nonEmpty);

  const schema: ColumnSchema = {
    name,
    type,
    distinctCount: distinct.size,
    nullCount: rawValues.length - nonEmpty.length,
    sampleValues: Array.from(distinct).slice(0, 8),
  };

  if (type === 'number') {
    const nums = nonEmpty.map((v) => Number(v.replace(/[,\s%$]/g, ''))).filter((n) => !Number.isNaN(n));
    if (nums.length) {
      schema.min = Math.min(...nums);
      schema.max = Math.max(...nums);
    }
  } else if (type === 'date') {
    const times = nonEmpty.map((v) => Date.parse(v)).filter((t) => !Number.isNaN(t));
    if (times.length) {
      schema.min = new Date(Math.min(...times)).toISOString().slice(0, 10);
      schema.max = new Date(Math.max(...times)).toISOString().slice(0, 10);
    }
  }

  return schema;
}

function rowsToSchema(fileName: string, rows: Record<string, unknown>[]): DatasetSchema {
  const truncated = rows.slice(0, MAX_ROWS_PARSED);
  const columnNames = truncated.length > 0 ? Object.keys(truncated[0]) : [];

  const columns = columnNames.map((name) => buildColumnSchema(name, truncated.map((r) => r[name])));

  return {
    fileName,
    rowCount: rows.length,
    columns,
    sampleRows: truncated.slice(0, MAX_SAMPLE_ROWS),
  };
}

export function parseCsvBuffer(fileName: string, text: string): DatasetSchema {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  return rowsToSchema(fileName, result.data);
}

export function parseXlsxBuffer(fileName: string, buffer: ArrayBuffer): DatasetSchema {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rowsToSchema(fileName, rows);
}

export async function parseDataFile(fileName: string, buffer: ArrayBuffer): Promise<DatasetSchema> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    const text = new TextDecoder('utf-8').decode(buffer);
    return parseCsvBuffer(fileName, text);
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return parseXlsxBuffer(fileName, buffer);
  }
  throw new Error(`Unsupported file type for "${fileName}". Upload a .csv, .tsv, or .xlsx file.`);
}

/** Full parsed rows (not just schema) for driving the interactive preview chart data. */
export async function parseDataRows(fileName: string, buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    const text = new TextDecoder('utf-8').decode(buffer);
    const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    return result.data.slice(0, MAX_ROWS_PARSED);
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }).slice(0, MAX_ROWS_PARSED);
  }
  throw new Error(`Unsupported file type for "${fileName}".`);
}
