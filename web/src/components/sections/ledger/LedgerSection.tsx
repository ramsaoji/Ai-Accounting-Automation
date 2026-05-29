import React, { useState, useMemo } from 'react';
import type { MasterSummary, Transaction, MonthlySummary, DebitorSummary } from '@/types';
import { DatePickerWithRange } from '@/components/ui/DatePickerWithRange';
import { LedgerTable } from './ledger/LedgerTable';
import { getSheetDate, parseSheetNameToValue } from '@/utils/format';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface LedgerSectionProps {
  summary: MasterSummary;
  activeTab: 'sales' | 'debitors';
  maxOutstandingDuesLimit: number;
}

export const LedgerSection: React.FC<LedgerSectionProps> = ({
  summary,
  activeTab,
  maxOutstandingDuesLimit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'breached' | 'watch' | 'clear'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const itemsPerPage = 10;

  const isDebitors = activeTab === 'debitors';

  const availableMonths = useMemo(() => {
    if (!summary.months) return [];
    return summary.months.map((m: MonthlySummary) => m.sheetName);
  }, [summary.months]);



  // Dynamic Debitors List based on date range
  const dynamicDebitorsList = useMemo(() => {
    if (!isDebitors || !summary.topDebitors) return [];
    
    // If no selected months filter, use summary.topDebitors
    if (selectedMonths.length === 0 || !summary.transactions) {
      return summary.topDebitors;
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

    return Array.from(debtorMap.entries())
      .map(([name, val]) => ({
        name,
        debit: val.debit,
        credit: val.credit,
        pending: val.pending
      }))
      .filter(d => d.pending > 0 || d.debit > 0)
      .sort((a, b) => b.pending - a.pending);
  }, [summary.topDebitors, summary.transactions, isDebitors, selectedMonths]);

  // Filter & Search Logic for Debitors
  const processedDebitors = useMemo(() => {
    // Apply search
    let list = dynamicDebitorsList.filter((debtor: DebitorSummary) =>
      debtor.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply status filter
    if (statusFilter !== 'all') {
      list = list.filter((debtor: DebitorSummary) => {
        const isBreach = debtor.pending > maxOutstandingDuesLimit;
        if (statusFilter === 'breached') return isBreach;
        if (statusFilter === 'watch') return !isBreach && debtor.pending > 5000;
        if (statusFilter === 'clear') return debtor.pending <= 5000;
        return true;
      });
    }

    return list;
  }, [dynamicDebitorsList, searchTerm, statusFilter, maxOutstandingDuesLimit]);

  // Filter & Search Logic for Months
  const processedMonths = useMemo(() => {
    if (!summary.months) return [];
    
    let list = summary.months;
    
    // Apply selected months filter
    if (selectedMonths.length > 0) {
      list = list.filter((m: MonthlySummary) => selectedMonths.includes(m.sheetName));
    }

    // Apply search
    list = list.filter((m: MonthlySummary) =>
      m.sheetName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return list.toSorted((a: MonthlySummary, b: MonthlySummary) => {
      const valA = parseSheetNameToValue(a.sheetName);
      const valB = parseSheetNameToValue(b.sheetName);
      return valB - valA;
    });
  }, [summary.months, searchTerm, selectedMonths]);

  // Dynamic values for rendering progress/bars
  const totalPendingSum = useMemo(() => {
    if (selectedMonths.length > 0 && summary.transactions) {
      return dynamicDebitorsList.reduce((sum: number, d: DebitorSummary) => sum + d.pending, 0);
    }
    return summary.aggregates?.totalPendingSum ?? 0;
  }, [selectedMonths, summary.transactions, dynamicDebitorsList, summary.aggregates]);

  const topDebtorValue = useMemo(() => {
    if (selectedMonths.length > 0 && summary.transactions) {
      return dynamicDebitorsList[0]?.pending ?? 1;
    }
    return summary.aggregates?.topDebtorValue ?? 1;
  }, [selectedMonths, summary.transactions, dynamicDebitorsList, summary.aggregates]);

  const bestProfitValue = useMemo(() => {
    if (selectedMonths.length > 0) {
      let maxVal = 0;
      processedMonths.forEach((m: MonthlySummary) => {
        if (m.net > maxVal) maxVal = m.net;
      });
      return maxVal || 1;
    }
    return summary.benchmarks?.bestProfitValue ?? 1;
  }, [selectedMonths, processedMonths, summary.benchmarks]);

  // Pagination Logic
  const totalItems = isDebitors ? processedDebitors.length : processedMonths.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  
  const paginatedDebitors = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedDebitors.slice(start, start + itemsPerPage);
  }, [processedDebitors, currentPage]);

  const paginatedMonths = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedMonths.slice(start, start + itemsPerPage);
  }, [processedMonths, currentPage]);

  return (
    <div className="flex flex-col gap-4 md:gap-6 w-full animate-in fade-in duration-300">
      {/* Title */}
      <div className="border-b pb-4 md:pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-tight text-foreground">
            Transaction Ledger Explorer
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit, filter, and inspect detailed balance sheets parsed from the local register files.
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="border shadow-xs bg-card/45 overflow-hidden flex flex-col justify-between">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Custom Database Toolbar */}
          <div className="p-4 border-b border-border/80 bg-muted/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0 select-none">
            <div className="w-full flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Field */}
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Filter records..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                {/* Date Filter Widget — only for sales (has month sheets) */}
                {!isDebitors && (
                  <DatePickerWithRange 
                    selectedMonths={selectedMonths} 
                    setSelectedMonths={(m: string[]) => { setSelectedMonths(m); setCurrentPage(1); }} 
                    availableMonths={availableMonths}
                  />
                )}
              </div>

              {/* Status filter dropdown for Debitors */}
              {isDebitors && (
                <div className="flex items-center gap-1.5">
                  <Filter className="size-3.5 text-muted-foreground" />
                  <div className="flex gap-1">
                    {(['all', 'breached', 'watch', 'clear'] as const).map((filter) => (
                      <button
                        type="button"
                        key={filter}
                        onClick={() => {
                          setStatusFilter(filter);
                          setCurrentPage(1);
                        }}
                        className={`text-xs px-3 h-9 sm:h-9 rounded-lg border font-semibold capitalize transition-all duration-200 cursor-pointer select-none ${
                          statusFilter === filter
                            ? 'bg-foreground text-background border-foreground hover:bg-foreground/90'
                            : 'bg-background hover:bg-muted text-muted-foreground border-input dark:bg-input/30'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Database Grid */}
          <div className="flex-1 overflow-auto">
            <LedgerTable
              isDebitors={isDebitors}
              paginatedDebitors={paginatedDebitors}
              paginatedMonths={paginatedMonths}
              maxOutstandingDuesLimit={maxOutstandingDuesLimit}
              totalPendingSum={totalPendingSum}
              topDebtorValue={topDebtorValue}
              bestProfitValue={bestProfitValue}
              totalItems={totalItems}
            />
          </div>
        </div>

        {/* Database Pagination Console */}
        <div className="border-t p-4 bg-muted/15 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 select-none shrink-0 text-xs font-semibold text-muted-foreground">
          <span>
            Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(totalItems, currentPage * itemsPerPage)} of {totalItems.toLocaleString()} items
          </span>
          
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="cursor-pointer"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-3 font-mono font-bold">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="cursor-pointer"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
