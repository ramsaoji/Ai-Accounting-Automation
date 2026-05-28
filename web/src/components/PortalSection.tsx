import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

import {
  ArrowRight,
  Search,
  Calendar,
  Database,
  TrendingUp,
  Cpu,
  AlertTriangle
} from 'lucide-react';
const PortalCharts = React.lazy(() => import('./PortalCharts'));

interface PortalSectionProps {
  salesData: any;
  debitorsData: any;
  salesAlertCount: number;
  debitorsAlertCount: number;
  onLaunchWorkspace: (workspace: 'sales' | 'debitors', view?: 'overview' | 'ledger' | 'auditor' | 'advisor') => void;
  cronSchedule: string;
  connectionMode: 'live' | 'static' | 'empty';
}

interface PortalStat {
  label: string;
  value: string;
  positive?: boolean;
  critical?: boolean;
}

interface PortalItem {
  id: string;
  title: string;
  type: string;
  filename: string;
  lastUpdated: string;
  stats: PortalStat[];
  alertCount: number;
  tags: string[];
  sparkline: any[];
  dataKey: string;
  stroke: string;
}

export const PortalSection: React.FC<PortalSectionProps> = ({
  salesData,
  debitorsData,
  salesAlertCount,
  debitorsAlertCount,
  onLaunchWorkspace,
  cronSchedule,
  connectionMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'flagged' | 'audited'>('all');

  const scanScheduleLabel = useMemo(() => {
    if (connectionMode === 'empty') {
      return 'Manual Sync Only';
    }
    if (connectionMode === 'static') {
      return 'Static Offline Sync';
    }
    
    // Parse common patterns
    const clean = cronSchedule.trim().replace(/\s+/g, ' ');
    if (clean === '0 0 * * *') {
      return 'Daily at 12:00 AM (Midnight)';
    }
    if (clean === '*/30 * * * *') {
      return 'Every 30 Minutes';
    }
    if (clean === '0 * * * *') {
      return 'Every Hour';
    }
    return `Scheduled: ${cronSchedule}`;
  }, [cronSchedule, connectionMode]);

  const formatINRValue = (value: number | undefined) => {
    if (value === undefined || value === null) return '—';
    const isNegative = value < 0;
    const absVal = Math.abs(value);
    let formatted = '';
    if (absVal >= 10000000) {
      formatted = `₹${parseFloat((absVal / 10000000).toFixed(2))} Cr`;
    } else if (absVal >= 100000) {
      formatted = `₹${parseFloat((absVal / 100000).toFixed(2))} L`;
    } else {
      formatted = `₹${absVal.toLocaleString('en-IN')}`;
    }
    return isNegative ? `-${formatted}` : formatted;
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'Never';
    if (ts.includes(',') || ts.toLowerCase().includes('am') || ts.toLowerCase().includes('pm')) {
      return ts;
    }
    const parsed = new Date(ts);
    if (isNaN(parsed.getTime())) {
      return ts;
    }
    return parsed.toLocaleString();
  };

  // Filter & Portals logic combined
  const filteredPortals = useMemo(() => {
    const portalsList: PortalItem[] = [
      {
        id: 'sales',
        title: salesData ? salesData.fileName.replace(/\.[^/.]+$/, "") : 'Daily Sales Register',
        type: 'Sales cash register',
        filename: salesData ? salesData.fileName : 'No spreadsheet uploaded',
        lastUpdated: salesData ? formatTimestamp(salesData.runTimestamp) : 'Never',
        stats: [
          { label: 'Consolidated Inflows', value: salesData ? formatINRValue(salesData.masterTotals?.totalInflows) : '—' },
          { label: 'Net Cash Surplus', value: salesData ? formatINRValue(salesData.masterTotals?.netCashflow) : '—', positive: salesData ? (salesData.masterTotals?.netCashflow >= 0) : undefined },
        ],
        alertCount: salesAlertCount,
        tags: salesData 
          ? ['Sales Registry', `${salesData.totalMonths || 0} Months`, `${(salesData.totalTransactions || 0).toLocaleString()} Transactions`]
          : ['Sales Registry', 'Awaiting Ingestion'],
        sparkline: salesData?.months?.map((m: any) => ({ net: m.net })) || [],
        dataKey: 'net',
        stroke: 'var(--primary)'
      },
      {
        id: 'debitors',
        title: debitorsData ? debitorsData.fileName.replace(/\.[^/.]+$/, "") : 'Customer Debitors Outstanding',
        type: 'Debitors Ledger',
        filename: debitorsData ? debitorsData.fileName : 'No spreadsheet uploaded',
        lastUpdated: debitorsData ? formatTimestamp(debitorsData.runTimestamp) : 'Never',
        stats: [
          { label: 'Outstanding Balance', value: debitorsData ? formatINRValue(debitorsData.aggregates?.totalPendingSum) : '—', critical: true },
          { 
            label: 'Recovery Success', 
            value: debitorsData 
              ? (String(debitorsData.aggregates?.collectionSuccessRate).endsWith('%') 
                  ? debitorsData.aggregates?.collectionSuccessRate 
                  : `${debitorsData.aggregates?.collectionSuccessRate}%`) 
              : '—' 
          },
        ],
        alertCount: debitorsAlertCount,
        tags: debitorsData
          ? ['Debitors Ledger', `${debitorsData.aggregates?.activeDebitorsCount || 0} Customers`, 'Udhari Register']
          : ['Debitors Ledger', 'Awaiting Ingestion'],
        sparkline: debitorsData?.topDebitors?.map((d: any) => ({ pending: d.pending })) || [],
        dataKey: 'pending',
        stroke: 'var(--destructive)'
      }
    ];

    return portalsList.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        activeFilter === 'all' ||
        (activeFilter === 'flagged' && p.alertCount > 0) ||
        (activeFilter === 'audited' && p.alertCount === 0);

      return matchesSearch && matchesFilter;
    });
  }, [salesData, debitorsData, salesAlertCount, debitorsAlertCount, searchQuery, activeFilter]);

  return (
    <div className="flex flex-col gap-4 md:gap-6 w-full animate-in fade-in duration-300">
      {/* Vercel-style Sub-header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 md:pb-5">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-tight text-foreground">
            Financial Ledger Consoles
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overview of active spreadsheet imports, AI pipeline executions, and audit exceptions.
          </p>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search database consoles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Console Filters */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto select-none">
          {(['all', 'flagged', 'audited'] as const).map((filter) => {
            const tooltipContent = 
              filter === 'all' 
                ? 'Show all imported ledger registers.' 
                : filter === 'flagged' 
                  ? 'Show only ledgers containing active anomalies or warnings.' 
                  : 'Show verified ledgers completely clear of exceptions.';

            return (
              <Tooltip key={filter}>
                <TooltipTrigger render={
                  <button
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-semibold capitalize transition-all duration-200 cursor-pointer select-none ${
                      activeFilter === filter
                        ? 'bg-foreground text-background border-foreground hover:bg-foreground/90'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border/80'
                    }`}
                  >
                    {filter}
                  </button>
                } />
                <TooltipContent className="block max-w-[240px] p-3 text-[0.72rem] leading-relaxed border bg-popover text-popover-foreground shadow-md rounded-lg">
                  {tooltipContent}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Project Switcher Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-1">
        {filteredPortals.length === 0 ? (
          <div className="col-span-2 text-center py-20 border rounded-xl bg-card/20 text-xs text-muted-foreground">
            No active database consoles match your search filter.
          </div>
        ) : (
          filteredPortals.map((portal) => (
            <Card
              key={portal.id}
              className="border hover:border-primary/50 hover:shadow-sm transition-all duration-300 bg-card/45 overflow-hidden flex flex-col justify-between group cursor-pointer"
              onClick={() => onLaunchWorkspace(portal.id as 'sales' | 'debitors')}
            >
              <div className="p-4 md:p-6 flex flex-col gap-4 md:gap-5">
                {/* Card Title & Icon */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-muted/60 flex items-center justify-center border border-border/80 text-muted-foreground group-hover:text-primary group-hover:border-primary/45 group-hover:bg-primary/10 transition-all shrink-0">
                      <Database className="size-5" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-sm font-bold text-foreground tracking-tight transition-colors">
                        {portal.title}
                      </h3>
                      <span className="text-[0.65rem] text-muted-foreground font-semibold leading-none mt-0.5">
                        {portal.type}
                      </span>
                    </div>
                  </div>

                  {/* Active badge */}
                  <span className="flex items-center gap-1 text-[0.62rem] font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full select-none">
                    <span className="size-1.5 rounded-full bg-success"></span>
                    Active
                  </span>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 gap-3 md:gap-4 bg-muted/20 p-2.5 md:p-3 rounded-lg border">
                  {portal.stats.map((stat) => (
                    <div key={stat.label} className="flex flex-col gap-0.5">
                      <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">
                        {stat.label}
                      </span>
                      <span className="text-base font-extrabold font-mono leading-tight mt-0.5 text-foreground">
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Trend line and meta description */}
                <div className="flex items-center justify-between gap-4 py-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider select-none">
                      Dynamic Trend
                    </span>
                    {portal.alertCount > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaunchWorkspace(portal.id as 'sales' | 'debitors', 'auditor');
                        }}
                        className="text-[0.68rem] text-destructive dark:text-red-400 font-semibold flex items-center gap-1 mt-0.5 hover:underline focus:outline-none cursor-pointer text-left"
                      >
                        <AlertTriangle className="size-3.5 text-destructive dark:text-red-400 shrink-0" />
                        <span>Flagged: {portal.alertCount} {portal.alertCount === 1 ? 'anomaly' : 'anomalies'}</span>
                      </button>
                    ) : (
                      <span className="text-[0.68rem] text-success font-semibold flex items-center gap-1 mt-0.5">
                        <TrendingUp className="size-3.5 text-success" />
                        <span>Audited stability log</span>
                      </span>
                    )}
                  </div>

                  {/* Sparkline Graph */}
                  <div className="w-24 h-8 select-none opacity-80 group-hover:opacity-100 transition-opacity">
                    {portal.sparkline && portal.sparkline.length > 0 ? (
                      <React.Suspense fallback={<div className="w-full h-full border border-dashed border-border/40 rounded-lg flex items-center justify-center text-[0.58rem] text-muted-foreground font-mono bg-muted/5 animate-pulse select-none">Loading…</div>}>
                        <PortalCharts data={portal.sparkline} dataKey={portal.dataKey} stroke={portal.stroke} />
                      </React.Suspense>
                    ) : (
                      <div className="w-full h-full border border-dashed border-border/40 rounded-lg flex items-center justify-center text-[0.58rem] text-muted-foreground font-mono bg-muted/5 select-none">
                        No trend data
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer: Metadata tags + Action button */}
              <div className="border-t px-4 py-3 md:px-6 md:py-3.5 bg-muted/20 flex items-center justify-between gap-4">
                <div className="flex flex-wrap gap-1.5">
                  {portal.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[0.6rem] font-bold text-muted-foreground border px-2 py-0.5 rounded bg-background shrink-0 font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <span>Open</span>
                  <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Human-readable Business Protection Guide */}
      <div className="border border-border/80 rounded-xl p-4 md:p-5 bg-muted/15 flex flex-col gap-3 md:gap-4 mt-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <Cpu className="size-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">Automated Bookkeeping Safety Checks</h4>
              <p className="text-[0.75rem] text-muted-foreground mt-1 leading-normal max-w-2xl">
                Every spreadsheet ingestion automatically passes through our <strong>Smart Integrity Engine</strong>. 
                We scan every transaction to safeguard your finances from manual typing errors, double billing, or cost spikes, sending instant alerts to your AI Strategic Advisor.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[0.68rem] text-muted-foreground font-mono bg-background border px-3 py-1.5 rounded-lg shrink-0 self-start sm:self-auto select-none">
            <Calendar className="size-3.5" />
            <span>Scan Schedule: {scanScheduleLabel}</span>
          </div>
        </div>

        {/* Audit Scope Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-border/50 select-none">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
            <span className="text-base select-none">🚫</span>
            <div className="flex flex-col">
              <span className="font-bold text-[0.68rem] text-foreground">Duplicate Bills</span>
              <span className="text-[0.58rem] text-muted-foreground">Catches double entries</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
            <span className="text-base select-none">💸</span>
            <div className="flex flex-col">
              <span className="font-bold text-[0.68rem] text-foreground">Large Payments</span>
              <span className="text-[0.58rem] text-muted-foreground">Flags bills &gt; ₹50,000</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
            <span className="text-base select-none">📈</span>
            <div className="flex flex-col">
              <span className="font-bold text-[0.68rem] text-foreground">Cost Spikes</span>
              <span className="text-[0.58rem] text-muted-foreground">Alerts 3x average jumps</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
            <span className="text-base select-none">🕒</span>
            <div className="flex flex-col">
              <span className="font-bold text-[0.68rem] text-foreground">Late Logging</span>
              <span className="text-[0.58rem] text-muted-foreground">Checks off-hours posts</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
            <span className="text-base select-none">⚠️</span>
            <div className="flex flex-col">
              <span className="font-bold text-[0.68rem] text-foreground">Value Check</span>
              <span className="text-[0.58rem] text-muted-foreground">Flags zero/negative slips</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
