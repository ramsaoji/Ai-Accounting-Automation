# 🔍 AI Accounting Automation — Comprehensive Project Review Report

> **Review Date**: May 29, 2026  
> **Scope**: Full-stack end-to-end (Backend + Frontend + Infrastructure)  
> **Backend**: Node.js / TypeScript / Fastify / PostgreSQL (Neon) / Multi-provider AI  
> **Frontend**: React 19 / Vite / Tailwind v4 / ShadCN / Zustand / Recharts  
> **Integrations**: Google Drive, Telegram Bot, 7 AI Providers

---

## 1. Executive Summary

This is a **well-architected, production-deployed** AI-powered accounting automation platform tailored for a small hospitality business. It ingests Excel spreadsheets (from Google Drive or manual upload), applies rule-based auditing, generates AI-powered financial insights, and delivers them through a polished web dashboard and an interactive Telegram bot.

**Overall Grade: B+** — The project demonstrates strong domain-specific engineering with good separation of concerns, a clean module architecture, and thoughtful UX. However, it has significant gaps in **testing**, **database design**, **error recovery**, **scalability**, and **generalization** that will become blockers as the product matures.

### Quick Stats
| Metric | Value |
|---|---|
| Backend LOC (TypeScript) | ~3,800 (excl. templates) |
| Frontend LOC (TSX/TS) | ~5,200 |
| HTML Report Templates | ~56K (2 template files) |
| Backend Modules | 14 directories |
| Frontend Components | 12 custom + 17 ShadCN UI |
| AI Providers Supported | 7 (OpenAI, Gemini, Claude, DeepSeek, OpenRouter, Groq, Ollama) |
| Test Files | **0** ⚠️ |
| API Endpoints | 9 (2 public, 7 authenticated) |

---

## 2. Key Strengths

### ✅ Architecture & Design
- **Clean modular structure**: Backend is well-organized into `ai/`, `api/`, `config/`, `db/`, `drive/`, `excel/`, `rules/`, `scheduler/`, `services/`, `telegram/` — each with a focused responsibility.
- **Provider Factory pattern**: The [ai.factory.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/ai/ai.factory.ts) cleanly abstracts 7 AI providers behind a common `AiProvider` interface, making it trivial to swap models.
- **Zod-validated config**: The [config.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/config/config.ts) uses Zod schemas with production-aware refinements (e.g., JWT_SECRET validation in prod).
- **Dual-mode operation**: Graceful fallback from DB to local file system when `DATABASE_URL` is not set — excellent for dev/prod parity.

### ✅ Security
- **Argon2 password hashing** with DB-backed credential storage.
- **Custom JWT implementation** with timing-safe HMAC-SHA256 verification in [security.controller.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/api/controllers/security.controller.ts).
- **Two-tier authentication**: Separate app-lock and upload tokens with different TTLs (24h vs 1h).
- **Production JWT secret enforcement**: Config schema prevents default fallback secrets in production.

### ✅ Rules Engine
- [rules.engine.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/rules/rules.engine.ts): 7 modular business rules (duplicate invoices, high expenses, suspicious spikes, off-hours, zero amounts, duplicate dates, cross-workbook reconciliation) — well-engineered and extensible.

### ✅ Frontend UX
- Polished ShadCN-based dashboard with sidebar navigation, dark/light theme, workspace switching, and responsive design.
- Smart drive sync polling with edge-case handling (up-to-date detection, timeout fallback, empty-to-data transitions).
- Offline fallback AI advisor with hardcoded heuristic responses in [api.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/services/api.ts).
- Chat history persistence via `localStorage` with Zustand state management.

### ✅ Telegram Bot
- Full-featured interactive bot with inline keyboards, month-by-month navigation, AI query routing, rate-limit-aware error formatting, and multi-user authorization.

### ✅ Developer Experience
- Comprehensive `.env.example` with inline documentation.
- Multi-stage Dockerfile with non-root user.
- Workspace-based monorepo (`npm workspaces`).
- Detailed documentation in `docs/`.

---

## 3. Critical Issues

### 🔴 CRIT-01: Zero Test Coverage

**Impact: Very High** | **Risk: Very High**

There are **zero test files** in the entire project — no unit tests, no integration tests, no E2E tests. This is the single most critical gap.

**Files at highest risk without tests:**
- [rules.engine.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/rules/rules.engine.ts) — Business-critical audit logic
- [security.controller.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/api/controllers/security.controller.ts) — Custom JWT and password verification
- [excel.parser.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/excel/excel.parser.ts) — Data ingestion core
- [orchestrator.service.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/services/orchestrator.service.ts) — Pipeline coordination

**Recommendation:** Introduce Vitest for backend, React Testing Library + Vitest for frontend. Start with the rules engine and security controller.

---

### 🔴 CRIT-02: Single-Table Database Design

**Impact: High** | **Risk: High**

The entire application stores **all data** in a single `financial_reports` table with a `VARCHAR(50)` primary key and a `JSONB` blob:

```sql
CREATE TABLE IF NOT EXISTS financial_reports (
  report_type VARCHAR(50) PRIMARY KEY,  -- 'sales', 'debitors', 'daily-sales', 'sync-metadata', 'security-config'
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Problems:**
- **No data history**: Every upsert overwrites the previous report. There is no audit trail, no version history, no ability to compare reports over time.
- **No query capability**: All analysis happens in application code. You can't run SQL queries against financial data.
- **Schema conflicts**: Security credentials, sync metadata, and financial reports all share the same table with the same schema.
- **No transactions/ACID guarantees** for multi-report writes (sales + daily-sales written separately).

**Recommendation:** Introduce proper relational tables: `reports`, `report_versions`, `transactions`, `debitors`, `security_config`, `sync_metadata`.

---

### 🔴 CRIT-03: AI Service Is an 818-Line God Method

**Impact: High** | **Risk: Medium**

[ai.service.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/ai/ai.service.ts) is **818 lines** containing a single `generateFinancialSummary()` method with two massive branches (debitors vs. sales). This method:
- Computes all aggregate statistics
- Builds AI prompts
- Calls AI providers
- Parses AI responses with regex
- Generates Markdown reports
- Generates JSON summaries
- Manages fallback logic
- Delegates to HTML template functions

This violates SRP (Single Responsibility Principle) and makes the code extremely difficult to test, debug, or extend.

**Recommendation:** Extract into separate concerns:
1. `StatisticsCalculator` — pure math/aggregation
2. `PromptBuilder` — AI prompt construction
3. `AiResponseParser` — response parsing with regex
4. `ReportRenderer` — Markdown/JSON/HTML generation
5. `FallbackEngine` — offline insight generation

---

### 🔴 CRIT-04: Hardcoded Business Name Throughout

**Impact: Medium** | **Risk: Medium**

Despite having `BUSINESS_NAME` in config, "Hotel Gaurav" is hardcoded in **dozens of places**:
- [telegram.bot.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/telegram/telegram.bot.ts): `'Hotel Gaurav'` appears 15+ times
- [ai.service.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/ai/ai.service.ts): Markdown report headers
- [excel.parser.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/excel/excel.parser.ts): `row1Val.includes('hotel gaurav')`
- [business.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/utils/business.ts): Fallback default
- [useAccountingData.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/hooks/useAccountingData.ts): Static toast messages

This makes it impossible to use this system for any other business without a full codebase search-and-replace.

**Recommendation:** Replace all hardcoded strings with `config.BUSINESS_NAME`. Make the Excel parser detect business names dynamically from cell content rather than checking for a specific string.

---

### 🔴 CRIT-05: .env File Committed to Repository

**Impact: Critical** | **Risk: Critical**

The `.env` file (3,569 bytes) exists in the project root. While `.gitignore` lists `.env`, the file's presence suggests it may have been committed at some point and could contain real credentials in git history.

**Recommendation:** 
1. Run `git log --all --diff-filter=A -- .env` to check if it was ever committed.
2. If so, use `git filter-branch` or BFG Repo-Cleaner to purge it from history.
3. Rotate all secrets that may have been exposed.

---

### 🔴 CRIT-06: No Rate Limiting on Authentication Endpoints

**Impact: High** | **Risk: High**

The `/api/security/verify-app` and `/api/security/verify-upload` endpoints have **no rate limiting**. An attacker could brute-force passwords with unlimited attempts.

**Recommendation:** Add `@fastify/rate-limit` with aggressive limits (e.g., 5 attempts per minute per IP) on auth endpoints.

---

## 4. Improvement Opportunities

### 🟡 IMP-01: Startup Race Condition

In [index.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/index.ts), database initialization is fire-and-forget:

```typescript
initDb().then(async () => {
  await initSecurityConfig();
}).catch((dbErr) => { ... });

// Immediately starts scheduler and server without awaiting DB
schedulerJob.start();
```

The scheduler and Fastify server can start handling requests **before the database is ready**, leading to undefined behavior on the first request.

**Fix:** Await `initDb()` before starting the scheduler and server.

---

### 🟡 IMP-02: Duplicate `any` Usage / TypeScript Strictness

Despite `strict: true` in tsconfig, there are 20+ instances of `any` types across the codebase:
- [telegram.bot.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/telegram/telegram.bot.ts): 15+ `any` casts
- [rules.engine.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/rules/rules.engine.ts): `let summary: any = null`
- [health.controller.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/api/controllers/health.controller.ts): `request: any, reply: any`

**Recommendation:** Enable `noImplicitAny` and systematically replace `any` with proper typed interfaces.

---

### 🟡 IMP-03: Monolithic Frontend Components

Several frontend components are excessively large:
- [AuditorSection.tsx](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/components/AuditorSection.tsx): **34,842 bytes**
- [OverviewSection.tsx](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/components/OverviewSection.tsx): **34,612 bytes**
- [LedgerSection.tsx](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/components/LedgerSection.tsx): **29,884 bytes**
- [UploadModal.tsx](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/components/UploadModal.tsx): **20,001 bytes**
- [SecuritySettingsModal.tsx](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/components/SecuritySettingsModal.tsx): **19,964 bytes**

Each of these should be decomposed into smaller, focused sub-components (e.g., `StatCard`, `TrendChart`, `AlertList`, `FilterBar`).

---

### 🟡 IMP-04: No API Versioning

All routes are under `/api/` without versioning. When the API evolves, breaking changes will affect all clients.

**Recommendation:** Prefix with `/api/v1/` and document the API contract.

---

### 🟡 IMP-05: No Request Validation Middleware

Zod validation is done manually inside each controller handler. This is repetitive and error-prone.

**Recommendation:** Create a reusable Fastify preHandler that validates `request.body` against a Zod schema, reducing boilerplate in every controller.

---

### 🟡 IMP-06: Synchronous File I/O in Hot Paths

[orchestrator.service.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/services/orchestrator.service.ts) uses synchronous file operations (`fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync`, `fs.mkdirSync`) throughout the pipeline. In a server context, this blocks the event loop during file processing.

**Recommendation:** Replace all `fs.*Sync` calls with their async equivalents (`fs.promises.*`).

---

### 🟡 IMP-07: No Graceful Degradation for Missing AI Keys

If `AI_PROVIDER=gemini` but `GEMINI_API_KEY` is empty, the error only surfaces at runtime when an AI call is made. The config schema marks all API keys as `optional()`.

**Recommendation:** Add a runtime validation in `AiProviderFactory.createProvider()` that checks the required key for the configured provider at startup, not at first use.

---

### 🟡 IMP-08: Inconsistent Error Response Shapes

Some endpoints return `{ error: string }`, others return `{ status: string, message: string }`. There is no standardized error response envelope.

**Recommendation:** Define a consistent error schema: `{ error: string, code?: string, details?: unknown }` and use it everywhere.

---

### 🟡 IMP-09: Frontend Type Duplication

Types are defined independently in both:
- Backend: [accounting.types.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/types/accounting.types.ts), [sales.types.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/types/sales.types.ts)
- Frontend: [types.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/types.ts)

The Vite config has a `@backend-types` alias set up but it's **not used anywhere** in the frontend code. Types will drift over time.

**Recommendation:** Either share types via the alias or extract a shared `types` package in the monorepo workspace.

---

### 🟡 IMP-10: HTML Report Templates Are Unmaintainable

[report-template.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/ai/report-template.ts) (28,544 bytes) and [debitors-template.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/ai/debitors-template.ts) (28,023 bytes) are massive template literal strings with inline CSS, SVG, and JavaScript. These are impossible to maintain, test, or iterate on.

**Recommendation:** Move to a proper templating engine (Handlebars, EJS) or generate reports in the frontend using React PDF / HTML-to-PDF.

---

## 5. UX & Product Recommendations

### 🎯 UX-01: No Loading States for Individual Data Sections
The app shows a full-page loading spinner during initial sync. After that, switching between Overview/Ledger/Auditor/Advisor sections has no per-section loading indicators — data pops in instantly (because it's already in memory) but there's no visual feedback if a section needs to compute.

### 🎯 UX-02: No Data Export Capability
Users cannot export reports to PDF, CSV, or Excel from the web dashboard. This is a significant gap for an accounting tool — users frequently need to share reports with accountants, partners, or auditors.

### 🎯 UX-03: No Date Range Filtering
The dashboard shows all-time cumulative data. There's no ability to filter by date range, compare specific periods, or view year-over-year trends interactively.

### 🎯 UX-04: Chat History Is Not Cloud-Synced
Chat history persists in `localStorage`, which means it's lost when the user switches browsers or clears data. For an accounting advisory tool, conversation history is valuable business context.

### 🎯 UX-05: No Notification Center
There's no way for users to see a history of alerts, sync completions, or audit events over time. A notification center/activity log would add significant value.

### 🎯 UX-06: Lock Screen UX
The lock screen appears on every session reload since the token is stored in `sessionStorage` (lost on tab close). Consider offering "Remember this device" with a longer-lived encrypted cookie or `localStorage` option.

### 🎯 UX-07: Onboarding Empty State
The empty state is informative but doesn't guide the user through a step-by-step first-time setup (connect Drive, upload first file, explore dashboard). A wizard flow would dramatically improve activation.

---

## 6. New Feature Suggestions

### 💡 FEAT-01: Multi-Tenant / Multi-Business Support
Allow a single deployment to manage multiple businesses. Each business would have its own workbooks, reports, and AI context. This is the most impactful change for productization.

### 💡 FEAT-02: Historical Report Versioning & Comparison
Store each ingestion run as a versioned snapshot. Enable "Compare this month vs. last month" or "View changes since last sync" — critical for an accounting tool.

### 💡 FEAT-03: Custom Alert Rules Configuration UI
Allow users to configure alert thresholds (e.g., high expense threshold, credit cap limits) from the Auditor section instead of hardcoding `₹50,000` in the rules engine.

### 💡 FEAT-04: Scheduled Email Reports
Add email digest support (daily/weekly/monthly) with the same content that goes to Telegram. Many accountants and business owners prefer email.

### 💡 FEAT-05: WhatsApp Integration
Given the Indian small-business target market, WhatsApp Business API integration would dramatically increase engagement over Telegram.

### 💡 FEAT-06: Profit & Loss Statement Generator
Auto-generate formal P&L statements from ingested data in a standard accounting format (not just a dashboard view).

### 💡 FEAT-07: Smart Anomaly Detection with ML
Beyond rule-based alerts, use the historical data to train simple anomaly detection models (e.g., isolation forests on transaction amounts) to catch novel patterns.

### 💡 FEAT-08: Receipt/Invoice Photo OCR
Allow users to photograph receipts and invoices, OCR them with the AI provider, and auto-create transaction entries — reducing manual Excel entry.

### 💡 FEAT-09: Role-Based Access Control (RBAC)
Currently there's a single password for the entire app. Introduce roles (Owner, Accountant, Viewer) with different permission levels.

### 💡 FEAT-10: Dashboard Sharing via Public Links
Generate time-limited, read-only shareable links to specific reports — useful for sharing with accountants or partners without giving app access.

---

## 7. Scalability & Architecture Recommendations

### 🏗️ ARCH-01: Extract Pipeline into Background Worker
The orchestrator pipeline runs in-process on the same Node.js event loop as the HTTP server. A slow AI call or large Excel parse blocks the entire server.

**Recommendation:** Use a job queue (BullMQ with Redis, or pg-boss with PostgreSQL) to decouple pipeline execution from the API server.

### 🏗️ ARCH-02: Implement Proper Database Migrations
There's no migration system. Schema changes require manual SQL or code changes to `initDb()`. As the schema grows (per CRIT-02), this becomes unsustainable.

**Recommendation:** Introduce a migration tool like `node-pg-migrate`, `Knex`, or `Drizzle ORM`.

### 🏗️ ARCH-03: Add OpenAPI/Swagger Documentation
No API documentation exists beyond code comments. The API surface is small enough to auto-generate OpenAPI specs.

**Recommendation:** Use `@fastify/swagger` to auto-generate interactive API docs.

### 🏗️ ARCH-04: Frontend Build Optimization
The frontend bundles `recharts` (heavy) and all ShadCN components together. No code splitting or lazy loading is implemented.

**Recommendation:** 
- Lazy-load section components (`React.lazy` + `Suspense`)
- Dynamic import for `recharts` only when charts are visible
- Analyze bundle with `vite-bundle-visualizer`

### 🏗️ ARCH-05: Observability & Monitoring
No health metrics, no request duration tracking, no error rate monitoring. In production, you're blind to performance issues.

**Recommendation:** Add Prometheus metrics via `fastify-metrics`, structured request logging, and error tracking (Sentry).

### 🏗️ ARCH-06: Connection Pool Management
The PostgreSQL pool is created unconditionally at module load but never has its health checked or its connections limited properly.

**Recommendation:** Add pool configuration (max connections, idle timeout, connection timeout) and health checks in the `/health` endpoint.

---

## 8. Prioritized Action Plan

### 🔴 High Impact — Do First

| # | Item | Type | Effort | Impact |
|---|---|---|---|---|
| 1 | **Add test infrastructure + critical path tests** (rules engine, security, parser) | CRIT-01 | 3-5 days | 🔥🔥🔥 |
| 2 | **Add rate limiting on auth endpoints** | CRIT-06 | 2 hours | 🔥🔥🔥 |
| 3 | **Audit `.env` git history and rotate secrets** | CRIT-05 | 1 hour | 🔥🔥🔥 |
| 4 | **Fix startup race condition** (await DB init) | IMP-01 | 30 min | 🔥🔥 |
| 5 | **Replace synchronous file I/O** in orchestrator | IMP-06 | 2-3 hours | 🔥🔥 |
| 6 | **Validate AI provider API key at startup** | IMP-07 | 1 hour | 🔥🔥 |

### 🟡 Medium Impact — Plan Next

| # | Item | Type | Effort | Impact |
|---|---|---|---|---|
| 7 | **Decompose AI service** into focused modules | CRIT-03 | 2-3 days | 🔥🔥 |
| 8 | **Parameterize all hardcoded business names** | CRIT-04 | 1 day | 🔥🔥 |
| 9 | **Add API versioning** (`/api/v1/`) | IMP-04 | 2 hours | 🔥 |
| 10 | **Standardize error response envelope** | IMP-08 | 3 hours | 🔥 |
| 11 | **Share types between frontend and backend** | IMP-09 | 3 hours | 🔥 |
| 12 | **Add data export (PDF/CSV)** | UX-02 | 2-3 days | 🔥🔥 |
| 13 | **Add date range filtering** | UX-03 | 2-3 days | 🔥🔥 |
| 14 | **Decompose large frontend components** | IMP-03 | 2-3 days | 🔥 |
| 15 | **Create Zod validation middleware** | IMP-05 | 2 hours | 🔥 |

### 🟢 Lower Impact — Backlog

| # | Item | Type | Effort | Impact |
|---|---|---|---|---|
| 16 | **Redesign database schema** (proper tables + migrations) | CRIT-02 | 3-5 days | 🔥🔥 |
| 17 | **Extract pipeline to background worker** | ARCH-01 | 3-5 days | 🔥🔥 |
| 18 | **Add OpenAPI/Swagger docs** | ARCH-03 | 1 day | 🔥 |
| 19 | **Implement frontend code splitting** | ARCH-04 | 1 day | 🔥 |
| 20 | **Add observability (Prometheus, Sentry)** | ARCH-05 | 2-3 days | 🔥 |
| 21 | **Move HTML templates to templating engine** | IMP-10 | 2-3 days | 🔥 |
| 22 | **Historical report versioning** | FEAT-02 | 3-5 days | 🔥🔥 |
| 23 | **Configurable alert thresholds UI** | FEAT-03 | 2-3 days | 🔥 |
| 24 | **RBAC (role-based access)** | FEAT-09 | 3-5 days | 🔥 |
| 25 | **Multi-tenant support** | FEAT-01 | 1-2 weeks | 🔥🔥 |

---

## 9. Final Overall Assessment

### What This Project Does Exceptionally Well
1. **Domain expertise is embedded in the code**: The rules engine, AI prompts, and Telegram bot messages demonstrate deep understanding of Indian small-business accounting workflows (Udhari, daily registers, credit recovery).
2. **Graceful degradation**: The system works offline, without a database, without Google Drive, without Telegram, and without AI — each feature degrades independently.
3. **Multi-provider AI architecture**: The factory pattern and consistent interface make it genuinely trivial to switch between 7 AI providers.
4. **Production readiness signals**: Docker multi-stage build, graceful shutdown handlers, CORS configuration, env validation, and structured logging show production-awareness.

### What Needs Immediate Attention
1. **Testing is non-existent** — this is a financial application handling money-related data with zero automated verification.
2. **Security hardening** — rate limiting, credential audit, and proper session management need attention.
3. **The AI service is a monolith** that will resist any future feature additions.
4. **Business-specific coupling** makes the platform unusable for anyone other than "Hotel Gaurav."

### Strategic Recommendation
The project has a **strong foundation** and a **clear product-market fit** for Indian SMB accounting automation. The highest-leverage moves are:
1. **Add testing** to protect what works.
2. **Generalize** away from Hotel Gaurav to become a platform.
3. **Add data export and date filtering** — the two most requested features in any accounting tool.
4. **Extract the pipeline** to a background worker before scaling to more users or larger datasets.

> [!IMPORTANT]
> This project is **one refactoring sprint away** from being a genuinely compelling SaaS product. The domain knowledge, AI integration, and multi-channel delivery (web + Telegram) create a strong moat. The recommended priorities above are designed to unlock that potential with minimal disruption to the existing working system.
