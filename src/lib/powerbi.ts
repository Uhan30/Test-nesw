import type { ColumnSchema, DatasetSchema } from './types';

const POWERBI_API_BASE = 'https://api.powerbi.com/v1.0/myorg';

export interface PowerBiCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  workspaceId: string;
}

export function loadPowerBiCredentials(): PowerBiCredentials | null {
  const tenantId = process.env.POWERBI_TENANT_ID;
  const clientId = process.env.POWERBI_CLIENT_ID;
  const clientSecret = process.env.POWERBI_CLIENT_SECRET;
  const workspaceId = process.env.POWERBI_WORKSPACE_ID;
  if (!tenantId || !clientId || !clientSecret || !workspaceId) return null;
  return { tenantId, clientId, clientSecret, workspaceId };
}

async function getAccessToken(creds: PowerBiCredentials): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: 'https://analysis.windows.net/powerbi/api/.default',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure AD auth failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.access_token as string;
}

function powerBiType(column: ColumnSchema): string {
  switch (column.type) {
    case 'number':
      return 'Double';
    case 'date':
      return 'DateTime';
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
}

function sanitizeTableName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_ ]/g, ' ').trim();
  return base.length > 0 ? base.slice(0, 100) : 'Dataset';
}

export interface PublishResult {
  datasetId: string;
  tableName: string;
  workspaceId: string;
  rowsPushed: number;
  datasetUrl: string;
}

/**
 * Publishes a push dataset with the parsed rows into the configured Power BI workspace.
 * Note: the Power BI REST API cannot programmatically build report visuals — creating the
 * report layout (charts, KPIs, pages) is still a manual step in Power BI Desktop/Service,
 * using the generated build spec as the guide. This function gets the data into the
 * workspace and ready to visualize.
 */
export async function publishPushDataset(
  creds: PowerBiCredentials,
  schema: DatasetSchema,
  rows: Record<string, unknown>[]
): Promise<PublishResult> {
  const accessToken = await getAccessToken(creds);
  const tableName = sanitizeTableName(schema.fileName);

  const datasetDefinition = {
    name: `${tableName} (Dashboard Builder)`,
    defaultMode: 'Push',
    tables: [
      {
        name: tableName,
        columns: schema.columns.map((c) => ({ name: c.name, dataType: powerBiType(c) })),
      },
    ],
  };

  const createRes = await fetch(`${POWERBI_API_BASE}/groups/${creds.workspaceId}/datasets?defaultRetentionPolicy=None`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(datasetDefinition),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create Power BI dataset (${createRes.status}): ${text}`);
  }

  const dataset = await createRes.json();
  const datasetId = dataset.id as string;

  const BATCH_SIZE = 10000;
  let rowsPushed = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const pushRes = await fetch(
      `${POWERBI_API_BASE}/groups/${creds.workspaceId}/datasets/${datasetId}/tables/${encodeURIComponent(tableName)}/rows`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ rows: batch }),
      }
    );

    if (!pushRes.ok) {
      const text = await pushRes.text();
      throw new Error(`Failed to push rows to Power BI (${pushRes.status}): ${text}`);
    }
    rowsPushed += batch.length;
  }

  return {
    datasetId,
    tableName,
    workspaceId: creds.workspaceId,
    rowsPushed,
    datasetUrl: `https://app.powerbi.com/groups/${creds.workspaceId}/datasets/${datasetId}/details`,
  };
}
