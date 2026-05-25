# AI Accounting Automation Service 📊💼

A production-ready, stateless, and fully modular financial audit background worker built with **Node.js** and **TypeScript**. This service automatically downloads or reads multi-page Excel financial ledgers, processes and aggregates transaction records across years of data, executes an extensible business rules validation engine to detect anomalies, generates high-quality executive summaries using **swappable AI LLM Providers**, and produces three distinct reports: a Telegram-compatible executive brief, a markdown report, and an interactive **Financial Command Center HTML Dashboard** featuring custom SVG chart integrations!

---

## 🛠️ System Architecture

The service executes an automated ETL, Auditing, and visual reporting pipeline based on a strict unidirectional data flow:

```
            Google Drive Ingestion / Local Ingestion
                              │
                              ▼
           [drive.service.ts] (JWT Auth) or Local Loader
                              │
                              ▼
           [excel.parser.ts] (25-Month Sheet Consolidation)
                              │
                              ▼
           [rules.engine.ts] (Modular Auditors & Flags)
                              │
                              ▼
            [ai.service.ts] (Groq / Gemini / OpenAI Factory)
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
           [report-helper.ts]    [report-template.ts]
         (SVG + Data Fallback)   (HTML/CSS Dashboard)
                    └──────────┬──────────┘
                               ▼
     ┌────────────────────────┴────────────────────────┐
     ▼                                                 ▼
[telegram.service.ts] (Markdown)        [data/output/<name>/summary.html]
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
│   │   ├── excel.parser.ts       # Main parser selector facade
│   │   ├── portal.builder.ts     # Master portal compiler & dashboard indexer
│   │   └── parsers/
│   │       ├── sales.parser.ts    # Daily sales multi-month parser
│   │       └── debitors.parser.ts # Customer outstanding udhari parser
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
│   │   ├── ai.prompts.ts         # High-fidelity prompts & mathematical contexts
│   │   ├── report-helper.ts      # Visual charts coordinate math & HTML trend row builders
│   │   ├── report-template.ts    # Daily Sales Register HTML console UI shell
│   │   ├── debitors-template.ts  # Customer outstanding Udhari HTML console UI shell
│   │   └── ai.service.ts         # Lean central orchestrator for LLM prompt connections
│   ├── telegram/
│   │   ├── telegram.bot.ts       # Telegram long polling bot interactive listener
│   │   ├── telegram.client.ts    # Telegram client with markdown recovery safety
│   │   └── telegram.service.ts   # Chunking and interval delivery manager
│   ├── scheduler/
│   │   └── scheduler.job.ts      # Cron job coordinator with overlapping guard
│   ├── services/
│   │   └── orchestrator.service.ts # Core pipeline coordinator with fail-safe alerts
│   ├── types/
│   │   ├── accounting.types.ts   # Core types routing hub
│   │   ├── sales.types.ts        # Daily sales validation schemas
│   │   └── debitors.types.ts     # Customer udhari structures
│   ├── logger/
│   │   └── logger.ts             # Pino logger configurations
│   ├── scripts/
│   │   ├── chat-ledger.ts        # Interactive ledger financial consultant CLI
│   │   ├── check-gemini.ts       # Gemini API validation/diagnostics helper
│   │   ├── generate-sample.ts    # Seed script generating sample test workbook
│   │   ├── inspect-excel.ts      # Excel sheet structure inspection utility
│   │   └── test-flow.ts          # Integrations tester simulating full workflow
│   └── index.ts                  # App entrypoint (runs scheduler + health check server)
├── Dockerfile                    # Multi-stage, low footprint production container
├── .dockerignore                 # Container build context filtering rules
├── .env.example                  # Template listing all environmental configs
├── tsconfig.json                 # Type-check configurations
└── package.json                  # Scripts and package manifests
```

---

## 📊 Interactive Financial Command Center HTML Dashboard

The output generation pipeline produces a fully responsive, highly interactive **Executive Dashboard** saved at `data/output/<ledger_name>/summary.html` built with pure CSS and vanilla JavaScript:

### 🎨 Visual Design & Aesthetics
* **Palette & Surfaces:** Modern dark-theme using a dark-blue backdrop (`#060913`), deep glassmorphism card containers, border highlights, and color-coded status elements.
* **Modern Typography:** Styled with standard pair fonts `Outfit` (headings, KPIs, and SVG charts) and `Inter` (readable tables, list items, and descriptions).
* **Elegant Scrollbars:** Overridden custom scrollbars for horizontal container elements to ensure a premium look across desktop and mobile devices.

### 🧭 Dynamic Navigation System
* **Collapsible Left Sidebar:** Smooth collapse action reducing the sidebar to compact icon badges to maximize workspace area on smaller laptops.
* **Sticky Mobile Drawer:** Smooth slide-out menu drawer with automatic overlay backdrop integration.
* **Top-Scroll Logo Action:** Logo containers on both desktop and mobile layouts scroll directly to the absolute top of the page upon click and restore the active link highlight to the first navigation item.
* **Precision ScrollSpy:** Tracks vertical scroll positions using a recursive offset solver (`getAbsoluteOffsetTop()`) that maps elements across nested coordinate grids to highlight the correct menu tab.
* **Smooth-Scroll Lock:** Utilizes a state-locked scroll flag to prevent active menu indicators from flickering or jumping as the viewport smooth-scrolls across intermediate sections.

### 📈 Neon SVG Dual Line Chart
* An inline vector graphic rendering cumulative business **Inflows** (Liquor sales, Food sales, and Credit Recovered) vs. **Outflows** (Operational expenses and credit extended) across the **25-month historical span**.
* Interactive data nodes with hoverable checkpoints.

### 📋 Weekly Operational Action Checklist
* Aggregates recommended staff procedures in a beautiful checklist format, complete with tick checkboxes and text line-through completed states.

### 🏆 AI Strategic Intelligence Panel
* A premium, gold-highlighted executive intelligence panel exposing critical operational leaks (e.g. food/liquor ratio imbalances, peak cost spikes, dues concentration risks, and collections efficiency metrics) with reliable deterministic data backups when offline.

---

## 💬 Hotel Gaurav CLI Financial Chat Advisor

The system includes an interactive, conversational terminal advisory utility (`src/scripts/chat-ledger.ts`). It loads the consolidated multi-month JSON ledger summary compiled by the pipeline and launches a warm, responsive financial advisory terminal session:

### 🌟 Key Capabilities
* **Automatic Context Loading:** Loads pre-calculated monthly statistics, segment receipts (liquor vs. food), outstanding credit balances, and rules alerts from the master JSON summary.
* **Warm Consulting Voice:** Communicates in an encouraging consulting tone using simple financial metrics and direct actionable suggestions without dry corporate jargon.
* **Swappable LLM Providers:** Automatically routes and query-optimizes prompts through the active model configured in your `.env` settings (Groq/Gemini/OpenAI/Claude).

### 🚀 Running the Chat Session
Launch the interactive terminal interface directly via:
```bash
npm run chat
```

### 💡 Example Owner Queries
* *"What is my credit collections success rate and unrecovered balance?"*
* *"Compare my sales in June 2024 vs June 2025."*
* *"What was my highest profit month and what were its liquor sales?"*
* *"Is there any warning or late-night logging anomaly I should know?"*

---

## ⚡ Quickstart & Specific File Processing

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

### 3. Generate Local Test Ledgers
To seed the input directory with realistic demo excel spreadsheets:
```bash
npm run generate-sample
```
This generates a standard mock transaction file in your **`data/input/`** directory, ready to audit immediately.

### 4. Running the Accounting Audits
The system provides tailored, high-fidelity commands to process specific spreadsheets and generate interactive HTML dashboards:

* 📊 **Audit Daily Sales Register:**
  Processes multi-month daily ledger pages, logs inflows/outflows, and compiles a time-series line chart dashboard:
  ```bash
  npm run audit-sales
  ```
  *Output HTML:* `data/output/Hotel Gaurav Daily Sales Register/summary.html`

* 👤 **Audit Debitors & Outstanding Dues:**
  Parses the outstanding collections workbook sheets (`Summary`, `EntryList`, and `Breakup`), sums balance dues, and generates a Top 15 debtor leaderboard with individual percentage contribution progress bars:
  ```bash
  npm run audit-debitors
  ```
  *Output HTML:* `data/output/DEBITORS LIST/summary.html`

* 🎯 **Audit Any Specific Spreadsheet (Configurable Leaderboard Limit):**
  Trigger the audit pipeline targeting any custom spreadsheet using flexible name lookups and override the outstanding debtor list limit:
  ```bash
  npm run audit -- --file "DEBITORS LIST" --limit 20
  ```
  *Note: Double-dashes (`--`) are required by npm to correctly forward arguments to the underlying script.*

### 5. Launch Service Background Worker
To run the background worker daemon (scheduler & native health endpoint):
```bash
npm run dev
```

---

## 👨‍💼 Simple Usage Steps Guide (For Non-Programmers)

If you want to run this service to audit your own business accounting ledgers, follow these four simple steps:

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

*Note: The parser supports multi-page workbooks, consolidating up to 25+ sheets/months automatically.*

### 2️⃣ Step 2: Set Your AI Provider in the `.env` File
You can add **multiple API keys** in your `.env` configuration file at the same time! The application is smart and uses the **`AI_PROVIDER`** variable as the selector switch to decide which key to run:

```env
# 1. Add your keys here
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-proj-...
CLAUDE_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_y2b...

# 2. Tell the system which key to prioritize!
AI_PROVIDER=groq         # prioritized for elite performance speeds!
# AI_PROVIDER=gemini       # (Uncomment this to switch to GEMINI_API_KEY)
```

### 3️⃣ Step 3: Run the Audit Script
Open your terminal/command prompt inside the folder and run:
```bash
npx tsx src/scripts/test-flow.ts
```

### 4️⃣ Step 4: Open Your Audit Results!
Go to the **`data/output/<ledger_name>/`** folder (e.g. `data/output/Hotel Gaurav Daily Sales Register/`):
* 🖥️ **`summary.html`**: Double-click this to open the gorgeous interactive dashboard containing neon line charts, collapsible navigation control menus, checklist items, and live statistics!
* 📄 **`summary.md`**: Open this file to see a clean markdown summary format.
* ⚙️ **`summary.json`**: Open this file to inspect the underlying parsed data aggregates.
* ⚙️ **`../system.log`**: Go one folder up to inspect the technical validation logs of all runs.

---

## 🔐 Environment Configuration Parameters

Define the following environment variables in your `.env` configuration file:

| Variable Name | Required | Default Value | Description |
| :--- | :--- | :--- | :--- |
| **`AI_PROVIDER`** | Yes | `gemini` | Core provider: `openai`, `gemini`, `claude`, `openrouter`, `deepseek`, `ollama`, `groq` |
| **`AI_MODEL`** | Yes | `gemini-1.5-flash` | The specific model ID to call (e.g. `gpt-4o-mini`, `claude-3-5-sonnet-20240620`, etc.) |
| **`GEMINI_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=gemini` |
| **`OPENAI_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=openai` |
| **`CLAUDE_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=claude` |
| **`OPENROUTER_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=openrouter` |
| **`DEEPSEEK_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=deepseek` |
| **`GROQ_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=groq` |
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

The service features an automated, extensible audit rules runner (`src/rules/rules.engine.ts`). Seven validation modules are enabled out-of-the-box:

1. **`DuplicateInvoiceRule` (High Severity)**: Groups transaction data on invoice codes. Alerts if a ledger records duplicate payments to avoid vendor billing issues.
2. **`HighExpenseRule` (High/Critical Severity)**: Triggers an alert when a single outflow transaction breaches a spending limit (configured to `₹50,000` by default).
3. **`SuspiciousSpikeRule` (Medium Severity)**: Calculates the historical spending averages of each category. If any single payment in that category is `> 3x category average` and exceeds ₹5,000, it flags a suspicious spending spike.
4. **`OffHoursTransactionRule` (Low Severity)**: Flags records posted outside standard operational windows (e.g., weekends or late-night between 11 PM and 5 AM IST) to audit delay lags or unauthorized logs.
5. **`NegativeOrZeroTransactionRule` (Critical Severity)**: Flags records that contain erroneous zero or negative values.
6. **`DuplicateDateRule` (High Severity)**: Detects duplicate transaction entries for the same date and category in daily registers.
7. **`CrossWorkbookReconciliationRule` (High Severity)**: Reconciles credit extended and credit recovery between the Daily Sales Register and the Debitors Ledger, flagging any variance mismatches.

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

Render supports deploying stateless automated workers as a **Web Service** (using the HTTP health check endpoint) or a **Background Worker**.

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
