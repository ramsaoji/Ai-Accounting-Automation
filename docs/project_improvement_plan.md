# AI Accounting Automation — Engineering Audit & Improvement Plan

This document outlines a series of technical enhancements, security audits, and feature improvements for both the Frontend (FE) and Backend (BE) layers of the AI Accounting Automation Service. 

Recommendations are prioritized from **P0 (Critical)** to **P3 (Nice to Have)** following the project's [ARCHITECTURE_MODULARITY_GUIDE](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/docs/guides/ARCHITECTURE_MODULARITY_GUIDE.md).

---

## Executive Summary & Priority Map

| Priority | Area | Recommendation | Effort | Risk |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | Security | API Rate Limiting on Passcode Challenges | Small | Low |
| **P1** | Architecture | Distributed Lock for Cron Scheduler | Medium | Low |
| **P1** | UX / Feature | Dynamic Rule Limits Configurator (Sliders) | Medium | Low |
| **P1** | UX / Feature | Individual Transaction Drilldown & Explorer | Medium | Low |
| **P1** | Security | Credential Sync & Rotation Handler | Small | Low |
| **P1** | Reliability | DB Cold Start Connection Retry & Exponential Backoff | Small | Low |
| **P2** | Performance | Graceful Database Pool Shutdown | Small | Low |
| **P2** | Security | Migrate to Standard JWT Library (`@fastify/jwt`) | Small | Low |
| **P2** | UI / UX | Markdown Callout & Alert Block Quote Parser | Small | Low |
| **P2** | UX / Feature | Interactive Ingestion Column Mapper UI | Medium | Low |
| **P3** | Optimization | Content Hash-Based AI Insights Caching | Small | Low |
| **P3** | DevExp | Zod Error Response Sanitization Middleware | Small | Low |

---

## P0 — Critical (Immediate Action Required)

### 1. API Rate Limiting on Passcode Challenges
* **Problem**: The backend does not enforce rate limiting or brute force protection. An attacker can repeatedly call passcode verification endpoints to guess passwords.
* **Root Cause**: In [fastify.app.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/api/fastify.app.ts), no rate limiting plugin (e.g. `@fastify/rate-limit`) is registered. The endpoints `/api/v1/security/verify-app` and `/api/v1/security/verify-upload` execute [argon2.verify()](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/api/controllers/security.controller.ts#L153), which is intentionally slow and CPU-intensive. A brute force script sending concurrent requests could spike CPU usage to 100%, causing a complete Denial of Service (DoS).
* **Proposed Solution**: 
  1. Install `@fastify/rate-limit`.
  2. Register the rate limiter globally in `fastify.app.ts`.
  3. Apply a strict rate-limit rule (e.g. max 5 requests per minute per IP address) specifically on the verification routes:
     ```typescript
     app.post('/api/v1/security/verify-app', {
       config: {
         rateLimit: {
           max: 5,
           timeWindow: '1 minute'
         }
       },
       preHandler: validateBody(verifyAppSchema)
     }, verifyAppPassword);
     ```
* **Benefits**: Prevents brute-forcing lock screen passcodes and safeguards backend resources against resource-exhaustion attacks.
* **Effort**: Small (1-2 hours)
* **Risk**: Low

---

## P1 — High Impact (Architecture, Core Gaps & Reliability)

### 2. Distributed Locking for Multi-Instance Deployments
* **Problem**: The background scheduler runs as a local in-memory task, leading to duplicate runs in horizontally scaled deployments.
* **Root Cause**: The cron scheduler in [scheduler.job.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/scheduler/scheduler.job.ts) uses `node-cron` and locks execution via an in-memory boolean `this.isRunning = false`. If the app is scaled to multiple instances (e.g. on Render with multiple replicas, or in a Kubernetes cluster), each instance runs its own cron scheduler. All instances will simultaneously check Google Drive and execute the sync pipeline, causing redundant API queries, duplicate database transactions, and multiple identical Telegram briefs.
* **Proposed Solution**:
  Implement database-backed distributed locking using Postgres advisory locks. Wrap the execution of the pipeline inside a database transaction that attempts to acquire a session-level lock:
  ```typescript
  // In orchestrator.service.ts
  const [lockAcquired] = await db.execute(sql`SELECT pg_try_advisory_lock(468792)`); // custom numeric lock ID
  if (!lockAcquired.pg_try_advisory_lock) {
    logger.info('Another instance is running the sync pipeline. Skipping cron execution.');
    return;
  }
  try {
    await runPipelineInternal();
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(468792)`);
  }
  ```
* **Benefits**: Guarantees mutually exclusive background sync execution across cluster instances without adding heavy caching infrastructure (like Redis/BullMQ).
* **Effort**: Medium (1 day)
* **Risk**: Low

### 3. Dynamic Rule Limits Configurator (Sliders UI Sync)
* **Problem**: The "Auditor Policies" page in the UI is read-only and static, while the documentation describes "Rule Limits Configurator sliders that recalculate exceptions on the fly."
* **Root Cause**: In [ExceptionsFeed.tsx](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/components/sections/auditor/auditor/ExceptionsFeed.tsx#L169-L241), the rules (such as High Outflow Ceiling of ₹50,000) are hardcoded text elements. There is no active binding to sliders, state, or backend configurations. The backend [RulesEngine](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/rules/rules.engine.ts) also initializes rules with static threshold arguments (e.g. `new HighExpenseRule(50000)`).
* **Proposed Solution**:
  1. Add database columns or system settings keys (in the `system_settings` table) to hold parameters for audit rules: `rule_high_expense_ceiling`, `rule_suspicious_spike_multiplier`, etc.
  2. Modify the rules' constructor or `evaluate()` methods to read their configuration values dynamically from the DB via `getSystemSetting()`.
  3. Replace the static text cards in the frontend's `ExceptionsFeed.tsx` with sliding controls (e.g., shadcn Slider components) connected to a local state.
  4. Implement an "Apply Policies" action that triggers `POST /api/v1/system/settings` to persist modified ranges, automatically triggering UI updates and recalculating exceptions during subsequent file syncs.
* **Benefits**: Aligns the codebase with user documentation and offers restaurant owners real control over compliance audit tolerances.
* **Effort**: Medium (2-3 days)
* **Risk**: Low

### 4. Raw Transaction Explorer & Drilldown Viewer
* **Problem**: The Ledger section in the dashboard only displays aggregated monthly sales registers or debtor summaries. The owner cannot view individual transaction rows.
* **Root Cause**: [LedgerSection.tsx](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/components/sections/ledger/LedgerSection.tsx) displays `paginatedMonths` or `paginatedDebitors` via [LedgerTable.tsx](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/components/sections/ledger/ledger/LedgerTable.tsx). The raw, row-level accounting items returned in `summary.transactions` are unused except to dynamically group monthly figures on the fly.
* **Proposed Solution**:
  1. Create a third tab in the Ledger explorer page: **"Raw Transactions Ledger"**.
  2. Implement a high-performance grid table showcasing individual records (Date, Category, Invoice ID, Amount, Type, Vendor/Payee, Particulars).
  3. Add click handlers to monthly cards in `MonthlySalesLedgerTable.tsx` and debtor rows in `DebitorLedgerTable.tsx` to launch a side drawer displaying a pre-filtered list of corresponding transactions.
  4. Make sure search and pagination apply to this raw list as well.
* **Benefits**: Enables deep research into transaction-level irregularities (like off-hours expenses or category spikes) without forcing users to leave the dashboard.
* **Effort**: Medium (2 days)
* **Risk**: Low

### 5. Password Rotation Configuration Sync
* **Problem**: Editing fallback passcodes inside the `.env` configuration file has no effect once the application database has been seeded.
* **Root Cause**: In [db.client.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/db/db.client.ts#L56-L81), `initSecurityConfig()` checks if a credentials record exists in `security_config`. If a record is found, it does nothing. If an administrator edits `DEFAULT_APP_PASSWORD` or `DEFAULT_UPLOAD_PASSWORD` inside `.env` to rotate keys, the changes are never applied, forcing them to manually drop the table (which can delete critical data if done wrong) or call `reset-drizzle`.
* **Proposed Solution**:
  Enhance `initSecurityConfig()` to compare the current `.env` value with the stored hash (using `argon2.verify()`). If they do not match, re-hash the new `.env` password and update the database:
  ```typescript
  const existing = await db.select().from(schema.securityConfig).where(eq(schema.securityConfig.key, 'credentials')).limit(1);
  if (existing.length > 0) {
    const creds = existing[0];
    const appPasswordNeedsSync = !(await argon2.verify(creds.appPasswordHash, config.APP_PASSWORD));
    const uploadPasswordNeedsSync = !(await argon2.verify(creds.uploadPasswordHash, config.UPLOAD_PASSWORD));
    
    if (appPasswordNeedsSync || uploadPasswordNeedsSync) {
      logger.info('Detected updated fallback passwords in environment. Syncing hashes to DB...');
      const appHash = appPasswordNeedsSync ? await argon2.hash(config.APP_PASSWORD) : creds.appPasswordHash;
      const uploadHash = uploadPasswordNeedsSync ? await argon2.hash(config.UPLOAD_PASSWORD) : creds.uploadPasswordHash;
      
      await db.update(schema.securityConfig)
        .set({ appPasswordHash: appHash, uploadPasswordHash: uploadHash, updatedAt: new Date() })
        .where(eq(schema.securityConfig.key, 'credentials'));
    }
  }
  ```
* **Benefits**: Ensures environment-based password rotation behaves predictably, preventing confusion during server administration.
* **Effort**: Small (2 hours)
* **Risk**: Low

### 6. Relational DB Connection Retry with Exponential Backoff
* **Problem**: Cold starts in serverless databases (like Neon DB) can cause the application server to crash immediately on startup.
* **Root Cause**: In [index.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/index.ts#L18-L27), `start()` attempts to invoke database initializers immediately. If Neon DB's serverless compute is suspended (as is default for idle projects), it may take 10-20 seconds to boot. The initial connection attempt fails, triggering `process.exit(1)`.
* **Proposed Solution**:
  Implement a helper connection checker in `db.client.ts` that retries connection and migration checks up to 5 times using exponential backoff before throwing a fatal startup exception:
  ```typescript
  async function connectWithRetry(retries = 5, delay = 2000): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await pool.query('SELECT 1');
        return;
      } catch (err) {
        if (i === retries - 1) throw err;
        logger.warn(`Database connection attempt ${i + 1} failed. Retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  }
  ```
* **Benefits**: Eliminates container restart loops and service disruption on server restarts during database cold starts.
* **Effort**: Small (1 hour)
* **Risk**: Low

---

## P2 — Medium Impact (Modularity, Standards & UX Polish)

### 7. PostgreSQL Pool Connection Release on Shut Down
* **Problem**: Graceful shutdown handlers disconnect Fastify and Telegram listeners but leave Postgres client pools open, leading to ghost connections.
* **Root Cause**: The process shutdown wrapper in [index.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/index.ts#L74-L103) closes Fastify, Telegram, and cron tasks but does not close the database connection pool (`pool` in `db.client.ts`).
* **Proposed Solution**:
  Export the pool instance or a wrapper function (e.g. `export const closeDb = () => pool.end()`) from `db.client.ts`, and await its completion inside `shutdown()` in `index.ts`:
  ```typescript
  // In index.ts shutdown()
  try {
    await closeDb();
    logger.info('PostgreSQL database pool closed cleanly.');
  } catch (err) {
    logger.error({ err }, 'Error closing database pool during shutdown');
  }
  ```
* **Benefits**: Avoids resource leakage and exhaustion on PostgreSQL servers (especially Neon which has tight connection caps on free tiers).
* **Effort**: Small (30 minutes)
* **Risk**: Low

### 8. Standard JWT Library Integration
* **Problem**: The application implements custom JWT signing and verification code, which is prone to edge case security bugs.
* **Root Cause**: In [security.controller.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/api/controllers/security.controller.ts#L42-L93), `signToken()` and `verifyToken()` manually format strings, construct base64 payloads, and apply `crypto.createHmac()`. It does not perform checks on standard JWT properties (such as algorithmic validation or header consistency).
* **Proposed Solution**:
  Replace manual HMAC utility logic with `@fastify/jwt` (registered in `fastify.app.ts`) or `jose` / `jsonwebtoken`. Let the library handle token issuance, validation, expiration, and header validation.
* **Benefits**: Adheres to standard security practices (Consistency Over Cleverness) and prevents common security oversights in custom auth protocols.
* **Effort**: Small (2 hours)
* **Risk**: Low

### 9. Markdown blockquote and Callout Parsing
* **Problem**: The custom markdown parser does not support rendering blockquotes (`> `) or alerts (e.g. `> [!WARNING]`), resulting in raw text strings appearing inside chat replies.
* **Root Cause**: In [markdown.tsx](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/web/src/utils/markdown.tsx#L41-L173), `parseMarkdownBlocks()` groups markdown syntax into headings, lists, tables, paragraphs, and spacers. It lacks checks for blockquotes (`>`) or callouts (`> [!...]`), which are generated heavily by the backend's [ai.service.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/ai/ai.service.ts#L221-L222).
* **Proposed Solution**:
  Enhance `parseMarkdownBlocks()` to check for blockquotes. If the line begins with `> `, parse it as a blockquote type. Check if the blockquote contains tags like `[!WARNING]`, `[!NOTE]`, or `[!TIP]` and map them to custom alert elements:
  ```typescript
  // Example blockquote matching
  if (line.startsWith('> ')) {
    if (currentBlock && currentBlock.type !== 'blockquote') {
      blocks.push(currentBlock);
      currentBlock = null;
    }
    // parse alert alerts or general quotes
  }
  ```
  Render these inside `SafeMarkdown` as alert callout banners with appropriate background hues and Lucide icons.
* **Benefits**: Enhances the visual quality of the strategic advisor chat to match modern SaaS dashboards.
* **Effort**: Small (2-3 hours)
* **Risk**: Low

### 10. Interactive Column-Mapper UI for Custom Ledger Imports
* **Problem**: Uploading a custom Excel sheet fails immediately if the columns do not align exactly with the hardcoded mappings.
* **Root Cause**: In [sales.parser.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/excel/parsers/sales.parser.ts), sheet structures are rigidly mapped. The fallback parser in [excel.mapper.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/excel/excel.mapper.ts) relies on synonyms. If the synonym check fails, it falls back to hardcoded column indexes (e.g. `getVal('date', 1)`). This causes validation failures if the columns are shifted.
* **Proposed Solution**:
  1. Add an intermediate step in the frontend upload wizard: if the backend responds with a parsing structure warning, display a mapping screen.
  2. Show a dropdown interface for each expected schema field (Date, Invoice No, Category, Amount, Type, Vendor) and let the user select which Excel column matches which field.
  3. Send this map configuration block as part of the upload payload so the backend mapper uses it instead of relying on default synonyms.
* **Benefits**: Vastly increases the system's flexibility to ingest spreadsheets from different point-of-sale systems.
* **Effort**: Medium (3 days)
* **Risk**: Low

---

## P3 — Nice to Have (Developer Experience & Optimizations)

### 11. Content Hash-Based AI Summary Caching
* **Problem**: Processing files repeatedly (e.g. during testing or sync triggers) leads to expensive redundant calls to the LLM API.
* **Root Cause**: In [orchestrator.service.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/services/orchestrator.service.ts#L380), the orchestrator triggers the AI service on every ingestion run. While Drive sync compares modification times, manually uploaded buffers always call AI.
* **Proposed Solution**:
  1. Calculate a cryptographic hash (SHA-256) of the raw transactions array representing the workbook.
  2. Before making the LLM call, query the `files` table for a record with the same hash and `status = 'success'`.
  3. If a match is found, copy its `aiSummary` and `aiIntelligence` fields to the new file record, completely skipping the LLM API call.
* **Benefits**: Significantly reduces API usage bills and speeds up manual spreadsheet ingestion.
* **Effort**: Small (3 hours)
* **Risk**: Low

### 12. Zod Error Sanitization Middleware
* **Problem**: When query/body validation fails on the backend, raw Zod compiler error stacks are sent to the client, leaking implementation details.
* **Root Cause**: [validate.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/api/middleware/validate.ts) intercepts requests and rejects them using `reply.send(error)` when Zod validation fails.
* **Proposed Solution**:
  Implement a formatting parser in `validate.ts` that simplifies the error stack into an array of user-friendly validation messages before sending (e.g. `{"error": "Field 'password' is required"}`).
* **Benefits**: Prevents exposing internal code schemas and improves API readability.
* **Effort**: Small (1 hour)
* **Risk**: Low
