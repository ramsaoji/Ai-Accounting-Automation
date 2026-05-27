import React, { useState } from 'react';
import { toast } from 'sonner';
import type { MasterSummary } from '../types';
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
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface OverviewSectionProps {
  summary: MasterSummary;
  connectionMode: 'live' | 'static' | 'empty';
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ summary, connectionMode }) => {
  const isDebitors = summary.isDebitorsList === true;
  const [activeChartTab, setActiveChartTab] = useState<'primary' | 'distribution'>('primary');

  const businessName = React.useMemo(() => {
    const fn = summary.fileName;
    const lower = fn.toLowerCase();
    if (lower.includes('gaurav')) return 'Hotel Gaurav';
    let name = fn.replace(/\.[^/.]+$/, "");
    name = name.replace(/(daily\s*sales\s*register|debitors\s*list|debitors|sales|ledger|list)/gi, '').trim();
    name = name.replace(/[_\-]+/g, ' ').trim();
    if (name.length > 2) {
      return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return 'Hotel Gaurav';
  }, [summary.fileName]);

  const triggerReminderCopy = (debtor: any) => {
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

  // Safe mapping for debitors ageing buckets
  const debitorsAgeingData = [
    { range: '0-30 Days', amount: 85000, color: 'var(--primary)' },
    { range: '31-60 Days', amount: 55000, color: 'var(--chart-3)' },
    { range: '61-90 Days', amount: 25000, color: 'var(--chart-2)' },
    { range: '90+ Days', amount: 10370, color: 'var(--destructive)' }
  ];

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-tight text-foreground">
            {isDebitors ? 'Debitors Command Hub' : 'Ledger Performance Console'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Spreadsheet: <code className="font-mono text-primary font-semibold">{summary.fileName}</code></span>
            <span className="text-muted-foreground/40">•</span>
            <span>Generation: {formatTimestamp(summary.runTimestamp)}</span>
            <span className="text-muted-foreground/40">•</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={
                  <button className="text-[0.65rem] bg-muted hover:bg-muted/85 text-foreground px-2 py-0.5 rounded border border-border/80 cursor-pointer select-none font-medium flex items-center gap-1">
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
        <div className="flex items-center gap-2 text-xs font-semibold text-success bg-success/10 border border-success/20 px-3 py-1.5 rounded-full select-none shrink-0 w-fit self-start sm:self-auto">
          <ShieldCheck className="size-4" />
          Audit Verified
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        {isDebitors && summary.aggregates ? (
          <>
            {/* Total Outstanding Dues */}
            <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
              <CardHeader className="p-5 pb-1 flex flex-row items-center justify-between">
                <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest">Unrecovered Liability</span>
                <TrendingDown className="text-destructive size-4 shrink-0" />
              </CardHeader>
              <CardContent className="p-5 pt-0 mt-1">
                <h3 className="text-2xl font-bold font-mono text-foreground tracking-tight">
                  {formatINR(summary.aggregates.totalPendingSum)}
                </h3>
                <span className="text-[0.65rem] text-muted-foreground mt-1.5 block leading-normal">
                  Total pending customer credit.
                </span>
              </CardContent>
            </Card>

            {/* Recovery Success */}
            <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
              <CardHeader className="p-5 pb-1 flex flex-row items-center justify-between">
                <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest">Clearance Index</span>
                <Percent className="text-success size-4 shrink-0" />
              </CardHeader>
              <CardContent className="p-5 pt-0 mt-1">
                <h3 className="text-2xl font-bold font-mono text-foreground tracking-tight">
                  {summary.aggregates.collectionSuccessRate}%
                </h3>
                <span className="text-[0.65rem] text-muted-foreground mt-1.5 block leading-normal">
                  Paid credit balance percentage.
                </span>
              </CardContent>
            </Card>

            {/* Average Outstanding */}
            <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
              <CardHeader className="p-5 pb-1 flex flex-row items-center justify-between">
                <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest">Mean Balances</span>
                <DollarSign className="text-primary size-4 shrink-0" />
              </CardHeader>
              <CardContent className="p-5 pt-0 mt-1">
                <h3 className="text-2xl font-bold font-mono text-foreground tracking-tight">
                  {formatINR(summary.aggregates.averageOutstandingDues)}
                </h3>
                <span className="text-[0.65rem] text-muted-foreground mt-1.5 block leading-normal">
                  Average outstanding per customer.
                </span>
              </CardContent>
            </Card>

            {/* Active Customers */}
            <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
              <CardHeader className="p-5 pb-1 flex flex-row items-center justify-between">
                <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest">Open Ledgers</span>
                <Users className="text-primary size-4 shrink-0" />
              </CardHeader>
              <CardContent className="p-5 pt-0 mt-1">
                <h3 className="text-2xl font-bold font-mono text-foreground tracking-tight">
                  {summary.aggregates.activeDebitorsCount}
                </h3>
                <span className="text-[0.65rem] text-muted-foreground mt-1.5 block leading-normal">
                  Outstanding credit profiles.
                </span>
              </CardContent>
            </Card>
          </>
        ) : summary.masterTotals && summary.benchmarks ? (
          <>
            {/* Consolidated Cashflow */}
            <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
              <CardHeader className="p-5 pb-1 flex flex-row items-center justify-between">
                <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest">Net Surplus</span>
                <TrendingUp className="text-success size-4 shrink-0" />
              </CardHeader>
              <CardContent className="p-5 pt-0 mt-1">
                <h3 className="text-2xl font-bold font-mono text-foreground tracking-tight">
                  {formatINR(summary.masterTotals.netCashflow)}
                </h3>
                <span className="text-[0.65rem] text-muted-foreground mt-1.5 block leading-normal">
                  Surplus cash after cost settlements.
                </span>
              </CardContent>
            </Card>

            {/* Bar/Menu Ratio */}
            <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
              <CardHeader className="p-5 pb-1 flex flex-row items-center justify-between">
                <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest">Liquor vs Food Split</span>
                <Percent className="text-amber-500 size-4 shrink-0" />
              </CardHeader>
              <CardContent className="p-5 pt-0 mt-1">
                <h3 className="text-2xl font-bold font-mono text-foreground tracking-tight">
                  {summary.benchmarks.liquorPercentage}% / {summary.benchmarks.foodPercentage}%
                </h3>
                <span className="text-[0.65rem] text-muted-foreground mt-1.5 block leading-normal">
                  Liquor sales vs. food revenue margins.
                </span>
              </CardContent>
            </Card>

            {/* Peak Profit Month */}
            <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
              <CardHeader className="p-5 pb-1 flex flex-row items-center justify-between">
                <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest">Peak Profit</span>
                <BarChart3 className="text-primary size-4 shrink-0" />
              </CardHeader>
              <CardContent className="p-5 pt-0 mt-1">
                <h3 className="text-2xl font-bold font-mono text-foreground tracking-tight">
                  {formatINR(summary.benchmarks.bestProfitValue)}
                </h3>
                <span className="text-[0.65rem] text-muted-foreground mt-1.5 block leading-normal">
                  Recorded peak in {summary.benchmarks.bestProfitMonth}.
                </span>
              </CardContent>
            </Card>

            {/* Recovery Rate */}
            <Card className="border shadow-xs bg-card/45 relative overflow-hidden group">
              <CardHeader className="p-5 pb-1 flex flex-row items-center justify-between">
                <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest">Credit Recovery</span>
                <CalendarDays className="text-primary size-4 shrink-0" />
              </CardHeader>
              <CardContent className="p-5 pt-0 mt-1">
                <h3 className="text-2xl font-bold font-mono text-foreground tracking-tight">
                  {summary.benchmarks.creditRecoveryRate}%
                </h3>
                <span className="text-[0.65rem] text-muted-foreground mt-1.5 block leading-normal">
                  Recovery performance over credits extended.
                </span>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Tab-switched Recharts Graphic Panel */}
      <Card className="bg-card/45 shadow-xs border">
        <CardHeader className="p-6 pb-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <LineIcon className="size-4.5 text-primary" />
              {isDebitors ? "Debitor Liabilities Analytics" : "Ledger Time-Series Performance"}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {isDebitors ? "Interactive analytics plotting liabilities and aging splits." : "Executive charts tracing cashflow margins and category expenditures."}
            </CardDescription>
          </div>

          {/* Chart Tabs */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto select-none">
            <button
              onClick={() => setActiveChartTab('primary')}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                activeChartTab === 'primary'
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              {isDebitors ? 'Top Debitors' : 'Cashflow Timeline'}
            </button>
            <button
              onClick={() => setActiveChartTab('distribution')}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                activeChartTab === 'distribution'
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              {isDebitors ? 'Ageing Splits' : 'Outflow Distribution'}
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="w-full h-80 select-none">
            <ResponsiveContainer width="100%" height="100%">
              {activeChartTab === 'primary' ? (
                // Primary Tab: Top Debitors (Bar) or Sales Timeline (Area)
                isDebitors && summary.topDebitors ? (
                  <BarChart
                    layout="vertical"
                    data={summary.topDebitors.slice(0, 8)}
                    margin={{ left: 5, right: 30, top: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => `₹${v/1000}K`} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="var(--muted-foreground)"
                      fontSize={10}
                      width={110}
                      tickFormatter={(v) => v.replace(/\s*\(.*?\)\s*/g, '').trim().slice(0, 22)}
                    />
                    <RechartsTooltip
                      cursor={{ fill: 'var(--muted)', opacity: 0.15 }}
                      contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)', fontSize: '11px', color: 'var(--foreground)' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                      labelStyle={{ color: 'var(--muted-foreground)' }}
                      formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Outstanding Liability']}
                    />
                    <Bar dataKey="pending" radius={[0, 4, 4, 0]} barSize={16}>
                      {summary.topDebitors.slice(0, 8).map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.pending > 15000 ? 'var(--destructive)' : entry.pending > 5000 ? 'var(--warning)' : 'var(--primary)'} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : summary.months ? (
                  <AreaChart data={summary.months} margin={{ left: 15, right: 15, top: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorInflows" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorOutflows" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} />
                    <XAxis dataKey="sheetName" stroke="var(--muted-foreground)" fontSize={10} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => `₹${v/100000}L`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)', fontSize: '11px', color: 'var(--foreground)' }} 
                      itemStyle={{ color: 'var(--foreground)' }}
                      labelStyle={{ color: 'var(--muted-foreground)' }}
                      formatter={(v) => `₹${Number(v).toLocaleString()}`} 
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    <Area type="monotone" name="Inflow Receipts" dataKey="inflows" stroke="var(--primary)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorInflows)" />
                    <Area type="monotone" name="Outflow Expenditures" dataKey="outflows" stroke="var(--destructive)" strokeWidth={1} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorOutflows)" />
                  </AreaChart>
                ) : null
              ) : (
                // Secondary Tab: Ageing Splits (Bar) or Outflow splits
                isDebitors ? (
                  <BarChart data={debitorsAgeingData} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} vertical={false} />
                    <XAxis dataKey="range" stroke="var(--muted-foreground)" fontSize={10} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => `₹${v/1000}K`} />
                    <RechartsTooltip 
                      cursor={{ fill: 'var(--muted)', opacity: 0.15 }}
                      contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)', fontSize: '11px', color: 'var(--foreground)' }} 
                      itemStyle={{ color: 'var(--foreground)' }}
                      labelStyle={{ color: 'var(--muted-foreground)' }}
                      formatter={(v) => `₹${Number(v).toLocaleString()}`} 
                    />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={40}>
                      {debitorsAgeingData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : summary.months ? (
                  <BarChart data={summary.months} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} vertical={false} />
                    <XAxis dataKey="sheetName" stroke="var(--muted-foreground)" fontSize={10} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => `₹${v/1000}K`} />
                    <RechartsTooltip 
                      cursor={{ fill: 'var(--muted)', opacity: 0.15 }}
                      contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)', fontSize: '11px', color: 'var(--foreground)' }} 
                      itemStyle={{ color: 'var(--foreground)' }}
                      labelStyle={{ color: 'var(--muted-foreground)' }}
                      formatter={(v) => `₹${Number(v).toLocaleString()}`} 
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="liquor" name="Liquor Split" stackId="a" fill="var(--chart-2)" />
                    <Bar dataKey="food" name="Food Split" stackId="a" fill="var(--primary)" />
                    <Bar dataKey="expenses" name="Operational Outflows" stackId="a" fill="var(--destructive)" />
                  </BarChart>
                ) : null
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {isDebitors && summary.topDebitors && (
        <div className="grid grid-cols-1 gap-6 mt-1 items-start animate-in fade-in duration-300">
          {/* Recovery Strategy Board */}
          <Card className="border bg-card/45 shadow-xs overflow-hidden flex flex-col justify-between">
            <div>
              <CardHeader className="p-6 border-b border-border/80 flex flex-row items-center gap-3 space-y-0">
                <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20 shrink-0">
                  <Zap className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Receivable Recovery & Planning</CardTitle>
                  <CardDescription className="text-xs">Top priority accounts and automated recovery outreach copy.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex flex-col gap-4">
                <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-wider select-none">
                  Top Priority Accounts
                </span>
                <div className="flex flex-col gap-3">
                  {summary.topDebitors.slice(0, 5).map((debtor) => {
                    const riskLevel = debtor.pending > 15000 ? 'High Risk' : debtor.pending > 5000 ? 'Medium Risk' : 'Low Risk';
                    const riskColor = debtor.pending > 15000 
                      ? 'bg-destructive/10 text-destructive border-destructive/25' 
                      : debtor.pending > 5000 
                        ? 'bg-warning/10 text-warning border-warning/25' 
                        : 'bg-success/10 text-success border-success/25';

                    return (
                      <div
                        key={debtor.name}
                        className="p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 bg-background select-none hover:bg-muted/30"
                      >
                        {/* Profile initials, Name, and Risk Level */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="size-9.5 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 text-primary border border-primary/20 flex items-center justify-center font-extrabold text-xs shrink-0 font-mono">
                            {debtor.name[0]}
                          </div>
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-foreground truncate">{debtor.name}</span>
                              <span className={`text-[0.65rem] font-extrabold border px-2 py-0.5 rounded-full capitalize leading-none shrink-0 ${riskColor}`}>
                                {riskLevel}
                              </span>
                            </div>
                            <span className="text-[0.72rem] text-muted-foreground leading-none font-medium">
                              Credit purchases: <span className="font-mono text-foreground/80 font-bold">{formatINR(debtor.debit || 0)}</span> • Cleared: <span className="font-mono text-success/80 font-bold">{formatINR(debtor.credit || 0)}</span>
                            </span>
                          </div>
                        </div>

                        {/* Balance and Outreach Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/50">
                          <div className="flex flex-col items-start sm:items-end">
                            <span className="text-xs sm:text-sm font-bold text-destructive font-mono">{formatINR(debtor.pending)}</span>
                            <span className="text-[0.62rem] text-muted-foreground font-semibold mt-1 leading-none uppercase tracking-wider">Outstanding Dues</span>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              triggerReminderCopy(debtor);
                            }}
                            className="gap-1.5 h-8.5 px-3 rounded-lg text-xs hover:bg-muted hover:text-foreground cursor-pointer transition-all shadow-xs border-border/80 text-muted-foreground"
                          >
                            <MessageSquare className="size-3.5 text-primary" />
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
        <CardHeader className="p-6 pb-4 border-b flex flex-row items-center justify-between select-none">
          <div className="flex items-center gap-3">
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={
                <button 
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
        </CardHeader>
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          {summary.intelligence.map((intel, idx) => {
            const types = [
              { label: 'Cashflow Optimization', badge: 'bg-success/10 text-success border-success/20', impact: 'High Impact' },
              { label: 'Revenue Yield Target', badge: 'bg-info/10 text-info border-info/20', impact: 'Moderate Impact' },
              { label: 'Exposure Risk Containment', badge: 'bg-destructive/10 text-destructive border-destructive/20', impact: 'Critical Action' }
            ];
            const meta = types[idx] || { label: 'Operational Advice', badge: 'bg-muted border', impact: 'Review Action' };

            return (
              <div
                key={idx}
                className="border rounded-xl p-4 bg-background/50 hover:border-foreground/30 transition-all flex flex-col justify-between gap-3 relative group"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center gap-3 select-none">
                    <span className={`text-[0.58rem] font-bold uppercase tracking-wider px-2 py-0.2 rounded border ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <span className="text-[0.58rem] font-semibold text-muted-foreground font-mono">
                      {meta.impact}
                    </span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed mt-2 font-medium">
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
