# Dashboard Builder

A natural-language interface for designing Power BI dashboards. Describe what you want, upload your data
(and optionally reference screenshots), and get:

1. 2-3 distinct dashboard concepts (layout, chart types, KPIs, color theme) generated from your actual data schema
2. An interactive preview built from your real uploaded data (not placeholder numbers)
3. A downloadable build spec with DAX measures, field wells, and page-by-page instructions to recreate it in Power BI Desktop
4. An optional one-click push of your data into a live Power BI workspace via the Power BI REST API

## Important limitation

The Power BI `.pbix` file format has no public write API, and the Power BI REST API cannot programmatically
assemble report visuals. "Publish to Power BI" pushes your **data** into a workspace as a live dataset — the
report's charts and layout still need to be built in Power BI Desktop or the Power BI service, using the
downloaded build spec as the guide. That's true of any tool working against the public Power BI API, not just
this one.

## Setup

```bash
npm install
cp .env.example .env.local
```

### Required: Claude API

Set `ANTHROPIC_API_KEY` in `.env.local`. Used to analyze your data schema + description + screenshots and
generate dashboard concepts, DAX measures, and instructions.

### Optional: Power BI publishing

To enable the "Publish to Power BI" step, you need an Azure AD app registration with Power BI Service API
permissions:

1. In the [Azure Portal](https://portal.azure.com), go to **Microsoft Entra ID → App registrations → New registration**.
2. Note the **Application (client) ID** and **Directory (tenant) ID**.
3. Under **Certificates & secrets**, create a new client secret. Note the value immediately (it's only shown once).
4. Under **API permissions**, add permissions for **Power BI Service**: `Dataset.ReadWrite.All`,
   `Workspace.ReadWrite.All` (Application permissions, not Delegated). Grant admin consent.
5. In the [Power BI Admin Portal](https://app.powerbi.com/admin-portal/tenantSettings), enable **"Allow service
   principals to use Power BI APIs"** for your tenant (or the relevant security group), and add your app's
   service principal to that group.
6. Create or choose a Power BI **workspace**, and add the app's service principal as a member (Contributor or
   above). Copy the workspace ID from the workspace URL.
7. Fill in `POWERBI_TENANT_ID`, `POWERBI_CLIENT_ID`, `POWERBI_CLIENT_SECRET`, and `POWERBI_WORKSPACE_ID` in
   `.env.local`.

Without these variables set, everything else in the app works — publishing is just disabled with a clear error
message.

## Run

```bash
npm run dev
```

Open http://localhost:3000.

## How it works

- `src/lib/dataParsing.ts` — parses uploaded CSV/XLSX files, infers column types, and samples rows
- `src/lib/anthropic.ts` — calls the Claude API with the data schema, description, and screenshots to generate
  structured dashboard concepts (JSON schema-constrained output)
- `src/components/DashboardPreview.tsx` — renders an interactive Recharts-based preview from your real data,
  driven by the chosen concept's visual specs
- `src/lib/buildSpec.ts` — turns a concept into a downloadable Markdown build spec (DAX, theme JSON, layout)
- `src/lib/powerbi.ts` — Power BI REST API client (Azure AD client-credentials auth, push dataset creation, row
  upload)
