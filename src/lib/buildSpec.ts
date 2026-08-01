import type { DashboardConcept, DatasetSchema } from './types';

export function generateBuildSpecMarkdown(concept: DashboardConcept, schema: DatasetSchema): string {
  const lines: string[] = [];

  lines.push(`# ${concept.name} — Power BI Build Spec`);
  lines.push('');
  lines.push(concept.summary);
  lines.push('');
  lines.push(`**Audience:** ${concept.audience}`);
  lines.push(`**Source data:** \`${schema.fileName}\` (${schema.rowCount} rows, ${schema.columns.length} columns)`);
  lines.push('');

  lines.push('## 1. Import the data');
  lines.push('');
  lines.push(`1. Open Power BI Desktop → **Get Data** → **Text/CSV** (or **Excel Workbook**).`);
  lines.push(`2. Select \`${schema.fileName}\` and load it.`);
  lines.push(`3. Verify column types in **Power Query Editor** match:`);
  lines.push('');
  lines.push('| Column | Type | Notes |');
  lines.push('|---|---|---|');
  for (const col of schema.columns) {
    const notes =
      col.type === 'number'
        ? `range ${col.min ?? '?'} – ${col.max ?? '?'}`
        : col.type === 'date'
          ? `range ${col.min ?? '?'} – ${col.max ?? '?'}`
          : `${col.distinctCount} distinct values`;
    lines.push(`| ${col.name} | ${col.type} | ${notes} |`);
  }
  lines.push('');

  lines.push('## 2. Apply the theme');
  lines.push('');
  lines.push('**View → Themes → Customize current theme**, or import as a JSON theme file:');
  lines.push('');
  lines.push('```json');
  lines.push(
    JSON.stringify(
      {
        name: concept.theme.name,
        dataColors: concept.theme.chartPalette,
        background: concept.theme.background,
        foreground: concept.theme.text,
        tableAccent: concept.theme.primary,
      },
      null,
      2
    )
  );
  lines.push('```');
  lines.push('');

  lines.push('## 3. Create DAX measures');
  lines.push('');
  lines.push('In the **Data** pane, right-click your table → **New measure** for each:');
  lines.push('');
  for (const measure of concept.daxMeasures) {
    lines.push(`**${measure.name}**`);
    lines.push('```dax');
    lines.push(`${measure.name} = ${measure.expression}`);
    lines.push('```');
    lines.push(measure.description);
    lines.push('');
  }

  lines.push('## 4. Build the pages');
  lines.push('');
  concept.pages.forEach((page, pageIdx) => {
    lines.push(`### Page ${pageIdx + 1}: ${page.name}`);
    lines.push('');
    lines.push(`_${page.purpose}_`);
    lines.push('');

    if (page.kpis.length > 0) {
      lines.push('**KPI cards (top row):**');
      for (const kpi of page.kpis) {
        lines.push(`- **${kpi.label}** — Card visual bound to measure \`${kpi.measureName}\`, format: ${kpi.format}`);
      }
      lines.push('');
    }

    lines.push('**Visuals:**');
    page.visuals.forEach((visual, vIdx) => {
      lines.push(`${vIdx + 1}. **${visual.title}** — ${visual.type} chart`);
      if (visual.xField) lines.push(`   - Axis: \`${visual.xField}\``);
      if (visual.yField) lines.push(`   - Values: \`${visual.yField}\` (${visual.aggregation ?? 'sum'})`);
      if (visual.seriesField) lines.push(`   - Legend/series: \`${visual.seriesField}\``);
      lines.push(`   - ${visual.description}`);
    });
    lines.push('');

    if (page.filters.length > 0) {
      lines.push(`**Filters/slicers:** ${page.filters.join(', ')}`);
      lines.push('');
    }
  });

  if (concept.dataModelNotes.length > 0) {
    lines.push('## 5. Data model notes');
    lines.push('');
    for (const note of concept.dataModelNotes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  lines.push('## 6. Publish');
  lines.push('');
  lines.push('**File → Publish → Publish to Power BI**, choose your workspace, and share the report link with your team.');
  lines.push('');

  return lines.join('\n');
}
