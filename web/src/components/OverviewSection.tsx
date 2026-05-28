import React, { useState } from 'react';
import { toast } from 'sonner';
import type { MasterSummary, DebitorSummary } from '../types';
import { deriveBusinessName } from '../utils/business';
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Users,
  DollarSign,
  Sparkles,
  ShieldCheck,
  Zap,
  BarChart3,
  CalendarDays,
  LineChart as LineIcon,
  MessageSquare,
  WifiOff,
  Activity,
  Info
} from 'lucide-react';
const OverviewCharts = React.lazy(() => import('./OverviewCharts'));
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  const businessName = React.useMemo(() => {
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

  const debitorsAgeingData = React.useMemo(() => {
    const debitors = summary.topDebitors ?? [];
    // Proxy aging by pending amount ranges (actual dates not in current JSONB schema)
    const high = debitors.filter(d => (d.pending ?? 0) > 20000).reduce((s, d) => s + (d.pending ?? 0), 0);
    const medium = debitors.filter(d => (d.pending ?? 0) > 10000 && (d.pending ?? 0) <= 20000).reduce((s, d) => s + (d.pending ?? 0), 0);
    const low = debitors.filter(d => (d.pending ?? 0) > 3000 && (d.pending ?? 0) <= 10000).reduce((s, d) => s + (d.pending ?? 0), 0);
    const minimal = debitors.filter(d => (d.pending ?? 0) <= 3000).reduce((s, d) => s + (d.pending ?? 0), 0);
    return [
      { range: 'High Risk (>₹20K)', amount: high, color: 'var(--destructive)' },
      { range: 'Medium (₹10K-₹20K)', amount: medium, color: 'var(--chart-2)' },
      { range: 'Low (₹3K-₹10K)', amount: low, color: 'var(--chart-3)' },
      { range: 'Minimal (<₹3K)', amount: minimal, color: 'var(--primary)' },
    ];
  }, [summary.topDebitors]);

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

      {/* KPI Cards Grid */}
      <TooltipProvider>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 select-none">
          {isDebitors && summary.aggregates ? (
            <>
              {/* Total Outstanding Dues */}
              <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
                <CardHeader className="p-4 pb-1 md:p-5 md:pb-1 flex flex-row items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="text-[0.58rem] md:text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest cursor-help underline underline-offset-2 decoration-dotted">Unrecovered Liability</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                      Total pending customer credit outstanding in the debitors ledger.
                    </TooltipContent>
                  </Tooltip>
                  <TrendingDown className="text-destructive size-4 shrink-0" />
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-5 md:pt-0 mt-1">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-foreground tracking-tight">
                    {formatINR(summary.aggregates.totalPendingSum)}
                  </h3>
                  <span className="text-[0.6rem] md:text-[0.65rem] text-muted-foreground mt-1 md:mt-1.5 block leading-normal">
                    Total pending customer credit.
                  </span>
                </CardContent>
              </Card>
  
              {/* Recovery Success */}
              <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
                <CardHeader className="p-4 pb-1 md:p-5 md:pb-1 flex flex-row items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="text-[0.58rem] md:text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest cursor-help underline underline-offset-2 decoration-dotted">Clearance Index</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                      Percentage of extended credit balances successfully paid back by customers.
                    </TooltipContent>
                  </Tooltip>
                  <Percent className="text-success size-4 shrink-0" />
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-5 md:pt-0 mt-1">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-foreground tracking-tight">
                    {summary.aggregates.collectionSuccessRate}%
                  </h3>
                  <span className="text-[0.6rem] md:text-[0.65rem] text-muted-foreground mt-1 md:mt-1.5 block leading-normal">
                    Paid credit balance percentage.
                  </span>
                </CardContent>
              </Card>
  
              {/* Average Outstanding */}
              <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
                <CardHeader className="p-4 pb-1 md:p-5 md:pb-1 flex flex-row items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="text-[0.58rem] md:text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest cursor-help underline underline-offset-2 decoration-dotted">Mean Balances</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                      Average outstanding pending dues per active debit customer.
                    </TooltipContent>
                  </Tooltip>
                  <DollarSign className="text-primary size-4 shrink-0" />
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-5 md:pt-0 mt-1">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-foreground tracking-tight">
                    {formatINR(summary.aggregates.averageOutstandingDues)}
                  </h3>
                  <span className="text-[0.6rem] md:text-[0.65rem] text-muted-foreground mt-1 md:mt-1.5 block leading-normal">
                    Average outstanding per customer.
                  </span>
                </CardContent>
              </Card>
  
              {/* Active Customers */}
              <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
                <CardHeader className="p-4 pb-1 md:p-5 md:pb-1 flex flex-row items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="text-[0.58rem] md:text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest cursor-help underline underline-offset-2 decoration-dotted">Open Ledgers</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                      Total number of customers carrying outstanding pending credits.
                    </TooltipContent>
                  </Tooltip>
                  <Users className="text-primary size-4 shrink-0" />
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-5 md:pt-0 mt-1">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-foreground tracking-tight">
                    {summary.aggregates.activeDebitorsCount}
                  </h3>
                  <span className="text-[0.6rem] md:text-[0.65rem] text-muted-foreground mt-1 md:mt-1.5 block leading-normal">
                    Outstanding credit profiles.
                  </span>
                </CardContent>
              </Card>
            </>
          ) : summary.masterTotals && summary.benchmarks ? (
            <>
              {/* Consolidated Cashflow */}
              <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
                <CardHeader className="p-4 pb-1 md:p-5 md:pb-1 flex flex-row items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="text-[0.58rem] md:text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest cursor-help underline underline-offset-2 decoration-dotted">Net Surplus</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                      Net cash balance remaining after subtracting operational expenses from total inflows.
                    </TooltipContent>
                  </Tooltip>
                  <TrendingUp className="text-success size-4 shrink-0" />
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-5 md:pt-0 mt-1">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-foreground tracking-tight">
                    {formatINR(summary.masterTotals.netCashflow)}
                  </h3>
                  <span className="text-[0.6rem] md:text-[0.65rem] text-muted-foreground mt-1 md:mt-1.5 block leading-normal">
                    Surplus cash after cost settlements.
                  </span>
                </CardContent>
              </Card>
  
              {/* Bar/Menu Ratio */}
              <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
                <CardHeader className="p-4 pb-1 md:p-5 md:pb-1 flex flex-row items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="text-[0.58rem] md:text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest cursor-help underline underline-offset-2 decoration-dotted">Liquor vs Food Split</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                      Proportional ratio of liquor sales compared to food menu sales.
                    </TooltipContent>
                  </Tooltip>
                  <Percent className="text-amber-500 size-4 shrink-0" />
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-5 md:pt-0 mt-1">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-foreground tracking-tight">
                    {summary.benchmarks.liquorPercentage}% / {summary.benchmarks.foodPercentage}%
                  </h3>
                  <span className="text-[0.6rem] md:text-[0.65rem] text-muted-foreground mt-1 md:mt-1.5 block leading-normal">
                    Ratio of liquor sales vs. food sales.
                  </span>
                </CardContent>
              </Card>
  
              {/* Peak Profit Month */}
              <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
                <CardHeader className="p-4 pb-1 md:p-5 md:pb-1 flex flex-row items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="text-[0.58rem] md:text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest cursor-help underline underline-offset-2 decoration-dotted">Peak Cash Surplus</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                      The single highest monthly cash surplus value achieved in the historical ledger.
                    </TooltipContent>
                  </Tooltip>
                  <BarChart3 className="text-primary size-4 shrink-0" />
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-5 md:pt-0 mt-1">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-foreground tracking-tight">
                    {formatINR(summary.benchmarks.bestProfitValue)}
                  </h3>
                  <span className="text-[0.6rem] md:text-[0.65rem] text-muted-foreground mt-1 md:mt-1.5 block leading-normal">
                    Highest monthly cash surplus in {summary.benchmarks.bestProfitMonth}.
                  </span>
                </CardContent>
              </Card>
  
              {/* Recovery Rate */}
              <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
                <CardHeader className="p-4 pb-1 md:p-5 md:pb-1 flex flex-row items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="text-[0.58rem] md:text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest cursor-help underline underline-offset-2 decoration-dotted">Credit Recovery</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                      The index measuring debt recovery success calculated over credits extended.
                    </TooltipContent>
                  </Tooltip>
                  <CalendarDays className="text-primary size-4 shrink-0" />
                </CardHeader>
                <CardContent className="p-4 pt-0 md:p-5 md:pt-0 mt-1">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-foreground tracking-tight">
                    {summary.benchmarks.creditRecoveryRate}%
                  </h3>
                  <span className="text-[0.6rem] md:text-[0.65rem] text-muted-foreground mt-1 md:mt-1.5 block leading-normal">
                    Recovery performance over credits extended.
                  </span>
                </CardContent>
              </Card>
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

          {/* Chart Tabs */}
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
            <React.Suspense fallback={<div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground animate-pulse">        Loading charts…</div>}>
              <OverviewCharts
                isDebitors={isDebitors}
                summary={summary}
                isMobile={isMobile}
                activeChartTab={activeChartTab}
                debitorsAgeingData={debitorsAgeingData}
              />
            </React.Suspense>
          </div>
        </CardContent>
      </Card>

      {isDebitors && summary.topDebitors && (
        <div className="grid grid-cols-1 gap-6 mt-1 items-start animate-in fade-in duration-300">
          {/* Recovery Strategy Board */}
          <Card className="border bg-card/45 shadow-xs overflow-hidden flex flex-col justify-between">
            <div>
              <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border/80 flex flex-row items-center gap-3 select-none">
                <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20 shrink-0">
                  <Zap className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Receivable Recovery & Planning</CardTitle>
                  <CardDescription className="text-xs">Top priority accounts and automated outreach copy drafts.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
                <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-wider select-none">
                  Top Priority Accounts
                </span>
                <div className="flex flex-col gap-3">
                  {summary.topDebitors.slice(0, 5).map((debtor) => {
                    const riskLevel = debtor.pending > 15000 ? 'High Risk' : debtor.pending > 5000 ? 'Medium Risk' : 'Low Risk';
                    const statusColorMap = debtor.pending > 15000 
                      ? 'bg-destructive' 
                      : debtor.pending > 5000 
                        ? 'bg-warning' 
                        : 'bg-success';
                    const riskColor = debtor.pending > 15000 
                      ? 'bg-destructive/10 text-destructive border-destructive/25' 
                      : debtor.pending > 5000 
                        ? 'bg-warning/10 text-warning border-warning/25' 
                        : 'bg-success/10 text-success border-success/25';

                    return (
                      <div
                        key={debtor.name}
                        className="relative overflow-hidden p-4 pl-5 border border-border/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 bg-card/25 hover:bg-card/50 hover:border-primary/25 group select-none shadow-xs"
                      >
                        {/* Subtle left status indicator bar */}
                        <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-md transition-all duration-300 ${statusColorMap} opacity-60 group-hover:opacity-100`} />

                        {/* Profile initials, Name, and Risk Level */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`size-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 font-mono transition-all duration-300 select-none shadow-sm ${
                            debtor.pending > 15000
                              ? 'bg-destructive/10 text-destructive border border-destructive/20 group-hover:bg-destructive/15'
                              : debtor.pending > 5000
                                ? 'bg-warning/10 text-warning border border-warning/20 group-hover:bg-warning/15'
                                : 'bg-success/10 text-success border border-success/20 group-hover:bg-success/15'
                          }`}>
                            {(() => {
                              const p = debtor.name.trim().split(/\s+/);
                              return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : debtor.name.slice(0, 2).toUpperCase();
                            })()}
                          </div>
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-sm font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors truncate">{debtor.name}</span>
                              <span className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md border shrink-0 font-sans leading-none ${riskColor}`}>
                                {riskLevel}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1.5">
                                <span className="opacity-75">Purchases:</span>
                                <span className="font-mono font-bold text-foreground/90">{formatINR(debtor.debit || 0)}</span>
                              </span>
                              <span className="size-1 rounded-full bg-border shrink-0" />
                              <span className="flex items-center gap-1.5">
                                <span className="opacity-75">Cleared:</span>
                                <span className="font-mono font-bold text-success/90">{formatINR(debtor.credit || 0)}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Balance and Outreach Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40 w-full sm:w-auto">
                          <div className="flex flex-col items-start sm:items-end">
                            <span className="text-sm sm:text-base font-extrabold text-destructive font-mono tracking-tight">{formatINR(debtor.pending)}</span>
                            <span className="text-[10px] text-muted-foreground font-bold mt-1 leading-none uppercase tracking-wider">Outstanding Dues</span>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              triggerReminderCopy(debtor);
                            }}
                            className="gap-1.5 h-9 sm:h-8 px-3 rounded-lg text-xs font-semibold bg-primary/5 text-primary border border-primary/10 hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-xs cursor-pointer transition-all duration-200 shrink-0"
                          >
                            <MessageSquare className="size-3.5 shrink-0" />
                            <span>Remind</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </div>
          </Card>
        </div>
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
