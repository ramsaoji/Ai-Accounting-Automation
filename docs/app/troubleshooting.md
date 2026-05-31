# 🛠️ System Troubleshooting & Operations Guide

This guide describes the operational parameters, diagnostic steps, and error resolutions for the AI Accounting Automation Service.

---

## 📊 1. Modifying Logging Levels & Pino Diagnostics

The service uses **Pino** for high-efficiency, structured JSON logging. In local development modes, output is prettified via `pino-pretty`.

### Setting Log Levels
The logging threshold is dynamically determined by the `NODE_ENV` configuration parameter inside your `.env` file:
* `NODE_ENV=development` (Default - Enables `debug` logging to output verbose detail, including row-by-row header mapping matches and raw LLM prompt structures).
* `NODE_ENV=production` or `NODE_ENV=test` (Enables `info` logging to output standard workflow status messages, parser metrics, and summary outcomes, keeping logs clean and efficient).

### Redirecting Output
Logs are continuously piped to standard output (`stdout`). Additionally, if `ENABLE_FILE_LOGGING` is set to `true` in your `.env` (default is `false`), they are also appended inside **`logs/system.log`**.
To isolate failures, inspect the log output:
```bash
tail -n 100 logs/system.log
```

---

## 🔑 2. API Credentials & AI Provider Failures

If you run into `Authentication Error` or `401 Unauthorized` during the pipeline execution:

### Swapping AI Providers
Ensure your active provider matches the configured API keys in `.env`:
* If `DEFAULT_AI_PROVIDER=groq`, verify `GROQ_API_KEY` is present and active.
* If `DEFAULT_AI_PROVIDER=gemini`, verify `GEMINI_API_KEY` is present.
* If `DEFAULT_AI_PROVIDER=openai`, verify `OPENAI_API_KEY` is present.

### Safe Fallback & Dry-Run Mode
If all external AI keys are unavailable or expired, the service **does not crash**.
1. **Parser & Rules Resilience:** Ingestion, custom parsing synonyms mapping, and the business rules engine execution continue to run successfully.
2. **Data-Driven Fallback:** The orchestrator detects key expiration, bypasses the LLM query phase, and dynamically computes real data insights from the parsed Excel numbers (monthly averages, high-risk account identification, recovery projections) — allowing the React Dashboard to display cleanly with 100% real data and zero hardcoded estimates.

---

## 🚦 3. Handling API Rate Limits & Throttling

### A. Telegram Message Rate Limits
* **Problem:** Telegram returns `429 Too Many Requests` when sending notifications rapidly.
* **Resolution:** The service incorporates a throttled messaging queue (**`src/telegram/telegram.client.ts`**). It enforces safe delivery intervals (minimum 1 second between dispatches) and chunks massive alerts groups to stay well within Telegram's maximum limits (30 requests/second).

### B. LLM Provider Token Throttling
* **Problem:** Large transaction sets exceed the model's Context Token limits.
* **Resolution:** The orchestrator trims transaction inputs to the most significant rows (e.g. anomalously flagged entries or consolidated monthly statistics matrices) before forwarding the prompt to the AI provider.

---

## 💾 4. PostgreSQL & Neon DB Connection Errors

### A. Database Migrations Fail on Startup
* **Problem:** The application fails to boot, reporting database migration errors.
* **Resolution:** 
  1. Confirm that your database is running and accepting connections.
  2. Verify that `DATABASE_URL` is set to a valid PostgreSQL connection string in `.env`.
  3. Run `npm run reset-drizzle` in the terminal to cascade-drop all tables and apply clean, fresh migrations.

### B. SSL Mode & Connection Failures
* **Problem:** Connecting to Neon DB rejects the connection due to missing SSL or certificate mismatch.
* **Resolution:** Neon DB requires TLS. Verify that your `.env` connection string has `?sslmode=require` appended to the end of the URL. The backend client utilizes `{ ssl: { rejectUnauthorized: false } }` to accept secure connections dynamically.

### C. Forgotten Passcodes / Access Denied
* **Problem:** Locked out of the application due to forgotten App Lock or Ingestion passcodes.
* **Resolution:**
  1. The security configurations are stored in the PostgreSQL database under the `security_config` table.
  2. Connect to your database using a psql client or Neon console, and delete the security configuration rows:
     ```sql
     TRUNCATE TABLE security_config;
     ```
  3. Restart the backend server process. The service will detect the missing records on startup and automatically re-initialize the credentials using the `DEFAULT_APP_PASSWORD` and `DEFAULT_UPLOAD_PASSWORD` values defined in your `.env` file.
