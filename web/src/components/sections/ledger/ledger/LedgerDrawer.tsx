import React, { useState, useMemo, useEffect } from 'react';
import type { Transaction } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  Search,
  X
} from 'lucide-react';

interface LedgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  loading: boolean;
  transactions: Transaction[];
  formatINR: (val: number) => string;
}

export const LedgerDrawer: React.FC<LedgerDrawerProps> = ({
  open,
  onOpenChange,
  title,
  description,
  loading,
  transactions,
  formatINR,
}) => {
  const [search, setSearch] = useState('');
  const [flowFilter, setFlowFilter] = useState<'all' | 'credit' | 'debit'>('all');

  // Reset filters when open state changes
  useEffect(() => {
    if (open) {
      setSearch('');
      setFlowFilter('all');
    }
  }, [open]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const query = search.toLowerCase().trim();
      if (!query && flowFilter === 'all') return true;

      const matchesSearch =
        tx.category.toLowerCase().includes(query) ||
        tx.particulars.toLowerCase().includes(query) ||
        (tx.vendor && tx.vendor.toLowerCase().includes(query)) ||
        tx.date.includes(query);

      const matchesFlow = flowFilter === 'all' ? true : tx.type === flowFilter;

      return matchesSearch && matchesFlow;
    });
  }, [transactions, search, flowFilter]);

  const stats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.type === 'credit') {
        inflow += tx.amount;
      } else {
        outflow += tx.amount;
      }
    });
    return {
      inflow,
      outflow,
      net: inflow - outflow,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl! w-full h-full flex flex-col p-6 bg-background/95 backdrop-blur-md border-l border-border/80 shadow-2xl overflow-hidden">
        <SheetHeader className="pb-4 border-b border-border/60 shrink-0">
          <SheetTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <Calendar className="size-5 text-primary" />
            {title}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            {description}
          </SheetDescription>
        </SheetHeader>

        {/* KPI Summary Cards - Responsive grid */}
        {!loading && transactions.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 mb-1 shrink-0">
            {/* Total Inflow Card */}
            <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 dark:border-emerald-500/20 flex flex-col justify-between select-none">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[0.62rem] font-bold uppercase tracking-wider">Total Inflow</span>
                <TrendingUp className="size-3.5 text-emerald-500 shrink-0" />
              </div>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1.5 leading-none">
                {formatINR(stats.inflow)}
              </span>
            </div>

            {/* Total Outflow Card */}
            <div className="p-3 rounded-xl bg-destructive/5 dark:bg-destructive/10 border border-destructive/15 dark:border-destructive/20 flex flex-col justify-between select-none">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[0.62rem] font-bold uppercase tracking-wider">Total Outflow</span>
                <TrendingDown className="size-3.5 text-destructive shrink-0" />
              </div>
              <span className="text-sm font-extrabold text-destructive font-mono mt-1.5 leading-none">
                {formatINR(stats.outflow)}
              </span>
            </div>

            {/* Net Flow Card */}
            <div className={`col-span-2 sm:col-span-1 p-3 rounded-xl border flex flex-col justify-between select-none ${
              stats.net >= 0
                ? 'bg-primary/5 border-primary/20'
                : 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/15 dark:border-amber-500/20'
            }`}>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[0.62rem] font-bold uppercase tracking-wider">Net Cashflow</span>
                <Activity className={`size-3.5 shrink-0 ${stats.net >= 0 ? 'text-primary' : 'text-amber-500'}`} />
              </div>
              <span className={`text-sm font-extrabold font-mono mt-1.5 leading-none ${
                stats.net >= 0
                  ? 'text-primary'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {stats.net >= 0 ? '+' : ''}{formatINR(stats.net)}
              </span>
            </div>
          </div>
        )}

        {/* Interactive Search & Filter Bar */}
        {!loading && transactions.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4 mb-1 shrink-0 sm:items-center">
            <div className="relative w-full sm:flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search category, particulars, or date..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9.5 h-9 text-xs bg-muted/20 border-border/80 focus-visible:ring-primary/50 w-full"
                id="drawer-search-input"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  id="clear-drawer-search-btn"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex bg-muted/40 p-0.5 rounded-lg border border-border/60 text-xs shrink-0 select-none w-full sm:w-auto justify-between sm:justify-start gap-1">
              <button
                onClick={() => setFlowFilter('all')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md transition-all font-bold text-[10px] uppercase tracking-wider cursor-pointer text-center ${
                  flowFilter === 'all'
                    ? 'bg-background shadow-xs text-foreground font-extrabold border border-border/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                id="filter-flow-all-btn"
              >
                All ({transactions.length})
              </button>
              <button
                onClick={() => setFlowFilter('credit')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md transition-all font-bold text-[10px] uppercase tracking-wider cursor-pointer text-center ${
                  flowFilter === 'credit'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/20'
                    : 'text-muted-foreground hover:text-emerald-500'
                }`}
                id="filter-flow-inflow-btn"
              >
                Inflow
              </button>
              <button
                onClick={() => setFlowFilter('debit')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md transition-all font-bold text-[10px] uppercase tracking-wider cursor-pointer text-center ${
                  flowFilter === 'debit'
                    ? 'bg-destructive/10 text-destructive font-extrabold border border-destructive/20'
                    : 'text-muted-foreground hover:text-destructive'
                }`}
                id="filter-flow-outflow-btn"
              >
                Outflow
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-border/40 pb-4 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-muted rounded"></div>
                    <div className="h-3.5 w-36 bg-muted rounded"></div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-4 w-16 bg-muted rounded ml-auto"></div>
                    <div className="h-3 w-12 bg-muted rounded ml-auto"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-20 text-xs text-muted-foreground">
              No transaction lines found for this record.
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-20 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2 bg-muted/5 border border-dashed rounded-lg border-border/80">
              <Search className="size-8 text-muted-foreground/35 animate-pulse" />
              <span className="font-bold text-foreground">No matching transactions found</span>
              <span className="text-[10px] max-w-xs text-muted-foreground">
                Try adjusting your search terms or flow filters.
              </span>
            </div>
          ) : (
            <>
              {/* 1. Spacious table representation - Hidden on mobile, visible on desktop */}
              <div className="hidden sm:block border rounded-lg overflow-hidden bg-muted/5 shadow-xs border-border/80 mb-4">
                <Table>
                  <TableHeader className="bg-muted/15 select-none">
                    <TableRow className="text-[0.62rem] font-bold text-muted-foreground uppercase h-9.5 border-b hover:bg-transparent">
                      <TableHead className="pl-4 w-[110px]">Date</TableHead>
                      <TableHead className="w-[160px]">Category</TableHead>
                      <TableHead className="w-auto">Particulars</TableHead>
                      <TableHead className="text-center w-[90px]">Flow</TableHead>
                      <TableHead className="text-right pr-4 w-[130px]">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-[0.7rem]">
                    {filteredTransactions.map((tx, idx) => {
                      const isCredit = tx.type === 'credit';
                      return (
                        <TableRow key={idx} className="hover:bg-muted/20 border-b h-10 transition-colors">
                          <TableCell className="pl-4 font-mono text-muted-foreground">
                            {tx.date}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">{tx.category}</TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[200px]" title={tx.particulars}>
                            {tx.particulars || '—'}
                          </TableCell>
                          <TableCell className="text-center select-none">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-2.5 py-0.5 uppercase tracking-wide ${
                              isCredit
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                : 'bg-destructive/10 text-destructive border-destructive/25'
                            }`}>
                              <span className={`size-1.5 rounded-full shrink-0 ${isCredit ? 'bg-emerald-500' : 'bg-destructive'}`} />
                              {isCredit ? 'Inflow' : 'Outflow'}
                            </span>
                          </TableCell>
                          <TableCell className={`text-right font-mono font-bold pr-4 ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                            {isCredit ? '+' : '-'}{formatINR(tx.amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 2. Responsive list representation - Visible on mobile, hidden on desktop */}
              <div className="block sm:hidden space-y-2.5 pb-4">
                {filteredTransactions.map((tx, idx) => {
                  const isCredit = tx.type === 'credit';
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-muted/10 border border-border/50 hover:bg-muted/20 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Flow Status Icon Indicator */}
                        <div className={`size-8 rounded-full flex items-center justify-center shrink-0 border ${
                          isCredit
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/10'
                            : 'bg-destructive/10 text-destructive border-destructive/10'
                        }`}>
                          {isCredit ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                        </div>

                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-foreground block truncate">{tx.category}</span>
                          <span className="text-[10px] text-muted-foreground block truncate mt-0.5" title={tx.particulars}>
                            {tx.particulars || '—'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-[12px] font-mono font-extrabold block ${
                          isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                        }`}>
                          {isCredit ? '+' : '-'}{formatINR(tx.amount)}
                        </span>
                        <span className="text-[9px] text-muted-foreground block mt-0.5 font-mono tracking-wider">
                          {tx.date}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
