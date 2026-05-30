# 🛠️ System Troubleshooting & Operations Guide

This guide describes the operational parameters, diagnostic steps, and error resolutions for the AI Accounting Automation Service background daemon and script CLI.

---

## 📊 1. Modifying Logging Levels & Pino Diagnostics

The service uses **Pino** for high-efficiency, structured JSON logging. In local development modes, output is prettified via `pino-pretty`.

### Setting Log Levels
The logging threshold is dynamically determined by the `NODE_ENV` configuration parameter inside your `.env` file:
* `NODE_ENV=development` (Default - Enables `debug` logging to output verbose detail, including row-by-row header mapping matches and raw LLM prompt structures).
* `NODE_ENV=production` or `NODE_ENV=test` (Enables `info` logging to output standard workflow status messages, parser metrics, and summary outcomes, keeping logs clean and efficient).

### Redirecting Output
Logs are continuously piped to standard output (`stdout`). Additionally, if `ENABLE_FILE_LOGGING` is set to `true` in your `.env` (default is `false`), they are also appended inside **`data/output/system.log`**.
To isolate failures, inspect the log output:
```bash
tail -n 100 data/output/system.log
```

---

## 🔑 2. API Credentials & AI Provider Failures

If you run into `Authentication Error` or `401 Unauthorized` during the pipeline execution:

### Swapping AI Providers
Ensure your active provider matches the configured API keys in `.env`:
* If `AI_PROVIDER=groq`, verify `GROQ_API_KEY` is present and active.
* If `AI_PROVIDER=gemini`, verify `GEMINI_API_KEY` is present.
* If `AI_PROVIDER=openai`, verify `OPENAI_API_KEY` is present.

### Safe Fallback & Dry-Run Mode
If all external AI keys are unavailable or expired, the service **does not crash**.
1. **Parser & Rules Resilience:** Ingestion, custom parsing synonyms mapping, and the business rules engine execution continue to run successfully.
2. **Data-Driven Fallback:** The orchestrator detects key expiration, bypasses the LLM query phase, and dynamically computes real data insights from the parsed Excel numbers (monthly averages, high-risk account identification, recovery projections) — allowing the HTML Dashboard to compile cleanly with 100% real data and zero hardcoded estimates.

---

## 🚦 3. Handling API Rate Limits & Throttling

### A. Telegram Message Rate Limits
* **Problem:** Telegram returns `429 Too Many Requests` when sending notifications rapidly.
* **Resolution:** The service incorporates a throttled messaging queue (**`src/telegram/telegram.client.ts`**). It enforces safe delivery intervals (minimum 1 second between dispatches) and chunks massive alerts groups to stay well within Telegram's maximum limits (30 requests/second).

### B. LLM Provider Token Throttling
* **Problem:** Large transaction sets exceed the model's Context Token limits.
* **Resolution:** The orchestrator trims transaction inputs to the most significant rows (e.g. anomalously flagged entries or consolidated monthly statistics matrices) before forwarding the prompt to the AI provider. Additionally, the CLI accepts an optional `--limit` flag to safely configure debtor leaderboards:
  ```bash
  npm run process-debitors -- --limit 10
  ```

---

## 📂 4. Output Folder Structuring Errors

If outputs are not appearing in `data/output/`:
1. **Local Folders Exist Check:** The service automatically runs folder creation checks (`fs.mkdirSync`) during boot. Verify the project root has adequate read/write permissions on Windows/Linux environments.
2. **Isolated Directory Cleanup:** The orchestrator is designed to work file-wise. Running the pipeline on a workbook (e.g. `npm run process-sales`) will **not** delete folders belonging to other ledger targets (like `DEBITORS LIST/`). If you wish to purge the outputs folder manually, delete the respective subfolders directly.

---

## 💾 5. Neon DB & PostgreSQL Errors

### A. Relation "financial_reports" does not exist
* **Problem:** Database queries fail when attempting to read or write reports because the target table has not been initialized. This occurs if the server process was booted before a valid `DATABASE_URL` was supplied, or if the database server was experiencing cold starts and timed out.
* **Resolution:** 
  1. Manually trigger the database structure builder by executing the workspace script:
     ```bash
     npx tsx src/scripts/test-db-init.ts
     ```
  2. Alternatively, restart the backend server process (`npm run dev`) to trigger the dynamic database guard check during server boot.

### B. SSL Mode & Connection Failures
* **Problem:** Connecting to Neon DB rejects the transaction due to missing SSL or certificate mismatch.
* **Resolution:** Neon DB requires TLS. Verify that your `.env` connection string has `?sslmode=require` appended to the end of the URL. The backend client utilizes `{ ssl: { rejectUnauthorized: false } }` to accept secure connections dynamically.

### C. Environment Reload Delays
* **Problem:** Setting `DATABASE_URL` in `.env` while `npm run dev` is running does not reload the database connection pool in the active Node memory namespace.
* **Resolution:** Stop the backend server in the console (Ctrl+C) and run `npm run dev` again to force Node.js to load the updated environment variables. Use `npx tsx src/scripts/check-db.ts` to inspect the connection live.

### D. Forgotten Passcodes / Access Denied
* **Problem:** Locked out of the application due to forgotten App Lock or Ingestion passcodes.
* **Resolution:**
  1. The security configurations are stored in the PostgreSQL database under the `financial_reports` table with `report_type = 'security-config'`.
  2. Connect to your database using a psql client or Neon console, and delete the security configuration row:
     ```sql
     DELETE FROM financial_reports WHERE report_type = 'security-config';
     ```
  3. Restart the backend server process. The service will detect the missing record on startup and automatically re-initialize the credentials using the `APP_PASSWORD` and `UPLOAD_PASSWORD` values defined in your `.env` file (which are strictly required to be configured in the environment).

