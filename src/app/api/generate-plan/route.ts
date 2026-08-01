import { NextRequest, NextResponse } from 'next/server';
import { generateDashboardConcepts } from '@/lib/anthropic';
import type { DatasetSchema } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const description: string = body.description;
    const schema: DatasetSchema = body.schema;
    const images: Array<{ mediaType: string; base64: string }> = body.images ?? [];

    if (!description?.trim()) {
      return NextResponse.json({ error: 'A description is required.' }, { status: 400 });
    }
    if (!schema?.columns?.length) {
      return NextResponse.json({ error: 'A parsed dataset schema is required.' }, { status: 400 });
    }

    const concepts = await generateDashboardConcepts({ description, schema, images });
    return NextResponse.json({ concepts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate dashboard concepts.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
