import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { MasterSummary, DebitorSummary, Transaction } from '../types';
import { deriveBusinessName } from '../utils/business';
import { DatePickerWithRange } from './ui/DatePickerWithRange';
import { KpiCard } from './overview/KpiCard';
import { RecoveryBoard } from './overview/RecoveryBoard';
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Users,
  DollarSign,
  Sparkles,
  ShieldCheck,
  BarChart3,
  CalendarDays,
  LineChart as LineIcon,
  WifiOff,
  Activity,
  Info
} from 'lucide-react';

const OverviewCharts = React.lazy(() => import('./OverviewCharts'));
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useIsMobile } from '../hooks/use-mobile';

interface OverviewSectionProps {
  summary: MasterSummary;
  connectionMode: 'live' | 'static' | 'empty';
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ summary, connectionMode }) => {
  const isMobile = useIsMobile();
  const isDebitors = summary.isDebitorsList === true;
  const [activeChartTab, setActiveChartTab] = useState<'primary' | 'distribution'>('primary');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const availableMonths = useMemo(() => {
    if (!summary.months) return [];
    return summary.months.map(m => m.sheetName);
  }, [summary.months]);

  const businessName = useMemo(() => {
    return deriveBusinessName(summary.fileName);
  }, [summary.fileName]);

  const triggerReminderCopy = (debtor: DebitorSummary) => {
    const text = `Dear ${debtor.name},\n\nThis is a friendly reminder from ${businessName} accounts management. Your pending account balance of ₹${debtor.pending.toLocaleString('en-IN')} (total credit purchases: ₹${debtor.debit.toLocaleString('en-IN')}, cleared: ₹${debtor.credit.toLocaleString('en-IN')}) is currently due.\n\nPlease settle this amount at your earliest convenience via UPI, cash, or card.\n\nThank you!`;
    navigator.clipboard.writeText(text);
    toast.success(`Outreach draft for ${debtor.name} copied to clipboard!`);
  };

  const formatINR = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'N/A';
    if (ts.includes(',') || ts.toLowerCase().includes('am') || ts.toLowerCase().includes('pm')) {
      return ts;
    }
    const parsed = new Date(ts);
    if (isNaN(parsed.getTime())) {
      return ts;
    }
    return parsed.toLocaleString();
  };

  // Helper to parse sheet month name like "Jan 2026"
  const getSheetDate = (sheetName: string): Date | null => {
    const clean = sheetName.trim().toLowerCase();
    const yearMatch = clean.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      const monthsMap: Record<string, number> = {
        january: 0, jan: 0,
        february: 1, feb: 1,
        march: 2, mar: 2,
        april: 3, apr: 3,
        may: 4,
        june: 5, jun: 5,
        july: 6, jul: 6,
        august: 7, aug: 7,
        september: 8, sept: 8, sep: 8,
        october: 9, oct: 9,
        november: 10, nov: 10,
        december: 11, dec: 11
      };
      const monthMatch = clean.match(/(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)/);
      const monthIdx = monthMatch ? monthsMap[monthMatch[0]] : 0;
      return new Date(year, monthIdx, 1);
    }
    return null;
  };

  // Filter months by selected months
  const filteredMonths = useMemo(() => {
    if (!summary.months) return [];
    if (selectedMonths.length === 0) return summary.months;

    return summary.months.filter(m => selectedMonths.includes(m.sheetName));
  }, [summary.months, selectedMonths]);

  // Dynamic calculations for Sales aggregates
  const dynamicSalesTotals = useMemo(() => {
    if (isDebitors || filteredMonths.length === 0) return null;

    const masterLiquor = filteredMonths.reduce((sum, m) => sum + (m.liquor || 0), 0);
    const masterFood = filteredMonths.reduce((sum, m) => sum + (m.food || 0), 0);
    const masterRecovery = filteredMonths.reduce((sum, m) => sum + (m.creditRecovery || 0), 0);
    const masterExpenses = filteredMonths.reduce((sum, m) => sum + (m.expenses || 0), 0);
    const masterCreditExtended = filteredMonths.reduce((sum, m) => sum + (m.creditExtended || 0), 0);

    const masterIncome = masterLiquor + masterFood + masterRecovery;
    const masterOutflow = masterExpenses + masterCreditExtended;
    const masterNet = masterIncome - masterOutflow;

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

    // Best revenue calculation in date range
    let bestProfitMonth = 'N/A';
    let bestProfitValue = 0;
    filteredMonths.forEach(m => {
      if (m.net > bestProfitValue) {
        bestProfitValue = m.net;
        bestProfitMonth = m.sheetName;
      }
    });

    return {
      masterLiquor,
      masterFood,
      masterIncome,
      masterOutflow,
      masterNet,
      liquorPercentage,
      foodPercentage,
      creditOutstandingGap,
      creditRecoveryRate,
      bestProfitMonth,
      bestProfitValue
    };
  }, [filteredMonths, isDebitors]);

  // Dynamic calculations for Debitors aggregates from transaction log
  const dynamicDebitorTotals = useMemo(() => {
    if (!isDebitors || !summary.topDebitors) return null;
    
    // If no filter selected, use backend pre-calculated metrics
    if (selectedMonths.length === 0 || !summary.transactions) {
      return {
        totalPendingSum: summary.aggregates?.totalPendingSum ?? 0,
        collectionSuccessRate: summary.aggregates?.collectionSuccessRate ?? '0.0',
        averageOutstandingDues: summary.aggregates?.averageOutstandingDues ?? 0,
        activeDebitorsCount: summary.aggregates?.activeDebitorsCount ?? 0,
        topDebitorsList: summary.topDebitors ?? [],
      };
    }

    // Filter transactions by checking if their month/year matches any of the selected months
    const filteredTx = summary.transactions.filter((t: Transaction) => {
      const txDate = new Date(t.date);
      return selectedMonths.some(monthStr => {
        const parsed = getSheetDate(monthStr);
        return parsed && 
               txDate.getFullYear() === parsed.getFullYear() && 
               txDate.getMonth() === parsed.getMonth();
      });
    });

    // Group by customer
    const debtorMap = new Map<string, { debit: number; credit: number; pending: number }>();
    filteredTx.forEach((t: Transaction) => {
      const name = t.vendor || 'Unknown';
      if (!debtorMap.has(name)) {
        debtorMap.set(name, { debit: 0, credit: 0, pending: 0 });
      }
      const val = debtorMap.get(name)!;
      if (t.type === 'debit') {
        val.debit += t.amount;
      } else if (t.type === 'credit') {
        val.credit += t.amount;
      }
      val.pending = val.debit - val.credit;
    });

    const list = Array.from(debtorMap.entries())
      .map(([name, val]) => ({
        name,
        debit: val.debit,
        credit: val.credit,
        pending: val.pending
      }))
      .filter(d => d.pending > 0 || d.debit > 0)
      .sort((a, b) => b.pending - a.pending);

    const totalDebitSum = list.reduce((sum, d) => sum + d.debit, 0);
    const totalCreditSum = list.reduce((sum, d) => sum + d.credit, 0);
    const totalPendingSum = list.reduce((sum, d) => sum + d.pending, 0);

    const collectionSuccessRate = totalDebitSum > 0 
      ? ((totalCreditSum / totalDebitSum) * 100).toFixed(1)
      : '100.0';

    const activeDebitorsCount = list.length;
    const averageOutstandingDues = activeDebitorsCount > 0 ? (totalPendingSum / activeDebitorsCount) : 0;

    return {
      totalPendingSum,
      collectionSuccessRate,
      averageOutstandingDues,
      activeDebitorsCount,
      topDebitorsList: list,
    };
  }, [summary.topDebitors, summary.transactions, summary.aggregates, isDebitors, selectedMonths]);

  const debitorsAgeingData = useMemo(() => {
    const list = dynamicDebitorTotals?.topDebitorsList ?? [];
    const high = list.filter(d => (d.pending ?? 0) > 20000).reduce((s, d) => s + (d.pending ?? 0), 0);
    const medium = list.filter(d => (d.pending ?? 0) > 10000 && (d.pending ?? 0) <= 20000).reduce((s, d) => s + (d.pending ?? 0), 0);
    const low = list.filter(d => (d.pending ?? 0) > 3000 && (d.pending ?? 0) <= 10000).reduce((s, d) => s + (d.pending ?? 0), 0);
    const minimal = list.filter(d => (d.pending ?? 0) <= 3000).reduce((s, d) => s + (d.pending ?? 0), 0);
    return [
      { range: 'High Risk (>₹20K)', amount: high, color: 'var(--destructive)' },
      { range: 'Medium (₹10K-₹20K)', amount: medium, color: 'var(--chart-2)' },
      { range: 'Low (₹3K-₹10K)', amount: low, color: 'var(--chart-3)' },
      { range: 'Minimal (<₹3K)', amount: minimal, color: 'var(--primary)' },
    ];
  }, [dynamicDebitorTotals?.topDebitorsList]);

  // Structured summary mock payload to feed to OverviewCharts
  const chartSummaryMock = useMemo(() => {
    return {
      ...summary,
      months: filteredMonths,
      topDebitors: dynamicDebitorTotals?.topDebitorsList ?? []
    };
  }, [summary, filteredMonths, dynamicDebitorTotals]);

  return (
    <div className="flex flex-col gap-4 md:gap-6 w-full animate-in fade-in duration-300">
      {/* Page Title & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 md:pb-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading font-semibold text-xl tracking-tight text-foreground">
              {isDebitors ? 'Debitors Command Hub' : 'Ledger Performance Console'}
            </h1>
            <div className="flex items-center gap-1 text-[0.65rem] font-bold text-success bg-success/10 border border-success/20 px-2.5 py-0.5 rounded-full select-none shrink-0">
              <ShieldCheck className="size-3 text-success" />
              <span>Verified</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span>Spreadsheet: <code className="font-mono text-primary font-semibold truncate max-w-[190px] sm:max-w-none inline-block align-bottom">{summary.fileName}</code></span>
            <span className="text-muted-foreground/40 hidden sm:inline">•</span>
            <span className="w-full sm:w-auto">Generation: {formatTimestamp(summary.runTimestamp)}</span>
            <span className="text-muted-foreground/40 hidden sm:inline">•</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={
                  <button type="button" className="text-[0.65rem] bg-muted hover:bg-muted/85 text-foreground px-2 py-0.5 rounded border border-border/80 cursor-pointer select-none font-medium flex items-center gap-1">
                    <Info className="size-3 text-muted-foreground" />
                    <span>What is Audited?</span>
                  </button>
                } />
                <TooltipContent className="block max-w-[280px] p-3 text-[0.72rem] leading-relaxed border bg-popover text-popover-foreground shadow-md rounded-lg">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-foreground">Smart Integrity Engine</span>
                    <span>Automatically scans spreadsheet transactions to protect from:</span>
                    <ol className="list-decimal pl-4 flex flex-col gap-0.5">
                      <li>Duplicate Bill entries</li>
                      <li>Large payments over ₹50,000</li>
                      <li>Suspicious cost spikes (&gt;3x avg)</li>
                      <li>Late-night booking delays</li>
                      <li>Negative ledger entries</li>
                    </ol>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
        </div>
      </div>

      {/* Date Filter & Control Widget Card — only for sales (has month sheets) */}
      {!isDebitors && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-xl bg-card/40 select-none shadow-xs">
          <div className="w-full sm:w-auto">
            <DatePickerWithRange 
              selectedMonths={selectedMonths} 
              setSelectedMonths={setSelectedMonths} 
              availableMonths={availableMonths}
            />
          </div>
          <div className="text-[0.7rem] font-medium text-muted-foreground">
            {selectedMonths.length > 0 ? (
              <span>Filtering metrics for: <strong className="text-foreground">{selectedMonths.join(", ")}</strong>.</span>
            ) : (
              <span>Showing all-time aggregate financial metrics from the spreadsheet.</span>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <TooltipProvider>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 select-none">
          {isDebitors && dynamicDebitorTotals ? (
            <>
              <KpiCard
                title="Unrecovered Liability"
                tooltipText="Total pending customer credit outstanding in the debitors ledger."
                value={formatINR(dynamicDebitorTotals.totalPendingSum)}
                description="Total pending customer credit."
                icon={<TrendingDown className="text-destructive size-4 shrink-0" />}
                variant="red"
              />
              <KpiCard
                title="Clearance Index"
                tooltipText="Percentage of extended credit balances successfully paid back by customers."
                value={`${dynamicDebitorTotals.collectionSuccessRate}%`}
                description="Paid credit balance percentage."
                icon={<Percent className="text-success size-4 shrink-0" />}
                variant="green"
              />
              <KpiCard
                title="Mean Balances"
                tooltipText="Average outstanding pending dues per active debit customer."
                value={formatINR(dynamicDebitorTotals.averageOutstandingDues)}
                description="Average outstanding per customer."
                icon={<DollarSign className="text-primary size-4 shrink-0" />}
              />
              <KpiCard
                title="Open Ledgers"
                tooltipText="Total number of customers carrying outstanding pending credits."
                value={dynamicDebitorTotals.activeDebitorsCount}
                description="Outstanding credit profiles."
                icon={<Users className="text-primary size-4 shrink-0" />}
              />
            </>
          ) : dynamicSalesTotals ? (
            <>
              <KpiCard
                title="Net Surplus"
                tooltipText="Net cash balance remaining after subtracting operational expenses from total inflows."
                value={formatINR(dynamicSalesTotals.masterNet)}
                description="Surplus cash after cost settlements."
                icon={<TrendingUp className="text-success size-4 shrink-0" />}
                variant="green"
              />
              <KpiCard
                title="Liquor vs Food Split"
                tooltipText="Proportional ratio of liquor sales compared to food menu sales."
                value={`${dynamicSalesTotals.liquorPercentage}% / ${dynamicSalesTotals.foodPercentage}%`}
                description="Ratio of liquor sales vs. food sales."
                icon={<Percent className="text-amber-500 size-4 shrink-0" />}
                variant="gold"
              />
              <KpiCard
                title="Peak Cash Surplus"
                tooltipText="The single highest monthly cash surplus value achieved in the historical ledger."
                value={formatINR(dynamicSalesTotals.bestProfitValue)}
                description={`Highest monthly cash surplus in ${dynamicSalesTotals.bestProfitMonth}.`}
                icon={<BarChart3 className="text-primary size-4 shrink-0" />}
              />
              <KpiCard
                title="Credit Recovery"
                tooltipText="The index measuring debt recovery success calculated over credits extended."
                value={`${dynamicSalesTotals.creditRecoveryRate}%`}
                description="Recovery performance over credits extended."
                icon={<CalendarDays className="text-primary size-4 shrink-0" />}
              />
            </>
          ) : null}
        </div>
      </TooltipProvider>

      {/* Tab-switched Recharts Graphic Panel */}
      <Card className="bg-card/45 shadow-xs border">
        <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <LineIcon className="size-4.5 text-primary" />
              {isDebitors ? "Debitor Liabilities Analytics" : "Ledger Time-Series Performance"}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {isDebitors ? "Interactive analytics plotting liabilities and aging splits." : "Executive charts tracing cashflow surpluses and category expenditures."}
            </CardDescription>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto select-none">
            <button
              type="button"
              onClick={() => setActiveChartTab('primary')}
              className={`text-[0.7rem] sm:text-xs px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                activeChartTab === 'primary'
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              {isDebitors ? 'Top Debitors' : 'Cashflow Timeline'}
            </button>
            <button
              type="button"
              onClick={() => setActiveChartTab('distribution')}
              className={`text-[0.7rem] sm:text-xs px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                activeChartTab === 'distribution'
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              {isDebitors ? 'Ageing Splits' : 'Outflow Distribution'}
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="w-full h-80 select-none">
            <React.Suspense fallback={
              <div className="h-full w-full flex flex-col items-center justify-center gap-3 select-none">
                <svg className="size-6 text-primary animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="text-[0.68rem] font-semibold text-muted-foreground tracking-wide animate-pulse">Loading charts…</span>
              </div>}
            >
              <OverviewCharts
                isDebitors={isDebitors}
                summary={chartSummaryMock}
                isMobile={isMobile}
                activeChartTab={activeChartTab}
                debitorsAgeingData={debitorsAgeingData}
              />
            </React.Suspense>
          </div>
        </CardContent>
      </Card>

      {isDebitors && dynamicDebitorTotals && (
        <RecoveryBoard
          topDebitors={dynamicDebitorTotals.topDebitorsList}
          businessName={businessName}
          triggerReminderCopy={triggerReminderCopy}
          formatINR={formatINR}
        />
      )}

      {/* AI Recommendations Queue Section */}
      <Card className="border bg-card/45 shadow-xs overflow-hidden">
        <CardHeader className="p-4 md:p-6 pb-4 border-b flex flex-col sm:flex-row sm:items-start justify-between gap-4 select-none">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-warning/10 flex items-center justify-center text-warning border border-warning/20 shrink-0">
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">AI Recommendation Queue</CardTitle>
              <CardDescription className="text-xs">
                Identified strategic action plans derived from accounting metrics.
                <span className="ml-1.5 opacity-90 hidden lg:inline text-muted-foreground/80 font-medium">
                  ({connectionMode === 'empty' 
                    ? 'Showing offline simulated demo recommendations for display purposes.' 
                    : summary.aiGenerated === true 
                      ? 'Dynamically generated in real-time by the LLM advisor.' 
                      : 'Calculated deterministically by our local rules engine due to LLM timeout.'
                  })
                </span>
              </CardDescription>
            </div>
          </div>
          <div className="shrink-0 self-start sm:self-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={
                  <button
                    type="button"
                    className={`text-[0.62rem] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border transition-all duration-300 select-none cursor-pointer ${
                      connectionMode === 'empty'
                        ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25'
                        : summary.aiGenerated === true
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 dark:border-emerald-500/20 shadow-[0_0_12px_-3px_rgba(16,185,129,0.25)]'
                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25'
                    }`}
                  >
                    {connectionMode === 'empty' ? (
                      <WifiOff className="size-3" />
                    ) : summary.aiGenerated === true ? (
                      <Sparkles className="size-3 text-emerald-500 animate-pulse" />
                    ) : (
                      <Activity className="size-3 text-indigo-500" />
                    )}
                    <span>
                      {connectionMode === 'empty'
                        ? 'Simulated Demo'
                        : summary.aiGenerated === true
                          ? 'Live AI Generated'
                          : 'Rule Engine (Fallback)'
                      }
                    </span>
                  </button>
                } />
                <TooltipContent className="max-w-[260px] p-2.5 text-[0.72rem] leading-relaxed border bg-popover text-popover-foreground shadow-md rounded-lg">
                  {connectionMode === 'empty'
                    ? 'Showing offline simulated demo recommendations for display purposes. Connect a database to trigger live insights.'
                    : summary.aiGenerated === true
                      ? 'This recommendation was dynamically generated in real-time by the LLM advisor from your sheet details.'
                      : 'Calculated deterministically by our local accounting heuristics rules engine due to LLM provider timeout or error.'
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {summary.intelligence.map((intel, idx) => {
            const types = [
              { label: 'Cashflow Optimization', badge: 'bg-success/10 text-success border-success/20', impact: 'High Impact' },
              { label: 'Revenue Yield Target', badge: 'bg-info/10 text-info border-info/20', impact: 'Moderate Impact' },
              { label: 'Exposure Risk Containment', badge: 'bg-destructive/10 text-destructive border-destructive/20', impact: 'Critical Action' }
            ];
            const meta = types[idx] || { label: 'Operational Advice', badge: 'bg-muted border', impact: 'Review Action' };

            return (
              <div
                key={intel.slice(0, 40)}
                className="border rounded-xl p-4 bg-card/45 hover:border-primary/30 hover:shadow-xs transition-all duration-300 flex flex-col justify-between gap-3.5 relative group"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 select-none">
                    <span className={`text-[0.62rem] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <span className="text-[0.62rem] font-bold text-muted-foreground font-mono flex items-center gap-1.5 whitespace-nowrap shrink-0">
                      <span className={`size-1.5 rounded-full shrink-0 ${idx === 0 ? 'bg-success' : idx === 1 ? 'bg-info' : 'bg-destructive'}`}></span>
                      {meta.impact}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed mt-2 font-medium">
                    {intel}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
