# AI Accounting Automation — Financial Command Center Dashboard

A high-fidelity, production-grade executive dashboard for real-time accounting verification, anomaly auditing, and business intelligence insights from financial registers. Connects live to the Node.js backend API which reads directly from a PostgreSQL (Neon) database.

---

## 🚀 Architecture Overview

This application operates on a modern, secure client-server architecture:
- **Frontend**: Built using React, TypeScript, Vite, and Tailwind CSS v4 with shadcn/ui components.
- **Backend Node.js Service**: Serves as the ingestion and orchestration engine, parsing Excel registers, executing anomaly-detection rules, and persisting data dynamically to PostgreSQL (Neon DB).

```mermaid
graph TD
    UserUpload[Spreadsheets Uploaded via Web UI] -->|POST In-Memory Buffer| Node[Node.js Backend Service]
    DriveSync[Google Drive Sync Button] -->|POST /api/v1/trigger-pipeline| Node
    Node -->|Persist Ingested Reports| NeonDB[(PostgreSQL Neon DB)]
    ReactApp[React Command Center Dashboard] -->|GET /api/v1/data/sales & /api/v1/data/debitors| Node
    Node --> NeonDB
```

---

## 📊 Data Integration & Sync Flow

### 1. Relational Database Architecture
The React application syncs data with the Node.js backend using a clean database-first configuration:
- **Live Database Mode**: The frontend queries `/api/v1/data/sales` and `/api/v1/data/debitors` which pull directly from the PostgreSQL database. If the database has no data yet, the API returns a 404 and the frontend displays the onboarding dashboard with upload controls active. **No mock fallbacks or simulated stats are shown in production when the database is empty.**

When the backend API is connected and reachable, the frontend initializes in `live` mode and fetches data registers concurrently. If the backend is completely unreachable, the console enters an offline `empty` state, launching a setup onboarding overlay. Under this offline mode, the advisor chat operates via a local simulated heuristic reasoning engine for demonstration purposes, and the AI Recommendations card displays a "Simulated Demo" badge.

### 2. Google Drive Sync
The **Sync Drive** button in the header triggers `POST /api/v1/trigger-pipeline`, which instructs the backend to:
1. Download all Excel ledgers from the configured Google Drive folder.
2. Parse, audit, and run AI analysis on each workbook.
3. Persist the results to the PostgreSQL DB.
4. Send a Telegram executive brief to the configured chat ID.
5. Return updated data — the frontend auto-reloads on success.

### 3. Sequential Multi-Spreadsheet Uploader
The interface includes a drag-and-drop file upload dialog:
- Select multiple ledger spreadsheets (Daily Sales Registers and Debitors Lists) simultaneously.
- An editable upload queue lets you review or remove workbooks before sending.
- Files are parsed sequentially in a non-blocking queue loop to prevent memory spikes, with real-time progress indicators (e.g. `Uploading: File 1 of 2: sales.xlsx`).
- On success, the dashboard reloads automatically with the freshly parsed data.

### 4. Loading Synchronization
On mount, the dashboard runs a background fetch to determine connection status and data availability. A modern spinner screen is displayed until the API responds, preventing layout flashes.

---

## 📁 Project Directory Structure

```
web/
├── public/                       # Static public assets
├── src/
│   ├── assets/                   # Local image and media assets
│   ├── components/               # React UI & page section components
│   │   ├── layout/               # Main layout components (Sidebar, Header, LoadingScreen)
│   │   ├── sections/             # Dashboard section interfaces (portal, overview, ledger, auditor, advisor)
│   │   ├── security/             # Security lock screen and credentials settings modal
│   │   ├── shared/               # Shared onboarding/upload wizard modals (OnboardingWizard, UploadModal)
│   │   └── ui/                   # Primitive layout components (card, button, input)
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-mobile.ts         # Viewport size detector hook
│   │   ├── useAccountingData.ts  # Cascading backend fetching hook
│   │   └── useDriveSync.ts       # Drive sync status tracking hook
│   ├── lib/
│   │   └── utils.ts              # Tailwind CSS merging utility
│   ├── services/
│   │   └── api.ts                # Client API wrappers with auth fetch
│   ├── store/
│   │   └── useAccountingStore.ts # Zustand global state manager
│   ├── utils/
│   │   ├── business.ts           # Business name filename-to-display converter
│   │   └── markdown.tsx          # Custom safe regex-based block tokenizer
│   ├── types.ts                  # Shared frontend types
│   ├── App.tsx                   # Main routing hub
│   ├── index.css                 # Global styles and tailwind directives
│   └── main.tsx                  # Vite React app entrypoint
├── components.json               # Config for shadcn UI component installer
├── eslint.config.js              # Code linting rules configuration
├── index.html                    # Dashboard main HTML container template
├── package.json                  # Scripts and package manifests
├── tsconfig.json                 # Type compiler configurations
└── vite.config.ts                # Bundling and path alias settings
```

---

## 🛠 Key Features

### 📊 Dual-Ledger Portal (Home)
- **Overview Cards**: Two portal cards (Sales Register, Customer Debitors) with live data status, alert counts, and sparkline trend previews.
- **Cron Schedule Display**: Shows the next scheduled auto-sync time from the backend cron configuration.

### 📈 Executive Overview
- **Dynamic KPIs**: Track Net Surplus, Credit Recovery split, and Clearance Indexes derived directly from parsed Excel data.
- **Interactive Time-Series Charts**: View cashflow timelines and dynamic priority debt risk splits using Recharts.
- **Outreach Copy Triggers**: Copy personalized SMS/WhatsApp payment reminder drafts directly from outstanding accounts.

### 🗃 Transaction Ledger Explorer
- **Record Inspection**: Drill down into detailed ledger sheets with full pagination.
- **Live Search & Filter**: Refine records by customer names, months, or credit thresholds.
- **Client-Side CSV Exporter**: Compile and download audited rows to a formatted CSV spreadsheet file matching your active filters.

### 🚨 Audit Anomaly Board
- **Security Exceptions**: Tracks structural issues (credit breaches, excessive category spending).
- **Rule Limits Configurator**: Live sliders adjust the compliance boundaries, recalculating active exceptions on the fly.
- **One-click Acknowledgements**: Resolve or reopen issues with instant toast feedback.

### 💬 AI Strategic Advisor
- **Contextual Ledger Chat**: Ask questions about top debtors or spending spikes. The advisor generates responses using real parsed metrics via `POST /api/chat`.
- **Offline Heuristic Fallback**: If the backend AI is unreachable, a local data-driven heuristic engine generates meaningful answers from the already-loaded ledger summary.

### 🔐 Security & Access Control
- **Fullscreen App Lock Screen**: Displays a security lock overlay upon mounting. It dynamically validates session health with the backend using secure, **bank-grade HttpOnly cookies** (`app_session_token`) completely invisible to client-side scripts (immune to XSS session-theft), with optional **"Remember this device"** 7-day duration scaling.
- **Upload Passcode Gate**: Form submissions for ledger uploads require a correct ingestion password, utilizing an in-memory scoped token inside the component to prevent persistent XSS exposure and remain immune to CSRF.
- **Tabbed Security console**: Features a dedicated settings console to update credentials in the Neon PostgreSQL database using **argon2 password hashing** on the backend. Provides side-by-side tabs for updating the App Lock passcode or the Upload passcode independently with confirmation mismatch verification and password visibility toggles (`Eye`/`EyeOff`).

---

## 💻 Tech Stack

| Layer | Technology | Version |
| :--- | :--- | :--- |
| Core Framework | React | ^19.2.4 |
| Build Tool | Vite | ^7.3.1 |
| Language | TypeScript | ~5.9.3 |
| Styling | Tailwind CSS v4 | ^4.2.1 |
| UI Components | shadcn/ui + Base UI | ^4.8.0 |
| Charts | Recharts | ^3.8.1 |
| Icons | Lucide React | ^1.16.0 |
| Toast Notifications | Sonner | ^2.0.7 |
| State Management | Zustand | ^5.0.13 |
| Theme | Custom ThemeProvider | (Internal `components/theme-provider.tsx`) |
| Markdown Rendering | Custom SafeMarkdown | (Internal `utils/markdown.tsx`) |

---

## ⚙ Setup & Development

### 1. Configure Environment Variables
Create a `.env` file in the `web/` directory (copy `.env.example` as a template):
```bash
cp .env.example .env
```
Set `VITE_API_BASE_URL` to point to your local or deployed backend:
```env
VITE_API_BASE_URL=http://localhost:8080
```
For Vercel production, set this to your deployed Render backend URL (e.g. `https://your-app.onrender.com`).

### 2. Install Dependencies
Run from the `web/` directory:
```bash
npm install
```

### 3. Run Development Server
Launches the interactive dashboard locally:
```bash
npm run dev
```
The app will be available at `http://localhost:5173` by default.

### 4. Build Production Bundle
Statically compiles and tree-shakes TypeScript code for deployment:
```bash
npm run build
```

---

## 🌐 Vercel Deployment

Deploy the frontend to Vercel with one environment variable:

| Variable | Value | Required |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Your Render backend URL (e.g. `https://your-api.onrender.com`) | **Yes** |

> [!IMPORTANT]
> Vercel builds with `npm run build`. Make sure `VITE_API_BASE_URL` is set **before** deploying — Vite bakes it into the static bundle at build time. If you update the backend URL, you must trigger a re-deploy.

> [!NOTE]
> CORS is handled by the backend. The backend's `cors.ts` already allows all origins (`*`), so no additional Vercel configuration is needed for cross-origin requests.
