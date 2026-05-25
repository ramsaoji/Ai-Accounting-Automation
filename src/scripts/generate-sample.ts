import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { logger } from '../logger/logger.js';

export async function generateSampleExcel() {
  logger.info('Generating high-fidelity sample accounting ledger spreadsheet...');
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Transactions_Q2');

  // Define styling formatting
  const headerFont = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F497D' }, // Navy blue theme
  };

  // Add headers
  const headers = [
    'Transaction Date',
    'Invoice Number',
    'Category',
    'Particulars (Description)',
    'Invoiced Amount',
    'Type (credit/debit)',
    'Vendor / Payee',
  ];

  worksheet.addRow(headers);
  
  // Style headers
  const headerRow = worksheet.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Mock transactions representing normal, anomalous, and invalid data
  const data = [
    // Regular credit (Revenue)
    ['2026-05-15 10:00:00', 'INV-2026-001', 'Revenue', 'SaaS Client Subscription Tier A', 120000, 'credit', 'Stripe Inflow'],
    // Regular debits
    ['2026-05-16 11:30:00', 'INV-2026-002', 'Infrastructure', 'AWS Monthly Invoice', 18500, 'debit', 'Amazon Web Services'],
    ['2026-05-17 14:00:00', 'INV-2026-003', 'SaaS Tools', 'Slack Team Yearly renewal', 8200, 'debit', 'Slack Technologies'],
    // High Expense Breaching ₹50,000 threshold (RULE_002)
    ['2026-05-18 16:15:00', 'INV-2026-004', 'Consulting', 'Q2 Cybersecurity Vulnerability Audit', 75000, 'debit', 'SecOps Consulting Group'],
    // Duplicate Invoices (RULE_001)
    ['2026-05-19 09:30:00', 'INV-2026-005', 'Marketing', 'Q2 Google AdWords Campaign', 24000, 'debit', 'Google LLC'],
    ['2026-05-19 17:45:00', 'INV-2026-005', 'Marketing', 'Google Ads Retargeting Retainer', 24000, 'debit', 'Google LLC'], // Duplicate!
    // Suspicious category spike (RULE_003) - Regular Office expenses are ~₹1,200
    ['2026-05-20 10:30:00', 'INV-2026-006', 'Office Operations', 'Printer Paper & Office Stationary', 1200, 'debit', 'Staples'],
    ['2026-05-20 12:00:00', 'INV-2026-007', 'Office Operations', 'Breakroom Snacks & Coffee Beans', 1500, 'debit', 'Starbucks Business'],
    ['2026-05-21 15:00:00', 'INV-2026-008', 'Office Operations', 'Executive Ergonomic Chair Replacement', 28000, 'debit', 'Herman Miller Inc.'], // Spike anomaly!
    // Off-Hours Weekend/Late night transaction (RULE_004)
    ['2026-05-24 02:45:00', 'INV-2026-009', 'Travel & Entertainment', 'Late-night client hospitality dinner', 5400, 'debit', 'Taj Fine Dining'], // Sunday 2:45 AM!
    // Normal real-world office operational replenishment
    ['2026-05-22 14:30:00', 'INV-2026-010', 'Office Operations', 'Replenishment of team stationary and folders', 1800, 'debit', 'Staples Business Depot'],
  ];

  for (const rowVal of data) {
    worksheet.addRow(rowVal);
  }

  // Adjust column widths for pretty printing
  worksheet.columns.forEach((col) => {
    let maxLen = 0;
    col.eachCell!((cell) => {
      const valLen = cell.value ? String(cell.value).length : 0;
      if (valLen > maxLen) maxLen = valLen;
    });
    col.width = Math.max(maxLen + 3, 12);
  });

  const inputDir = path.resolve(process.cwd(), 'data', 'input');
  if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
  }

  const destPath = path.join(inputDir, 'sample_ledger.xlsx');
  await workbook.xlsx.writeFile(destPath);
  logger.info({ destPath }, 'Sample accounting workbook generated successfully!');
}

// Automatically invoke on script direct run only (ignore on imports)
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('generate-sample.ts') ||
  process.argv[1].endsWith('generate-sample') ||
  process.argv[1].endsWith('generate-sample.js')
);

if (isDirectRun) {
  generateSampleExcel().catch((error) => {
    logger.error({ error }, 'Failed to generate sample Excel workbook');
  });
}
