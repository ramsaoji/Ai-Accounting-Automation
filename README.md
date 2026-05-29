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
           [excel.parser.ts] (Multi-Month Sheet Consolidation)
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
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── chat.controller.ts     # Zod validation & LLM advisor chat endpoint
│   │   │   ├── health.controller.ts   # Healthcheck server metrics endpoint
│   │   │   ├── report.controller.ts   # Real-time report getters and uploader
│   │   │   └── security.controller.ts # Passcode verification (cookie sets), session status, logout, and change endpoints
│   │   ├── fastify.app.ts        # Fastify app builder with CORS & Cookie plugin configuration
│   │   └── fastify.auth.ts       # Authentication hook checking HttpOnly cookies first, with Bearer header fallback
│   ├── config/
│   │   └── config.ts             # Strongly-typed config loader & Zod validator
│   ├── db/
│   │   └── db.client.ts          # Neon DB Pool client with table/security initialization
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
│   │   ├── ai.prompts.ts         # Shared AI prompt input type definitions
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
│   │   └── orchestrator.service.ts # Decoupled pipeline coordinator with parallel worker_threads spawner
│   ├── types/
│   │   ├── accounting.types.ts   # Core types routing hub
│   │   ├── sales.types.ts        # Daily sales validation schemas
│   │   └── debitors.types.ts     # Customer udhari structures
│   ├── logger/
│   │   └── logger.ts             # Pino logger configurations
│   ├── scripts/
│   │   ├── chat-ledger.ts        # Interactive ledger financial consultant CLI
│   │   ├── check-db.ts           # Neon DB connection & query test script
│   │   ├── check-gemini.ts       # Gemini API validation/diagnostics helper
│   │   ├── generate-sample.ts    # Seed script generating sample test workbook
│   │   ├── inspect-excel.ts      # Excel sheet structure inspection utility
│   │   ├── process-local.ts      # Local batch processor: runs full pipeline on data/input/ files
│   │   └── test-db-init.ts       # Database structure manual table initializer
│   ├── utils/
│   │   └── cron.ts               # Cron expression humanization utility
│   └── index.ts                  # App entrypoint (initializes DB, scheduler, Telegram bot, and Fastify server)
│── Dockerfile                    # Multi-stage, low footprint production container
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
* An inline vector graphic rendering cumulative business **Inflows** (Liquor sales, Food sales, and Credit Recovered) vs. **Outflows** (Operational expenses and credit extended) across the parsed historical span.
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

* 📊 **Process Daily Sales Register:**
  Processes multi-month daily ledger pages, logs inflows/outflows, and compiles a time-series line chart dashboard:
  ```bash
  npm run process-sales
  ```
  *Output HTML:* `data/output/Hotel Gaurav Daily Sales Register/summary.html`

* 👤 **Process Debitors & Outstanding Dues:**
  Parses the outstanding collections workbook sheets (`Summary`, `EntryList`, and `Breakup`), sums balance dues, and generates a Top 15 debtor leaderboard with individual percentage contribution progress bars:
  ```bash
  npm run process-debitors
  ```
  *Output HTML:* `data/output/DEBITORS LIST/summary.html`

* 🎯 **Process Any Specific Spreadsheet (Configurable Leaderboard Limit):**
  Trigger the pipeline targeting any custom spreadsheet using flexible name lookups and override the outstanding debtor list limit:
  ```bash
  npm run process-local -- --file "DEBITORS LIST" --limit 20
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

*Note: The parser supports multi-page workbooks, consolidating all sheets/months automatically.*

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
npm run process-local
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
| **`NODE_ENV`** | No | `development` | Runtime mode (`development` enables verbose debug logs, `production` enables clean info logs) |
| **`PORT`** | No | `8080` | Bind port for cloud environment container health checks |
| **`DATABASE_URL`** | No | - | PostgreSQL connection string (e.g. Neon DB). If omitted, the backend reads from local `data/output/` files instead |
| **`AI_PROVIDER`** | Yes | `gemini` | Core provider: `openai`, `gemini`, `claude`, `openrouter`, `deepseek`, `ollama`, `groq` |
| **`AI_MODEL`** | Yes | - | The specific model ID to call (e.g. `gpt-4o-mini`, `gemini-1.5-flash`, etc.). Must be defined |
| **`GEMINI_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=gemini` |
| **`OPENAI_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=openai` |
| **`CLAUDE_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=claude` |
| **`OPENROUTER_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=openrouter` |
| **`DEEPSEEK_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=deepseek` |
| **`GROQ_API_KEY`** | Conditional | - | API key required if `AI_PROVIDER=groq` |
| **`OLLAMA_BASE_URL`** | No | `http://localhost:11434` | Endpoint for local model serving |
| **`GOOGLE_CLIENT_EMAIL`** | No* | `accounting-worker@your-project-id.iam.gserviceaccount.com` | Google Service Account email. If left at this default or placeholder value, the drive service is bypassed and local file mode is active |
| **`GOOGLE_PRIVATE_KEY`** | No* | `MIIEvgIBADANBgkqhkiG9w0` | Raw Private Key PEM string (escaped `\n`). If left at this default, local file mode is active |
| **`GOOGLE_DRIVE_FOLDER_ID`** | No* | `your_google_drive_folder_id_here` | Target Google Drive Folder ID. If left at this default, local file mode is active |
| **`TELEGRAM_BOT_TOKEN`** | No | `1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ` | Telegram Bot API Token. If left at this default or omitted, Telegram features are bypassed |
| **`TELEGRAM_CHAT_ID`** | No | `-1001234567890` | Comma-separated list of authorized Chat IDs. If left at this default or omitted, Telegram features are bypassed |
| **`TELEGRAM_TIMEZONES`** | No | `Asia/Kolkata,Asia/Hong_Kong` | Comma-separated list of IANA timezones to format times in Telegram messages |
| **`CRON_SCHEDULE`** | No | `0 0 * * *` | Cron task schedule (defaults to daily at midnight: `0 0 * * *`) |
| **`UPLOAD_PASSWORD`** | Yes | - | Passcode used to authorize spreadsheet ingestion uploads |
| **`APP_PASSWORD`** | Yes | - | Passcode used to unlock the fullscreen App Lock screen |
| **`JWT_SECRET`** | No | `development_jwt_secret_fallback_key_12345` | Signing secret key used to generate and verify JWT admin session tokens |
| **`ENABLE_FILE_LOGGING`** | No | `false` | Enable/disable appending structured logs to `data/output/system.log` |
| **`ALLOWED_ORIGINS`** | No | - | Comma-separated list of allowed CORS domains (e.g. `https://your-domain.vercel.app`) |
| **`BUSINESS_NAME`** | No | `Hotel Gaurav` | Display name of the business injected into AI prompting contexts and Telegram messages |


> *Google Drive credentials are optional — omit them (or leave placeholders) to run in **local file mode** where the service reads spreadsheets from `data/input/` instead of Drive.

---

## 🔐 System Security & Access Controls

To protect administrative functions and financial metrics, the application implements a robust, database-backed security layer:

* **Fullscreen App Lock Screen**: A fullscreen glassmorphic lock screen prevents unauthorized dashboard view access. It dynamically validates session health with the backend using secure, **bank-grade HttpOnly cookies** (`app_session_token`) completely invisible to client-side scripts (immune to XSS session-theft).
* **Double Storage Session Parity**: If the user checks **"Remember this device"** on the passcode challenge, the backend sets the HttpOnly cookie with an explicit `maxAge` of **7 days** (`604800` seconds). If unchecked, it behaves as a standard browser session-lifetime cookie (erased immediately on tab/window close).
* **Upload Passcode Layer**: File uploads via the Web UI require validation of a dedicated upload passcode. This uses a highly secure, scoped, short-lived in-memory token within the `UploadModal` state, completely bypassing local storage and remaining immune to XSS and CSRF attack vectors.
* **Database-Backed Credential Sync**: Security passcodes are stored securely in PostgreSQL (Neon) under the `financial_reports` table (`report_type = 'security-config'`) using high-strength **argon2 password hashing**. They initialize automatically from `.env` values on first boot and can be updated at runtime.
* **Redesigned Tabbed Settings Modal**: A sidebar control allows administrators to change credentials dynamically. It features a tabbed interface splitting **App Lock Passcode** and **Upload Passcode** updates, including eye icon visibility toggles and strict validation matching fields before sending requests.

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

## 🚀 Cloud Deployment Guide

The backend features a built-in health check HTTP server that binds automatically to the environment's `$PORT`. This prevents container termination during health validations on cloud platforms.

### A. Backend → Render Deployment

Render is the recommended platform for the Node.js background worker.

1. **Deploy Service**: Go to the Render Dashboard, click **New +**, and select **Web Service**.
2. **Connect Repo**: Link your GitHub repository.
3. **Configure Settings**:
   - **Environment**: Select `Docker` (uses the root `Dockerfile`).
   - **Branch**: Specify your branch (e.g. `main`).
   - **Health Check Path**: `/health`
4. **Environment Variables**: Add your backend `.env` values under **Environment**:

   | Variable | Notes |
   | :--- | :--- |
   | `NODE_ENV` | Set to `production` |
   | `DATABASE_URL` | Your Neon PostgreSQL connection string |
   | `AI_PROVIDER` | e.g. `groq` or `gemini` |
   | `AI_MODEL` | e.g. `gemini-1.5-flash` |
   | `GEMINI_API_KEY` / `GROQ_API_KEY` | Whichever matches your `AI_PROVIDER` |
   | `GOOGLE_CLIENT_EMAIL` | Service account email for Drive sync |
   | `GOOGLE_PRIVATE_KEY` | Full PEM key with `\n` escaped (paste exactly from JSON file) |
   | `GOOGLE_DRIVE_FOLDER_ID` | Target Drive folder containing ledgers |
   | `TELEGRAM_BOT_TOKEN` | From @BotFather — single token for the whole bot |
   | `TELEGRAM_CHAT_ID` | Comma-separated Chat IDs of authorized users (e.g. `987654321,112233445`) |
   | `CRON_SCHEDULE` | e.g. `30 17 * * *` for daily at 11 PM IST |
   | `PORT` | `8080` (Render maps this automatically) |

5. **Launch**: Click **Deploy Web Service**. Render builds the Docker image, routes `/health` for uptime checks, and starts the cron scheduler!

> [!NOTE]
> After the first deploy, copy your Render service URL (e.g. `https://your-api.onrender.com`). You will need it as the `VITE_API_BASE_URL` for the Vercel frontend.

---

### B. Frontend → Vercel Deployment

The `web/` React dashboard deploys to Vercel as a static site.

1. Go to [vercel.com](https://vercel.com), click **Add New Project**, and import your repository.
2. Set the **Root Directory** to `web`.
3. Add the following **Environment Variable**:

   | Variable | Value |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | Your Render backend URL (e.g. `https://your-api.onrender.com`) |

4. Vercel auto-detects Vite and runs `npm run build`. Click **Deploy**.

> [!IMPORTANT]
> `VITE_API_BASE_URL` is baked into the static bundle at build time by Vite. If your backend URL changes, you must trigger a re-deploy on Vercel.

---

### C. Railway Deployment (Alternative)

1. **Create Project**: Click **New Project** on Railway Dashboard and choose **Github Repository**.
2. **Configure Variables**: Navigate to the **Variables** tab and add the same backend env vars listed in the Render section above.
3. **Deployment**: Railway reads the root `Dockerfile`, builds the multi-stage package, binds health checks to `PORT`, and starts the scheduler automatically!

---

## 🔮 Future Scalability Path

The architecture is built from the ground up to support future business scale:
* **Multi-Format Excel Parsing**: The `excel.mapper.ts` synonymous header map can be expanded or mapped dynamically to specific database profiles if you ingest ledgers from multiple vendors.
* **Persistent History**: While designed to be stateless, you can easily plug in an ORM (like Prisma) in `orchestrator.service.ts` to log transaction histories and alerts before generating summaries.
* **Multi-Channel Dispatch**: Expand the notification layer beyond Telegram to support alternative channels, such as WhatsApp API alerts, SMS notifications, Slack webhooks, or automated HTML email digests.
