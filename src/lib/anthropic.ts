import type { DashboardConcept, DatasetSchema } from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-5';

interface ImageInput {
  mediaType: string;
  base64: string;
}

const CONCEPT_SCHEMA = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          summary: { type: 'string' },
          audience: { type: 'string' },
          theme: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              primary: { type: 'string' },
              secondary: { type: 'string' },
              background: { type: 'string' },
              surface: { type: 'string' },
              text: { type: 'string' },
              chartPalette: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 8 },
            },
            required: ['name', 'primary', 'secondary', 'background', 'surface', 'text', 'chartPalette'],
            additionalProperties: false,
          },
          pages: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                purpose: { type: 'string' },
                kpis: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      measureName: { type: 'string' },
                      format: { type: 'string' },
                    },
                    required: ['label', 'measureName', 'format'],
                    additionalProperties: false,
                  },
                },
                visuals: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['bar', 'column', 'line', 'pie', 'donut', 'area', 'scatter', 'table', 'card', 'map'],
                      },
                      title: { type: 'string' },
                      xField: { type: 'string' },
                      yField: { type: 'string' },
                      seriesField: { type: 'string' },
                      aggregation: {
                        type: 'string',
                        enum: ['sum', 'average', 'count', 'min', 'max', 'distinctCount'],
                      },
                      description: { type: 'string' },
                    },
                    required: ['type', 'title', 'description'],
                    additionalProperties: false,
                  },
                },
                filters: { type: 'array', items: { type: 'string' } },
              },
              required: ['name', 'purpose', 'kpis', 'visuals', 'filters'],
              additionalProperties: false,
            },
          },
          daxMeasures: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                expression: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['name', 'expression', 'description'],
              additionalProperties: false,
            },
          },
          dataModelNotes: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'name', 'summary', 'audience', 'theme', 'pages', 'daxMeasures', 'dataModelNotes'],
        additionalProperties: false,
      },
    },
  },
  required: ['concepts'],
  additionalProperties: false,
} as const;

function buildSchemaPrompt(schema: DatasetSchema): string {
  const columnLines = schema.columns
    .map((c) => {
      const extra =
        c.type === 'number' || c.type === 'date'
          ? ` range=[${c.min ?? '?'}, ${c.max ?? '?'}]`
          : ` examples=${JSON.stringify(c.sampleValues.slice(0, 5))}`;
      return `- ${c.name} (${c.type}, distinct=${c.distinctCount}, nulls=${c.nullCount})${extra}`;
    })
    .join('\n');

  return `Dataset "${schema.fileName}" has ${schema.rowCount} rows and these columns:\n${columnLines}`;
}

export async function generateDashboardConcepts(params: {
  description: string;
  schema: DatasetSchema;
  images?: ImageInput[];
}): Promise<DashboardConcept[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env.local file.');
  }

  const userContent: Array<Record<string, unknown>> = [];

  for (const image of params.images ?? []) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
    });
  }

  userContent.push({
    type: 'text',
    text: [
      `The user wants a Power BI dashboard. Their description:`,
      `"""${params.description}"""`,
      ``,
      buildSchemaPrompt(params.schema),
      ``,
      params.images?.length
        ? `They also attached ${params.images.length} reference screenshot(s) — use them for style/layout/color inspiration, adapted to their actual data columns above. Do not invent data fields that don't exist in the schema.`
        : ``,
      ``,
      `Produce 2-3 distinct dashboard concepts. Each concept must:`,
      `- Only reference column names that exist in the schema above`,
      `- Include realistic Power BI DAX measures (using the actual column names)`,
      `- Choose visual types appropriate to each field's data type (categorical -> bar/pie, time series -> line/area, single number -> card)`,
      `- Include a distinct color theme per concept (hex colors)`,
      `- Be genuinely different from each other in layout/focus, not cosmetic variations`,
    ].join('\n'),
  });

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: CONCEPT_SCHEMA },
      },
      system:
        'You are a Power BI solutions architect. You design dashboard concepts strictly grounded in the columns available in the provided dataset schema. You never invent fields. You respond only with the structured JSON requested.',
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errText}`);
  }

  const data = await response.json();

  if (data.stop_reason === 'refusal') {
    throw new Error('The request was declined. Try rephrasing your dashboard description.');
  }

  const textBlock = (data.content as Array<{ type: string; text?: string }>).find((b) => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('No response content from Claude API.');
  }

  const parsed = JSON.parse(textBlock.text) as { concepts: DashboardConcept[] };
  return parsed.concepts;
}
