import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Zap, MessageSquare, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DebitorSummary } from '@/types';

interface RecoveryBoardProps {
  topDebitors: DebitorSummary[];
  businessName: string;
  triggerReminderCopy: (debtor: DebitorSummary) => void;
  formatINR: (val: number) => string;
}

export const RecoveryBoard: React.FC<RecoveryBoardProps> = ({
  topDebitors,
  businessName,
  triggerReminderCopy,
  formatINR,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredDebitors = useMemo(() => {
    if (!searchTerm.trim()) return topDebitors;
    const term = searchTerm.toLowerCase();
    return topDebitors.filter(d => 
      d.name.toLowerCase().includes(term)
    );
  }, [topDebitors, searchTerm]);

  const itemsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(filteredDebitors.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  
  const paginatedDebitors = filteredDebitors.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const rangeStart = (activePage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(activePage * itemsPerPage, filteredDebitors.length);

  return (
    <Card className="border bg-card/45 shadow-xs overflow-hidden flex flex-col">
      <CardHeader className="p-4 sm:p-5 pb-2 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20 shrink-0">
            <Zap className="size-5" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Outstanding Recovery Recommendations</CardTitle>
            <CardDescription className="text-xs">
              Top priority customer accounts and automated outreach drafts for {businessName}.
            </CardDescription>
          </div>
        </div>

        {topDebitors.length > 3 && (
          <div className="relative w-full sm:max-w-xs shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search debtor names..."
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
        {topDebitors.length > 3 && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground border-b border-border/40 pb-1.5 select-none">
            <span>
              {filteredDebitors.length === 0 
                ? "No matching debtors" 
                : `Showing ${rangeStart}–${rangeEnd} of ${filteredDebitors.length} priority accounts`}
              {searchTerm && ` (filtered from ${topDebitors.length})`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedDebitors.length === 0 ? (
            <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-8 text-xs text-muted-foreground select-none">
              No matching outstanding debtors found.
            </div>
          ) : (
            paginatedDebitors.map((debtor) => {
              const riskLevel = debtor.pending > 15000 ? 'High Risk' : debtor.pending > 5000 ? 'Medium Risk' : 'Low Risk';
              
              let glowColor = '';
              let hoverShadow = '';
              let riskBadgeStyle = '';
              
              if (debtor.pending > 15000) {
                glowColor = 'bg-rose-500';
                hoverShadow = 'hover:shadow-[0_8px_30px_rgba(244,63,94,0.08)] hover:border-rose-500/30';
                riskBadgeStyle = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
              } else if (debtor.pending > 5000) {
                glowColor = 'bg-amber-500';
                hoverShadow = 'hover:shadow-[0_8px_30px_rgba(245,158,11,0.08)] hover:border-amber-500/30';
                riskBadgeStyle = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
              } else {
                glowColor = 'bg-indigo-500';
                hoverShadow = 'hover:shadow-[0_8px_30px_rgba(99,102,241,0.08)] hover:border-indigo-500/30';
                riskBadgeStyle = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
              }

              return (
                <div 
                  key={debtor.name}
                  className={`relative flex flex-col justify-between gap-4 p-4 pt-5 rounded-xl bg-card/25 backdrop-blur-xs border border-border/40 hover:-translate-y-0.5 transition-all duration-300 group/card shadow-sm hover:shadow-md ${hoverShadow}`}
                >
                  {/* Glowing edge indicator: soft pill design */}
                  <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[2px] rounded-full ${glowColor} blur-[0.3px] opacity-60 group-hover/card:opacity-95 transition-all duration-300`} />
                  
                  <div className="flex flex-col gap-2.5">
                    {/* Header: Avatar, Name, and Risk Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`size-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 font-mono transition-all duration-300 select-none shadow-xs border ${
                          debtor.pending > 15000
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 group-hover/card:bg-rose-500/15'
                            : debtor.pending > 5000
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 group-hover/card:bg-amber-500/15'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 group-hover/card:bg-indigo-500/15'
                        }`}>
                          {(() => {
                            const p = debtor.name.trim().split(/\s+/);
                            return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : debtor.name.slice(0, 2).toUpperCase();
                          })()}
                        </div>
                        <span className="font-semibold text-xs text-foreground truncate max-w-[130px]" title={debtor.name}>
                          {debtor.name}
                        </span>
                      </div>
                      
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0 ${riskBadgeStyle}`}>
                        {riskLevel}
                      </span>
                    </div>

                    {/* Content: Purchases and Cleared metrics */}
                    <div className="text-[10px] text-muted-foreground mt-1 flex flex-col gap-1 border-l-2 border-border/20 pl-2 group-hover/card:border-primary/30 transition-colors">
                      <div className="flex justify-between">
                        <span>Total credit purchases:</span>
                        <strong className="text-foreground">{formatINR(debtor.debit || 0)}</strong>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>Cleared payments:</span>
                        <strong className="text-emerald-500">{formatINR(debtor.credit || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Footer: Outstanding dues and outreach message button */}
                  <div className="border-t border-dashed border-border/70 pt-3 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                      <span>Outstanding Dues:</span>
                      <span className={`font-extrabold text-xs px-2 py-0.5 rounded ${
                        debtor.pending > 15000
                          ? 'bg-rose-500/10 text-rose-400'
                          : debtor.pending > 5000
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-indigo-500/10 text-indigo-400'
                      }`}>
                        {formatINR(debtor.pending)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => triggerReminderCopy(debtor)}
                      className="w-full flex items-center justify-center gap-1.5 text-[9px] font-bold border border-primary/15 bg-primary/5 hover:bg-primary text-primary hover:text-primary-foreground rounded-lg py-1.5 cursor-pointer transition-all duration-200 shadow-2xs active:scale-95"
                    >
                      <MessageSquare className="size-3 shrink-0" />
                      <span>Draft Outreach Reminder</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
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
