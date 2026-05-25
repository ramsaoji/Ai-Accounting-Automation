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
Logs are continuously piped to standard output (`stdout`) and appended inside **`data/output/system.log`**.
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
  npm run audit-debitors -- --limit 10
  ```

---

## 📂 4. Output Folder Structuring Errors

If outputs are not appearing in `data/output/`:
1. **Local Folders Exist Check:** The service automatically runs folder creation checks (`fs.mkdirSync`) during boot. Verify the project root has adequate read/write permissions on Windows/Linux environments.
2. **Isolated Directory Cleanup:** The orchestrator is designed to work file-wise. Running an audit on a workbook (e.g. `npm run audit-sales`) will **not** delete folders belonging to other ledger targets (like `DEBITORS LIST/`). If you wish to purge the outputs folder manually, delete the respective subfolders directly.
