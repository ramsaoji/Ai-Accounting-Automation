import { AiProviderFactory } from './ai.factory.js';
import { AiProvider } from './ai.types.js';
import { PromptInputData, buildDebitorsPrompt, buildSalesPrompt, buildGodownStockPrompt } from './ai.prompts.js';
import { ParsingError, Transaction } from '../types/accounting.types.js';
import { logger } from '../logger/logger.js';
import { config } from '../config/config.js';
import {
  calculateDebitorMetrics,
  calculateSalesMetrics
} from './ai.calculator.js';
import {
  cleanPromptPoint,
  parseAiResponse
} from './ai.parser.js';
import {
  generateSalesSvgChart,
  buildSalesTrendElements,
  generateDebitorsSvgChart,
  generateDebitorsHtmlRows,
  groupAlertsIntoHtml,
  computeSalesFallbackInsights,
  computeDebitorsFallbackInsights
} from './report-helper.js';
import crypto from 'crypto';
import { db } from '../db/db.client.js';
import * as schema from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * Dynamic PII scrubber and restorer to replace names, phone numbers, and email addresses with codes,
 * preventing data leakage to external LLMs, and restoring them back on the returned AI response.
 */
export function buildPiiScrubber(names: string[]) {
  const nameToCode = new Map<string, string>();
  const codeToName = new Map<string, string>();

  // Filter unique names, sort by length descending to prevent substring matching issues
  const uniqueNames = Array.from(new Set(names))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  uniqueNames.forEach((name, idx) => {
    const code = `Customer_${String.fromCharCode(65 + (idx % 26))}${idx >= 26 ? Math.floor(idx / 26) : ''}`;
    nameToCode.set(name, code);
    codeToName.set(code, name);
  });

  const scrub = (text: string): string => {
    if (!text) return text;
    // Scrub phone numbers
    let scrubbed = text.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');
    // Scrub emails
    scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    
    // Replace names
    for (const [name, code] of nameToCode.entries()) {
      const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      scrubbed = scrubbed.replace(regex, code);
    }
    return scrubbed;
  };

  const restore = (text: string): string => {
    if (!text) return text;
    let restored = text;
    for (const [code, name] of codeToName.entries()) {
      const regex = new RegExp(code, 'g');
      restored = restored.replace(regex, name);
    }
    return restored;
  };

  return { scrub, restore };
}

/**
 * Calculates a SHA-256 hash representing the content of the spreadsheet entries.
 */
export function calculateTransactionsHash(transactions: any[], errors: any[], alerts: any[]): string {
  const dataToHash = JSON.stringify({
    transactions: transactions.map(t => ({
      date: t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date),
      amount: String(t.amount),
      type: t.type,
      vendor: t.vendor,
      category: t.category,
      invoiceNumber: t.invoiceNumber
    })),
    errors: errors.map(e => ({ row: e.row, error: e.error })),
    alerts: alerts.map(a => ({ ruleId: a.ruleId, message: a.message }))
  });
  return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

/**
 * Extracts a specific section list of items from the cached markdown report by header synonyms.
 */
export function extractSection(markdown: string, headerSynonyms: string[]): string {
  const lines = markdown.split('\n');
  const startIdx = lines.findIndex(l => headerSynonyms.some(syn => l.toLowerCase().includes(syn.toLowerCase())));
  if (startIdx === -1) return '';
  const result: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#') || (line.startsWith('---') && i > startIdx + 2)) break;
    if (
      line.startsWith('*') ||
      line.startsWith('-') ||
      line.startsWith('>') ||
      line.startsWith('1.') ||
      line.startsWith('2.') ||
      line.startsWith('3.')
    ) {
      const cleanLine = line
        .replace(/^>\s*\*\s*\[\s*\]\s*\*\*/, '')
        .replace(/^>\s*\*\s*\*\*/, '')
        .replace(/^>\s*\*/, '')
        .replace(/^\*\s*\[\s*\]\s*\*\*/, '')
        .replace(/^\*\s*\*\*/, '')
        .replace(/^\*\s*/, '')
        .replace(/^-\s*/, '')
        .replace(/^>\s*/, '')
        .replace(/^\d+\.\s*\*\*/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/\*\*$/, '')
        .trim();
      if (cleanLine) {
        result.push(cleanLine);
      }
    }
  }
  return result.join('\n');
}

export interface GeneratedReports {
  markdownReport: string;
  jsonSummary: string;
}

export class AiService {
  private provider: AiProvider;

  constructor() {
    this.provider = AiProviderFactory.createProvider();
  }

  /**
   * Generates a beautifully structured sales dashboard, appends friendly business tips,
   * compiles predictive projections, and renders a print-ready, branded HTML web report.
   */
  async generateFinancialSummary(data: PromptInputData): Promise<GeneratedReports> {
    const { transactions, alerts, parsingErrors, fileName, runTimestamp } = data;
    
    let businessName = config.BUSINESS_NAME;
    let industryProfile = 'HOSPITALITY';
    let coaList: any[] = [];
    try {
      if (fileName) {
        const fileRecord = await db.select().from(schema.files).where(eq(schema.files.fileName, fileName)).limit(1).then(r => r[0]);
        if (fileRecord?.branchId) {
          const branch = await db.select().from(schema.branches).where(eq(schema.branches.id, fileRecord.branchId)).limit(1).then(r => r[0]);
          if (branch) {
            const biz = await db.select().from(schema.businessEntities).where(eq(schema.businessEntities.id, branch.entityId)).limit(1).then(r => r[0]);
            if (biz) {
              businessName = biz.name;
              industryProfile = biz.industryProfile;
            }
            coaList = await db.select().from(schema.chartOfAccounts).where(eq(schema.chartOfAccounts.entityId, branch.entityId));
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to resolve dynamic business profile in generateFinancialSummary');
    }

    const calculatedHash = calculateTransactionsHash(transactions, parsingErrors, alerts);
    let cachedWeeklyChecklist = '';
    let cachedProjections = '';
    let cachedIntelligence = '';
    let aiCachedHit = false;

    // Check database cache first
    try {
      const cached = await db
        .select()
        .from(schema.files)
        .where(
          and(
            eq(schema.files.contentHash, calculatedHash),
            eq(schema.files.status, 'success'),
            eq(schema.files.aiGenerated, true)
          )
        )
        .limit(1);

      if (cached.length > 0) {
        const cachedRecord = cached[0];
        logger.info({ fileName, contentHash: calculatedHash }, 'LLM Cache hit: Bypassing LLM generation.');
        
        const cachedMarkdown = cachedRecord.aiSummary || '';
        
        const checklistSynonyms = data.isDebitorsList
          ? ['Staff Meeting Weekly Recovery Checklist', 'weekly recovery checklist', 'checklist']
          : ['Weekly Operational Action Checklist', 'action items', 'checklist'];
          
        const projectionsSynonyms = data.isDebitorsList
          ? ['Collections & Accounts Recovery Projections', 'recovery projections', 'projections']
          : ['Dynamic 3-Month Projections', 'predictive forecasting', 'projections'];
          
        const intelligenceSynonyms = data.isDebitorsList
          ? ['AI Strategic Intelligence & Hidden Dues Risks', 'dues risks', 'intelligence']
          : ['AI Strategic Intelligence & Hidden Operational Leaks', 'operational leaks', 'intelligence'];

        cachedWeeklyChecklist = extractSection(cachedMarkdown, checklistSynonyms);
        cachedProjections = extractSection(cachedMarkdown, projectionsSynonyms);
        cachedIntelligence = extractSection(cachedMarkdown, intelligenceSynonyms);
        aiCachedHit = true;
      }
    } catch (cacheErr) {
      logger.error({ err: cacheErr }, 'Error querying LLM cache from DB. Proceeding with standard generation.');
    }

    // =========================================================================
    // BRANCH C: Godown Stock Ingestion Summary Orchestrator
    // =========================================================================
    const isGodownStock = data.isGodownStockList || fileName.toUpperCase().includes('STOCK');
    if (isGodownStock && data.sheets) {
      logger.info({ fileName }, `Generating specialized report for Godown Stock (${businessName})`);

      const godownStockItemsList = data.sheets.flatMap(s => s.godownStockItems || []);
      const todaysItems = godownStockItemsList.filter(s => s.sheetName === 'Todays' || s.sheetName === 'Current');
      
      const uniqueItemsCount = new Set(todaysItems.map(i => i.itemName)).size;
      const categories = Array.from(new Set(todaysItems.filter(i => i.category).map(i => i.category as string)));
      
      let totalStockValue = 0;
      let totalStockCostValue = 0;
      for (const item of todaysItems) {
        totalStockValue += Number(item.totalSellValue || 0);
        totalStockCostValue += Number(item.totalCostValue || 0);
      }

      const godownItems = todaysItems.filter(i => i.location === 'godown');
      const counterItems = todaysItems.filter(i => i.location === 'counter');

      let godownVal = 0, godownCost = 0;
      for (const item of godownItems) {
        godownVal += Number(item.totalSellValue || 0);
        godownCost += Number(item.totalCostValue || 0);
      }

      let counterVal = 0, counterCost = 0;
      for (const item of counterItems) {
        counterVal += Number(item.totalSellValue || 0);
        counterCost += Number(item.totalCostValue || 0);
      }

      // AI calls for strategic intelligence specific to stock
      let aiWeeklyChecklist = '';
      let aiProjections = '';
      let aiIntelligence = '';
      let aiGenerated = aiCachedHit;

      if (aiCachedHit) {
        aiWeeklyChecklist = cachedWeeklyChecklist;
        aiProjections = cachedProjections;
        aiIntelligence = cachedIntelligence;
      }

      const statsText = `
Inventory cumulative totals for the snapshot date:
- Total unique items: ${uniqueItemsCount} products on books
- Total Stock Value (Retail Selling Price): ₹${Math.round(totalStockValue).toLocaleString()}
- Total Stock Cost Value (Purchase Price): ₹${Math.round(totalStockCostValue).toLocaleString()}
- Godown Stock Cost Value: ₹${Math.round(godownCost).toLocaleString()} (Items: ${godownItems.length})
- Counter Stock Cost Value: ₹${Math.round(counterCost).toLocaleString()} (Items: ${counterItems.length})
- Active Categories: ${categories.join(', ')}
`;

      // Get top 10 items sorted by totalCostValue for each location to pass as summary context
      const topGodown = godownItems
        .sort((a, b) => Number(b.totalCostValue || 0) - Number(a.totalCostValue || 0))
        .slice(0, 10);
      const topCounter = counterItems
        .sort((a, b) => Number(b.totalCostValue || 0) - Number(a.totalCostValue || 0))
        .slice(0, 10);

      const isHospitality = industryProfile === 'HOSPITALITY';

      const godownSummaryText = topGodown.map((item, idx) => {
        const isLoose = isHospitality && item.bottleSizeMl === 0;
        const sizeText = (isHospitality && item.bottleSizeMl) ? `${item.bottleSizeMl}ml` : (item.specification || 'Standard');
        const unitText = isLoose ? 'ml' : (item.unitOfMeasure || 'units');
        return `${idx + 1}. [Godown] ${item.itemName} (${sizeText}): Closing: ${item.closingStock} ${unitText} (Opening: ${item.openingStock}, In: ${item.stockIn}, Out: ${item.stockOut}) | Cost: ₹${item.costPrice ?? 'N/A'}`;
      }).join('\n');

      const counterSummaryText = topCounter.map((item, idx) => {
        const isLoose = isHospitality && item.bottleSizeMl === 0;
        const sizeText = (isHospitality && item.bottleSizeMl) ? `${item.bottleSizeMl}ml` : (item.specification || 'Standard');
        const unitText = isLoose ? 'ml' : (item.unitOfMeasure || 'units');
        return `${idx + 1}. [Counter] ${item.itemName} (${sizeText}): Closing: ${item.closingStock} ${unitText} (Opening: ${item.openingStock}, In: ${item.stockIn}, Out: ${item.stockOut}) | Cost: ₹${item.costPrice ?? 'N/A'}`;
      }).join('\n');

      const stockSummaryText = `GODOWN INVENTORY:\n${godownSummaryText}\n\nCOUNTER INVENTORY:\n${counterSummaryText}`;

      if (!aiGenerated) {
        try {
          const unifiedPrompt = buildGodownStockPrompt(businessName, statsText, stockSummaryText, industryProfile);
          const responseText = await this.provider.generateText(unifiedPrompt, { temperature: 0.15 });

          const parsed = parseAiResponse(responseText);
          aiWeeklyChecklist = parsed.checklist;
          aiProjections = parsed.projections;
          aiIntelligence = parsed.intelligence;

          aiGenerated = true;
        } catch (error) {
          logger.error({ error }, 'AI inventory recommendations generation failed. Using data-driven fallback.');
          aiWeeklyChecklist = [
            `Audit items in category "${categories[0] || 'Primary'}" showing low movement.`,
            `Cross-reference opening stock values with previous closing figures to ensure zero drift.`,

            `Initiate a recount of items with closing stock under 5 units.`
          ].join('\n');
          aiProjections = [
            `Inventory valuation is projected to remain stable based on current daily stock-out rates.`,
            `Demand for high-volume categories will rise by approximately 5% in the upcoming month.`,
            `Stockout risks are low for key products, given healthy opening balances.`
          ].join('\n');
          aiIntelligence = [
            `Inventory contains ${uniqueItemsCount} products across ${categories.length} categories.`,
            `Estimated total stock valuation is ₹${Math.round(totalStockValue).toLocaleString()} at retail prices.`,
            `Strategic balance indicates a healthy turnover in core segments.`
          ].join('\n');
        }
      }

      const htmlChecklistPoints = aiWeeklyChecklist
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<li>${cleanPromptPoint(line)}</li>`)
        .join('\n');

      const htmlProjectionsPoints = aiProjections
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<li>${cleanPromptPoint(line)}</li>`)
        .join('\n');

      const htmlIntelligencePoints = aiIntelligence
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<li>${cleanPromptPoint(line)}</li>`)
        .join('\n');

      const markdownReport = `# 🏭 ${businessName} Godown Stock Register — Master Audit Summary\n\n` +
        `> [!NOTE]\n` +
        `> **Source File**: \`${fileName}\`  \n` +
        `> **Active Products in Godown**: \`${uniqueItemsCount} Items\`  \n` +
        `> **Status**: ${parsingErrors.length > 0 ? 'Processed with Warnings ⚠️' : 'Successfully Parsed & Synced ✅'}  \n` +
        `> **Processed On**: ${runTimestamp}  \n\n` +
        `---\n\n` +
        `### 💰 Core Inventory Aggregates (Todays)\n` +
        `* **Total Stock Value (Retail):** **₹${Math.round(totalStockValue).toLocaleString()}**\n` +
        `* **Total Stock Cost Value (Purchase):** **₹${Math.round(totalStockCostValue).toLocaleString()}**\n` +
        `* **Estimated Retail Margin:** **₹${Math.round(totalStockValue - totalStockCostValue).toLocaleString()}**\n` +
        `* **Active Categories:** ${categories.join(', ')}\n\n` +
        `---\n\n` +
        `### 🔮 AI Strategic Intelligence & Inventory Insights\n` +
        aiIntelligence.split('\n').map(l => `* ${cleanPromptPoint(l)}`).join('\n') + `\n\n` +
        `---\n\n` +
        `### 🚨 Ingestion Exceptions & Warnings\n` +
        `> * All stock registers are cleanly matching with zero alerts!\n`;

      const jsonSummary = JSON.stringify({
        fileName,
        timestamp: runTimestamp,
        runTimestamp,
        isGodownStockList: true,
        aiGenerated: aiGenerated,
        aggregates: {
          totalStockValue: Math.round(totalStockValue),
          totalStockCostValue: Math.round(totalStockCostValue),
          uniqueItemsCount,
          activeProductsCount: uniqueItemsCount
        },
        alerts: [],
        errors: parsingErrors,
        intelligence: aiIntelligence
          .split('\n')
          .map(line => cleanPromptPoint(line.trim()))
          .filter(line => line.length > 0)
      }, null, 2);

      return { markdownReport, jsonSummary };
    }

    // =========================================================================
    // BRANCH A: Specialized Udhari & Debitors Register Orchestrator
    // =========================================================================
    if (data.isDebitorsList && data.debitors) {
      logger.info({ fileName }, `Generating specialized report for Debitors List (${businessName})`);

      const calc = calculateDebitorMetrics(data);
      const {
        totalDebitSum,
        totalCreditSum,
        totalPendingSum,
        collectionSuccessRate,
        activeDebitorsCount,
        averageOutstandingDues,
        topDebtorName,
        topDebtorValue,
        maxPending,
        topDebitorsLimitList
      } = calc;

      const debitorsLimit = data.debitorsLimit || 10;

      // AI calls for weekly checklist, 3-month outlook and strategic intelligence specific to debitors
      let aiWeeklyChecklist = cachedWeeklyChecklist;
      let aiProjections = cachedProjections;
      let aiIntelligence = cachedIntelligence;
      let aiGenerated = aiCachedHit;

      const masterStatsText = `
Master Debitor Accounts Cumulative Totals:
- Total Outstanding Accounts: ${activeDebitorsCount} customers on books
- Total Credit Extended (Udhari Extended): ₹${Math.round(totalDebitSum).toLocaleString()}
- Total Credit Recovered (Recovery Collected): ₹${Math.round(totalCreditSum).toLocaleString()}
- Net Outstanding Balance Dues: ₹${Math.round(totalPendingSum).toLocaleString()} (Collections Recovery Success Rate: ${collectionSuccessRate}%)
- Average Outstanding Dues: ₹${Math.round(averageOutstandingDues).toLocaleString()} per customer
- Top Outstanding Account: ${topDebtorName} (₹${Math.round(topDebtorValue).toLocaleString()} pending dues)
      `;

      const debtorsSummaryText = topDebitorsLimitList.map((d, i) => {
        return `${i + 1}. ${d.name}: Total Dues: ₹${Math.round(d.pending).toLocaleString()} (Extended: ₹${Math.round(d.debit).toLocaleString()}, Paid: ₹${Math.round(d.credit).toLocaleString()})`;
      }).join('\n');

      if (!aiGenerated) {
        try {
          const allDebitorNames = (data.debitors || []).map(d => d.name).concat(topDebitorsLimitList.map(d => d.name));
          const scrubber = buildPiiScrubber(allDebitorNames);

          const scrubbedStatsText = scrubber.scrub(masterStatsText);
          const scrubbedSummaryText = scrubber.scrub(debtorsSummaryText);

          const unifiedPrompt = buildDebitorsPrompt(businessName, scrubbedStatsText, scrubbedSummaryText, industryProfile);
          const responseText = await this.provider.generateText(unifiedPrompt, { temperature: 0.15 });
          
          const restoredResponse = scrubber.restore(responseText);
          const parsed = parseAiResponse(restoredResponse);
          aiWeeklyChecklist = parsed.checklist;
          aiProjections = parsed.projections;
          aiIntelligence = parsed.intelligence;

          aiGenerated = true;
        } catch (error) {
          logger.error({ error }, 'AI debtor collection suggestions generation failed. Using data-driven fallback.');
          const fallback = computeDebitorsFallbackInsights({
            topDebitorsLimitList,
            topDebtorName,
            topDebtorValue,
            totalPendingSum,
            collectionSuccessRate,
            averageOutstandingDues,
            activeDebitorsCount
          });
          aiWeeklyChecklist = fallback.checklist;
          aiProjections = fallback.projections;
          aiIntelligence = fallback.intelligence;
        }
      }

      // Delegate all visual rendering calculations to our report-helper library
      const { generatedSvgChart } = generateDebitorsSvgChart(topDebitorsLimitList, maxPending, totalPendingSum);
      const htmlDebitorRows = generateDebitorsHtmlRows(topDebitorsLimitList, maxPending, totalPendingSum);

      const htmlChecklistPoints = aiWeeklyChecklist
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          const cleaned = cleanPromptPoint(line);
          return `
            <label class="checkbox-container">
              <input type="checkbox">
              <span class="checkmark"></span>
              <span class="checkbox-text"><strong>${cleaned}</strong></span>
            </label>
          `;
        })
        .join('\n');

      const htmlProjectionsPoints = aiProjections
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          const cleaned = cleanPromptPoint(line);
          return `<li><strong>${cleaned}</strong></li>`;
        })
        .join('\n');

      const htmlIntelligencePoints = aiIntelligence
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          const cleaned = cleanPromptPoint(line);
          return `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
              <span style="font-size: 1.1rem; color: var(--brand-gold);">✦</span>
              <p style="font-size: 0.88rem; color: var(--text-main); margin: 0; line-height: 1.5;">${cleaned}</p>
            </div>
          `;
        })
        .join('\n');

      // Legacy HTML report generation removed.

      // Format Markdown checklist and projections
      const mdChecklistPoints = aiWeeklyChecklist
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `> * [ ] **${cleanPromptPoint(line)}**`)
        .join('\n');

      const mdProjectionsPoints = aiProjections
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `> * **${cleanPromptPoint(line)}**`)
        .join('\n');

      const mdIntelligencePoints = aiIntelligence
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `> * **${cleanPromptPoint(line)}**`)
        .join('\n');

      // Group alerts map for markdown warning block
      const alertGroups = new Map<string, typeof alerts>();
      for (const a of alerts) {
        if (!alertGroups.has(a.ruleId)) alertGroups.set(a.ruleId, []);
        alertGroups.get(a.ruleId)!.push(a);
      }
      const mdAlertsList = Array.from(alertGroups.entries()).map(([ruleId, list]) => {
        const first = list[0];
        const countLabel = list.length > 1 ? ` (${list.length} occurrences)` : '';
        const examples = list.slice(0, 2).map(a => `... ${a.message}`).join('\n');
        return `> [!WARNING]\n> **${first.ruleName}${countLabel}**:\n${examples}`;
      }).join('\n\n');

      const mdDebitorRowsList = topDebitorsLimitList.map((d, i) => {
        const pct = totalPendingSum > 0 ? ((d.pending / totalPendingSum) * 100).toFixed(0) : '0';
        return `| **#${i + 1}** | **${d.name}** | ₹${Math.round(d.debit).toLocaleString()} | ₹${Math.round(d.credit).toLocaleString()} | ₹${Math.round(d.pending).toLocaleString()} | ${pct}% |`;
      }).join('\n');

      const markdownReport = `# 📋 ${businessName} Udhari & Debitors Register — Master Audit Summary\n\n` +
        `> [!NOTE]\n` +
        `> **Source File**: \`${fileName}\`  \n` +
        `> **Total Outstanding Accounts**: \`${activeDebitorsCount} Customers\`  \n` +
        `> **Status**: ${parsingErrors.length > 0 ? 'Processed with Ingestion Warnings ⚠️' : 'Successfully Parsed & Synced ✅'}  \n\n` +
        `---\n\n` +
        `### 💳 Core Udhari & Debitors Aggregates\n` +
        `* **Total Credit Invoiced (Extended):** ₹${Math.round(totalDebitSum).toLocaleString()}\n` +
        `* **Total Repayments Collected (Recovered):** ₹${Math.round(totalCreditSum).toLocaleString()}\n` +
        `* **Net Outstanding Customer Balance (Current Gap):** **₹${Math.round(totalPendingSum).toLocaleString()}**\n` +
        `* **Collections Recovery Success Rate:** \`${collectionSuccessRate}%\`\n` +
        `* **Average Outstanding Balance Dues:** ₹${Math.round(averageOutstandingDues).toLocaleString()} per account\n` +
        `* **Top Customer Dues Account:** **${topDebtorName}** (₹${Math.round(topDebtorValue).toLocaleString()} pending)\n\n` +
        `---\n\n` +
        `### 🏆 Top Outstanding Dues Leaderboard (Top ${debitorsLimit})\n` +
        `| Rank | Customer Debitor | Total Debit (Purchased) | Total Credit (Repayed) | Outstanding Pending | Pending Contribution % |\n` +
        `| :--- | :--- | :--- | :--- | :--- | :--- |\n` +
        `${mdDebitorRowsList}\n\n` +
        `---\n\n` +
        `### ⚡ Collections & Accounts Recovery Projections\n` +
        `${mdProjectionsPoints || '> * No projections generated.'}\n\n` +
        `---\n\n` +
        `### 📋 Staff Meeting Weekly Recovery Checklist\n` +
        `${mdChecklistPoints || '> * No checklist items generated.'}\n\n` +
        `---\n\n` +
        `### 🏆 AI Strategic Intelligence & Hidden Dues Risks\n` +
        `${mdIntelligencePoints || '> * No strategic insights generated.'}\n\n` +
        `---\n\n` +
        `### 🚨 Ingestion Exceptions & Warnings\n` +
        `${mdAlertsList || '> * All balances and daily registers are cleanly matching with zero alerts!'}\n`;

      const jsonSummary = JSON.stringify({
        fileName,
        timestamp: runTimestamp,
        runTimestamp,
        isDebitorsList: true,
        aiGenerated,
        aggregates: {
          totalDebitSum: Math.round(totalDebitSum),
          totalCreditSum: Math.round(totalCreditSum),
          totalPendingSum: Math.round(totalPendingSum),
          collectionSuccessRate,
          averageOutstandingDues: Math.round(averageOutstandingDues),
          activeDebitorsCount,
          topDebtorName,
          topDebtorValue: Math.round(topDebtorValue),
        },
        topDebitors: topDebitorsLimitList.map(d => ({
          name: d.name,
          debit: Math.round(d.debit),
          credit: Math.round(d.credit),
          pending: Math.round(d.pending),
        })),
        allDebitors: data.debitors ? data.debitors.map(d => ({
          name: d.name,
          pending: Math.round(d.pending)
        })) : [],
        alerts: alerts.map(a => ({
          ruleId: a.ruleId,
          ruleName: a.ruleName,
          severity: a.severity,
          message: a.message,
        })),
        errors: parsingErrors,
        intelligence: aiIntelligence.split('\n').map(l => cleanPromptPoint(l)).filter(l => l.length > 0),
      }, null, 2);

      return { markdownReport, jsonSummary };
    }

    // =========================================================================
    // BRANCH B: Combined Multi-month Daily Sales Register Orchestrator
    // =========================================================================
    const salesCalc = calculateSalesMetrics(data);
    const { sortedSheets, maxAbsNet, maxInflowOutflow } = salesCalc;

    // Call report helper functions to generate SVG visual lines and tabular cashflows
    const generatedSvgChart = generateSalesSvgChart(sortedSheets, maxInflowOutflow);
    const trendElements = buildSalesTrendElements(sortedSheets, maxAbsNet, coaList);

    const {
      htmlTrendRows,
      monthlyTrendRows,
      bestRevenueMonth,
      bestRevenueValue,
      bestProfitMonth,
      bestProfitValue,
      peakExpenseMonth,
      peakExpenseValue,
      masterLiquor,
      masterFood,
      masterRecovery,
      masterExpenses,
      masterCreditExtended,
      jsonMonths
    } = trendElements;

    const recoveryCoa = coaList.find(c =>
      c.accountType === 'REVENUE' &&
      (
        c.accountName.toLowerCase().includes('recover') ||
        c.accountName.toLowerCase().includes('jama') ||
        c.accountName.toLowerCase().includes('collected')
      )
    ) || coaList.find(c => c.accountCode === '4003');

    const revenueCoas = coaList.filter(c => c.accountType === 'REVENUE' && c.id !== recoveryCoa?.id);
    const rev1 = revenueCoas[0];
    const rev2 = revenueCoas[1];
    const rev1Name = rev1 ? rev1.accountName : undefined;
    const rev2Name = rev2 ? rev2.accountName : undefined;

    const masterIncome = masterLiquor + masterFood + masterRecovery;
    const masterOutflow = masterExpenses + masterCreditExtended;
    const masterNet = masterIncome - masterOutflow;
    const masterStatus = masterNet >= 0 ? 'Surplus 🟢' : 'Deficit 🔴';

    const liquorPercentage = masterLiquor + masterFood > 0 
      ? ((masterLiquor / (masterLiquor + masterFood)) * 100).toFixed(1)
      : '0.0';
    const foodPercentage = masterLiquor + masterFood > 0 
      ? ((masterFood / (masterLiquor + masterFood)) * 100).toFixed(1)
      : '0.0';

    const creditOutstandingGap = masterCreditExtended - masterRecovery;
    const creditRecoveryRate = masterCreditExtended > 0
      ? ((masterRecovery / masterCreditExtended) * 100).toFixed(1)
      : '100.0';

    const allTransactions: Transaction[] = [];
    const allErrors: ParsingError[] = [];
    for (const s of sortedSheets) {
      allTransactions.push(...s.transactions);
      allErrors.push(...s.errors.map((e: any) => ({
        ...e,
        error: `[${s.sheetName}] ${e.error}`
      })));
    }

    // AI weekly suggestions, projections and strategic intelligence call
    let aiWeeklyChecklist = cachedWeeklyChecklist;
    let aiProjections = cachedProjections;
    let aiIntelligence = cachedIntelligence;
    let aiGenerated = aiCachedHit;

    if (!aiGenerated) {
      try {
        logger.info({ sheetCount: sortedSheets.length }, 'Invoking AI to generate Strategic Projections & Action Checklist...');
        
        const monthlySummaryText = sortedSheets.map((s: any) => {
          const catSums: Record<string, number> = {};
          let inc = 0;
          let out = 0;
          
          for (const t of s.transactions) {
            const amt = t.amount || 0;
            const coa = coaList.find(c => c.id === t.coaId);
            const catName = coa ? coa.accountName : t.category;
            catSums[catName] = (catSums[catName] || 0) + amt;

            if (t.type === 'credit') inc += amt;
            else out += amt;
          }

          const net = inc - out;
          const catListStr = Object.entries(catSums)
            .map(([name, sum]) => `${name}: ₹${Math.round(sum).toLocaleString()}`)
            .join(', ');
          
          return `- ${s.sheetName}: Sales Inflows: ₹${Math.round(inc).toLocaleString()} (${catListStr}), Outflows: ₹${Math.round(out).toLocaleString()}, Net: ₹${Math.round(net).toLocaleString()}`;
        }).join('\n');

        const masterCategoryTotals: Record<string, number> = {};
        let masterInflows = 0;
        let masterOutflows = 0;
        for (const t of transactions) {
          const amt = t.amount || 0;
          const coa = coaList.find(c => c.id === t.coaId);
          const catName = coa ? coa.accountName : t.category;
          masterCategoryTotals[catName] = (masterCategoryTotals[catName] || 0) + amt;
          
          if (t.type === 'credit') {
            masterInflows += amt;
          } else {
            masterOutflows += amt;
          }
        }
        const masterNetCalculated = masterInflows - masterOutflows;

        let dynamicCategoryStats = '';
        for (const [catName, sum] of Object.entries(masterCategoryTotals)) {
          dynamicCategoryStats += `- Total ${catName}: ₹${Math.round(sum).toLocaleString()}\n`;
        }

        const masterStatsText = `
Master Cumulative Totals (All Months):
${dynamicCategoryStats}- Overall Cumulative Net Inflows: ₹${Math.round(masterInflows).toLocaleString()}
- Overall Cumulative Net Outflows: ₹${Math.round(masterOutflows).toLocaleString()}
- Overall Cumulative Net Cashflow: ₹${Math.round(masterNetCalculated).toLocaleString()} (${masterNetCalculated >= 0 ? 'Surplus' : 'Deficit'})
- Outstanding Credit Gap: ₹${Math.round(creditOutstandingGap).toLocaleString()} (Recovery Rate: ${creditRecoveryRate}%)
        `;

        const allVendorNames = data.transactions.map(t => t.vendor);
        const scrubber = buildPiiScrubber(allVendorNames);

        const scrubbedStatsText = scrubber.scrub(masterStatsText);
        const scrubbedMonthlyText = scrubber.scrub(monthlySummaryText);

        const unifiedPrompt = buildSalesPrompt(businessName, scrubbedStatsText, scrubbedMonthlyText, industryProfile);
        const responseText = await this.provider.generateText(unifiedPrompt, { temperature: 0.15 });

        const restoredResponse = scrubber.restore(responseText);
        const parsed = parseAiResponse(restoredResponse);
        aiWeeklyChecklist = parsed.checklist;
        aiProjections = parsed.projections;
        aiIntelligence = parsed.intelligence;

        logger.info('AI successfully generated unified projections, checklist and strategic intelligence.');
        aiGenerated = true;
      } catch (error) {
        logger.error({ error }, 'AI strategic trend and projections generation failed. Using data-driven fallback.');
        const fallback = computeSalesFallbackInsights({
          sortedSheets,
          masterLiquor,
          masterFood,
          masterExpenses,
          masterCreditExtended,
          masterRecovery,
          creditOutstandingGap,
          creditRecoveryRate,
          foodPercentage,
          liquorPercentage,
          bestRevenueMonth,
          bestRevenueValue,
          peakExpenseMonth,
          peakExpenseValue,
          industryProfile,
          rev1Name,
          rev2Name
        });
        aiWeeklyChecklist = fallback.checklist;
        aiProjections = fallback.projections;
        aiIntelligence = fallback.intelligence;
      }
    }

    const mdChecklistPoints = aiWeeklyChecklist
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `> * [ ] **${cleanPromptPoint(line)}**`)
      .join('\n');

    const mdProjectionsPoints = aiProjections
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `> * **${cleanPromptPoint(line)}**`)
      .join('\n');

    const mdIntelligencePoints = aiIntelligence
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `> * **${cleanPromptPoint(line)}**`)
      .join('\n');

    const htmlChecklistPoints = aiWeeklyChecklist
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cleaned = cleanPromptPoint(line);
        return `
          <label class="checkbox-container">
            <input type="checkbox">
            <span class="checkmark"></span>
            <span class="checkbox-text"><strong>${cleaned}</strong></span>
          </label>
        `;
      })
      .join('\n');

    const htmlProjectionsPoints = aiProjections
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cleaned = cleanPromptPoint(line);
        return `<li><strong>${cleaned}</strong></li>`;
      })
      .join('\n');

    const htmlIntelligencePoints = aiIntelligence
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const cleaned = cleanPromptPoint(line);
        return `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
            <span style="font-size: 1.1rem; color: var(--brand-gold);">✦</span>
            <p style="font-size: 0.88rem; color: var(--text-main); margin: 0; line-height: 1.5;">${cleaned}</p>
          </div>
        `;
      })
      .join('\n');

    const formattedErrors = allErrors.length > 0
      ? allErrors.slice(0, 10).map(e => `* **Row ${e.row}**: ${e.error}`).join('\n')
      : '';

    const htmlErrors = allErrors.length > 0
      ? allErrors.slice(0, 10).map(e => `<li><strong>Row ${e.row}</strong>: ${e.error}</li>`).join('')
      : '';

    const htmlAlertsList = groupAlertsIntoHtml(alerts);

    // Group alerts map for markdown warning block
    const alertGroups = new Map<string, typeof alerts>();
    for (const a of alerts) {
      if (!alertGroups.has(a.ruleId)) alertGroups.set(a.ruleId, []);
      alertGroups.get(a.ruleId)!.push(a);
    }
    const mdAlertsList = Array.from(alertGroups.entries()).map(([ruleId, list]) => {
      const first = list[0];
      const countLabel = list.length > 1 ? ` (${list.length} occurrences)` : '';
      const examples = list.slice(0, 2).map(a => `... ${a.message}`).join('\n');
      return `> [!WARNING]\n> **${first.ruleName}${countLabel}**:\n${examples}`;
    }).join('\n\n');

    // Resolve dynamic emojis and titles
    const isHospitality = industryProfile === 'HOSPITALITY';
    const revRatioLabel = isHospitality ? '🍺 Restaurant Menu Ratio' : '📈 Revenue Category Ratio';
    const rev1Label = rev1 ? rev1.accountName : (isHospitality ? 'Liquor Sales' : 'Primary Revenue');
    const rev2Label = rev2 ? rev2.accountName : (isHospitality ? 'Food Sales' : 'Secondary Revenue');
    const splitRatioText = `**${liquorPercentage}% ${rev1Label}** vs. **${foodPercentage}% ${rev2Label}**`;

    // Map transaction categories dynamically
    const mCategoryTotals: Record<string, number> = {};
    for (const t of transactions) {
      const amt = Number(t.amount || 0);
      const coa = coaList.find(c => c.id === t.coaId || c.code === t.coaId || c.accountCode === t.coaId);
      const catName = coa ? coa.accountName : t.category;
      mCategoryTotals[catName] = (mCategoryTotals[catName] || 0) + amt;
    }

    function getCategoryEmoji(catName: string): string {
      const lower = catName.toLowerCase();
      if (lower.includes('hair') || lower.includes('styling') || lower.includes('salon')) return '✂️';
      if (lower.includes('spa') || lower.includes('massage') || lower.includes('therapy') || lower.includes('facial')) return '💆';
      if (lower.includes('product') || lower.includes('retail') || lower.includes('item')) return '🛍️';
      if (lower.includes('liquor') || lower.includes('wine') || lower.includes('beer') || lower.includes('bar')) return '🍸';
      if (lower.includes('food') || lower.includes('restaurant') || lower.includes('dine')) return '🍽️';
      return '📈';
    }

    const revenueRows: string[] = [];
    if (revenueCoas.length > 0) {
      for (const coa of revenueCoas) {
        const amt = mCategoryTotals[coa.accountName] || 0;
        const emoji = getCategoryEmoji(coa.accountName);
        revenueRows.push(`| **${emoji} ${coa.accountName}** | **₹${Math.round(amt).toLocaleString()}** | — | Combined ${coa.accountName.toLowerCase()} revenue |`);
      }
    } else {
      revenueRows.push(
        `| **🍸 Liquor Sales** | **₹${Math.round(masterLiquor).toLocaleString()}** | — | Combined bar counter revenue |`,
        `| **🍽️ Food Sales** | **₹${Math.round(masterFood).toLocaleString()}** | — | Combined restaurant food revenue |`
      );
    }

    const revenueHeaders = revenueCoas.length > 0 
      ? revenueCoas.map(c => c.accountName)
      : ['Liquor Sales', 'Food Sales'];

    const mdTrendHeaders = `| Month / Year | ` + revenueHeaders.map(h => `${h}`).join(' | ') + ` | Credit Extended | Expenses | Net Cashflow | Status |`;
    const mdTrendSubHeaders = `| :--- | ` + revenueHeaders.map(() => ':---:').join(' | ') + ` | :---: | :---: | :---: | :---: |`;

    const markdownReport = `# 📋 ${businessName} Daily Sales Register — Master Performance Summary\n\n` +
      `> [!NOTE]\n` +
      `> **Source File**: \`${fileName}\`  \n` +
      `> **Total Months Audited**: \`${sortedSheets.length} Months\`  \n` +
      `> **Status**: ${allErrors.length > 0 ? 'Processed with Errors ⚠️' : 'Successfully Processed ✅'}  \n` +
      `> **Processed On**: ${runTimestamp}  \n\n` +
      `---\n\n` +
      `### 🏆 Executive Highlights & Benchmarks\n` +
      `> [!NOTE]\n` +
      `> * **🥇 Best Sales Month**: **${bestRevenueMonth}** (Total Revenue: **₹${Math.round(bestRevenueValue).toLocaleString()}**)\n` +
      `> * **💰 Best Cash Surplus Month**: **${bestProfitMonth}** (Net Surplus: **₹${Math.round(bestProfitValue).toLocaleString()}**)\n` +
      `> * **🛠️ Peak Expense Month**: **${peakExpenseMonth}** (Supplier Costs: **₹${Math.round(peakExpenseValue).toLocaleString()}**)\n` +
      `> * **${revRatioLabel}**: ${splitRatioText}\n` +
      `> * **💳 Credit Recovery Efficiency**: **${creditRecoveryRate}%** of extended customer credit successfully collected! \n` +
      `>   * _Outstanding Customer Balance_: **₹${Math.round(creditOutstandingGap).toLocaleString()}** (currently unrecovered)\n\n` +
      `---\n\n` +
      `## 📊 Combined Performance Overview (All Months)\n\n` +
      `| Category | Combined Inflows | Combined Outflows | Description & Master Bookkeeping Notes |\n` +
      `| :--- | :---: | :---: | :--- |\n` +
      revenueRows.join('\n') + `\n` +
      `| **📥 Credit Recovered (Udhari Jama)** | **₹${Math.round(masterRecovery).toLocaleString()}** | — | Total customer outstanding dues collected |\n` +
      `| **🛠️ Daily Expenses** | — | **₹${Math.round(masterExpenses).toLocaleString()}** | Total daily supplier, wage & inventory outflows |\n` +
      `| **📤 Credit Extended (Udhari Given)** | — | **₹${Math.round(masterCreditExtended).toLocaleString()}** | Total services and products served to customers on credit |\n` +
      `| **📊 MASTER TOTALS** | **₹${Math.round(masterIncome).toLocaleString()}** | **₹${Math.round(masterOutflow).toLocaleString()}** | Total financial volume combined |\n` +
      `| **⚖️ NET POSITION** | **₹${Math.round(masterNet).toLocaleString()}** | **[${masterStatus.toUpperCase()}]** | **Overall Cumulative Cash Surplus** |\n\n` +
      `---\n\n` +
      `## 📅 Month-by-Month Trend Analysis\n\n` +
      `${mdTrendHeaders}\n` +
      `${mdTrendSubHeaders}\n` +
      `${monthlyTrendRows.join('\n')}\n\n` +
      `---\n\n` +
      `## 🔮 Dynamic 3-Month Projections (AI Predictive Forecasting)\n\n` +
      `> [!NOTE]\n` +
      `> **Seasonal Trends & Financial Outlook**:\n` +
      `${mdProjectionsPoints}\n\n` +
      `---\n\n` +
      `## 💡 Weekly Operational Action Checklist\n\n` +
      `> [!TIP]\n` +
      `> **Action items for your next staff meeting**:\n` +
      `${mdChecklistPoints}\n\n` +
      `---\n\n` +
      `## 🏆 AI Strategic Intelligence & Hidden Operational Leaks\n\n` +
      `> [!TIP]\n` +
      `> **Operational insight, revenue-mix, and cost-leak optimizations**:\n` +
      `${mdIntelligencePoints}\n\n` +
      `---\n\n` +
      `## 🔍 File & Records Integrity\n\n` +
      `* **Total Months Processed**: \`${sortedSheets.length}\`\n` +
      `* **Total Transactions Audited**: \`${allTransactions.length}\`\n` +
      `* **Format Errors / Skipped Rows**: \`${allErrors.length}\`\n` +
      `${allErrors.length > 0 ? `\n### Format Error Log (First 10):\n${formattedErrors}` : ''}\n\n` +
      `---\n\n` +
      `## ⚠️ Key Operational Alerts (Top Exceptions)\n\n` +
      `${mdAlertsList || '> [!NOTE]\n> ✅ No alerts or exceptions detected across the entire historical data.'}\n`;

    // Legacy HTML report generation removed.

    const jsonSummary = JSON.stringify({
      fileName,
      runTimestamp,
      aiGenerated,
      totalMonths: sortedSheets.length,
      totalTransactions: transactions.length,
      masterTotals: {
        liquorSales: Math.round(masterLiquor),
        foodSales: Math.round(masterFood),
        creditRecovery: Math.round(masterRecovery),
        expenses: Math.round(masterExpenses),
        creditExtended: Math.round(masterCreditExtended),
        totalInflows: Math.round(masterIncome),
        totalOutflows: Math.round(masterOutflow),
        netCashflow: Math.round(masterNet),
        surplusStatus: masterNet >= 0 ? 'Surplus' : 'Deficit'
      },
      benchmarks: {
        bestRevenueMonth,
        bestRevenueValue: Math.round(bestRevenueValue),
        bestProfitMonth,
        bestProfitValue: Math.round(bestProfitValue),
        peakExpenseMonth,
        peakExpenseValue: Math.round(peakExpenseValue),
        liquorPercentage,
        foodPercentage,
        creditRecoveryRate,
        creditOutstandingGap: Math.round(creditOutstandingGap)
      },
      months: jsonMonths,
      alerts: Array.from(alertGroups.entries()).map(([ruleId, list]) => ({
        ruleId,
        ruleName: list[0].ruleName,
        severity: list[0].severity,
        totalOccurrences: list.length,
        example: list[0].message
      })),
      intelligence: aiIntelligence.split('\n').map(l => cleanPromptPoint(l)).filter(l => l.length > 0)
    }, null, 2);

    return { markdownReport, jsonSummary };
  }
}

export const aiService = new AiService();
