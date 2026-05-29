import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { MasterSummary, DebitorSummary, Transaction, MonthlySummary } from '@/types';
import { deriveBusinessName } from '@/utils/business';
import { DatePickerWithRange } from '@/components/ui/DatePickerWithRange';
import { RecoveryBoard } from './overview/RecoveryBoard';
import { OverviewKpiCards } from './overview/OverviewKpiCards';
import { AiRecommendationsQueue } from './overview/AiRecommendationsQueue';
import {
  ShieldCheck,
  LineChart as LineIcon,
  Info
} from 'lucide-react';

const OverviewCharts = React.lazy(() => import('./OverviewCharts'));
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatINR, formatTimestamp, getSheetDate } from '@/utils/format';

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
    return summary.months.map((m: MonthlySummary) => m.sheetName);
  }, [summary.months]);

  const businessName = useMemo(() => {
    return deriveBusinessName(summary.fileName);
  }, [summary.fileName]);

  const triggerReminderCopy = (debtor: DebitorSummary) => {
    const text = `Dear ${debtor.name},\n\nThis is a friendly reminder from ${businessName} accounts management. Your pending account balance of ₹${debtor.pending.toLocaleString('en-IN')} (total credit purchases: ₹${debtor.debit.toLocaleString('en-IN')}, cleared: ₹${debtor.credit.toLocaleString('en-IN')}) is currently due.\n\nPlease settle this amount at your earliest convenience via UPI, cash, or card.\n\nThank you!`;
    navigator.clipboard.writeText(text);
    toast.success(`Outreach draft for ${debtor.name} copied to clipboard!`);
  };

  // Filter months by selected months
  const filteredMonths = useMemo(() => {
    if (!summary.months) return [];
    if (selectedMonths.length === 0) return summary.months;

    return summary.months.filter((m: MonthlySummary) => selectedMonths.includes(m.sheetName));
  }, [summary.months, selectedMonths]);

  // Dynamic calculations for Sales aggregates
  const dynamicSalesTotals = useMemo(() => {
    if (isDebitors || filteredMonths.length === 0) return null;

    const masterLiquor = filteredMonths.reduce((sum: number, m: MonthlySummary) => sum + (m.liquor || 0), 0);
    const masterFood = filteredMonths.reduce((sum: number, m: MonthlySummary) => sum + (m.food || 0), 0);
    const masterRecovery = filteredMonths.reduce((sum: number, m: MonthlySummary) => sum + (m.creditRecovery || 0), 0);
    const masterExpenses = filteredMonths.reduce((sum: number, m: MonthlySummary) => sum + (m.expenses || 0), 0);
    const masterCreditExtended = filteredMonths.reduce((sum: number, m: MonthlySummary) => sum + (m.creditExtended || 0), 0);

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
    filteredMonths.forEach((m: MonthlySummary) => {
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
    const high = list.filter((d: DebitorSummary) => (d.pending ?? 0) > 20000).reduce((s: number, d: DebitorSummary) => s + (d.pending ?? 0), 0);
    const medium = list.filter((d: DebitorSummary) => (d.pending ?? 0) > 10000 && (d.pending ?? 0) <= 20000).reduce((s: number, d: DebitorSummary) => s + (d.pending ?? 0), 0);
    const low = list.filter((d: DebitorSummary) => (d.pending ?? 0) > 3000 && (d.pending ?? 0) <= 10000).reduce((s: number, d: DebitorSummary) => s + (d.pending ?? 0), 0);
    const minimal = list.filter((d: DebitorSummary) => (d.pending ?? 0) <= 3000).reduce((s: number, d: DebitorSummary) => s + (d.pending ?? 0), 0);
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
      <OverviewKpiCards
        isDebitors={isDebitors}
        dynamicDebitorTotals={dynamicDebitorTotals}
        dynamicSalesTotals={dynamicSalesTotals}
      />

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
      <AiRecommendationsQueue
        intelligence={summary.intelligence}
        aiGenerated={summary.aiGenerated}
        connectionMode={connectionMode}
      />
    </div>
  );
};
