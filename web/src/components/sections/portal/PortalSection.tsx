import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { MasterSummary, MonthlySummary, DebitorSummary } from '@/types';
import { Search, X, Brain, Sparkles, ArrowRight, AlertCircle, AlertTriangle, Info, ChevronLeft, ChevronRight, Package, TrendingUp, Users, Filter } from 'lucide-react';
import { formatINRValue, formatTimestamp, formatCronExpression } from '@/utils/format';
import { PortalCard } from './portal/PortalCard';
import { SafetyChecksGuide } from './portal/SafetyChecksGuide';
import { useAccountingStore } from '@/store/useAccountingStore';

interface PortalSectionProps {
  salesData: MasterSummary | null;
  debitorsData: MasterSummary | null;
  stockData: MasterSummary | null;
  counterStockData: MasterSummary | null;
  onLaunchWorkspace: (workspace: 'sales' | 'debitors' | 'godown_stock' | 'counter_stock', view?: 'overview' | 'ledger' | 'auditor' | 'advisor') => void;
  cronSchedule: string;
  connectionMode: 'live' | 'static' | 'empty';
  aiProvider: string;
  webChatEnabled: boolean;
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
  latestSummaryLabel?: string;
  latestSummaryValue?: string;
  latestSummaryPositive?: boolean;
}

interface ProactiveInsightsHubProps {
  salesData: MasterSummary | null;
  debitorsData: MasterSummary | null;
  stockData: MasterSummary | null;
  counterStockData: MasterSummary | null;
  onLaunchWorkspace: (workspace: 'sales' | 'debitors' | 'godown_stock' | 'counter_stock', view?: 'overview' | 'ledger' | 'auditor' | 'advisor') => void;
}

const ProactiveInsightsHub: React.FC<ProactiveInsightsHubProps> = ({
  salesData,
  debitorsData,
  stockData,
  counterStockData,
  onLaunchWorkspace,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const setPendingAdvisorPrompt = useAccountingStore((state) => state.setPendingAdvisorPrompt);

  const suggestedSearches = [
    { label: '🔥 Critical Risks', query: 'critical' },
    { label: '⚠️ High Risks', query: 'high risk' },
    { label: '📦 Stock levels', query: 'inventory' },
    { label: '📊 Valuations', query: 'valuation' },
    { label: '💵 Sales', query: 'sales' },
  ];

  const handleFilterClick = (query: string) => {
    if (searchTerm.toLowerCase() === query.toLowerCase()) {
      setSearchTerm('');
    } else {
      setSearchTerm(query);
    }
  };

  const insights = useMemo(() => {
    const list: {
      text: string;
      source: 'sales' | 'debitors' | 'godown_stock' | 'counter_stock';
      sourceLabel: string;
      severity: 'critical' | 'high' | 'info';
      score: number;
    }[] = [];

    const getSeverityInfo = (text: string) => {
      const t = text.toLowerCase();
      if (t.includes('critical') || t.includes('urgent') || t.includes('danger') || t.includes('immediate') || t.includes('overdue')) {
        return { severity: 'critical' as const, score: 3 };
      }
      if (t.includes('warning') || t.includes('risk') || t.includes('depletion') || t.includes('loss') || t.includes('leak') || t.includes('deficit')) {
        return { severity: 'high' as const, score: 2 };
      }
      return { severity: 'info' as const, score: 1 };
    };

    if (salesData?.intelligence && Array.isArray(salesData.intelligence)) {
      salesData.intelligence.forEach(text => {
        if (!text) return;
        const { severity, score } = getSeverityInfo(text);
        list.push({ text, source: 'sales', sourceLabel: 'Sales Register', severity, score });
      });
    }

    if (debitorsData?.intelligence && Array.isArray(debitorsData.intelligence)) {
      debitorsData.intelligence.forEach(text => {
        if (!text) return;
        const { severity, score } = getSeverityInfo(text);
        list.push({ text, source: 'debitors', sourceLabel: 'Debitors Ledger', severity, score });
      });
    }

    if (stockData?.intelligence && Array.isArray(stockData.intelligence)) {
      stockData.intelligence.forEach(text => {
        if (!text) return;
        const { severity, score } = getSeverityInfo(text);
        list.push({ text, source: 'godown_stock', sourceLabel: 'Godown Inventory', severity, score });
      });
    }

    if (counterStockData?.intelligence && Array.isArray(counterStockData.intelligence)) {
      counterStockData.intelligence.forEach(text => {
        if (!text) return;
        const { severity, score } = getSeverityInfo(text);
        list.push({ text, source: 'counter_stock', sourceLabel: 'Counter Inventory', severity, score });
      });
    }

    return list.sort((a, b) => b.score - a.score);
  }, [salesData, debitorsData, stockData, counterStockData]);

  const filteredInsights = useMemo(() => {
    if (!searchTerm.trim()) return insights;
    const term = searchTerm.toLowerCase();
    return insights.filter(item => {
      const severityLabel = item.severity === 'critical' 
        ? 'critical' 
        : item.severity === 'high' 
          ? 'high risk' 
          : 'strategic';
      return (
        item.text.toLowerCase().includes(term) || 
        item.sourceLabel.toLowerCase().includes(term) ||
        severityLabel.includes(term)
      );
    });
  }, [insights, searchTerm]);

  // Reset page when search term changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (insights.length === 0) return null;

  const itemsPerPage = 3;
  const totalPages = Math.max(1, Math.ceil(filteredInsights.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedInsights = filteredInsights.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const rangeStart = (activePage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(activePage * itemsPerPage, filteredInsights.length);

  return (
    <div className="w-full bg-card/10 backdrop-blur-md border border-border/40 rounded-2xl p-5 mb-2 relative overflow-hidden group animate-in fade-in duration-300">
      {/* Decorative background glow */}
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none transition-all duration-700 group-hover:bg-primary/8" />
      
      {/* Header Row */}
      <div className="flex items-center justify-between gap-4 border-b border-border/20 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
            <Brain className="size-4.5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Proactive AI Strategic Insights
              <Sparkles className="size-3.5 text-amber-500 fill-amber-500/20" />
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Live intelligence aggregated across active ledgers and stock profiles.
            </p>
          </div>
        </div>

        <div className="text-[10px] px-2.5 py-1 rounded-full bg-muted border border-border/80 text-muted-foreground font-semibold flex items-center gap-1 select-none shrink-0 h-7 self-center">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
          {insights.length} active findings
        </div>
      </div>

      {/* Toolbar Row (Search + Suggested Filters) */}
      {insights.length > 3 && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3 bg-muted/10 p-3 rounded-xl border border-border/30">
          <div className="relative w-full lg:w-80 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by topic, source, or risk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs w-full bg-background/50 border-border/40 focus-visible:ring-primary/30"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-0.5 rounded-full hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground/85 mr-1 flex items-center gap-1">
              <Filter className="size-3 text-muted-foreground/60" /> Filter by:
            </span>
            {suggestedSearches.map((item) => {
              const active = searchTerm.toLowerCase() === item.query.toLowerCase();
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleFilterClick(item.query)}
                  className={`text-[9px] px-2.5 py-1 rounded-lg border font-medium transition-all duration-200 cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                    active
                      ? 'bg-primary/10 border-primary/30 text-primary shadow-xs'
                      : 'bg-background hover:bg-muted text-muted-foreground border-border/80 hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Range Indicator Row */}
      {insights.length > 3 && (
        <div className="text-[10px] text-muted-foreground mb-3.5 select-none pl-0.5">
          {filteredInsights.length === 0 
            ? "No matching insights found" 
            : `Showing ${rangeStart}–${rangeEnd} of ${filteredInsights.length} insights`}
          {searchTerm && ` (filtered from ${insights.length})`}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedInsights.length === 0 ? (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-8 text-xs text-muted-foreground select-none">
            No matching insights found.
          </div>
        ) : (
          paginatedInsights.map((insight, idx) => {
            let badgeColor = '';
            let Icon = Info;
            let glowColor = '';
            let hoverShadow = '';
            
            if (insight.severity === 'critical') {
              badgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
              Icon = AlertCircle;
              glowColor = 'bg-rose-500';
              hoverShadow = 'hover:shadow-[0_8px_30px_rgba(244,63,94,0.08)] hover:border-rose-500/30';
            } else if (insight.severity === 'high') {
              badgeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
              Icon = AlertTriangle;
              glowColor = 'bg-amber-500';
              hoverShadow = 'hover:shadow-[0_8px_30px_rgba(245,158,11,0.08)] hover:border-amber-500/30';
            } else {
              badgeColor = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
              Icon = Info;
              glowColor = 'bg-indigo-500';
              hoverShadow = 'hover:shadow-[0_8px_30px_rgba(99,102,241,0.08)] hover:border-indigo-500/30';
            }

            let sourceColor = '';
            let SourceIcon = Package;
            if (insight.source === 'sales') {
              sourceColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
              SourceIcon = TrendingUp;
            } else if (insight.source === 'debitors') {
              sourceColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
              SourceIcon = Users;
            } else if (insight.source === 'godown_stock') {
              sourceColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
              SourceIcon = Package;
            } else {
              sourceColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
              SourceIcon = Package;
            }

            return (
              <div 
                key={idx}
                className={`relative flex flex-col justify-between gap-4 p-4 pt-5 rounded-xl bg-card/25 backdrop-blur-xs border border-border/40 hover:-translate-y-0.5 transition-all duration-300 group/card shadow-sm hover:shadow-md ${hoverShadow}`}
              >
                {/* Glowing edge indicator: soft pill design */}
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[2px] rounded-full ${glowColor} blur-[0.3px] opacity-60 group-hover/card:opacity-95 transition-all duration-300`} />
                
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${sourceColor} select-none`}>
                      <SourceIcon className="size-2.5" />
                      {insight.sourceLabel}
                    </span>
                    
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1 ${badgeColor} select-none`}>
                      <Icon className="size-3" />
                      {insight.severity === 'critical' ? 'Critical' : insight.severity === 'high' ? 'High Risk' : 'Strategic'}
                    </span>
                  </div>
                  
                  <p className="text-xs text-foreground/85 font-medium leading-relaxed mt-1 tracking-wide pl-2 border-l-2 border-border/20 group-hover/card:border-primary/30 transition-colors">
                    {insight.text}
                  </p>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/20">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingAdvisorPrompt(`Regarding the insight: "${insight.text}". Can you elaborate on this and explain what actions I should take?`);
                      onLaunchWorkspace(insight.source, 'advisor');
                    }}
                    className="text-[10px] text-primary hover:text-primary-foreground font-semibold flex items-center gap-1 group/btn cursor-pointer transition-all duration-200 bg-primary/5 hover:bg-primary border border-primary/15 hover:border-primary px-3 py-1.5 rounded-lg shadow-xs active:scale-95"
                  >
                    Consult AI Advisor
                    <ArrowRight className="size-3 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/40 pt-3.5 mt-4 select-none">
          <span className="text-xs text-muted-foreground">
            Page {activePage} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={activePage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1.5 rounded-lg border border-border/80 bg-background hover:bg-muted disabled:opacity-40 disabled:hover:bg-background cursor-pointer disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              type="button"
              disabled={activePage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-1.5 rounded-lg border border-border/80 bg-background hover:bg-muted disabled:opacity-40 disabled:hover:bg-background cursor-pointer disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const PortalSection: React.FC<PortalSectionProps> = ({
  salesData,
  debitorsData,
  stockData,
  counterStockData,
  onLaunchWorkspace,
  cronSchedule,
  connectionMode,
  aiProvider,
  webChatEnabled,
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
        isActive: !!salesData,
        latestSummaryLabel: salesData?.masterTotals?.totalInflows ? 'Surplus Rate' : undefined,
        latestSummaryValue: salesData?.masterTotals?.totalInflows && salesData.masterTotals.totalInflows > 0
          ? `${(salesData.masterTotals.netCashflow >= 0 ? '+' : '')}${((salesData.masterTotals.netCashflow / salesData.masterTotals.totalInflows) * 100).toFixed(1)}%`
          : undefined,
        latestSummaryPositive: salesData?.masterTotals?.netCashflow !== undefined ? salesData.masterTotals.netCashflow >= 0 : undefined,
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
        isActive: !!debitorsData,
        latestSummaryLabel: debitorsData?.aggregates?.activeDebitorsCount ? 'Avg Owed' : undefined,
        latestSummaryValue: debitorsData?.aggregates?.averageOutstandingDues
          ? formatINRValue(debitorsData.aggregates.averageOutstandingDues)
          : undefined,
        latestSummaryPositive: false,
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
              buildStockDateTag(stockData.dateRange) || 'Godown Stock',
              `${stockData.totalItems ?? stockData.totalTransactions ?? 0} Products`,
            ].filter(Boolean) as string[])
          : ['Inventory Registry', 'Awaiting Ingestion'],
        sparkline: stockData?.historicalTrends?.map((t: any) => ({ net: t.totalCostValue })) || [],
        dataKey: 'net',
        stroke: 'var(--chart-2)',
        isActive: !!stockData,
        latestSummaryLabel: stockData?.aggregates?.totalClosingValue ? 'Est. Markup' : undefined,
        latestSummaryValue: stockData?.aggregates?.totalClosingValue && stockData.aggregates.totalClosingValue > 0 && stockData.aggregates.totalSellingValue
          ? `+${(((stockData.aggregates.totalSellingValue - stockData.aggregates.totalClosingValue) / stockData.aggregates.totalClosingValue) * 100).toFixed(1)}%`
          : undefined,
        latestSummaryPositive: true,
      },
      {
        id: 'counter_stock',
        title: counterStockData ? counterStockData.fileName.replace(/\.[^/.]+$/, "") : 'Counter Stock Register',
        type: 'Counter Inventory & Sales',
        filename: counterStockData ? counterStockData.fileName : 'No spreadsheet uploaded',
        lastUpdated: counterStockData ? formatTimestamp(counterStockData.runTimestamp) : 'Never',
        stats: [
          { label: 'Stock Valuation (Cost)', value: counterStockData ? formatINRValue(counterStockData.aggregates?.totalClosingValue) : '—' },
          { label: 'Active Items', value: counterStockData ? `${counterStockData.aggregates?.activeItemsCount || counterStockData.aggregates?.totalItemsCount || 0} items` : '—' },
        ],
        alertCount: counterStockData?.highAlertCount ?? counterStockData?.alerts?.length ?? 0,
        totalAlertCount: counterStockData?.alerts?.length ?? 0,
        tags: counterStockData
          ? ([
              'Counter Registry',
              buildDurationTag(counterStockData.dateRange, true),
              buildStockDateTag(counterStockData.dateRange) || 'Counter Stock',
              `${counterStockData.totalItems ?? counterStockData.totalTransactions ?? 0} Products`,
            ].filter(Boolean) as string[])
          : ['Counter Registry', 'Awaiting Ingestion'],
        sparkline: counterStockData?.historicalTrends?.map((t: any) => ({ net: t.totalCostValue })) || [],
        dataKey: 'net',
        stroke: 'var(--chart-3)',
        isActive: !!counterStockData,
        latestSummaryLabel: counterStockData?.aggregates?.totalClosingValue ? 'Est. Markup' : undefined,
        latestSummaryValue: counterStockData?.aggregates?.totalClosingValue && counterStockData.aggregates.totalClosingValue > 0 && counterStockData.aggregates.totalSellingValue
          ? `+${(((counterStockData.aggregates.totalSellingValue - counterStockData.aggregates.totalClosingValue) / counterStockData.aggregates.totalClosingValue) * 100).toFixed(1)}%`
          : undefined,
        latestSummaryPositive: true,
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
  }, [salesData, debitorsData, stockData, counterStockData, searchQuery, activeFilter]);

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

      {/* Proactive AI Insights Hub */}
      {aiProvider !== 'none' && webChatEnabled && (
        <ProactiveInsightsHub
          salesData={salesData}
          debitorsData={debitorsData}
          stockData={stockData}
          counterStockData={counterStockData}
          onLaunchWorkspace={onLaunchWorkspace}
        />
      )}

      {/* Bookkeeping Safety Checks */}
      <SafetyChecksGuide scanScheduleLabel={scanScheduleLabel} />
    </div>
  );
};
