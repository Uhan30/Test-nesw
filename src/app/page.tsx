'use client';

import { useRef, useState } from 'react';
import { DashboardPreview } from '@/components/DashboardPreview';
import { generateBuildSpecMarkdown } from '@/lib/buildSpec';
import type { DashboardConcept, DatasetSchema } from '@/lib/types';

type Step = 'upload' | 'analyzing' | 'options' | 'preview';

interface ImagePayload {
  fileName: string;
  mediaType: string;
  base64: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState<string | null>(null);

  const [dataFile, setDataFile] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [description, setDescription] = useState('');

  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [concepts, setConcepts] = useState<DashboardConcept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<DashboardConcept | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ datasetUrl: string; rowsPushed: number } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const dataInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  async function handleGenerate() {
    setError(null);
    if (!dataFile) {
      setError('Upload a data file (CSV or Excel) to continue.');
      return;
    }
    if (!description.trim()) {
      setError('Describe the dashboard you want.');
      return;
    }

    setStep('analyzing');
    try {
      const formData = new FormData();
      formData.append('file', dataFile);
      const parseRes = await fetch('/api/parse-data', { method: 'POST', body: formData });
      const parseJson = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseJson.error ?? 'Failed to parse data file.');

      setSchema(parseJson.schema);
      setRows(parseJson.rows);

      const images: ImagePayload[] = [];
      for (const shot of screenshots) {
        const base64 = await fileToBase64(shot);
        images.push({ fileName: shot.name, mediaType: shot.type || 'image/png', base64 });
      }

      const planRes = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description, schema: parseJson.schema, images }),
      });
      const planJson = await planRes.json();
      if (!planRes.ok) throw new Error(planJson.error ?? 'Failed to generate dashboard concepts.');

      setConcepts(planJson.concepts);
      setStep('options');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('upload');
    }
  }

  function selectConcept(concept: DashboardConcept) {
    setSelectedConcept(concept);
    setPublishResult(null);
    setPublishError(null);
    setStep('preview');
  }

  function downloadInstructions() {
    if (!selectedConcept || !schema) return;
    const markdown = generateBuildSpecMarkdown(selectedConcept, schema);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedConcept.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-build-spec.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePublish() {
    if (!schema) return;
    setPublishing(true);
    setPublishError(null);
    setPublishResult(null);
    try {
      const res = await fetch('/api/publish-powerbi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schema, rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to publish to Power BI.');
      setPublishResult(json.result);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to publish to Power BI.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard Builder</h1>
        <p className="mt-1 text-sm text-slate-500">
          Describe the Power BI dashboard you want, upload your data, and get an interactive preview plus a
          step-by-step build spec.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div className="space-y-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Data file (CSV or Excel)</label>
            <input
              ref={dataInputRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls"
              onChange={(e) => setDataFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-accent-dark"
            />
            {dataFile && <p className="mt-1 text-xs text-slate-500">{dataFile.name}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Reference screenshots (optional)</label>
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setScreenshots(Array.from(e.target.files ?? []))}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-300 dark:file:bg-slate-800 dark:hover:file:bg-slate-700"
            />
            {screenshots.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">{screenshots.length} screenshot(s) attached</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Describe the dashboard you want</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="e.g. An executive sales overview with monthly revenue trend, top products, and regional breakdown. Should feel clean and modern like the screenshot I attached."
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <button
            onClick={handleGenerate}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-ink hover:bg-accent-dark"
          >
            Generate dashboard concepts
          </button>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-slate-500">Analyzing your data and drafting dashboard concepts…</p>
        </div>
      )}

      {step === 'options' && (
        <div>
          <button onClick={() => setStep('upload')} className="mb-4 text-xs text-slate-500 hover:underline">
            ← Back
          </button>
          <h2 className="mb-4 text-lg font-medium">Choose a concept</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {concepts.map((concept) => (
              <button
                key={concept.id}
                onClick={() => selectConcept(concept)}
                className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-accent hover:shadow-sm dark:border-slate-800"
              >
                <div className="mb-2 flex gap-1">
                  {concept.theme.chartPalette.slice(0, 5).map((c, i) => (
                    <span key={i} className="h-4 w-4 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="font-medium">{concept.name}</div>
                <div className="mt-1 text-sm text-slate-500">{concept.summary}</div>
                <div className="mt-2 text-xs text-slate-400">
                  {concept.pages.length} page{concept.pages.length !== 1 ? 's' : ''} · {concept.audience}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'preview' && selectedConcept && schema && (
        <div>
          <button onClick={() => setStep('options')} className="mb-4 text-xs text-slate-500 hover:underline">
            ← Back to concepts
          </button>

          <DashboardPreview concept={selectedConcept} rows={rows} schema={schema} />

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={downloadInstructions}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
            >
              Download build instructions (.md)
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent-dark disabled:opacity-50"
            >
              {publishing ? 'Publishing…' : 'Publish dataset to Power BI'}
            </button>
          </div>

          {publishError && <p className="mt-3 text-sm text-red-600">{publishError}</p>}
          {publishResult && (
            <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              Pushed {publishResult.rowsPushed} rows to Power BI.{' '}
              <a href={publishResult.datasetUrl} target="_blank" rel="noreferrer" className="underline">
                Open dataset in Power BI
              </a>
              . Now build the report visuals in Power BI Desktop/Service using the downloaded build spec — the
              REST API can push data but can't assemble report visuals for you.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
