import { NextRequest, NextResponse } from 'next/server';
import { loadPowerBiCredentials, publishPushDataset } from '@/lib/powerbi';
import type { DatasetSchema } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const creds = loadPowerBiCredentials();
    if (!creds) {
      return NextResponse.json(
        {
          error:
            'Power BI publishing is not configured on this server. Set POWERBI_TENANT_ID, POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET, and POWERBI_WORKSPACE_ID. See README.md for the Azure AD app registration steps.',
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const schema: DatasetSchema = body.schema;
    const rows: Record<string, unknown>[] = body.rows;

    if (!schema?.columns?.length || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'A parsed dataset schema and rows are required.' }, { status: 400 });
    }

    const result = await publishPushDataset(creds, schema, rows);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to publish to Power BI.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
