# AI Accounting Automation Service 📊💼

A production-ready, stateless, and fully modular background worker built with **Node.js** and **TypeScript**. This service connects to Google Drive, automatically downloads the latest Excel financial ledger, parses the transaction records, runs an extensible business rules validation engine to detect anomalies, generates high-quality executive financial reports using **swappable AI LLM Providers**, and posts clean, formatted message updates to **Telegram** on a customizable scheduler.

---

## 🛠️ System Architecture

The service executes an automated ETL and Auditing pipeline based on a strict unidirectional data flow:

```
      Google Drive Ingestion
                 │
                 ▼
     [drive.service.ts] (JWT Auth) ──► Downloads latest .xlsx workbook
                 │
                 ▼
     [excel.parser.ts] ──────────────► Scans columns, parses rows into JSON
                 │
                 ▼
     [rules.engine.ts] ──────────────► Runs modular auditors & validates inputs
                 │
                 ▼
     [ai.service.ts] (Factory) ──────► Compiles context prompt & query LLM API
                 │
                 ▼
     [telegram.service.ts] ──────────► Delivers formatted markdown report
```

---

## 📁 Project Directory Structure

```
ai-accounting-automation/
├── src/
│   ├── config/
│   │   └── config.ts             # Strongly-typed config loader & Zod validator
│   ├── drive/
│   │   ├── drive.client.ts       # Authorized Google Drive Client (JWT auth)
│   │   └── drive.service.ts      # Excel spreadsheet searcher and downloader
│   ├── excel/
│   │   ├── excel.mapper.ts       # Dynamic column finder & row converter
│   │   └── excel.parser.ts       # Spreadsheet workbook reader & error logger
│   ├── rules/
│   │   ├── rules.types.ts        # Modular Rules Engine interfaces & Alert contracts
│   │   └── rules.engine.ts       # Concrete Rule implementations (Spikes, Duplicates)
│   ├── ai/
│   │   ├── providers/
│   │   │   ├── openai.provider.ts # OpenAI, DeepSeek, & OpenRouter client
│   │   │   ├── gemini.provider.ts # Google Gemini REST client
│   │   │   ├── claude.provider.ts # Anthropic Claude REST client
│   │   │   └── ollama.provider.ts # Local LLM client
│   │   ├── ai.types.ts           # Swappable AI provider contract
│   │   ├── ai.factory.ts         # Env-driven runtime provider factory
│   │   ├── ai.prompts.ts         # High-fidelity prompt templates & math summaries
│   │   └── ai.service.ts         # Central execution and retry service
│   ├── telegram/
│   │   ├── telegram.client.ts    # Telegram client with Markdown parsing safety recovery
│   │   └── telegram.service.ts   # Chunking and interval delivery manager
│   ├── scheduler/
│   │   └── scheduler.job.ts      # Cron job coordinator with overlapping guard
│   ├── services/
│   │   └── orchestrator.service.ts # Core pipeline coordinator with fail-safe alerts
│   ├── types/
│   │   └── accounting.types.ts   # Ingest schema, Zod validations, parsing models
│   ├── logger/
│   │   └── logger.ts             # Pino logger configurations
│   ├── scripts/
│   │   ├── generate-sample.ts    # Seed script generating sample test workbook
│   │   └── test-flow.ts          # Integrations tester simulating full workflow
│   └── index.ts                  # App entrypoint (runs scheduler + web healthchecks)
├── Dockerfile                    # Multi-stage, low footprint production container
├── .dockerignore                 # Container build context filtering rules
├── .env.example                  # Template listing all environmental configs
├── tsconfig.json                 # Type-check configurations
└── package.json                  # Scripts and package manifests
```

---

## ⚡ Quickstart

### 1. Ingestion Setup & Installation
Clone the workspace files or initialize the target directory, then execute package installation:
```bash
npm install
```

### 2. Configure Credentials
Duplicate `.env.example` to a new `.env` file in the project root:
```bash
cp .env.example .env
```
Fill in the parameters (details below).

### 3. Generate Local Test Ledger
To test the parser and rules engine locally without setting up Google Drive immediately:
```bash
npx tsx src/scripts/generate-sample.ts
```
This generates a realistic financial spreadsheet loaded with real-world transactions (including duplicate payments, expense breaches, off-hours activity, and data errors) inside your **`data/input/`** directory.

### 4. Execute Pipeline Integration Test
Verify all subsystems (parsing, rules engine, live AI analysis, and logs) with a single command:
```bash
npx tsx src/scripts/test-flow.ts
```
* **Active API Keys?** The script calls the live provider (configured in `.env`), performs semantic business auditing, and saves the executive brief inside **`data/output/sample_ledger_summary.md`**.
* **Offline Fallback?** If no key is set or the API rate limits, our fail-safe hybrid engine compiles the complete multi-page audit report with perfect mathematical cashflow calculations and skipped row lists seamlessly!
* **System Logging**: The complete historical trace of every validation warn, rules flag, and API metric is appended persistently to **`data/output/system.log`**.

### 5. Launch Service Background Worker
To run the background worker (scheduler & native health endpoint):
```bash
npm run dev
```

---

## 👨‍💼 Simple Usage Steps Guide (For Non-Programmers)

If you are not a developer and just want to run this service to audit your own real business accounting ledgers, follow these four simple steps:

### 1️⃣ Step 1: Format & Place Your Excel File
Make sure your business spreadsheet has columns containing these words (the order does not matter):
* **Date** (e.g. `Transaction Date`)
* **Invoice** (e.g. `Invoice Number`)
* **Category** (e.g. `Expense Category`)
* **Particulars** (e.g. `Description`)
* **Amount** (e.g. `Amount Invoiced`)
* **Type** (e.g. `credit` for income / `debit` for payments)
* **Vendor** (e.g. `Vendor/Payee`)

Name your file **`sample_ledger.xlsx`** and save it inside this folder:
📂 **`data/input/`**

### 2️⃣ Step 2: Set Your AI Provider in the `.env` File
You can add **multiple API keys** in your `.env` configuration file at the same time! The application is smart and uses the **`AI_PROVIDER`** variable as the selector switch to decide which key to run:

```env
# 1. Add your keys here
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-proj-...
CLAUDE_API_KEY=sk-ant-...

# 2. Tell the system which key to prioritize!
AI_PROVIDER=gemini       # Uses GEMINI_API_KEY and Gemini models
# AI_PROVIDER=openai     # (Uncomment this to switch to OPENAI_API_KEY)
# AI_PROVIDER=claude     # (Uncomment this to switch to CLAUDE_API_KEY)
```

### 3️⃣ Step 3: Run the Audit Script
Open your terminal/command prompt inside the folder and run:
```bash
npx tsx src/scripts/test-flow.ts
```

### 4️⃣ Step 4: Open Your Audit Results!
Go to the **`data/output/`** folder:
* 📄 **`sample_ledger_summary.md`**: Open this file to see your stunning, executive-ready Financial Dashboard (complete with total revenue, expenses, net deficit/surplus, unparseable skipped row logs, and live auditor insights!).
* ⚙️ **`system.log`**: Open this file to inspect the historical, technical logs of everything the pipeline evaluated.

---

## 🔐 Environment Configuration Parameters

Define the following environment variables in your `.env` configuration file:

| Variable Name | Required | Default Value | Description |
| :--- | :--- | :--- | :--- |
| **`AI_PROVIDER`** | Yes | `gemini` | Core provider: `openai`, `gemini`, `claude`, `openrouter`, `deepseek`, `ollama` |
| **`AI_MODEL`** | Yes | `gemini-1.5-flash` | The specific model ID to call (e.g. `gpt-4o-mini`, `claude-3-5-sonnet-20240620`, etc.) |
| **`GEMINI_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=gemini` |
| **`OPENAI_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=openai` |
| **`CLAUDE_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=claude` |
| **`OPENROUTER_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=openrouter` |
| **`DEEPSEEK_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=deepseek` |
| **`OLLAMA_BASE_URL`** | No | `http://localhost:11434` | Endpoint for local model serving |
| **`GOOGLE_CLIENT_EMAIL`** | Yes | - | Google Service Account email (IAM credentials) |
| **`GOOGLE_PRIVATE_KEY`** | Yes | - | Raw Private Key PEM string (supports multi-line or escaped `\n`) |
| **`GOOGLE_DRIVE_FOLDER_ID`** | Yes | - | Target Google Drive Folder ID containing the ledgers |
| **`TELEGRAM_BOT_TOKEN`** | Yes | - | Token generated by BotFather (e.g. `123456:ABC...`) |
| **`TELEGRAM_CHAT_ID`** | Yes | - | Recipient Chat or Group channel ID (typically negative for groups) |
| **`CRON_SCHEDULE`** | No | `0 * * * *` | Chron task schedule (Defaults to hourly: `0 * * * *`) |
| **`PORT`** | No | `8080` | Bind port for cloud environment container health checks |

---

## 🕵️ Rules Engine Specification

The service features an automated, extensible audit rules runner (`src/rules/rules.engine.ts`). Five validation modules are enabled out-of-the-box:

1. **`DuplicateInvoiceRule` (High Severity)**: Groups transaction data on invoice codes. Alerts if a ledger records duplicate payments to avoid vendor billing issues.
2. **`HighExpenseRule` (High/Critical Severity)**: Triggers an alert when a single outflow transaction breaches a spending limit (configured to `₹50,000` by default).
3. **`SuspiciousSpikeRule` (Medium Severity)**: Calculates the historical spending averages of each category. If any single payment in that category is `> 3x category average`, it flags a suspicious spending spike.
4. **`OffHoursTransactionRule` (Low Severity)**: Flags records posted outside standard operational windows (e.g., weekends or late-night between 11 PM and 5 AM) to audit delay lags or unauthorized logs.
5. **`NegativeOrZeroTransactionRule` (Critical Severity)**: Flags records that contain erroneous zero or negative values.

---

## 📈 Integration Demonstrations

### 1. Ingestion Input Ledger Format (`sample_ledger.xlsx`)
Our parser maps fields regardless of column order by scanning for column header keywords. Standard formatting:

| Transaction Date | Invoice Number | Category | Particulars (Description) | Invoiced Amount | Type (credit/debit) | Vendor / Payee |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-05-15 10:00:00 | INV-2026-001 | Revenue | SaaS Client Subscription Tier A | 120000 | credit | Stripe Inflow |
| 2026-05-16 11:30:00 | INV-2026-002 | Infrastructure | AWS Monthly Invoice | 18500 | debit | Amazon Web Services |
| 2026-05-19 09:30:00 | INV-2026-005 | Marketing | Q2 Google AdWords Campaign | 24000 | debit | Google LLC |
| 2026-05-19 17:45:00 | INV-2026-005 | Marketing | Google Ads Retargeting Retainer | 24000 | debit | Google LLC |

### 2. Formatted Telegram Output Report
Below is a visual example of the synthesized, Telegram-compatible markdown summary generated by our AI auditor:

```markdown
📊 *FINANCIAL AUDIT EXECUTIVE SUMMARY*
📅 Ingestion Timestamp: 5/23/2026, 5:40:12 PM
📁 Source Ledger: `sample_ledger.xlsx`

*-----------------------------------*
💰 *KEY PERFORMANCE METRICS*
*-----------------------------------*
• *Total Revenue (Inflow)*: ₹120,000
• *Total Expenses (Outflow)*: ₹184,300
• *Net Operating Cashflow*: 🔴 *-₹64,300* (Deficit)

*-----------------------------------*
🔍 *CRITICAL RULES AUDIT ALERTS*
*-----------------------------------*
🚨 *[CRITICAL]* Invalid transaction amount detected: ₹-10,000 from invoice INV-ERR-001.
🟠 *[HIGH]* Duplicate invoice number detected: *INV-2026-005* found twice for vendor *Google LLC* totaling *₹48,000*.
🟠 *[HIGH]* Large transaction breach: Outflow of *₹75,000* to *SecOps Consulting Group* exceeded audit limit (₹50,000).
⚠️ *[MEDIUM]* Suspicious category spike: *Office Operations* recorded a single charge of *₹28,000* (Herman Miller Chair), which is *30.0x* the category average (₹933).
⚠️ *[LOW]* Off-Hours booking: Transaction *₹5,400* (Taj Fine Dining) was logged during the weekend late-night (Sunday 2:45 AM).

*-----------------------------------*
🛠️ *INGESTION INTEGRITY STATS*
*-----------------------------------*
• Successfully Processed Rows: 10
• Format Failures (Skipped Rows): 1 (Row 12: invalid Date & Amount variables)

*-----------------------------------*
💡 *FINANCIAL INSIGHTS & RISKS*
*-----------------------------------*
1. *Operating Deficit*: We registered a net loss of ₹64,300. This is driven by heavy outlays for consulting (₹75k) and office equipment (₹28k).
2. *Duplicate Payment Risk*: Action required to audit double charges on invoice **INV-2026-005** to Google.
3. *Inventory Waste*: Verify authorization for Herman Miller equipment purchase. Category averages indicate a dramatic cost overrun.

_Audit completed by Antigravity AI Engine_
```

---

## 🐳 Docker Deployment

For high-availability container hosting, package the worker in a lightweight, secure container image:

### 1. Build Image
```bash
docker build -t ai-accounting-worker .
```

### 2. Run Container Locally
```bash
docker run --env-file .env -p 8080:8080 ai-accounting-worker
```

---

## 🚀 Cloud Container Hosting Guide

Our background worker features a built-in health check HTTP server that binds automatically to the environment's `$PORT`. This prevents container termination during health validations.

### A. Railway Deployment

1. **Create Project**: Click **New Project** on Railway Dashboard and choose **Github Repository** or **Deploy from CLI**.
2. **Configure Variables**: Navigate to the **Variables** tab of the service and import your `.env` settings:
   - Make sure to paste the exact `GOOGLE_PRIVATE_KEY` with actual newlines or escaped strings.
   - Specify `PORT=8080` (Railway automatically maps this).
3. **Deployment**: Railway automatically reads the `Dockerfile` at the root, builds the multi-stage package, binds the health checks to `PORT`, and starts the scheduler background worker seamlessly!

### B. Render Deployment

Render supports deploying stateless automated workers as a **Web Service** (using the HTTP health check endpoint) or a **Background Worker** (if you do not need port bindings, but Web Service is recommended to prevent Render from declaring the container dead due to a missing web server).

1. **Deploy Service**: Go to the Render Dashboard, click **New +**, and select **Web Service**.
2. **Connect Repo**: Link your repository.
3. **Configure Settings**:
   - **Environment**: Select `Docker`.
   - **Branch**: Specify your branch (e.g. `main`).
4. **Environment Variables**: Add your `.env` configurations under **Advanced** configurations:
   - Render handles port detection automatically by checking port `8080`.
5. **Launch**: Click **Deploy Web Service**. Render builds the image, routes the `/health` endpoint automatically, and begins executing the daily/hourly cron schedule!

---

## 🔮 Future Scalability Path

The architecture is built from the ground up to support future business scale:
* **Multi-Format Excel Parsing**: The `excel.mapper.ts` synonymous header map can be expanded or mapped dynamically to specific database profiles if you ingest ledgers from multiple vendors.
* **Persistent History**: While designed to be stateless, you can easily plug in an ORM (like Prisma) in `orchestrator.service.ts` to log transaction histories and alerts before generating summaries.
* **Multiple Recipients**: Expand `TELEGRAM_CHAT_ID` to a list or comma-separated string in the config, and iterate over it in `telegram.service.ts` to dispatch summaries to multiple executive channels or accounting groups.
