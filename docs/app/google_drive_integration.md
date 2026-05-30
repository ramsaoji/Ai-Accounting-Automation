# Google Drive Integration Guide

Connect the accounting automation service to **Google Drive** so it can automatically download your Excel ledger files, run the full AI auditing pipeline, and push results to Neon DB on every scheduled cron tick — or whenever you trigger it manually.

---

## 💸 Is it free?

Yes. The **Google Drive API** is completely free for this use case. The service account approach does not require billing to be enabled. You only get charged if you exceed 1 billion API calls/day (not possible here).

---

## 🛠️ Step-by-Step Setup

### Step 1: Open Google Cloud Console

Go to **[console.cloud.google.com](https://console.cloud.google.com)** and sign in with your Google account.

> [!NOTE]
> Make sure you're on the **Console** page (dark sidebar with project selector), not the marketing homepage at `cloud.google.com`.

---

### Step 2: Create or Select a Project

1. Click the **project dropdown** in the top navigation bar.
2. Click **"New Project"**.
3. Enter a name (e.g. `ai-accounting-automation`) → Click **Create**.
4. Ensure this project is active in the top bar before proceeding.

---

### Step 3: Enable the Google Drive API

1. In the left sidebar: **APIs & Services → Library**.
2. In the search box, type: `Google Drive API`.
3. Click the **Google Drive API** card.
4. Click **Enable**.

> [!IMPORTANT]
> Do **not** search for "credentials" in the API Library — that shows unrelated IAM APIs. You must enable **Google Drive API** specifically.

---

### Step 4: Create a Service Account

A Service Account is a non-human Google identity that your backend server uses to authenticate with Drive.

1. In the left sidebar: **IAM & Admin → Service Accounts**.
   Or go directly to: `console.cloud.google.com/iam-admin/serviceaccounts`
2. Click **"+ Create Service Account"**.
3. Fill in:
   - **Service account name**: `ai-accounting-worker` (or any name)
   - **Service account ID**: auto-filled
4. Click **"Create and Continue"**.
5. On the **Grant access** step: skip it (click **Continue**).
6. Click **Done**.

---

### Step 5: Generate a JSON Key

1. In the Service Accounts list, **click the service account** you just created.
2. Go to the **Keys** tab.
3. Click **"Add Key" → "Create new key"**.
4. Select **JSON** → Click **Create**.
5. A `.json` file is **automatically downloaded** to your computer. Keep it safe — this is your private credential file.

The JSON file looks like this:
```json
{
  "type": "service_account",
  "project_id": "ai-accounting-automation",
  "client_email": "ai-accounting-worker@ai-accounting-automation.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0B...\n-----END PRIVATE KEY-----\n",
  ...
}
```

---

### Step 6: Add Credentials to `.env`

Open your project's `.env` file at the root (`/ai-accounting-automation/.env`) and fill in:

```env
# ====================================================================
# Google Drive Service Account Configuration
# ====================================================================
# The client_email from your downloaded JSON key file
GOOGLE_CLIENT_EMAIL=ai-accounting-worker@ai-accounting-automation.iam.gserviceaccount.com

# The private_key from your downloaded JSON key file (keep the \n characters)
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0B...\n-----END PRIVATE KEY-----\n"

# The ID of your Google Drive folder containing the Excel ledgers (see Step 7)
GOOGLE_DRIVE_FOLDER_ID=1abc123XYZdef456GHI
```

> [!WARNING]
> The `GOOGLE_PRIVATE_KEY` must preserve the `\n` escape sequences exactly as they appear in the JSON file. If you paste the key with real line breaks instead of `\n`, authentication will fail.

> [!CAUTION]
> Never commit your `.env` file or the downloaded JSON key to GitHub. The `.gitignore` is already configured to exclude `.env` files.

---

### Step 7: Share Your Drive Folder with the Service Account

The service account cannot access your Drive files by default — you must explicitly share the folder with it, just like sharing with a person.

1. Open **[drive.google.com](https://drive.google.com)** in your browser.
2. Navigate to the folder containing your Excel ledger files.
3. Right-click the folder → **Share**.
4. In the **"Add people and groups"** field, paste your `client_email` value:
   ```
   ai-accounting-worker@ai-accounting-automation.iam.gserviceaccount.com
   ```
5. Set the role to **Viewer** (read-only is enough).
6. Click **Send** (ignore the warning about sharing with a non-Google account).

---

### Step 8: Get the Drive Folder ID

The folder ID is embedded in the URL when you open the folder in Google Drive:

```
https://drive.google.com/drive/folders/1abc123XYZdef456GHI789
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        This is your GOOGLE_DRIVE_FOLDER_ID
```

Copy that ID segment and add it to your `.env` as `GOOGLE_DRIVE_FOLDER_ID`.

---

### Step 9: Restart the Backend

```bash
npm run dev
```

You will see in the logs:
```
[drive.service] Searching for all Excel files in Google Drive
[drive.service] Found Excel file(s) in Google Drive
[orchestrator] Downloading target Excel sheet from Google Drive
[drive.service] Downloading file buffer from Google Drive
[orchestrator] Persisted ingestion report to Neon DB
```

---

## 🔄 How the Sync Works

```mermaid
sequenceDiagram
    participant Cron as Scheduler (CRON_SCHEDULE)
    participant API as POST /api/trigger-pipeline
    participant Orch as Orchestrator Service
    participant Drive as Google Drive API
    participant AI as AI Service (Groq/Gemini)
    participant DB as Neon DB
    participant TG as Telegram Bot

    Cron->>Orch: Cron tick fires
    API->>Orch: Manual trigger (optional)
    Orch->>Drive: getAllExcelFiles()
    Drive-->>Orch: Array of file metadata
    loop For each Excel file (oldest first)
        Orch->>Drive: downloadFile(fileId)
        Drive-->>Orch: Excel Buffer
        Orch->>AI: generateFinancialSummary(transactions)
        AI-->>Orch: Markdown + HTML + JSON reports
        Orch->>DB: saveReport('sales' | 'debitors')
        Orch->>TG: sendReport(executiveSummary)
        TG-->>TG: Deliver to authorized Chat ID
    end
```

---

## ⚙️ How the Orchestrator Decides: Drive vs. Local

The orchestrator automatically detects which mode to run based on your credentials:

| Condition | Mode | Source |
| :--- | :--- | :--- |
| `GOOGLE_CLIENT_EMAIL` contains `your-project-id` or `GOOGLE_PRIVATE_KEY` contains `MIIEvgIBADANBgkqhkiG9w0` | **Local mode** | Reads `.xlsx` files from `data/input/` |
| Neither contains placeholder text | **Drive mode** | Downloads from Google Drive folder |

No code changes are needed — just update the `.env` and restart.

---

## 🗓️ Configuring the Sync Schedule

Control how often Drive is polled by setting `CRON_SCHEDULE` in your `.env` (defaults to daily at midnight if omitted):

```env
# Run daily at midnight (default if omitted)
CRON_SCHEDULE=0 0 * * *

# Run every hour
CRON_SCHEDULE=0 * * * *

# Run every 6 hours
CRON_SCHEDULE=0 */6 * * *
```

Use [crontab.guru](https://crontab.guru) to build and validate cron expressions.

---

## 🚀 Manual Trigger (Without Waiting for Cron)

To trigger an immediate Drive sync without waiting for the next scheduled tick:

**Linux / macOS / Git Bash:**
```bash
curl -X POST http://localhost:8080/api/trigger-pipeline
```

**Windows PowerShell** (`curl` is an alias — use one of these instead):
```powershell
# Option A: force real curl binary
curl.exe -X POST http://localhost:8080/api/trigger-pipeline

# Option B: native PowerShell
Invoke-WebRequest -Uri http://localhost:8080/api/trigger-pipeline -Method POST
```

Response:
```json
{ "message": "Accounting pipeline triggered successfully in background" }
```

The pipeline runs asynchronously in the background — the API responds immediately with `202 Accepted` while processing continues in the server logs.

---

## 🛠️ Troubleshooting

### ❌ `Google Drive list failed: invalid_grant`
- Your `GOOGLE_PRIVATE_KEY` has broken line endings. Make sure it uses literal `\n` characters, not real newlines.
- Re-copy the `private_key` value directly from the downloaded JSON key file.

### ❌ `No Excel files found in the configured folder`
- The folder was not shared with the service account email.
- The `GOOGLE_DRIVE_FOLDER_ID` is incorrect — double-check the URL.
- The folder contains no `.xlsx` files.

### ❌ `Google Drive Client initialization failed`
- The Drive API is not enabled on your project. Go back to **Step 3** and enable it.
- The `GOOGLE_CLIENT_EMAIL` value is still the placeholder default.

### ❌ Drive runs but DB is not updated
- Verify `DATABASE_URL` is set correctly in `.env`.
- Check the Neon DB dashboard to confirm the `financial_reports` table exists.
- Look at `data/output/system.log` for `Failed to persist` errors.
