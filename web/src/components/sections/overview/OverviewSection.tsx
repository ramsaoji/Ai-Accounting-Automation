import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import type { MasterSummary, DebitorSummary, Transaction, MonthlySummary } from '@/types';
import { deriveBusinessName } from '@/utils/business';
import { DatePickerWithRange } from '@/components/ui/DatePickerWithRange';
import { RecoveryBoard } from './overview/RecoveryBoard';
import { OverviewKpiCards } from './overview/OverviewKpiCards';
import { AiRecommendationsQueue } from './overview/AiRecommendationsQueue';
import { StockDepletionPanel } from './overview/StockDepletionPanel';
import { SalesExceptionsPanel } from './overview/SalesExceptionsPanel';
import { PeriodComparisonPanel } from './overview/PeriodComparisonPanel';
import {
  ShieldCheck,
  LineChart as LineIcon,
  Info,
  TrendingUp,
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
  const isStock = summary.isGodownStockList === true;
  const [activeChartTab, setActiveChartTab] = useState<'primary' | 'distribution'>('primary');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const availableMonths = useMemo(() => {
    if (!summary.months) return [];
    return summary.months.map((m: MonthlySummary) => m.sheetName);
  }, [summary.months]);

  const businessName = useMemo(() => {
    if (summary.businessMetadata?.businessName) {
      return summary.businessMetadata.businessName;
    }
    return deriveBusinessName(summary.fileName);
  }, [summary.fileName, summary.businessMetadata?.businessName]);

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

    // Dynamic split computations based on Chart of Accounts
    const revenueDepts = summary.departments?.filter(
      d =>
        d.type === 'REVENUE' &&
        !d.name.toLowerCase().includes('recovery') &&
        !d.name.toLowerCase().includes('jama') &&
        !d.name.toLowerCase().includes('recover')
    ) || [];
    const deptTotals = revenueDepts.map(dept => {
      const totalVal = filteredMonths.reduce((sum, m) => {
        return sum + ((m.departments && (dept.name in m.departments))
          ? (m.departments[dept.name] || 0)
          : (dept.code === '4001' || dept.id === 'liq' ? m.liquor : dept.code === '4002' || dept.id === 'food' ? m.food : 0));
      }, 0);
      return { dept, totalVal };
    }).sort((a, b) => b.totalVal - a.totalVal);

    let splitTitle = "Revenue Split";
    let splitValue = "0.0% / 0.0%";
    let splitTooltip = "Ratio of revenue categories.";
    let splitDesc = "Revenue distribution.";

    if (deptTotals.length >= 2) {
      const top1 = deptTotals[0];
      const top2 = deptTotals[1];
      const combined = top1.totalVal + top2.totalVal;
      const top1Pct = combined > 0 ? ((top1.totalVal / combined) * 100).toFixed(1) : "0.0";
      const top2Pct = combined > 0 ? ((top2.totalVal / combined) * 100).toFixed(1) : "0.0";

      const name1 = top1.dept.name.replace(/\s*(sales|revenue)\s*/gi, '').trim();
      const name2 = top2.dept.name.replace(/\s*(sales|revenue)\s*/gi, '').trim();

      splitTitle = `${name1} vs ${name2} Split`;
      splitValue = `${top1Pct}% / ${top2Pct}%`;
      splitTooltip = `Proportional ratio of ${name1.toLowerCase()} compared to ${name2.toLowerCase()} sales.`;
      splitDesc = `Ratio of ${name1.toLowerCase()} vs. ${name2.toLowerCase()}.`;
    } else if (deptTotals.length === 1) {
      const top1 = deptTotals[0];
      const name1 = top1.dept.name.replace(/\s*(sales|revenue)\s*/gi, '').trim();
      splitTitle = `${name1} Share`;
      splitValue = "100.0%";
      splitTooltip = `Proportional share of ${name1.toLowerCase()} sales.`;
      splitDesc = `Revenue is driven entirely by ${name1.toLowerCase()}.`;
    }

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
      bestProfitValue,
      splitTitle,
      splitValue,
      splitTooltip,
      splitDesc
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

  // Dynamic calculations for Stock aggregates
  const dynamicStockTotals = useMemo(() => {
    if (!isStock || !summary.aggregates) return null;
    return {
      totalClosingValue: summary.aggregates.totalClosingValue ?? 0,
      totalSellingValue: summary.aggregates.totalSellingValue ?? 0,
      totalItemsCount: summary.aggregates.totalItemsCount ?? 0,
      totalVolumeLiters: summary.aggregates.totalVolumeLiters ?? 0,
      godown: summary.aggregates.godown,
      counter: summary.aggregates.counter
    };
  }, [summary.aggregates, isStock]);

  const debitorsAgeingData = useMemo(() => {
    const list = dynamicDebitorTotals?.topDebitorsList ?? [];
    const txs = summary.transactions || [];
    
    // Find reference date (maximum date in transaction logs, or runTimestamp, or today)
    let referenceDate = new Date();
    if (txs.length > 0) {
      let maxTime = 0;
      txs.forEach((t) => {
        const d = new Date(t.date).getTime();
        if (!isNaN(d) && d > maxTime) {
          maxTime = d;
        }
      });
      if (maxTime > 0) {
        referenceDate = new Date(maxTime);
      }
    } else if (summary.runTimestamp) {
      const parsed = new Date(summary.runTimestamp);
      if (!isNaN(parsed.getTime())) {
        referenceDate = parsed;
      }
    }

    let bucket0to30 = 0;
    let bucket31to60 = 0;
    let bucket61to90 = 0;
    let bucket90plus = 0;

    // For each debtor, calculate aging of their pending balance
    list.forEach((debtor) => {
      const pendingBalance = debtor.pending;
      if (pendingBalance <= 0) return;

      // Get all debit (credit extended) transactions for this debtor
      const debtorDebits = txs
        .filter((t) => t.vendor === debtor.name && t.type === 'debit')
        .map((t) => ({
          amount: t.amount,
          date: new Date(t.date)
        }))
        .filter((t) => !isNaN(t.date.getTime()))
        // Sort descending (newest first)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      let allocatedPending = 0;

      for (const tx of debtorDebits) {
        if (allocatedPending >= pendingBalance) break;
        const remainingToAllocate = pendingBalance - allocatedPending;
        const allocAmount = Math.min(tx.amount, remainingToAllocate);

        const ageInDays = Math.max(0, Math.floor((referenceDate.getTime() - tx.date.getTime()) / (1000 * 60 * 60 * 24)));

        if (ageInDays <= 30) {
          bucket0to30 += allocAmount;
        } else if (ageInDays <= 60) {
          bucket31to60 += allocAmount;
        } else if (ageInDays <= 90) {
          bucket61to90 += allocAmount;
        } else {
          bucket90plus += allocAmount;
        }

        allocatedPending += allocAmount;
      }

      // If there's still unallocated pending balance (e.g. older balance forward), put it in the oldest bucket
      if (allocatedPending < pendingBalance) {
        bucket90plus += (pendingBalance - allocatedPending);
      }
    });

    return [
      { range: '0-30 Days', amount: Math.round(bucket0to30), color: 'var(--primary)' },
      { range: '31-60 Days', amount: Math.round(bucket31to60), color: 'var(--chart-2)' },
      { range: '61-90 Days', amount: Math.round(bucket61to90), color: 'var(--chart-3)' },
      { range: '90+ Days', amount: Math.round(bucket90plus), color: 'var(--destructive)' },
    ];
  }, [dynamicDebitorTotals?.topDebitorsList, summary.transactions, summary.runTimestamp]);

  // Structured summary mock payload to feed to OverviewCharts
  const chartSummaryMock = useMemo(() => {
    return {
      ...summary,
      months: filteredMonths,
      topDebitors: dynamicDebitorTotals?.topDebitorsList ?? [],
      historicalTrends: summary.historicalTrends || [],
      categoryAggregates: summary.categoryAggregates || []
    };
  }, [summary, filteredMonths, dynamicDebitorTotals]);

  return (
    <div className="flex flex-col gap-4 md:gap-6 w-full animate-in fade-in duration-300">
      {/* Page Title & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 md:pb-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading font-semibold text-xl tracking-tight text-foreground">
              {isDebitors ? 'Debitors Command Hub' : isStock ? 'Inventory Command Hub' : 'Ledger Performance Console'}
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
      {!isDebitors && !isStock && (
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
        isStock={isStock}
        dynamicDebitorTotals={dynamicDebitorTotals}
        dynamicSalesTotals={dynamicSalesTotals}
        dynamicStockTotals={dynamicStockTotals}
        industryProfile={summary.businessMetadata?.industryProfile}
      />

      {/* Tab-switched Recharts Graphic Panel */}
      <Card className="bg-card/45 shadow-xs border">
        <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <LineIcon className="size-4.5 text-primary" />
              {isDebitors ? "Debitor Liabilities Analytics" : isStock ? "Inventory Valuation Trends" : "Ledger Time-Series Performance"}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {isDebitors ? "Interactive analytics plotting liabilities and aging splits." : isStock ? "Interactive analytics plotting total cost and sell valuations." : "Executive charts tracing cashflow surpluses and category expenditures."}
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
              {isDebitors ? 'Top Debitors' : isStock ? 'Valuation History' : 'Cashflow Timeline'}
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
              {isDebitors ? 'Ageing Splits' : isStock ? 'Category Splits' : 'Outflow Distribution'}
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
                isStock={isStock}
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

      {isStock && summary.items && (
        <StockDepletionPanel
          items={summary.items}
          businessName={businessName}
        />
      )}

      {!isDebitors && !isStock && summary.alerts && (
        <SalesExceptionsPanel
          alerts={summary.alerts}
          businessName={businessName}
        />
      )}

      {!isDebitors && !isStock && summary.months && (
        <PeriodComparisonPanel
          months={summary.months}
          industryProfile={summary.businessMetadata?.industryProfile}
          departments={summary.departments}
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
