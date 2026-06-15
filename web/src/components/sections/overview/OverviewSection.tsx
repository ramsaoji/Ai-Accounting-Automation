import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import type { MasterSummary, DebitorSummary, Transaction, MonthlySummary } from '@/types';
import { deriveBusinessName } from '@/utils/business';
import { DatePickerWithRange } from '@/components/ui/DatePickerWithRange';
import { RecoveryBoard } from './overview/RecoveryBoard';
import { OverviewKpiCards } from './overview/OverviewKpiCards';
import { AiRecommendationsQueue } from './overview/AiRecommendationsQueue';
import { Input } from '@/components/ui/input';
import {
  ShieldCheck,
  LineChart as LineIcon,
  Info,
  Copy,
  ShoppingCart,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  RotateCcw
} from 'lucide-react';

const OverviewCharts = React.lazy(() => import('./OverviewCharts'));
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatINR, formatTimestamp, getSheetDate } from '@/utils/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface StockDepletionPanelProps {
  items: any[];
  businessName: string;
}

const StockDepletionPanel: React.FC<StockDepletionPanelProps> = ({ items, businessName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const stockoutRisks = useMemo(() => {
    if (!items) return [];
    
    return items
      .map(item => {
        const closing = Number(item.closingStock || 0);
        const velocity = Number(item.stockOut || 0);
        
        let daysRemaining = Infinity;
        let riskLevel: 'out' | 'negative' | 'critical' | 'warning' | 'healthy' = 'healthy';
        
        if (closing < 0) {
          riskLevel = 'negative';
          daysRemaining = 0;
        } else if (closing === 0) {
          riskLevel = 'out';
          daysRemaining = 0;
        } else if (velocity > 0) {
          daysRemaining = closing / velocity;
          if (daysRemaining < 3) {
            riskLevel = 'critical';
          } else if (daysRemaining <= 5) {
            riskLevel = 'warning';
          }
        }
        
        const recommendedOrder = velocity > 0 
          ? Math.max(0, Math.ceil(velocity * 14 - closing))
          : (closing === 0 ? 12 : 0);
          
        return {
          ...item,
          daysRemaining,
          riskLevel,
          recommendedOrder,
          velocity
        };
      })
      .filter(item => item.riskLevel !== 'healthy' && (item.riskLevel === 'negative' || item.riskLevel === 'out' || item.velocity > 0))
      .sort((a, b) => {
        const severityMap: Record<string, number> = { negative: 0, out: 1, critical: 2, warning: 3, healthy: 4 };
        const aRisk = a.riskLevel as string;
        const bRisk = b.riskLevel as string;
        if (severityMap[aRisk] !== severityMap[bRisk]) {
          return severityMap[aRisk] - severityMap[bRisk];
        }
        return a.daysRemaining - b.daysRemaining;
      });
  }, [items]);

  const filteredRisks = useMemo(() => {
    if (!searchTerm.trim()) return stockoutRisks;
    const term = searchTerm.toLowerCase();
    return stockoutRisks.filter(item => 
      item.itemName.toLowerCase().includes(term)
    );
  }, [stockoutRisks, searchTerm]);

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const copyPoDraft = (item: any) => {
    const isLoose = item.bottleSizeMl === 0;
    const unitText = isLoose ? 'ml' : 'units';
    const sizeText = isLoose ? 'Loose' : `${item.bottleSizeMl}ml`;
    const qtyText = item.recommendedOrder > 0 ? `${item.recommendedOrder} ${unitText}` : (isLoose ? '0 ml' : `1 case`);
    const draftText = `PURCHASE ORDER\nBusiness: ${businessName}\nItem: ${item.itemName} (${sizeText})\nRequested Qty: ${qtyText}\n\n[System Ledger Context]\n- Closing Stock: ${item.closingStock} ${unitText}\n- Daily Sales Velocity: ${item.velocity} ${unitText}/day\n- Est. Remaining Days: ${item.daysRemaining === Infinity ? 'N/A' : Math.round(item.daysRemaining) + ' days'}`;
    navigator.clipboard.writeText(draftText);
    toast.success(`PO Draft for ${item.itemName} copied to clipboard!`);
  };

  if (stockoutRisks.length === 0) {
    return (
      <Card className="border bg-card/45 shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="size-4 text-emerald-500" />
            Stockout & Reorder Recommendations
          </CardTitle>
          <CardDescription className="text-xs">
            Predictive demand forecasting based on daily sales velocity.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2 text-center text-xs text-muted-foreground py-6 flex items-center justify-center gap-1.5 select-none">
          <Sparkles className="size-3.5 text-amber-500 fill-amber-500/10 shrink-0" />
          <span>All stock levels are healthy! No imminent stockouts projected.</span>
        </CardContent>
      </Card>
    );
  }

  const itemsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(filteredRisks.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  
  const paginatedRisks = filteredRisks.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const rangeStart = (activePage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(activePage * itemsPerPage, filteredRisks.length);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (activePage > 3) pages.push('...');
      const start = Math.max(2, activePage - 1);
      const end = Math.min(totalPages - 1, activePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (activePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <Card className="border bg-card/45 shadow-xs flex flex-col">
      <CardHeader className="p-4 sm:p-5 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShoppingCart className="size-4 text-warning" />
              Stockout & Reorder Recommendations
            </CardTitle>
            <CardDescription className="text-xs">
              Imminent inventory depletion warnings and suggested purchase quantities.
            </CardDescription>
          </div>

          {stockoutRisks.length > 3 && (
            <div className="relative w-full sm:max-w-xs shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search stockout items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs w-full"
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
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-5 pt-1.5 flex flex-col gap-3.5">
        {stockoutRisks.length > 3 && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground border-b border-border/40 pb-1.5 select-none">
            <span>
              {filteredRisks.length === 0 
                ? "No matching items" 
                : `Showing ${rangeStart}–${rangeEnd} of ${filteredRisks.length} recommendations`}
              {searchTerm && ` (filtered from ${stockoutRisks.length})`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {paginatedRisks.length === 0 ? (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-8 text-xs text-muted-foreground select-none">
              No matching stockout items found.
            </div>
          ) : (
            paginatedRisks.map((item, idx) => {
              const isLoose = item.bottleSizeMl === 0;
              const sizeText = isLoose ? 'Loose' : `${item.bottleSizeMl}ml`;
              const unitText = isLoose ? 'ml' : 'units';
              
              let riskBadgeStyle = '';
              let riskLabel = '';
              if (item.riskLevel === 'negative') {
                riskBadgeStyle = 'bg-destructive/10 text-destructive border-destructive/20';
                riskLabel = 'Negative Stock';
              } else if (item.riskLevel === 'out') {
                riskBadgeStyle = 'bg-destructive/10 text-destructive border-destructive/20';
                riskLabel = 'Out of Stock';
              } else if (item.riskLevel === 'critical') {
                riskBadgeStyle = 'bg-red-500/10 text-red-500 border-red-500/20';
                riskLabel = `${Math.round(item.daysRemaining)} Days Left`;
              } else if (item.riskLevel === 'warning') {
                riskBadgeStyle = 'bg-warning/10 text-warning border-warning/20';
                riskLabel = `${Math.round(item.daysRemaining)} Days Left`;
              }

              return (
                <div 
                  key={`${item.itemName}-${item.bottleSizeMl}-${idx}`}
                  className="border border-border/80 bg-muted/10 p-3 rounded-lg flex flex-col justify-between gap-2.5 transition-all hover:bg-muted/15"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-semibold text-xs text-foreground truncate max-w-[150px]" title={item.itemName}>
                        {item.itemName}
                      </span>
                      <span className={`text-[9px] font-bold border rounded-full px-2 py-0.2 uppercase tracking-wide shrink-0 ${riskBadgeStyle}`}>
                        {riskLabel}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Size: {sizeText} • Closing: <strong className="text-foreground">{item.closingStock}</strong> {unitText}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-border/70 pt-2 flex flex-col gap-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Daily Sales:</span>
                      <span className="font-semibold text-foreground">{item.velocity} {unitText}/day</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground items-center">
                      <span>Reorder Qty:</span>
                      <span className="font-bold text-primary text-xs bg-primary/10 px-1.5 py-0.2 rounded">
                        +{item.recommendedOrder} {unitText}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyPoDraft(item)}
                    className="w-full flex items-center justify-center gap-1.5 text-[9px] font-bold border border-input bg-background hover:bg-muted rounded-md py-1.5 cursor-pointer text-muted-foreground hover:text-foreground transition-all shadow-2xs"
                  >
                    <Copy className="size-3" />
                    <span>Draft Purchase Order</span>
                  </button>
                </div>
              );
            })
          )}
          
          {/* Symmetrical invisible placeholder cards to prevent height shifting */}
          {totalPages > 1 && paginatedRisks.length > 0 && Array.from({ length: 6 - paginatedRisks.length }).map((_, idx) => (
            <div 
              key={`placeholder-${idx}`} 
              className="opacity-0 pointer-events-none border border-transparent p-3 rounded-lg flex flex-col justify-between gap-2.5 select-none" 
              aria-hidden="true"
            >
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-start gap-1">
                  <span className="font-semibold text-xs truncate">&nbsp;</span>
                </div>
                <span className="text-[10px]">&nbsp;</span>
              </div>
              <div className="pt-2 flex flex-col gap-1.5">
                <div className="flex justify-between text-[10px]"><span>&nbsp;</span><span>&nbsp;</span></div>
                <div className="flex justify-between text-[10px]"><span>&nbsp;</span><span>&nbsp;</span></div>
                <div className="w-full mt-2.5 py-1.5 px-3 rounded-md border text-[10px]">&nbsp;</div>
              </div>
            </div>
          ))}
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/40 pt-3.5 select-none">
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

              {/* Direct Page Numbers */}
              {getPageNumbers().map((pNum, i) => {
                if (pNum === '...') {
                  return (
                    <span key={`dots-${i}`} className="h-7 w-7 text-xs font-bold text-muted-foreground/60 flex items-center justify-center select-none">
                      ...
                    </span>
                  );
                }
                const pageNum = pNum as number;
                const isSelected = activePage === pageNum;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-7 w-7 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center select-none active:scale-95 ${
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground shadow-xs'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border/80 hover:text-foreground'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

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
      </CardContent>
    </Card>
  );
};

interface SalesExceptionsPanelProps {
  alerts: any[];
  businessName: string;
}

const SalesExceptionsPanel: React.FC<SalesExceptionsPanelProps> = ({ alerts, businessName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter out alerts that don't have a message or are from irrelevant rules
  const exceptionAlerts = useMemo(() => {
    if (!alerts) return [];
    return alerts
      .filter((a) => a && a.message)
      .sort((a, b) => {
        const severityMap: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        const aSeverity = a.severity || 'info';
        const bSeverity = b.severity || 'info';
        return (severityMap[aSeverity] ?? 4) - (severityMap[bSeverity] ?? 4);
      });
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    if (!searchTerm.trim()) return exceptionAlerts;
    const term = searchTerm.toLowerCase();
    return exceptionAlerts.filter(a => 
      a.message.toLowerCase().includes(term) || 
      (a.ruleName && a.ruleName.toLowerCase().includes(term))
    );
  }, [exceptionAlerts, searchTerm]);

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const itemsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  
  const paginatedAlerts = filteredAlerts.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const rangeStart = (activePage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(activePage * itemsPerPage, filteredAlerts.length);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (activePage > 3) pages.push('...');
      const start = Math.max(2, activePage - 1);
      const end = Math.min(totalPages - 1, activePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (activePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const copyAuditMemo = (alert: any) => {
    const tx = alert.transaction || {};
    const invoiceText = tx.invoice ? `Invoice: ${tx.invoice}` : 'Invoice: N/A';
    const amountText = tx.amount ? `Amount: ₹${tx.amount.toLocaleString('en-IN')}` : 'Amount: N/A';
    const vendorText = tx.vendor ? `Vendor/Customer: ${tx.vendor}` : 'Vendor/Customer: N/A';
    const catText = tx.category ? `Category: ${tx.category}` : 'Category: N/A';
    const dateText = tx.date ? `Date: ${new Date(tx.date).toLocaleDateString('en-IN')}` : 'Date: N/A';
    
    const draftText = `AUDIT INVESTIGATION MEMO\nBusiness: ${businessName}\nIssue: ${alert.ruleName || 'Anomalous Entry'}\nSeverity: ${alert.severity ? alert.severity.toUpperCase() : 'HIGH'}\n\n[Transaction Details]\n- ${dateText}\n- ${invoiceText}\n- ${amountText}\n- ${catText}\n- ${vendorText}\n\n[Exception Context]\n${alert.message || 'Audited transaction rule violation.'}\n\nAction Required: Verify ledger records, crosscheck physical receipts, and log justification.`;
    
    navigator.clipboard.writeText(draftText);
    toast.success(`Audit Investigation Memo copied to clipboard!`);
  };

  if (exceptionAlerts.length === 0) {
    return (
      <Card className="border bg-card/45 shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4 text-emerald-500 animate-pulse" />
            Sales Exceptions & Integrity Warnings
          </CardTitle>
          <CardDescription className="text-xs">
            Exception tracking compiled by our automated ledger audit rules engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2 text-center text-xs text-muted-foreground py-6 flex items-center justify-center gap-1.5 select-none">
          <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
          <span>All audited sales invoices and ledger postings are consistent! No critical anomalies detected.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border bg-card/45 shadow-xs flex flex-col">
      <CardHeader className="p-4 sm:p-5 pb-2 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20 shrink-0">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Sales Integrity & Exception Warnings</CardTitle>
            <CardDescription className="text-xs">
              Audit flags detected by the compliance integrity scanner for {businessName}.
            </CardDescription>
          </div>
        </div>

        {exceptionAlerts.length > 3 && (
          <div className="relative w-full sm:max-w-xs shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search exceptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs w-full"
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
        )}
      </CardHeader>
      
      <CardContent className="p-4 sm:p-5 pt-4 flex flex-col gap-4">
        {exceptionAlerts.length > 3 && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground border-b border-border/40 pb-1.5 select-none">
            <span>
              {filteredAlerts.length === 0 
                ? "No matching exceptions" 
                : `Showing ${rangeStart}–${rangeEnd} of ${filteredAlerts.length} exceptions`}
              {searchTerm && ` (filtered from ${exceptionAlerts.length})`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedAlerts.length === 0 ? (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-8 text-xs text-muted-foreground select-none">
              No matching exceptions found.
            </div>
          ) : (
            paginatedAlerts.map((alert, idx) => {
              const severity = alert.severity || 'high';
              const isCritical = severity === 'critical';
              const Icon = isCritical ? AlertCircle : AlertTriangle;
              
              let glowColor = '';
              let hoverShadow = '';
              let severityBadgeStyle = '';
              
              if (isCritical) {
                glowColor = 'bg-rose-500';
                hoverShadow = 'hover:shadow-[0_8px_30px_rgba(244,63,94,0.08)] hover:border-rose-500/30';
                severityBadgeStyle = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
              } else {
                glowColor = 'bg-amber-500';
                hoverShadow = 'hover:shadow-[0_8px_30px_rgba(245,158,11,0.08)] hover:border-amber-500/30';
                severityBadgeStyle = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
              }

              const tx = alert.transaction || {};

              return (
                <div 
                  key={`${alert.ruleId || 'rule'}-${idx}`}
                  className={`relative flex flex-col justify-between gap-4 p-4 pt-5 rounded-xl bg-card/25 backdrop-blur-xs border border-border/40 hover:-translate-y-0.5 transition-all duration-300 group/card shadow-sm hover:shadow-md ${hoverShadow}`}
                >
                  {/* Glowing edge indicator: soft pill design */}
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[2px] rounded-full ${glowColor} blur-[0.3px] opacity-60 group-hover/card:opacity-95 transition-all duration-300`} />
                  
                  <div className="flex flex-col gap-2.5">
                    {/* Header: Title and Severity Badge */}
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-xs text-foreground truncate max-w-[150px]" title={alert.ruleName || 'Auditor Exception'}>
                        {alert.ruleName || 'Auditor Exception'}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0 flex items-center gap-1 ${severityBadgeStyle}`}>
                        <Icon className="size-3" />
                        {severity === 'critical' ? 'Critical' : 'High Risk'}
                      </span>
                    </div>

                    {/* Alert Description message */}
                    <p className="text-[11px] text-foreground/80 leading-relaxed font-medium mt-1 pl-2 border-l-2 border-border/20 group-hover/card:border-primary/30 transition-colors">
                      {alert.message}
                    </p>

                    {/* Transaction Metadata */}
                    {tx.invoice || tx.category || tx.vendor ? (
                      <div className="text-[9px] text-muted-foreground mt-1 bg-muted/20 p-2 rounded border border-border/60 flex flex-col gap-0.5 font-mono">
                        {tx.invoice && <div>Invoice: <span className="text-foreground/90 font-semibold">{tx.invoice}</span></div>}
                        {tx.category && <div>Category: <span className="text-foreground/90 font-semibold">{tx.category}</span></div>}
                        {tx.vendor && <div>Vendor: <span className="text-foreground/90 font-semibold truncate block max-w-full">{tx.vendor}</span></div>}
                        {tx.date && <div>Date: <span>{new Date(tx.date).toLocaleDateString('en-IN')}</span></div>}
                      </div>
                    ) : null}
                  </div>

                  {/* Footer: Transaction Value & Draft Audit Memo Button */}
                  <div className="border-t border-dashed border-border/70 pt-3 flex flex-col gap-2.5">
                    {tx.amount ? (
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                        <span>Transaction Value:</span>
                        <span className={`font-extrabold text-xs px-2 py-0.5 rounded ${
                          isCritical ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          ₹{tx.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => copyAuditMemo(alert)}
                      className="w-full flex items-center justify-center gap-1.5 text-[9px] font-bold border border-primary/15 bg-primary/5 hover:bg-primary text-primary hover:text-primary-foreground rounded-lg py-1.5 cursor-pointer transition-all duration-200 shadow-2xs active:scale-95"
                    >
                      <Copy className="size-3 shrink-0" />
                      <span>Draft Audit Memo</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
          
          {/* Symmetrical invisible placeholder cards to prevent height shifting */}
          {totalPages > 1 && paginatedAlerts.length > 0 && Array.from({ length: 6 - paginatedAlerts.length }).map((_, idx) => (
            <div 
              key={`placeholder-${idx}`} 
              className="opacity-0 pointer-events-none border border-transparent p-4 pt-5 rounded-xl flex flex-col justify-between gap-4 select-none" 
              aria-hidden="true"
            >
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-semibold text-xs truncate">&nbsp;</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-md">&nbsp;</span>
                </div>
                <p className="text-[11px] leading-relaxed mt-1 pl-2 border-l-2 border-transparent">
                  &nbsp;
                </p>
              </div>
              <div className="pt-3 flex flex-col gap-2.5">
                <div className="h-4">&nbsp;</div>
                <div className="w-full py-1.5 rounded-lg border text-[9px]">&nbsp;</div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/40 pt-3.5 select-none">
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

              {/* Direct Page Numbers */}
              {getPageNumbers().map((pNum, i) => {
                if (pNum === '...') {
                  return (
                    <span key={`dots-${i}`} className="h-7 w-7 text-xs font-bold text-muted-foreground/60 flex items-center justify-center select-none">
                      ...
                    </span>
                  );
                }
                const pageNum = pNum as number;
                const isSelected = activePage === pageNum;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-7 w-7 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center select-none active:scale-95 ${
                      isSelected
                        ? 'bg-primary border-primary text-primary-foreground shadow-xs'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border/80 hover:text-foreground'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

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
      </CardContent>
    </Card>
  );
};

interface PeriodComparisonPanelProps {
  months: MonthlySummary[];
  industryProfile?: string;
  departments?: {
    id: string;
    code: string;
    name: string;
    type: string;
    colorHex: string | null;
  }[];
}

const PeriodComparisonPanel: React.FC<PeriodComparisonPanelProps> = ({ months, industryProfile, departments }) => {
  const availableMonths = useMemo(() => {
    if (!months) return [];
    return months.filter(m => m.sheetName && (m.inflows !== undefined || m.outflows !== undefined));
  }, [months]);

  const [baseMonthName, setBaseMonthName] = useState<string>('');
  const [compareMonthName, setCompareMonthName] = useState<string>('');

  const resetPeriods = () => {
    if (availableMonths.length > 0) {
      setBaseMonthName(availableMonths[0].sheetName);
      if (availableMonths.length > 1) {
        setCompareMonthName(availableMonths[1].sheetName);
      } else {
        setCompareMonthName(availableMonths[0].sheetName);
      }
    }
  };

  useEffect(() => {
    if (availableMonths.length > 0) {
      setBaseMonthName(availableMonths[0].sheetName);
      if (availableMonths.length > 1) {
        setCompareMonthName(availableMonths[1].sheetName);
      } else {
        setCompareMonthName(availableMonths[0].sheetName);
      }
    }
  }, [availableMonths]);

  const baseMonth = useMemo(() => {
    return availableMonths.find(m => m.sheetName === baseMonthName);
  }, [availableMonths, baseMonthName]);

  const compareMonth = useMemo(() => {
    return availableMonths.find(m => m.sheetName === compareMonthName);
  }, [availableMonths, compareMonthName]);

  const metrics = useMemo(() => {
    if (!baseMonth || !compareMonth) return [];

    const calculateVariance = (baseVal: number, compareVal: number) => {
      const abs = compareVal - baseVal;
      const pct = baseVal !== 0 ? (abs / baseVal) * 100 : 0;
      return { abs, pct };
    };

    const getMetricData = (
      name: string,
      keyOrExtractor: keyof MonthlySummary | ((m: MonthlySummary) => number),
      isNegativeOutflow = false
    ) => {
      const getValue = (m: MonthlySummary) => {
        if (typeof keyOrExtractor === 'function') {
          return keyOrExtractor(m);
        }
        return Number(m[keyOrExtractor] || 0);
      };

      const baseVal = getValue(baseMonth);
      const compareVal = getValue(compareMonth);
      const { abs, pct } = calculateVariance(baseVal, compareVal);
      const positiveGood = !isNegativeOutflow;

      return {
        name,
        baseVal,
        compareVal,
        abs,
        pct,
        positiveGood
      };
    };

    const isHospitality = industryProfile === 'HOSPITALITY';
    const revenueDepts = departments?.filter(
      (d: any) =>
        d.type === 'REVENUE' &&
        !d.name.toLowerCase().includes('recovery') &&
        !d.name.toLowerCase().includes('jama') &&
        !d.name.toLowerCase().includes('recover')
    ) || [];

    const dept1 = revenueDepts[0];
    const dept2 = revenueDepts[1];

    const label1 = dept1 ? `${dept1.name} Performance` : (isHospitality ? 'Liquor Revenue Split' : 'Primary Revenue Split');
    const label2 = dept2 ? `${dept2.name} Performance` : (isHospitality ? 'Food Revenue Split' : 'Secondary Revenue Split');

    const extractor1 = (m: MonthlySummary) => {
      if (m.departments && dept1 && (dept1.name in m.departments)) {
        return m.departments[dept1.name] || 0;
      }
      return m.liquor || 0;
    };

    const extractor2 = (m: MonthlySummary) => {
      if (m.departments && dept2 && (dept2.name in m.departments)) {
        return m.departments[dept2.name] || 0;
      }
      return m.food || 0;
    };

    return [
      getMetricData('Total Inflows (Revenue)', 'inflows'),
      getMetricData(label1, extractor1),
      getMetricData(label2, extractor2),
      getMetricData('Operational Expenses', 'expenses', true),
      getMetricData('Credit Extended (Udhari)', 'creditExtended', true),
      getMetricData('Net Position (Surplus)', 'net'),
    ];
  }, [baseMonth, compareMonth, industryProfile, departments]);

  if (availableMonths.length < 2) {
    return null;
  }

  const formatCurrency = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  return (
    <Card className="border bg-card/45 shadow-xs flex flex-col">
      <CardHeader className="p-4 sm:p-5 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          Period-over-Period Performance Compare
        </CardTitle>
        <CardDescription className="text-xs">
          Select any two monthly statements to analyze cashflow shifts and margin variance.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-5 pt-1.5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 p-3 bg-muted/20 border border-border/75 rounded-lg select-none">
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Base Period</label>
            <Select value={baseMonthName} onValueChange={(val) => setBaseMonthName(val ?? '')}>
              <SelectTrigger className="!h-9 w-full sm:w-48 text-xs font-semibold">
                <SelectValue placeholder="Select base period" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={`base-${m.sheetName}`} value={m.sheetName}>
                    {m.sheetName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight className="size-4 text-muted-foreground hidden sm:block mt-4 shrink-0" />

          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Comparison Period</label>
            <Select value={compareMonthName} onValueChange={(val) => setCompareMonthName(val ?? '')}>
              <SelectTrigger className="!h-9 w-full sm:w-48 text-xs font-semibold">
                <SelectValue placeholder="Select comparison period" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={`compare-${m.sheetName}`} value={m.sheetName}>
                    {m.sheetName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={resetPeriods}
            className="mt-4 !h-9 text-xs font-semibold sm:ml-auto w-full sm:w-auto cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>

        {baseMonth && compareMonth && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.map((m) => {
              const isPositive = m.abs >= 0;
              const isHealthy = (isPositive && m.positiveGood) || (!isPositive && !m.positiveGood);
              const isZero = m.abs === 0;

              let deltaBadgeClass = 'bg-muted text-muted-foreground border-border';
              let deltaLabel = 'No change';
              let deltaIcon = null;

              if (!isZero) {
                if (isHealthy) {
                  deltaBadgeClass = 'bg-success/10 text-success border-success/20';
                  deltaLabel = `${isPositive ? '+' : ''}${m.pct.toFixed(1)}%`;
                  deltaIcon = <TrendingUp className="size-3" />;
                } else {
                  deltaBadgeClass = 'bg-destructive/10 text-destructive border-destructive/20';
                  deltaLabel = `${isPositive ? '+' : ''}${m.pct.toFixed(1)}%`;
                  deltaIcon = <TrendingDown className="size-3" />;
                }
              }

              return (
                <div 
                  key={m.name}
                  className="border border-border/80 bg-muted/10 p-3.5 rounded-lg flex flex-col justify-between gap-1.5 transition-all hover:bg-muted/15"
                >
                  <div className="flex justify-between items-start gap-1.5">
                    <span className="font-semibold text-xs text-foreground">{m.name}</span>
                    <span className={`text-[9px] font-bold border rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${deltaBadgeClass}`}>
                      {deltaIcon}
                      {deltaLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1 pt-1.5 border-t border-dashed border-border/80">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider truncate">Base ({baseMonthName.split(' ')[0]})</span>
                      <span className="font-mono text-xs font-semibold text-foreground/80 mt-0.5">{formatCurrency(m.baseVal)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider truncate">Compare ({compareMonthName.split(' ')[0]})</span>
                      <span className="font-mono text-xs font-bold text-foreground mt-0.5">{formatCurrency(m.compareVal)}</span>
                    </div>
                  </div>

                  {!isZero && (
                    <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
                      <span>Variance:</span>
                      <span className={`font-mono font-semibold ${isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        {m.abs >= 0 ? '+' : ''}{formatCurrency(m.abs)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

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
