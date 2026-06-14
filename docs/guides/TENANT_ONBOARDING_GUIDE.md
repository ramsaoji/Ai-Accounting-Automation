# 🏭 Universal Tenant Onboarding Developer Guide

This document describes the step-by-step developer workflow to onboard a new business entity (tenant) to the **AI Accounting Automation Platform** (e.g. Salons, Restaurants, Retail Outlets, Bars).

---

## 🏗️ 1. Multi-Tenant Architectural Overview

The database is built around a generic, metadata-driven multi-tenant design:
1. **`organizations`**: Stores the billing parent company.
2. **`business_entities`**: Configures the business type (e.g., `SERVICES`, `HOSPITALITY`, `RETAIL`), timezone, and base currency.
3. **`branches`**: Physical locations or outlets under the business entity.
4. **`chart_of_accounts`**: Stores the custom categories (codes and colors) used for financial aggregation.
5. **`parser_templates`**: Stores a JSON `mapping_schema` matching the spreadsheet column coordinates to Chart of Accounts IDs.

---

## 🚀 2. Onboarding Workflow (Step-by-Step)

### Step 1: Configure Tenant Metadata & Mapping
Open the onboarding script [add-tenant.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/scripts/add-tenant.ts) and edit the `NEW_TENANT_CONFIG` declaration. 

#### Example Configuration (For a Beauty Salon):
```typescript
const NEW_TENANT_CONFIG = {
  organizationName: 'Zenith Wellness Group',
  businessName: 'Zenith Salon & Spa',
  industryProfile: 'SERVICES', // Options: SERVICES, RETAIL, HOSPITALITY, TRADING
  baseCurrency: 'INR',
  baseTimezone: 'Asia/Kolkata',
  branches: [
    { name: 'Zenith Salon Downtown', slug: 'zenith-salon-downtown', description: 'Downtown premium spa location' }
  ],
  // Define custom Chart of Accounts categories
  chartOfAccounts: [
    { code: '4001', name: 'Hair Services Revenue', type: 'REVENUE', color: 'var(--primary)' },
    { code: '4002', name: 'Spa & Facial Revenue', type: 'REVENUE', color: 'var(--chart-2)' },
    { code: '4003', name: 'Retail Product Sales', type: 'REVENUE', color: 'var(--chart-3)' },
    { code: '5001', name: 'Salon Rent & Utilities', type: 'OPEX', color: 'var(--destructive)' },
    { code: '5002', name: 'Staff Commissions', type: 'OPEX', color: 'var(--warning)' }
  ],
  // Define column index mappings in the Excel sheet
  parserTemplates: [
    {
      templateName: 'Zenith Salon Excel Sales Template',
      fileCategory: 'sales',
      mappingSchema: {
        file_category: 'sales',
        header_row_index: 2, // Excel Row number containing the headers (1-indexed)
        data_start_row: 3,  // Excel Row number where data values start
        columns: {
          date: { col_idx: 1, type: 'date' },       // Date column index
          invoice: { col_idx: 2, type: 'string' }   // Invoice column index (optional)
        },
        // Maps column indices to their Chart of Accounts codes
        expansions: [
          { col_index: 3, type: 'credit', coa_code: '4001', default_vendor: 'Hair Styling Desk', default_particulars: 'Hair Services Revenue' },
          { col_index: 4, type: 'credit', coa_code: '4002', default_vendor: 'Spa Rooms', default_particulars: 'Spa & Facial Treatments' },
          { col_index: 5, type: 'credit', coa_code: '4003', default_vendor: 'Product Shelves', default_particulars: 'Retail Product Sales' },
          { col_index: 7, type: 'debit', coa_code: '5001', default_vendor: 'Landlords', default_particulars: 'Rent and utility bills' }
        ]
      }
    }
  ]
};
```

---

### Step 2: Execute the Onboarding Script
Save the file and run the following command in your terminal:
```bash
npm run onboard-tenant
```
This script will:
1. Register the parent Organization.
2. Register the Business Entity, currency settings, and timezone.
3. Establish branches.
4. Populate the custom Chart of Accounts.
5. Create the Excel template configurations matching the columns and map them to their corresponding database IDs.

---

### Step 3: Run Ingestion
Once seeded, drag and drop the Excel file into the **Setup Wizard** or **Ingestion Control Center**.
* The **Excel Parser** will detect the file headers, find the registered `parser_template` in the database, and execute the dynamic row-expansion parser.
* The frontend charts and advisor prompt context will adapt to the newly configured Chart of Accounts and industry profile automatically.

---

## 🔀 3. Handling Different XLSX Layouts

If a new tenant's spreadsheet format is different, you have two ways to handle it:

### Scenario A: The sheet has standard rows/columns, but different column offsets or header names
You do **not** need to write any code. Simply adjust the `mappingSchema` in the `parserTemplate` configuration inside [add-tenant.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/scripts/add-tenant.ts):
* **`header_row_index`**: Tells the parser which row contains the columns (e.g. Row 1, Row 3).
* **`data_start_row`**: Tells the parser on which row the data transactions start, allowing it to bypass blank rows or title banners.
* **`columns` & `expansions`**: Bind the target columns by index to their corresponding Chart of Accounts codes (e.g., Column 1 is Date, Column 3 is Haircuts, Column 5 is Retail Sales). The dynamic parser will auto-extract transactions based on these coordinates.

### Scenario B: The file is completely non-standard (e.g., PDF statements, complex multi-sheet summaries)
If a sheet cannot be parsed using simple row-by-column coordinates:
1. **Create a specialized parser**: Write a new parser file under `src/excel/parsers/` (e.g. `src/excel/parsers/salon-complex.parser.ts`) implementing custom cell-looping logic.
2. **Register the parser**: Import your new parser inside [excel.parser.ts](file:///d:/1.WORK/PROJECTS/NODEJS/ai-accounting-automation/src/excel/excel.parser.ts) and add a check inside `parseBuffer` to route to it based on the file name or template category:
   ```typescript
   if (dbTemplate.templateName === 'My Complex Format') {
     return parseMyComplexFormat(sheet, fileName);
   }
   ```

---

## 🛠️ 4. Verification & Troubleshooting

### Check Database Records
You can run Drizzle Studio to verify that the tenant was correctly seeded:
```bash
npm run db-studio
```
1. Verify a new record was added in the `business_entities` table.
2. Confirm the `chart_of_accounts` has matching codes and colors.
3. Inspect `parser_templates` to verify that the schema configurations hold the resolved database UUIDs of the Chart of Accounts.
