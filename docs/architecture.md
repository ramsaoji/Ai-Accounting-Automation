# 🏛️ AI Accounting Automation Service — Architecture Guide

This guide provides an in-depth breakdown of the structural blueprint, design patterns, and processing flows implemented in the service.

---

## 🧭 Unidirectional ETL Pipeline Design

The system implements a **stateless, pipe-and-filter ETL (Extract, Transform, Load) architectural pattern**, ensuring strict separation of concerns and predictable, stateless operations.

```
[EXTRACT] Drive / Local File Ingestion
    │
    ▼
[TRANSFORM] Facade Parser Engine (excel.parser.ts)
    │   ├── Specialized Sales Register Sub-Parser
    │   └── Specialized Outstanding Debitors Sub-Parser
    │
    ▼
[AUDIT] Business Rules Engine (rules.engine.ts)
    │   └── Concrete Validation Strategy Classes
    │
    ▼
[SYNTHESIZE] AI Strategic Forecast Engine (ai.service.ts)
    │   └── Swappable LLM Provider Factory Method
    │
    ▼
[LOAD] Resilient Outputs Dispatch
        ├── Isolated Folder-wise HTML Dashboards
        └── Interactive Telegram Bot & Rate-Throttled Queue
```

---

## 🛠️ Deep Dive: Core System Layers

### 1. The Configuration & Boot Boundary (`src/config/config.ts`)
* **Role:** Environmental Validation & Boot Guard.
* **Technique:** Strongly-typed schema checking via **Zod**.
* **Rationale:** Verifies all variables (credentials, API endpoints, scheduler schedules) during startup. The application will immediately crash with structured, informative error logs if invalid variables are passed, protecting against runtime failures.

### 2. Ingestion & Search Client (`src/drive/` & Local FS)
* **Role:** Dynamic file retrieval.
* **Technique:** Google Drive API wrapper with dynamic JWT Authentication fallback.
* **Rationale:** The system scans for targeted spreadsheet files in your cloud storage. If client secrets are left at mock defaults, it cleanly falls back to local batch directory scanning inside `data/input/`, maintaining execution safety.

### 3. Modular Parsing Facade (`src/excel/`)
* **Role:** Type-safe row-by-row data extraction.
* **Pattern:** **Facade Design Pattern**.
* **Decoupled Engine:**
  * `excel.parser.ts`: Lightweight interface selector. Performs sheet signature detections (tab names and column layouts checks) and dynamically routes execution to specialized sub-parsers.
  * `parsers/sales.parser.ts`: Tailored multi-month sales register parser.
  * `parsers/debitors.parser.ts`: Tailored customer outstanding balance parser.
  * `excel.mapper.ts`: Synonym header translator. Resolves variants (e.g. `Amount` vs `Invoiced Amount`) dynamically.
  * `portal.builder.ts`: Rebuilds the Master Dashboard Landing Hub (`data/output/index.html`) by scanning the output folder for audited ledger summaries (`summary.json`) and generating clean overview cards with live status links.
* **Safety Patch:** Implements an in-memory monkey patch to safely intercept ExcelJS name validation bugs regarding Microsoft Excel protected tab names (e.g. `History`).

### 4. Strategy Rules Auditing (`src/rules/`)
* **Role:** Business logic and anomaly validation.
* **Pattern:** **Strategy Design Pattern**.
* **Rationale:** Every rule class (e.g. `DuplicateInvoiceRule`, `SuspiciousSpikeRule`) implements a standard `Rule` interface. The `RulesEngine` aggregates and evaluates these dynamically. Developers can construct and register a new rule class in minutes without rewriting the parser or the core orchestrator.

### 5. Swappable AI Engine Factory (`src/ai/`)
* **Role:** Financial trends forecasting and recovery task-list compiling.
* **Patterns:** **Factory Method** & **Adapter Design Patterns**.
* **Decoupled Providers:**
  * Adapters for **Groq**, **Gemini**, **OpenAI**, **Claude**, and local **Ollama** runtimes inherit from a unified `AIProvider` contract.
  * Prompt templates encapsulate structured business variables inside dynamic strings, feeding them to active adapter connections.
  * **Visual & Calculation Helpers:** 
    * `report-helper.ts`: Decoupled utility module that performs SVG chart coordinate math, maps tabular transaction trends, and formats operational compliance anomalies.
    * `report-template.ts` & `debitors-template.ts`: Elegant HTML/CSS shells compiling the Master Dashboard and outstanding debtors command interfaces using modern glassmorphic grids.

### 6. Throttled Messaging Dispatch & Polling Bot (`src/telegram/`)
* **Role:** Secure alert notification delivery and interactive query handling.
* **Technique:** Throttling client queues and long polling.
* **Rationale:** To comply with Telegram API's rate limits (maximum 30 messages/second), a throttled queue in `telegram.client.ts` buffers notifications and distributes them across safe delivery intervals. In addition, `telegram.bot.ts` runs a persistent background long-polling loop to respond to interactive user queries (e.g., fetching summaries, triggering a sync, or asking natural language questions to the AI advisor).

### 7. PostgreSQL Neon DB Layer (`src/db/db.client.ts`)
* **Role:** Relational persistence for processed compliance summaries.
* **Technique:** Connection pool management via **pg** library with strict SSL requirements.
* **Schema:** Creates and updates the `financial_reports` table dynamically:
  ```sql
  CREATE TABLE IF NOT EXISTS financial_reports (
    report_type VARCHAR(50) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```
* **Rationalization:** Decouples the frontend dashboard queries from direct disk access. The database layer automatically upserts report payloads (`sales`, `debitors`, daily aggregates, and `argon2` hashed `security-config` credentials) upon ingestion, supporting high-speed JSON queries, secure credential storage, and scaling.

### 8. Fastify HTTP Router and Controllers (`src/api/`)
* **Role:** Expose JSON query endpoints and spreadsheet uploader channels.
* **Technique:** Fastify server configuration with schema validation hooks and cookie support plugin.
* **Routing Strategy:** 
  * Public routes verify overall system health (`/health`), check unlock credentials (`/api/security/verify-app`), check session cookie status (`/api/security/status`), and clear active cookies (`/api/security/logout`).
  * Authorized workspace routes are nested within Fastify pre-handler plugin validations (`fastify.auth.ts`) which intercept and verify secure **HttpOnly cookies** (`app_session_token`), falling back to Bearer tokens in headers for Telegram Bot compatibility.
  * Specialized controllers (`chat.controller.ts`, `report.controller.ts`, `security.controller.ts`) handle processing requests, parsing uploader payloads, and fetching/saving database state.

### 9. Decoupled Worker Thread Ingestion Engine (`src/services/` & `worker_threads`)
* **Role:** Unblock the HTTP event loop during heavy parsing and audits.
* **Technique:** Spawns a dedicated, parallel Node.js `Worker` thread targeting `orchestrator.service.ts` to process ingestion, rules checks, and AI forecasts in an isolated V8 thread.
* **Rationale:** Keeps the Fastify API server 100% responsive during multi-month Excel parses or long-lived AI network queries.

### 10. Background Cron Job Scheduler (`src/scheduler/`)
* **Role:** Auto-sync coordinator.
* **Technique:** `node-cron` daemon wrapper (`scheduler.job.ts`).
* **Rationale:** Initiates the background worker thread pipeline automatically on a scheduled interval defined by `CRON_SCHEDULE` (default: daily at midnight).

### 11. General System Utilities (`src/utils/`)
* **Role:** Shareable formatting and parse helpers.
* **Technique:** `cron.ts` conversion methods.
* **Rationale:** Converts standard 5-field cron configurations to human-friendly strings for dashboard UI display and startup diagnostics reports.

---

## 🔑 Stateless Executions & Persistence

While the backend daemon operates on stateless ETL principles, it supports dual persistence:
1. **Relational Database**: If `DATABASE_URL` is set in the environment, summaries are written directly to PostgreSQL, allowing the dashboard UI to operate DB-first.
2. **Local File Mirroring**: It writes markdown summaries, HTML dashboards, and raw JSON logs inside the `data/output/<workbook_name>/` directory, serving as offline assets when database integration is bypassed.

This decoupled architecture allows you to scale the API server independently or run it as a pure serverless daemon.
