'use client';

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardConcept, PageSpec, VisualSpec } from '@/lib/types';
import { aggregateCardValue, buildChartData, formatNumber, guessKpiSource } from '@/lib/aggregate';
import type { DatasetSchema } from '@/lib/types';

function VisualCard({
  visual,
  rows,
  schema,
  palette,
}: {
  visual: VisualSpec;
  rows: Record<string, unknown>[];
  schema: DatasetSchema;
  palette: string[];
}) {
  if (visual.type === 'card') {
    const value = aggregateCardValue(rows, visual.yField ?? visual.xField, visual.aggregation);
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{visual.title}</div>
        <div className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: palette[0] }}>
          {formatNumber(value)}
        </div>
        <div className="mt-1 text-xs text-slate-500">{visual.description}</div>
      </div>
    );
  }

  const data = buildChartData(rows, visual, schema.columns);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-medium">{visual.title}</div>
        <div className="mt-4 text-xs text-slate-400">Not enough data to render this visual.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm font-medium">{visual.title}</div>
      <div className="mt-1 text-xs text-slate-500">{visual.description}</div>
      <div className="mt-3 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {visual.type === 'line' || visual.type === 'area' ? (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip formatter={(v: number) => formatNumber(v)} />
              <Line type="monotone" dataKey="value" stroke={palette[0]} strokeWidth={2} dot={false} />
            </LineChart>
          ) : visual.type === 'pie' || visual.type === 'donut' ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={visual.type === 'donut' ? 50 : 0}
                outerRadius={90}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={palette[i % palette.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatNumber(v)} />
            </PieChart>
          ) : (
            <BarChart
              data={data}
              layout={visual.type === 'bar' ? 'vertical' : 'horizontal'}
              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              {visual.type === 'bar' ? (
                <>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                </>
              )}
              <Tooltip formatter={(v: number) => formatNumber(v)} />
              <Bar dataKey="value" fill={palette[0]} radius={4} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PageView({
  page,
  rows,
  schema,
  concept,
}: {
  page: PageSpec;
  rows: Record<string, unknown>[];
  schema: DatasetSchema;
  concept: DashboardConcept;
}) {
  const palette = concept.theme.chartPalette;
  return (
    <div className="space-y-4">
      {page.kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {page.kpis.map((kpi, i) => {
            const { field, aggregation } = guessKpiSource(kpi, schema.columns);
            const value = aggregateCardValue(rows, field, aggregation);
            return (
              <div
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums" style={{ color: palette[i % palette.length] }}>
                  {formatNumber(value, kpi.format)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {page.visuals.map((visual, i) => (
          <VisualCard key={i} visual={visual} rows={rows} schema={schema} palette={palette} />
        ))}
      </div>
      {page.filters.length > 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-slate-700">
          Slicers in the real report: {page.filters.join(', ')}
        </div>
      )}
    </div>
  );
}

export function DashboardPreview({
  concept,
  rows,
  schema,
}: {
  concept: DashboardConcept;
  rows: Record<string, unknown>[];
  schema: DatasetSchema;
}) {
  const [activePageIdx, setActivePageIdx] = useState(0);
  const activePage = concept.pages[activePageIdx];

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        backgroundColor: concept.theme.background,
        borderColor: concept.theme.surface,
        color: concept.theme.text,
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-semibold">{concept.name}</div>
          <div className="text-xs opacity-70">{concept.audience}</div>
        </div>
        {concept.pages.length > 1 && (
          <div className="flex gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/5">
            {concept.pages.map((p, i) => (
              <button
                key={p.name}
                onClick={() => setActivePageIdx(i)}
                className="rounded-md px-3 py-1 text-xs font-medium transition"
                style={{
                  backgroundColor: i === activePageIdx ? concept.theme.primary : 'transparent',
                  color: i === activePageIdx ? '#fff' : 'inherit',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {activePage && <PageView page={activePage} rows={rows} schema={schema} concept={concept} />}
    </div>
  );
}
