# AI Accounting Automation Service 📊💼

A production-ready, database-backed financial audit orchestrator and background worker built with **Node.js**, **TypeScript**, and **Drizzle ORM**. This service automatically syncs with Google Drive or accepts manual uploads of Excel financial ledgers via the Web UI, parses and aggregates transaction records, runs an extensible anomaly-detection rules engine, generates high-quality executive summaries using **swappable AI LLM Providers**, persists everything relationally to a PostgreSQL database, and dispatches real-time executive briefs to Telegram!

---

## 🛠️ System Architecture

The service executes an automated ETL, Auditing, and database persistence pipeline:

```
          Google Drive Sync or Web UI Manual Upload
                             │
                             ▼
             [drive.service.ts] (JWT Auth)
                             │
                             ▼
         [excel.parser.ts] (Consolidates sheets)
                             │
                             ▼
        [rules.engine.ts] (Flags exceptions & spikes)
                             │
                             ▼
         [ai.service.ts] (Gemini/Groq/OpenAI Factory)
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
          [schema.transactions]  [schema.auditAlerts]
          (Relational Tables)    (Relational Tables)
                  └──────────┬──────────┘
                             ▼
               [telegram.service.ts] (Briefs)
```

---

## 📁 Project Directory Structure

```
ai-accounting-automation/
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── chat.controller.ts     # LLM advisor chat context loader
│   │   │   ├── health.controller.ts   # Minimal health check status endpoint
│   │   │   ├── report.controller.ts   # Database report getters and uploader
│   │   │   ├── security.controller.ts # Passcode verification and sessions manager
│   │   │   └── settings.controller.ts # Database setting toggle manager
│   │   ├── middleware/
│   │   │   └── validate.ts           # Reusable Zod request body/query/params validation hooks
│   │   ├── errors.ts                  # Standardized API error responses and envelopes
│   │   ├── fastify.app.ts        # Fastify app builder with CORS & Cookie plugin config
│   │   └── fastify.auth.ts       # Authentication hook checking HttpOnly cookies
│   ├── config/
│   │   └── config.ts             # Strongly-typed config loader & Zod validator
│   ├── db/
│   │   ├── db.client.ts          # Neon DB Pool client with table/security initialization
│   │   └── schema.ts             # Relational database tables (Drizzle ORM)
│   ├── drive/
│   │   ├── drive.client.ts       # Authorized Google Drive Client (JWT auth)
│   │   └── drive.service.ts      # Excel spreadsheet searcher and downloader
│   ├── excel/
│   │   ├── excel.mapper.ts       # Dynamic column finder & row converter
│   │   ├── excel.parser.ts       # Main parser selector facade
│   │   └── parsers/
│   │       ├── sales.parser.ts    # Daily sales register parser
│   │       └── debitors.parser.ts # Customer outstanding udhari parser
│   ├── rules/
│   │   ├── rules.types.ts        # Modular Rules Engine interfaces
│   │   ├── rules.engine.ts       # Concrete Rule implementations (Spikes, Duplicates)
│   │   └── definitions/          # Individual modular audit rules
│   │       ├── cross-workbook.rule.ts
│   │       ├── duplicate-date.rule.ts
│   │       ├── duplicate-invoice.rule.ts
│   │       ├── high-expense.rule.ts
│   │       ├── negative-or-zero.rule.ts
│   │       ├── off-hours-transaction.rule.ts
│   │       └── suspicious-spike.rule.ts
│   ├── ai/
│   │   ├── providers/
│   │   │   ├── openai.provider.ts # OpenAI, DeepSeek, & OpenRouter client
│   │   │   ├── gemini.provider.ts # Google Gemini REST client
│   │   │   └── claude.provider.ts # Anthropic Claude REST client
│   │   ├── ai.types.ts           # Swappable AI provider contract
│   │   ├── ai.factory.ts         # Env-driven runtime provider factory
│   │   ├── ai.prompts.ts         # Shared AI prompt input type definitions
│   │   ├── ai.calculator.ts      # Specialized stats calculator for sales & debitors
│   │   ├── ai.parser.ts          # AI response parser and text format cleaner
│   │   ├── report-helper.ts      # Visual charts coordinate math & HTML trend row builders
│   │   ├── report-template.ts    # Daily Sales Register HTML console UI shell
│   │   ├── debitors-template.ts  # Customer outstanding Udhari HTML console UI shell
│   │   └── ai.service.ts         # Central orchestrator for LLM prompt connections
│   ├── telegram/
│   │   ├── telegram.bot.ts       # Telegram long polling bot interactive listener
│   │   ├── telegram.client.ts    # Telegram client with markdown recovery safety
│   │   └── telegram.service.ts   # Chunking and interval delivery manager
│   ├── scheduler/
│   │   └── scheduler.job.ts      # Cron job coordinator with overlapping guard
│   ├── services/
│   │   └── orchestrator.service.ts # Decoupled pipeline coordinator with parallel worker thread
│   ├── types/
│   │   ├── accounting.types.ts   # Core types routing hub
│   │   ├── sales.types.ts        # Daily sales validation schemas
│   │   └── debitors.types.ts     # Customer udhari structures
│   ├── logger/
│   │   └── logger.ts             # Pino logger configurations
│   ├── scripts/
│   │   └── reset-drizzle.ts      # Developer tool: wipes database schemas and reapplies migrations
│   ├── utils/
│   │   ├── cron.ts               # Cron expression humanization utility
│   │   ├── file.ts               # Local file resolution helpers
│   │   └── accounting.ts         # In-memory daily sales aggregation utilities
│   └── index.ts                  # App entrypoint (initializes DB, scheduler, Telegram bot, and Fastify server)
│── Dockerfile                    # Multi-stage, low footprint production container
├── .dockerignore                 # Container build context filtering rules
├── .env.example                  # Template listing all environmental configs
├── tsconfig.json                 # Type-check configurations
└── package.json                  # Scripts and package manifests
```

---

## ⚡ Quickstart

### 1. Ingestion Setup & Installation
Clone the workspace files and install dependencies:
```bash
npm install
```

### 2. Configure Credentials
Duplicate `.env.example` to a new `.env` file in the project root:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` is set to your PostgreSQL database.

### 3. Run the Development Server
Launch the Fastify server, cron scheduler, and Telegram listener locally:
```bash
npm run dev
```

### 4. Database Schema Reset (Optional)
To clear database tables and reapply clean schema migrations:
```bash
npm run reset-drizzle
```

---

## 🔐 Environment Configuration Parameters

Define the following environment variables in your `.env` configuration file:

| Variable Name | Required | Default Value | Description |
| :--- | :--- | :--- | :--- |
| **`NODE_ENV`** | No | `development` | Runtime mode (`development` enables verbose debug logs, `production` enables clean info logs) |
| **`PORT`** | No | `8080` | Bind port for cloud environment container health checks |
| **`DATABASE_URL`** | **Yes** | - | PostgreSQL connection string. A running database is strictly required for application startup |
| **`DEFAULT_AI_PROVIDER`** | No | `none` | Fallback AI provider used once during first-time database seeding: `openai`, `gemini`, `claude`, `openrouter`, `deepseek`, `groq`, `none`. If set to `none`, AI is disabled |
| **`DEFAULT_AI_MODEL`** | No | - | Fallback AI model ID used once during database seeding (e.g. `gpt-4o-mini`, `gemini-2.5-flash`, etc.). If omitted, falls back to standard provider defaults |
| **`GEMINI_API_KEY`** | Conditional | - | API key required if active provider is `gemini` |
| **`OPENAI_API_KEY`** | Conditional | - | API key required if active provider is `openai` |
| **`CLAUDE_API_KEY`** | Conditional | - | API key required if active provider is `claude` |
| **`OPENROUTER_API_KEY`** | Conditional | - | API key required if active provider is `openrouter` |
| **`DEEPSEEK_API_KEY`** | Conditional | - | API key required if active provider is `deepseek` |
| **`GROQ_API_KEY`** | Conditional | - | API key required if active provider is `groq` |
| **`GOOGLE_CLIENT_EMAIL`** | No | `accounting-worker@your-project-id.iam.gserviceaccount.com` | Google Service Account email for Drive Sync. If left at mock defaults, cloud syncing is skipped |
| **`GOOGLE_PRIVATE_KEY`** | No | `MIIEvgIBADANBgkqhkiG9w0` | Service Account Private Key PEM string. If left at defaults, cloud syncing is skipped |
| **`GOOGLE_DRIVE_FOLDER_ID`** | No | `your_google_drive_folder_id_here` | Target Google Drive Folder ID containing your excel sheets |
| **`TELEGRAM_BOT_TOKEN`** | No | `1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ` | Telegram Bot API Token. If left at this default or omitted, Telegram features are bypassed |
| **`TELEGRAM_CHAT_ID`** | No | `-1001234567890` | Comma-separated list of authorized Chat IDs. If left at this default or omitted, Telegram features are bypassed |
| **`TELEGRAM_TIMEZONES`** | No | `Asia/Kolkata,Asia/Hong_Kong` | Comma-separated list of IANA timezones to format times in Telegram messages |
| **`CRON_SCHEDULE`** | No | `0 0 * * *` | Cron task schedule (defaults to daily at midnight) |
| **`DEFAULT_UPLOAD_PASSWORD`** | **Yes** | - | Fallback passcode used to authorize spreadsheet ingestion uploads during first-time database seeding |
| **`DEFAULT_APP_PASSWORD`** | **Yes** | - | Fallback passcode used to secure the fullscreen App Lock screen during first-time database seeding |
| **`DEFAULT_WEB_CHAT_ENABLED`** | No | `true` | Enable/disable AI strategic advisor chat in the Web UI on initial seeding |
| **`DEFAULT_TELEGRAM_CHAT_ENABLED`** | No | `true` | Enable/disable AI chat responses in the Telegram Bot on initial seeding |
| **`JWT_SECRET`** | No | `development_jwt_secret_fallback_key_12345` | Signing secret key used to generate and verify JWT admin session tokens |
| **`ENABLE_FILE_LOGGING`** | No | `false` | Enable/disable appending structured logs to `logs/system.log` |
| **`ALLOWED_ORIGINS`** | No | - | Comma-separated list of allowed CORS domains (e.g. `http://localhost:5173`) |
| **`BUSINESS_NAME`** | No | `Hotel Gaurav` | Display name of the business injected into AI prompting contexts and Telegram messages |

---

## 🔐 System Security & Access Controls

To protect administrative functions and financial metrics, the application implements a robust, database-backed security layer:

* **Fullscreen App Lock Screen**: A fullscreen glassmorphic lock screen prevents unauthorized dashboard view access. It dynamically validates session health with the backend using secure, **bank-grade HttpOnly cookies** (`app_session_token`) completely invisible to client-side scripts.
* **Double Storage Session Parity**: If the user checks **"Remember this device"** on the passcode challenge, the backend sets the HttpOnly cookie with an explicit `maxAge` of **7 days** (`604800` seconds). If unchecked, it behaves as a standard browser session-lifetime cookie (erased immediately on tab/window close).
* **Upload Passcode Layer**: File uploads via the Web UI require validation of a dedicated upload passcode. This uses a secure, scoped, short-lived in-memory token within the upload state, completely bypassing local storage and remaining immune to XSS and CSRF attack vectors.
* **Database-Backed Credential Sync**: Security passcodes are stored securely in PostgreSQL under the `security_config` table using high-strength **argon2 password hashing**. They initialize automatically from `.env` values on first boot and can be updated at runtime.
* **Tabbed Settings Modal**: A settings modal allows administrators to change credentials dynamically. It features a tabbed interface splitting **App Lock Passcode** and **Upload Passcode** updates.

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

The backend features a built-in health check HTTP server that binds automatically to the environment's `$PORT`.

### A. Backend → Render Deployment

Render is the recommended platform for the Node.js background worker.

1. **Deploy Service**: Go to the Render Dashboard, click **New +**, and select **Web Service**.
2. **Connect Repo**: Link your GitHub repository.
3. **Configure Settings**:
   - **Environment**: Select `Docker` (uses the root `Dockerfile`).
   - **Branch**: Specify your branch (e.g. `main`).
   - **Health Check Path**: `/health`
4. **Environment Variables**: Add your backend `.env` values under **Environment**.

### B. Frontend → Vercel Deployment

The `web/` React dashboard deploys to Vercel as a static site.

1. Go to [vercel.com](https://vercel.com), click **Add New Project**, and import your repository.
2. Set the **Root Directory** to `web`.
3. Add the following **Environment Variable**: `VITE_API_BASE_URL` pointing to your Render backend URL.
4. Vercel auto-detects Vite and runs `npm run build`. Click **Deploy**.
