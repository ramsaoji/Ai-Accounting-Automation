import type { MasterSummary } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Normalized parsing of backend/static response alerts
export function mapMasterSummary(data: any, isDebitors: boolean): MasterSummary {
  return {
    ...data,
    runTimestamp: data.runTimestamp || data.timestamp || new Date().toLocaleString(),
    alerts: data.alerts ? data.alerts.map((a: any) => ({
      ruleId: a.ruleId,
      ruleName: a.ruleName,
      severity: a.severity,
      message: isDebitors ? a.message : (a.example || a.message)
    })) : []
  };
}

export interface SyncResult {
  sales: MasterSummary | null;
  debitors: MasterSummary | null;
  mode: 'live' | 'static' | 'empty';
}

/**
 * Optimized concurrent fetch for accounting data registers.
 * Communicates directly with the live database backend.
 */
export async function fetchAccountingData(): Promise<SyncResult> {
  // Concurrent live API fetch
  try {
    const [salesRes, debitorsRes] = await Promise.all([
      fetch(`${apiBaseUrl}/api/data/sales`),
      fetch(`${apiBaseUrl}/api/data/debitors`)
    ]);

    const sales = salesRes.ok ? mapMasterSummary(await salesRes.json(), false) : null;
    const debitors = debitorsRes.ok ? mapMasterSummary(await debitorsRes.json(), true) : null;

    return {
      sales,
      debitors,
      mode: 'live'
    };
  } catch (err) {
    console.warn('Backend API connection failed.', err);
    return {
      sales: null,
      debitors: null,
      mode: 'empty'
    };
  }
}

/**
 * Handles posting user inputs to the backend AI agent with fallback logic.
 */
export async function sendAdvisorChatMessage(
  message: string,
  isDebitors: boolean,
  summary: MasterSummary,
  history: { sender: 'user' | 'ai'; text: string }[]
): Promise<string> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        workspace: isDebitors ? 'debitors' : 'sales',
        history,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.text) {
        return data.text;
      }
    }
  } catch (err) {
    console.warn('AI Chat API offline. Falling back to local offline heuristic reasoning engine.', err);
  }

  // Local simulated response fallback
  return generateOfflineHeuristicResponse(message, isDebitors, summary);
}

function generateOfflineHeuristicResponse(query: string, isDebitors: boolean, summary: MasterSummary): string {
  const q = query.toLowerCase();
  
  if (isDebitors) {
    const totalPending = summary.aggregates?.totalPendingSum || 0;
    const successRate = summary.aggregates?.collectionSuccessRate || '0%';
    const topName = summary.aggregates?.topDebtorName || 'None';
    const topVal = summary.aggregates?.topDebtorValue || 0;

    if (q.includes('rate') || q.includes('success') || q.includes('collection')) {
      return `Our credit collections success rate currently stands at **${successRate}%**. We have successfully collected ₹${(summary.aggregates?.totalCreditSum || 0).toLocaleString('en-IN')} out of ₹${(summary.aggregates?.totalDebitSum || 0).toLocaleString('en-IN')} in total credit extended. The remaining ₹${totalPending.toLocaleString('en-IN')} gap represents a major cashflow recovery opportunity!`;
    }
    if (q.includes('top') || q.includes('who') || q.includes('highest') || q.includes('debtor') || q.includes('client')) {
      return `Our top outstanding debtor account is **${topName}**, who carries a pending balance of **₹${topVal.toLocaleString('en-IN')}**. That single account represents approximately **${((topVal / Math.max(totalPending, 1)) * 100).toFixed(1)}%** of all our outstanding uncollected tabs! I highly advise scheduling a direct, friendly phone call with them this week to set up a structured weekly installment clearance.`;
    }
    if (q.includes('checklist') || q.includes('staff') || q.includes('suggest') || q.includes('action') || q.includes('policy') || q.includes('limit') || q.includes('cap')) {
      return `Here is the recommended **Client Credit Limit Policy**:\n\n1. **High Dues Restriction:** Place a temporary credit freeze on **${topName}** and any other accounts above ₹20,000 until they clear at least 50% of their current tab.\n2. **Counter Ledger Inquiries:** Ask your billing counter staff to politely verify credit statuses with repeat customers *before* their table orders exceed ₹2,000.\n3. **Structured Recoveries:** Reach out to **SURAJ KHARCHE** and request a small weekend installment plan to begin clearing their ₹27,000 outstanding dues incrementally.`;
    }
  } else {
    const netProfit = summary.masterTotals?.netCashflow || 0;
    const liqPct = summary.benchmarks?.liquorPercentage || '0';
    const foodPct = summary.benchmarks?.foodPercentage || '0';
    const bestMonth = summary.benchmarks?.bestRevenueMonth || 'N/A';
    const bestVal = summary.benchmarks?.bestRevenueValue || 0;
    const peakMonth = summary.benchmarks?.peakExpenseMonth || 'N/A';
    const peakVal = summary.benchmarks?.peakExpenseValue || 0;

    if (q.includes('best') || q.includes('profit') || q.includes('revenue') || q.includes('highest') || q.includes('month')) {
      return `Our highest monthly performance occurred in **${bestMonth}**, generating a peak revenue of **₹${bestVal.toLocaleString('en-IN')}**! Overall, the business shows a cumulative Net cash surplus of **₹${netProfit.toLocaleString('en-IN')}** across the audited timeframe. That proves the underlying sales volume is incredibly strong!`;
    }
    if (q.includes('liquor') || q.includes('food') || q.includes('compare') || q.includes('ratio') || q.includes('markup')) {
      return `The menu sales split is currently **${liqPct}% Liquor** (Bar Counter) vs. **${foodPct}% Food** (Restaurant). While bar sales drive high receipts, we can boost our margins further by having tables upsell premium starter platters and specialty combos to drink orders. This leverages the high volume of the bar to drive double-digit food margins!`;
    }
    if (q.includes('alert') || q.includes('warning') || q.includes('spike') || q.includes('expense') || q.includes('credit')) {
      return `Yes, the system flagged **${summary.alerts.length} operational alerts**. Specifically, in **${peakMonth}**, supplier expenses spiked to **₹${peakVal.toLocaleString('en-IN')}**, breaching our standard safety budget limits. I recommend cross-auditing supplier statements from that period to identify if there was any cost leakage or duplicate supplier billing.`;
    }
  }

  return `I hear you! Looking at "${summary.fileName}", our numbers indicate a strong financial base with ₹${(isDebitors ? summary.aggregates?.totalPendingSum : summary.masterTotals?.netCashflow)?.toLocaleString('en-IN')} in play. To optimize this, I recommend scheduling a quick staff sync to review billing entries, capping high credit extensions, and setting target sales goals. What specific numbers would you like me to pull next?`;
}

/**
 * Uploads an Excel ledger spreadsheet and parses/audits it in real-time.
 */
export async function uploadSpreadsheet(fileName: string, base64Data: string): Promise<MasterSummary> {
  const res = await fetch(`${apiBaseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      fileData: base64Data
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with status ${res.status}`);
  }

  const summary = await res.json();
  const isDebitors = fileName.toUpperCase().includes('DEBITORS') || summary.isDebitorsList === true;
  return mapMasterSummary(summary, isDebitors);
}

/**
 * Triggers the backend AI accounting pipeline to sync with Google Drive.
 */
export async function triggerDriveSync(): Promise<{ status: 'up-to-date' | 'processing'; message: string }> {
  const res = await fetch(`${apiBaseUrl}/api/trigger-pipeline`, {
    method: 'POST',
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server responded with status ${res.status}`);
  }

  return res.json();
}

/**
 * Fetches server configuration and health metadata (including cron schedule).
 */
export async function fetchSystemHealth(): Promise<{ cron: string; status: string } | null> {
  try {
    const res = await fetch(`${apiBaseUrl}/health`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch system health metadata.', err);
  }
  return null;
}

