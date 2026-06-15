import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AlertTriangle, AlertCircle, Search, X, ChevronLeft, ChevronRight, ShieldCheck, Copy } from 'lucide-react';

interface SalesExceptionsPanelProps {
  alerts: any[];
  businessName: string;
}

export const SalesExceptionsPanel: React.FC<SalesExceptionsPanelProps> = ({ alerts, businessName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[2px] rounded-full ${glowColor} blur-[0.3px] opacity-60 group-hover/card:opacity-95 transition-all duration-300`} />
                  
                  <div className="flex flex-col gap-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold text-xs text-foreground truncate max-w-[150px]" title={alert.ruleName || 'Auditor Exception'}>
                        {alert.ruleName || 'Auditor Exception'}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0 flex items-center gap-1 ${severityBadgeStyle}`}>
                        <Icon className="size-3" />
                        {severity === 'critical' ? 'Critical' : 'High Risk'}
                      </span>
                    </div>

                    <p className="text-[11px] text-foreground/80 leading-relaxed font-medium mt-1 pl-2 border-l-2 border-border/20 group-hover/card:border-primary/30 transition-colors">
                      {alert.message}
                    </p>

                    {tx.invoice || tx.category || tx.vendor ? (
                      <div className="text-[9px] text-muted-foreground mt-1 bg-muted/20 p-2 rounded border border-border/60 flex flex-col gap-0.5 font-mono">
                        {tx.invoice && <div>Invoice: <span className="text-foreground/90 font-semibold">{tx.invoice}</span></div>}
                        {tx.category && <div>Category: <span className="text-foreground/90 font-semibold">{tx.category}</span></div>}
                        {tx.vendor && <div>Vendor: <span className="text-foreground/90 font-semibold truncate block max-w-full">{tx.vendor}</span></div>}
                        {tx.date && <div>Date: <span>{new Date(tx.date).toLocaleDateString('en-IN')}</span></div>}
                      </div>
                    ) : null}
                  </div>

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
