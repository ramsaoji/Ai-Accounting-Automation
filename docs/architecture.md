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
        ├── Isolated Folder-wise HTML SaaS Dashboards
        └── Rate-Throttled Telegram Bulletins Queue
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

### 6. Throttled Messaging Dispatch (`src/telegram/`)
* **Role:** Secure alert notification delivery.
* **Technique:** Throttling client queues.
* **Rationale:** To comply with Telegram API's rate limits (maximum 30 messages/second), a throttled queue buffers notifications and distributes them across safe delivery intervals.

---

## 🔑 Stateless Executions & Concurrency

The background worker stores no local persistent state between runs. When a workbook is scanned, it downloads the buffer, extracts columns, runs local mathematical audits, queries the LLM, writes HTML dashboards inside `data/output/<workbook_name>/`, and signs off. 

This pure stateless quality allows deploying the background worker safely as multiple concurrent replica containers behind load balancers without transaction locks or session state synchronization issues.
