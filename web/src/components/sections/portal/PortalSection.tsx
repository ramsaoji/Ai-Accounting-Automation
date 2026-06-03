import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { MasterSummary, MonthlySummary, DebitorSummary } from '@/types';
import { Search, X } from 'lucide-react';
import { formatINRValue, formatTimestamp, formatCronExpression } from '@/utils/format';
import { PortalCard } from './portal/PortalCard';
import { SafetyChecksGuide } from './portal/SafetyChecksGuide';

interface PortalSectionProps {
  salesData: MasterSummary | null;
  debitorsData: MasterSummary | null;
  stockData: MasterSummary | null;
  onLaunchWorkspace: (workspace: 'sales' | 'debitors' | 'godown_stock', view?: 'overview' | 'ledger' | 'auditor' | 'advisor') => void;
  cronSchedule: string;
  connectionMode: 'live' | 'static' | 'empty';
}

interface PortalStat {
  label: string;
  value: string;
  positive?: boolean;
  critical?: boolean;
}

interface SparklineItem {
  net?: number;
  pending?: number;
}

interface PortalItem {
  id: string;
  title: string;
  type: string;
  filename: string;
  lastUpdated: string;
  stats: PortalStat[];
  alertCount: number;       // High/medium/critical alerts only (badge display)
  totalAlertCount: number;  // All alerts (for 'flagged' filter)
  tags: string[];
  sparkline: SparklineItem[];
  dataKey: string;
  stroke: string;
  isActive: boolean;
}

export const PortalSection: React.FC<PortalSectionProps> = ({
  salesData,
  debitorsData,
  stockData,
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
    
    return formatCronExpression(cronSchedule);
  }, [cronSchedule, connectionMode]);

  // Filter & Portals logic combined
  const filteredPortals = useMemo(() => {
    // Helper: parse month sheet name into Date
    function parseSheetDate(label: string): Date | null {
      const d = new Date(label + ' 1');  // try direct parse
      if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
        return d;
      }
      const monthsMap: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
        jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const clean = label.trim().toLowerCase();
      const yearM = clean.match(/\b(20\d{2})\b/);
      const monM = clean.match(/(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|october|oct|november|nov|december|dec)/);
      if (yearM && monM) {
        return new Date(parseInt(yearM[1], 10), monthsMap[monM[0]], 1);
      }
      return null;
    }

    // Helper: format a date range tag for a register
    function buildDateRangeTag(dateRange: { from: string; to: string } | null | undefined): string | null {
      if (!dateRange) return null;
      const { from, to } = dateRange;
      // Shorten to "MMM 'YY" format for display
      const shorten = (label: string) => {
        const d = parseSheetDate(label);
        if (d) {
          return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        }
        return label;
      };
      if (from === to) return shorten(from);
      return `${shorten(from)} – ${shorten(to)}`;
    }

    // Helper: format a stock date range from ISO-ish date strings
    function buildStockDateTag(dateRange: { from: string; to: string } | null | undefined): string | null {
      if (!dateRange) return null;
      const fmt = (d: string) => {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
          return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
        }
        return d;
      };
      if (dateRange.from === dateRange.to) return fmt(dateRange.from);
      return `${fmt(dateRange.from)} – ${fmt(dateRange.to)}`;
    }

    // Helper: calculate human-readable duration/span
    function buildDurationTag(dateRange: { from: string; to: string } | null | undefined, isStock: boolean, totalMonths?: number): string | null {
      if (!dateRange) {
        if (!isStock && totalMonths) {
          if (totalMonths === 1) return '30 days data';
          if (totalMonths < 12) return `${totalMonths} months data`;
          const yrs = Math.floor(totalMonths / 12);
          const mos = totalMonths % 12;
          if (mos === 0) return `${yrs} yr data`;
          return `${yrs} yr ${mos} mo data`;
        }
        return null;
      }
      
      const { from, to } = dateRange;
      let dateFrom: Date | null = null;
      let dateTo: Date | null = null;

      if (isStock) {
        const f = new Date(from);
        const t = new Date(to);
        if (!isNaN(f.getTime())) dateFrom = f;
        if (!isNaN(t.getTime())) dateTo = t;
      } else {
        dateFrom = parseSheetDate(from);
        dateTo = parseSheetDate(to);
      }

      if (!dateFrom || !dateTo) return null;

      if (dateFrom > dateTo) {
        const temp = dateFrom;
        dateFrom = dateTo;
        dateTo = temp;
      }

      const diffMs = Math.abs(dateTo.getTime() - dateFrom.getTime());
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (isStock) {
        if (diffDays <= 1) {
          return "1 day data";
        }
        if (diffDays <= 31) {
          return `${diffDays} days data`;
        }
        if (diffDays < 365) {
          const months = Math.round(diffDays / 30);
          return `${months} months data`;
        }
        const yrs = Math.floor(diffDays / 365);
        const mos = Math.round((diffDays % 365) / 30);
        if (mos === 0) {
          return `${yrs} yr data`;
        }
        return `${yrs} yr ${mos} mo data`;
      } else {
        const months = (dateTo.getFullYear() - dateFrom.getFullYear()) * 12 + (dateTo.getMonth() - dateFrom.getMonth()) + 1;
        if (months === 1) {
          return "30 days data";
        }
        if (months < 12) {
          return `${months} months data`;
        }
        const yrs = Math.floor(months / 12);
        const mos = months % 12;
        if (mos === 0) {
          return `${yrs} yr data`;
        }
        return `${yrs} yr ${mos} mo data`;
      }
    }

    const portalsList: PortalItem[] = [
      {
        id: 'sales',
        title: salesData ? salesData.fileName.replace(/\.[^/.]+$/, "") : 'Daily Sales Register',
        type: 'Sales cash register',
        filename: salesData ? salesData.fileName : 'No spreadsheet uploaded',
        lastUpdated: salesData ? formatTimestamp(salesData.runTimestamp) : 'Never',
        stats: [
          { label: 'Consolidated Inflows', value: salesData ? formatINRValue(salesData.masterTotals?.totalInflows) : '—' },
          { label: 'Net Cash Surplus', value: salesData ? formatINRValue(salesData.masterTotals?.netCashflow) : '—', positive: salesData?.masterTotals?.netCashflow !== undefined ? (salesData.masterTotals.netCashflow >= 0) : undefined },
        ],
        alertCount: salesData?.highAlertCount ?? salesData?.alerts?.length ?? 0,
        totalAlertCount: salesData?.alerts?.length ?? 0,
        tags: salesData
          ? ([
              'Sales Registry',
              buildDurationTag(salesData.dateRange, false, salesData.totalMonths) || `${salesData.totalMonths || 0} Months`,
              buildDateRangeTag(salesData.dateRange),
              `${(salesData.totalTransactions || 0).toLocaleString()} Transactions`,
            ].filter(Boolean) as string[])
          : ['Sales Registry', 'Awaiting Ingestion'],
        sparkline: salesData?.months?.map((m: MonthlySummary) => ({ net: m.net })) || [],
        dataKey: 'net',
        stroke: 'var(--primary)',
        isActive: !!salesData
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
            value: debitorsData?.aggregates?.collectionSuccessRate !== undefined 
              ? (String(debitorsData.aggregates.collectionSuccessRate).endsWith('%') 
                  ? String(debitorsData.aggregates.collectionSuccessRate) 
                  : `${debitorsData.aggregates.collectionSuccessRate}%`) 
              : '—' 
          },
        ],
        alertCount: debitorsData?.highAlertCount ?? debitorsData?.alerts?.length ?? 0,
        totalAlertCount: debitorsData?.alerts?.length ?? 0,
        tags: debitorsData
          ? [
              'Debitors Ledger',
              `${debitorsData.aggregates?.activeDebitorsCount || 0} Customers`,
              debitorsData.runTimestamp
                ? `Imported ${new Date(debitorsData.runTimestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}`
                : 'Udhari Register',
            ]
          : ['Debitors Ledger', 'Awaiting Ingestion'],
        sparkline: debitorsData?.topDebitors?.map((d: DebitorSummary) => ({ pending: d.pending })) || [],
        dataKey: 'pending',
        stroke: 'var(--destructive)',
        isActive: !!debitorsData
      },
      {
        id: 'godown_stock',
        title: stockData ? stockData.fileName.replace(/\.[^/.]+$/, "") : 'Godown Stock Register',
        type: 'Inventory Valuation & Movement',
        filename: stockData ? stockData.fileName : 'No spreadsheet uploaded',
        lastUpdated: stockData ? formatTimestamp(stockData.runTimestamp) : 'Never',
        stats: [
          { label: 'Stock Valuation (Cost)', value: stockData ? formatINRValue(stockData.aggregates?.totalClosingValue) : '—' },
          { label: 'Active Items', value: stockData ? `${stockData.aggregates?.activeItemsCount || stockData.aggregates?.totalItemsCount || 0} items` : '—' },
        ],
        alertCount: stockData?.highAlertCount ?? stockData?.alerts?.length ?? 0,
        totalAlertCount: stockData?.alerts?.length ?? 0,
        tags: stockData
          ? ([
              'Inventory Registry',
              buildDurationTag(stockData.dateRange, true),
              buildStockDateTag(stockData.dateRange) || 'Godown Counter',
              `${stockData.totalItems ?? stockData.totalTransactions ?? 0} Products`,
            ].filter(Boolean) as string[])
          : ['Inventory Registry', 'Awaiting Ingestion'],
        sparkline: stockData?.historicalTrends?.map((t: any) => ({ net: t.totalCostValue })) || [],
        dataKey: 'net',
        stroke: 'var(--chart-2)',
        isActive: !!stockData
      }
    ];

    return portalsList.filter(p => {
      if (!p.isActive) return false;

      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        activeFilter === 'all' ||
        (activeFilter === 'flagged' && p.totalAlertCount > 0) ||
        (activeFilter === 'audited' && p.totalAlertCount === 0);

      return matchesSearch && matchesFilter;
    });
  }, [salesData, debitorsData, stockData, searchQuery, activeFilter]);

  return (
    <div className="flex flex-col gap-4 md:gap-6 w-full animate-in fade-in duration-300">
      {/* Sub-header */}
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
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search database consoles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-10 sm:h-9 text-xs w-full"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-0.5 rounded-full hover:bg-muted"
              aria-label="Clear console search"
            >
              <X className="size-3" />
            </button>
          )}
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
            <PortalCard
              key={portal.id}
              portal={portal}
              onLaunchWorkspace={onLaunchWorkspace}
            />
          ))
        )}
      </div>

      {/* Bookkeeping Safety Checks */}
      <SafetyChecksGuide scanScheduleLabel={scanScheduleLabel} />
    </div>
  );
};
