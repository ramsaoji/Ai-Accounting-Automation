# 📘 Workbook Integration Guide — Adding New Excel Layouts

This guide explains how to extend the service to support a completely new Excel workbook format (e.g. `INVENTORY LIST.xlsx`) in the relational architecture.

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

## 💾 Step 4: Map to Relational Database Tables

1. Define or extend the SQL tables inside **`src/db/schema.ts`** to store the new parsed data relationally (e.g., `stockItems` table).
2. Open **`src/services/orchestrator.service.ts`** and update `saveToRelationalDb` to read the parsed inventory data from the results payload and persist it into the database:

```typescript
      // Insert stock items / inventory
      if (fileType === 'stock' && allTransactions.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < allTransactions.length; i += batchSize) {
          const chunk = allTransactions.slice(i, i + batchSize).map(t => ({
            fileId: newFile.id,
            sheetName: t.sheetName || 'Stock',
            itemName: t.itemName,
            quantity: String(t.quantity),
            unitPrice: String(t.unitCost),
            totalValue: String(t.quantity * t.unitCost),
            location: 'counter'
          }));
          await tx.insert(schema.stockItems).values(chunk);
        }
      }
```

---

## 🧠 Step 5: Integrate with the AI Generation Pipeline

Open **`src/ai/ai.service.ts`** and update `generateFinancialSummary()` to route the parsed dataset through custom LLM prompts and templates:

```typescript
const isInventory = sheets.some(s => s.inventory !== undefined);

if (isInventory) {
  return this.generateInventorySummary(params); // <-- Route to inventory prompts
}
```

---

## 🚀 Step 6: Test & Run!

1. Start the development server (`npm run dev`).
2. Open the React command center UI in your browser.
3. Use the upload modal to drop your new Excel file. The backend will parse it, rule-audit it, run AI summaries, and save the results relationally.
