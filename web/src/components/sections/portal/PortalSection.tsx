import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { MasterSummary, MonthlySummary, DebitorSummary } from '@/types';
import { Search } from 'lucide-react';
import { formatINRValue, formatTimestamp, formatCronExpression } from '@/utils/format';
import { PortalCard } from './portal/PortalCard';
import { SafetyChecksGuide } from './portal/SafetyChecksGuide';

interface PortalSectionProps {
  salesData: MasterSummary | null;
  debitorsData: MasterSummary | null;
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
  alertCount: number;
  tags: string[];
  sparkline: SparklineItem[];
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
    
    return formatCronExpression(cronSchedule);
  }, [cronSchedule, connectionMode]);

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
          { label: 'Net Cash Surplus', value: salesData ? formatINRValue(salesData.masterTotals?.netCashflow) : '—', positive: salesData?.masterTotals?.netCashflow !== undefined ? (salesData.masterTotals.netCashflow >= 0) : undefined },
        ],
        alertCount: salesAlertCount,
        tags: salesData 
          ? ['Sales Registry', `${salesData.totalMonths || 0} Months`, `${(salesData.totalTransactions || 0).toLocaleString()} Transactions`]
          : ['Sales Registry', 'Awaiting Ingestion'],
        sparkline: salesData?.months?.map((m: MonthlySummary) => ({ net: m.net })) || [],
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
            value: debitorsData?.aggregates?.collectionSuccessRate !== undefined 
              ? (String(debitorsData.aggregates.collectionSuccessRate).endsWith('%') 
                  ? String(debitorsData.aggregates.collectionSuccessRate) 
                  : `${debitorsData.aggregates.collectionSuccessRate}%`) 
              : '—' 
          },
        ],
        alertCount: debitorsAlertCount,
        tags: debitorsData
          ? ['Debitors Ledger', `${debitorsData.aggregates?.activeDebitorsCount || 0} Customers`, 'Udhari Register']
          : ['Debitors Ledger', 'Awaiting Ingestion'],
        sparkline: debitorsData?.topDebitors?.map((d: DebitorSummary) => ({ pending: d.pending })) || [],
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
