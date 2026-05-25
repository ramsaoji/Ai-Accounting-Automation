# 📘 Workbook Integration Guide — Adding New Excel Layouts

This guide provides a comprehensive tutorial explaining how to extend the service to support a completely new Excel workbook format (e.g. `INVENTORY LIST.xlsx`) in less than 15 minutes.

---

## 🛠️ Step 1: Declare the New Domain Models

Isolate the interface declarations and validation rules for the new layout into a dedicated domain type file inside `src/types/` (e.g. `src/types/inventory.types.ts`):

```typescript
import { z } from 'zod';

export const InventoryItemSchema = z.object({
  sku: z.string().min(1, 'SKU is required').trim(),
  name: z.string().min(1, 'Product Name is required').trim(),
  quantity: z.coerce.number().int().nonnegative('Quantity must be non-negative'),
  unitCost: z.coerce.number().positive('Unit Cost must be positive'),
  supplier: z.string().default('Generic Supplier'),
});

export type InventoryItem = z.infer<typeof InventoryItemSchema>;
```

### Export through the Central Hub
Open **`src/types/accounting.types.ts`**, import your new interfaces, and re-export them. Also, extend the core parsing payload results:
```typescript
import { InventoryItem } from './inventory.types.js';

export { InventoryItem };

export interface SheetParsingResult {
  sheetName: string;
  transactions: Transaction[];
  errors: ParsingError[];
  debitors?: DebitorSummary[];
  inventory?: InventoryItem[]; // <-- Add custom parsed array reference
}
```

---

## 🧭 Step 2: Implement the Specialized Sub-Parser

Create a dedicated parsing module under `src/excel/parsers/` (e.g. `src/excel/parsers/inventory.parser.ts`):

```typescript
import ExcelJS from 'exceljs';
import { ExcelParsingResult, ParsingError, InventoryItem } from '../../types/accounting.types.js';
import { extractStringValue } from '../excel.mapper.js';
import { logger } from '../../logger/logger.js';

export function parseInventoryWorkbook(workbook: ExcelJS.Workbook, fileName: string): ExcelParsingResult {
  logger.info({ fileName }, 'Routing to specialized Inventory List Workbook parser');
  
  const sheet = workbook.worksheets[0]; // Or find by tab signature
  const inventory: InventoryItem[] = [];
  const errors: ParsingError[] = [];

  // Parse worksheet rows using synonym maps...
  
  return {
    fileName,
    sheets: [
      {
        sheetName: sheet.name,
        transactions: [], // Not a daily transaction log
        errors,
        inventory
      }
    ]
  };
}
```

---

## 🚦 Step 3: Register Tab Signatures in the Facade

Open the central orchestrator **`src/excel/excel.parser.ts`**. Import the new parser and define a signature-based detection rule:

```typescript
import { parseInventoryWorkbook } from './parsers/inventory.parser.js';

// ... Inside parseBuffer() ...
const sheetNames = workbook.worksheets.map(w => w.name);

// Signature rule
const isInventoryList = sheetNames.some(s => s.toLowerCase().includes('stock') || s.toLowerCase().includes('inventory'));

if (isInventoryList) {
  return parseInventoryWorkbook(workbook, fileName);
}
```

---

## 🎨 Step 4: Design the HTML SaaS Dashboard Layout

Create a dedicated visual template under `src/ai/` (e.g. `src/ai/inventory-template.ts`). It should return a styled, responsive HTML string with the custom components:
* Keep the collapsible sidebars and mobile sliding navigation drawer menus consistent.
* Utilize the custom Google Fonts pairings (`Outfit` / `Inter`).
* Embed tailored responsive SVG charts (e.g., product breakdown circles, bar graphs, replenishment gauges).

---

## 🧠 Step 5: Integrate with the AI Generation Pipeline

Open **`src/ai/ai.service.ts`** and update `generateFinancialSummary()` to route the parsed dataset through custom LLM prompts and templates:

```typescript
const isInventory = sheets.some(s => s.inventory !== undefined);

if (isInventory) {
  return this.generateInventorySummary(params); // <-- Route to inventory prompts and templates!
}
```

---

### Step 6: Test & Run!

Run the integration suite using the targeted `--file` parameter. Your folder name resolver will automatically find the mock workbook and output the isolated files:
```bash
npm run audit -- --file "INVENTORY LIST"
```
The modular pipeline outputs:
* 🖥️ `data/output/INVENTORY LIST/summary.html`
* 📄 `data/output/INVENTORY LIST/summary.md`
* ⚙️ `data/output/INVENTORY LIST/summary.json`
