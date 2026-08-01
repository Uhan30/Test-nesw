import { NextRequest, NextResponse } from 'next/server';
import { parseDataFile, parseDataRows } from '@/lib/dataParsing';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const schema = await parseDataFile(file.name, buffer);
    const rows = await parseDataRows(file.name, buffer);

    return NextResponse.json({ schema, rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse file.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
