# 🏭 Production-Grade Coding Standards & UI/UX Design Guidelines

This document establishes the official engineering guidelines, architectural structures, and design system rules for the **AI Accounting Automation Platform**. 

All future refactoring, feature implementation, and scaling updates must strictly adhere to these specifications to prevent code bloat, maintain UI/UX consistency, and ensure absolute separation of concerns.

---

## 🗂️ 1. Backend Modularization & File Separation

To prevent single files from becoming monolithic and unmaintainable (e.g., keeping controllers, database actions, or bots in single scripts), we enforce a strict file layout by responsibility:

```
src/
├── api/
│   ├── controllers/      # Fastify request/reply logic. No SQL or direct LLM execution.
│   ├── middleware/       # JWT auth, rate limits, schema validation hooks (Zod).
│   └── fastify.app.ts    # Server setup and plugins registration.
├── db/
│   ├── schema.ts         # Relational database table schemas (Drizzle).
│   └── db.client.ts      # Connection pools and basic client getters.
├── excel/
│   ├── parsers/          # Layout-specific parser strategies (Daily Sales, Stocks, A/R).
│   ├── excel.mapper.ts   # Dynamic synonym builders and column lookup functions.
│   └── excel.parser.ts   # Selector facade routing binary streams to specialized parsers.
├── rules/
│   ├── definitions/      # Strategy rules (Duplicate invoices, Credit breaches).
│   └── rules.engine.ts   # Orchestrator evaluating registered strategy rules.
├── ai/
│   ├── providers/        # Adapters for swappable LLM APIs (Gemini, Claude, OpenAI).
│   ├── ai.prompts.ts     # System templates and domain-specific advisor prompts.
│   └── ai.service.ts     # Orchestrator managing prompt assembly and RAG injection.
├── telegram/
│   ├── bot.commands.ts   # Handler functions for text commands (/start, /sync, /help).
│   ├── bot.callbacks.ts  # Inline keyboards button interaction handlers.
│   ├── bot.ai.ts         # Voice message translation and conversational prompt routing.
│   ├── bot.keyboards.ts  # Markup layouts for reply keyboards and menu trees.
│   └── telegram.bot.ts   # Bot entrypoint, long-polling registry, and lifecycle router.
└── services/
    └── orchestrator.ts   # Worker-thread pipelines coordinating ETL and audit workflows.
```

### 🛡️ Code Separation Rules
1. **Controllers (No Business Logic)**: API handlers must only validate request formats (`req.body`, `req.query`) using Zod schemas, delegate tasks to a specific **Service** or **Orchestrator**, and return normalized JSON envelopes.
2. **Services (No HTTP Context)**: Service functions must never refer to Fastify objects (`request`, `reply`, cookies). They receive parameters, execute business actions, query databases, and return raw data.
3. **Audit Rules Strategy Pattern**: Each check in the rules engine must be implemented in a dedicated file inside `src/rules/definitions/` that implements the `Rule` interface. Registering/removing rules should require exactly one line of change in `rules.engine.ts`.
4. **LLM Provider Factory Pattern**: Adding a new AI vendor must be done by writing a new adapter class in `src/ai/providers/` that implements the `AIProvider` contract. No ad-hoc `fetch` requests directly to Gemini/OpenAI are allowed outside these adapters.

---

## 🎨 2. Frontend UI/UX Standards (Shadcn UI & CSS Variable Tokens)

To maintain a consistent, premium user experience, the frontend must exclusively use **Shadcn UI** components styled with CSS tokens, prohibiting ad-hoc colors or custom hex styling.

### 🎨 Design System Tokens
All colors, borders, and layouts must use Tailwind variable mappings referencing our core design tokens:

```css
:root {
  --background: 240 10% 3.9%;      /* Sleek Dark Base */
  --foreground: 0 0% 98%;          /* High-Contrast White text */
  --card: 240 10% 6%;              /* Muted Card surface */
  --card-foreground: 0 0% 98%;
  --primary: 263.4 70% 50.4%;      /* Royal Purple primary actions */
  --primary-foreground: 210 20% 98%;
  --muted: 240 3.7% 15.9%;         /* Muted borders/backgrounds */
  --muted-foreground: 240 5% 64.9%;
  --accent: 240 3.7% 15.9%;
  --destructive: 0 62.8% 30.6%;    /* Audit alerts / Overflows */
  --success: 142.1 76.2% 36.3%;    /* Surplus indicators / Recovered credit */
  --warning: 38 92% 50%;           /* Credit warnings / Margin losses */
  --border: 240 3.7% 15.9%;
  --radius: 0.5rem;
}
```

### 💅 Strict Frontend Guidelines
1. **No Hardcoded Hex Colors**: Code must never contain inline hex color classes (e.g., do NOT write `text-[#4F46E5]` or `bg-[#FF0000]`). Use semantic classes: `text-primary`, `bg-destructive`, `border-muted`, `text-success`.
2. **Shadcn UI Eager Imports**: Component files must reside in `@/components/ui/` (e.g., `button.tsx`, `card.tsx`, `dialog.tsx`). Customize components by modifying their base Tailwind mappings or default props, not by hacking styles inside parent files.
3. **Glassmorphism Theme Style**: Maintain a premium feel using backdrop filters:
   - Cards: `bg-card/45 backdrop-blur-md border border-border/40`
   - Lock screen: `bg-background/80 backdrop-blur-xl`
4. **Performance & Code Splitting**:
   - Always load major dashboard views (Overview, Ledgers, Exceptions, Advisor) asynchronously using React's `lazy` and `Suspense`:
     ```tsx
     const LedgerSection = React.lazy(() => import('./sections/ledger/LedgerSection'));
     ```
   - Heavy dependencies (like `recharts` and `lucide-react`) must be split into separate chunks via Vite build manual chunk configurations.

---

## 🤖 3. Telegram Bot Architecture & Modularization

The Telegram Bot is a critical interface for the business owner. To prevent [telegram.bot.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/telegram/telegram.bot.ts) from growing into a monolithic handler, command routing must be split using a lookup map:

```
                                [Inbound Telegram Event]
                                           │
                                           ▼
                                 [telegram.bot.ts]
                                (Lifecycle Router)
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
           [bot.commands.ts]      [bot.callbacks.ts]          [bot.ai.ts]
         (/start, /sync, /help)     (Inline menus)       (Voice notes & advisor)
                    │                      │                      │
                    └──────────────────────┼──────────────────────┘
                                           ▼
                                   [telegram.client.ts]
                                 (Dispatches Card/Image)
```

### 💬 Command & Callback Rules
1. **Explicit Routing Table**: Commands must be registered via a map rather than an endless `if-else` or `switch` tree inside the listener:
   ```typescript
   const COMMAND_ROUTERS: Record<string, CommandHandler> = {
     '/start': handleStartCommand,
     '/sync': handleSyncCommand,
     '/health': handleHealthCheck,
   };
   ```
2. **Markdown Protection**: Telegram requires strict markdown formatting escape configurations. All text sent to the user must be routed through a sanitizer function (like `telegramClient.sendMarkdownSafe`) to prevent parsing crashes when rendering data with special characters (`.`, `-`, `_`, `₹`).

---

## 🔒 4. Enterprise-Grade Security & Data Confidentiality

Since accounting, sales, and employee wages are highly sensitive, the application must enforce strict data privacy and leakage prevention policies.

### 🛡️ Tenant Isolation & Access Controls
1. **Tenant Filtering**: All database select, update, and delete queries must be explicitly scoped by the active business ID:
   - For Drizzle: Always include `eq(schema.transactions.branchId, activeBranchId)` or `eq(schema.files.businessId, activeBusinessId)`.
   - Never write queries without checking active session authorization scope.
2. **Row-Level Security (RLS)**: Database tables containing ledger, stock, or payroll items should have PostgreSQL RLS enabled to guarantee data isolation at the DB layer.
3. **Role-Based Scopes**: Ensure branch managers only have access to their assigned branch ID, while administrators have aggregate organization-wide visibility.

### 🪵 Log Redaction Policy
To prevent leaking financial figures or keys into system logs or external monitoring platforms:
- **Logger Configuration**: The Pino logger in [logger.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/logger/logger.ts) must be configured to redact sensitive paths:
  ```typescript
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'password',
    'token',
    'apiKey',
    '*.password',
    '*.token',
    '*.amount',
    '*.pending',
    '*.debit',
    '*.credit',
    '*.particulars',
    '*.itemName',
    '*.partyName'
  ]
  ```

### 🤖 AI Context Anonymization (PII Scrubbing)
When sending transaction contexts or tables to external AI models (Gemini, Claude, OpenAI):
1. **Names Masking**: Strip out customer and employee names in the query payloads. Replace them with standardized index codes (e.g. `"Customer A"`, `"Stylist X"`, `"Staff Member 1"`).
2. **Contact Scrubbing**: Strip phone numbers, email addresses, and vehicle numbers from description columns before sending them to the LLM.
3. **Aggregated RAG Contexts**: Never feed raw ledger pages into the AI prompt. Provide pre-computed daily/weekly sums and exception descriptions, preventing the LLM from processing row-level transaction records.

---

## 🚨 5. Production Observability, Testing & Error Handling

To support multi-tenant loads:
1. **Vitest Unit Specifications**: Every validation rule and parser converter must have a companion `.test.ts` file in its folder.
2. **Standard API Envelopes**: All API endpoints must return a consistent payload signature to the frontend:
   - **Success**: `{ data: T }`
   - **Error**: `{ error: { code: string, message: string, details?: any } }`
3. **No-Downtime Migration Pattern**: Schema modifications must be written to support a backward-compatible "Dual-Run" mode. If new tenant variables are missing, backend logic and database queries must fall back to default seeds (e.g. Hotel Gaurav parameters) rather than returning 500 exceptions.
