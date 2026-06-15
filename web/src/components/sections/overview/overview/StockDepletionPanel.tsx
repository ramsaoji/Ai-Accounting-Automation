import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, X, ChevronLeft, ChevronRight, Sparkles, Copy } from 'lucide-react';

interface StockDepletionPanelProps {
  items: any[];
  businessName: string;
}

export const StockDepletionPanel: React.FC<StockDepletionPanelProps> = ({ items, businessName }) => {
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
