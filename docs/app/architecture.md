# 🏛️ AI Accounting Automation Service — Architecture Guide

This guide provides an in-depth breakdown of the structural blueprint, design patterns, and processing flows implemented in the service.

---

## 🧭 Unidirectional ETL Pipeline Design

The system implements a **stateless, pipe-and-filter ETL (Extract, Transform, Load) architectural pattern**, ensuring strict separation of concerns and predictable database-driven operations.

```
[EXTRACT] Google Drive Ingestion or Web UI Manual Upload
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
[LOAD] Relational Database Persistence (Neon / PostgreSQL)
        ├── Normalized tables: files, transactions, party_balances
        ├── Exception tracking: audit_alerts, parsing_errors
        └── Telegram Bot Notifications & Dispatch Queue
```

---

## 🛠️ Deep Dive: Core System Layers

### 1. The Configuration & Boot Boundary (`src/config/config.ts`)
* **Role:** Environmental Validation & Boot Guard.
* **Technique:** Strongly-typed schema checking via **Zod**.
* **Rationale:** Verifies all variables (credentials, API endpoints, scheduler schedules) during startup. The application will immediately crash with structured, informative error logs if invalid variables are passed, protecting against runtime failures.

### 2. Ingestion & Search Client (`src/drive/`)
* **Role:** Cloud-based file retrieval.
* **Technique:** Google Drive API wrapper with dynamic JWT Authentication.
* **Rationale:** The system scans for targeted spreadsheet files in your cloud storage. If credentials are not configured, cloud syncing is skipped, and the server expects manual HTTP uploads via the frontend interface.

### 3. Modular Parsing Facade (`src/excel/`)
* **Role:** Type-safe row-by-row data extraction.
* **Pattern:** **Facade Design Pattern**.
* **Decoupled Engine:**
  * `excel.parser.ts`: Lightweight interface selector. Performs sheet signature detections (tab names and column layouts checks) and dynamically routes execution to specialized sub-parsers.
  * `parsers/sales.parser.ts`: Tailored sales register parser.
  * `parsers/debitors.parser.ts`: Tailored customer outstanding balance parser.
  * `excel.mapper.ts`: Synonym header translator. Resolves variants (e.g. `Amount` vs `Invoiced Amount`) dynamically.
* **Safety Patch:** Implements an in-memory monkey patch to safely intercept ExcelJS name validation bugs regarding Microsoft Excel protected tab names (e.g. `History`).

### 4. Strategy Rules Auditing (`src/rules/`)
* **Role:** Business logic and anomaly validation.
* **Pattern:** **Strategy Design Pattern**.
* **Rationale:** Every rule class (e.g. `DuplicateInvoiceRule`, `SuspiciousSpikeRule`) implements a standard `Rule` interface. The `RulesEngine` evaluates them dynamically. Developers can construct and register a new rule class in minutes without rewriting the parser or the core orchestrator.

### 5. Swappable AI Engine Factory (`src/ai/`)
* **Role:** Financial trends forecasting and recovery task-list compiling.
* **Patterns:** **Factory Method** & **Adapter Design Patterns**.
* **Decoupled Runtimes:**
  * Adapters for **Groq**, **Gemini**, **OpenAI**, **Claude**, and **none** (disabled) runtimes inherit from a unified `AIProvider` contract.
  * Prompt templates encapsulate structured business variables inside dynamic strings, feeding them to active adapter connections.

### 6. Throttled Messaging Dispatch & Polling Bot (`src/telegram/`)
* **Role:** Secure alert notification delivery and interactive query handling.
* **Technique:** Throttling client queues and long polling.
* **Rationale:** To comply with Telegram API's rate limits (maximum 30 messages/second), a throttled queue in `telegram.client.ts` buffers notifications and distributes them across safe delivery intervals. In addition, `telegram.bot.ts` runs a persistent background long-polling loop to respond to interactive user queries (e.g., fetching summaries, triggering a sync, or asking natural language questions to the AI advisor).

### 7. PostgreSQL Neon DB Layer (`src/db/db.client.ts`)
* **Role:** Relational persistence for processed compliance summaries.
* **Technique:** Connection pool management via **pg** library with strict SSL requirements.
* **Schema:** Relational schema containing tables like `files`, `transactions`, `party_balances`, `audit_alerts`, `parsing_errors`, and `security_config` to store argon2-hashed app lock passwords.
* **Rationalization:** Decouples the frontend dashboard queries from direct disk access. The database layer automatically stores ingested rows and calculated metadata, supporting high-speed JSON queries, secure credential storage, and scaling.

### 8. Fastify HTTP Router and Controllers (`src/api/`)
* **Role:** Expose JSON query endpoints and spreadsheet uploader channels.
* **Technique:** Fastify server configuration with schema validation hooks and cookie support plugin.
* **Routing Strategy:** 
  * Public routes verify overall system health (`/health`), check unlock credentials (`/api/v1/security/verify-app`), check session cookie status (`/api/v1/security/status`), and clear active cookies (`/api/v1/security/logout`).
  * Authorized workspace routes are nested within Fastify pre-handler plugin validations (`fastify.auth.ts`) which intercept and verify secure **HttpOnly cookies** (`app_session_token`), falling back to Bearer tokens in headers for Telegram Bot compatibility.
  * Specialized controllers (`chat.controller.ts`, `report.controller.ts`, `security.controller.ts`) handle processing requests, parsing uploader payloads, and fetching/saving database state.

### 9. Decoupled Worker Thread Ingestion Engine (`src/services/` & `worker_threads`)
* **Role:** Unblock the HTTP event loop during heavy parsing and audits.
* **Technique:** Spawns a dedicated, parallel Node.js `Worker` thread targeting `orchestrator.service.ts` to process ingestion, rules checks, and AI forecasts in an isolated V8 thread.
* **Rationale:** Keeps the Fastify API server 100% responsive during Excel parses or long-lived AI network queries.

### 10. Background Cron Job Scheduler (`src/scheduler/`)
* **Role:** Auto-sync coordinator.
* **Technique:** `node-cron` daemon wrapper (`scheduler.job.ts`).
* **Rationale:** Initiates the background worker thread pipeline automatically on a scheduled interval defined by `CRON_SCHEDULE` (default: daily at midnight).

---

## 🔑 Database Schema Layout

The relational schema strictly maps parsed ledger transactions and outstanding balances to normalize data rows:

1. **`files`**: Ingestion runs tracking workbook metadata, AI summaries, and execution statuses.
2. **`transactions`**: Unified sales counter registers, payroll entries, and operational payment logs.
3. **`party_balances`**: Outstanding balance records for debtors (Udhari) and creditors/suppliers.
4. **`audit_alerts`**: Rules engine exceptions and warning records.
5. **`parsing_errors`**: Structural anomalies and validation failures flagged during parsing.
6. **`security_config`**: Password Argon2 hashes (app and upload tokens).
7. **`syncMetadata`**: Google Drive file tracking logs (modification times and filenames).
