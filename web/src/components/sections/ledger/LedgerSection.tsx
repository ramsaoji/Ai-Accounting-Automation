import React, { useState, useMemo, useEffect } from 'react';
import type { MasterSummary, Transaction, MonthlySummary, DebitorSummary } from '@/types';
import { DatePickerWithRange } from '@/components/ui/DatePickerWithRange';
import { LedgerTable } from './ledger/LedgerTable';
import type { GodownStockTableItem } from './ledger/GodownStockLedgerTable';
import { getSheetDate, parseSheetNameToValue } from '@/utils/format';
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchTransactions, fetchSystemSettings } from '@/services/api';
import { RawTransactionsTable } from './ledger/RawTransactionsTable';
import { LedgerDrawer } from './ledger/LedgerDrawer';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { toast } from 'sonner';

interface LedgerSectionProps {
  summary: MasterSummary;
  activeTab: 'sales' | 'debitors' | 'godown_stock' | 'counter_stock';
  relevantFileName: string | undefined;
}

export const LedgerSection: React.FC<LedgerSectionProps> = ({
  summary,
  activeTab,
  relevantFileName,
}) => {
  const [maxOutstandingDuesLimit, setMaxOutstandingDuesLimit] = useState(15000);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await fetchSystemSettings(activeTab, relevantFileName);
        if (data?.ruleOutstandingCreditCap !== undefined) {
          setMaxOutstandingDuesLimit(data.ruleOutstandingCreditCap);
        }
      } catch (err) {
        console.error('Failed to load credit limit settings in ledger view:', err);
      }
    };
    loadSettings();
  }, [activeTab, relevantFileName]);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'breached' | 'watch' | 'clear'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const itemsPerPage = 10;

  const [activeSubTab, setActiveSubTab] = useState<'ledger' | 'transactions'>('ledger');

  // Client-side ledger sorting states
  const [salesSortBy, setSalesSortBy] = useState<string>('sheetName');
  const [salesSortOrder, setSalesSortOrder] = useState<'asc' | 'desc'>('desc');
  const [debtorSortBy, setDebtorSortBy] = useState<string>('pending');
  const [debtorSortOrder, setDebtorSortOrder] = useState<'asc' | 'desc'>('desc');
  const [stockSortBy, setStockSortBy] = useState<string>('itemName');
  const [stockSortOrder, setStockSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleStockSort = (column: string) => {
    if (stockSortBy === column) {
      setStockSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setStockSortBy(column);
      setStockSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Server-side transactions grid states
  const [txList, setTxList] = useState<Transaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txLimit] = useState(10);
  const [txSearch, setTxSearch] = useState('');
  const [txSortBy, setTxSortBy] = useState('date');
  const [txSortOrder, setTxSortOrder] = useState<'asc' | 'desc'>('desc');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [txSelectedMonths, setTxSelectedMonths] = useState<string[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Reset selected months when tab changes
  useEffect(() => {
    setSelectedMonths([]);
    setTxSelectedMonths([]);
  }, [activeTab]);

  // Debounce search input for client-side lists
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSalesSort = (column: string) => {
    if (salesSortBy === column) {
      setSalesSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSalesSortBy(column);
      setSalesSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleDebtorSort = (column: string) => {
    if (debtorSortBy === column) {
      setDebtorSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setDebtorSortBy(column);
      setDebtorSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // Drawer States
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerDescription, setDrawerDescription] = useState('');
  const [drawerTransactions, setDrawerTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (activeSubTab !== 'transactions' || activeTab === 'godown_stock' || activeTab === 'counter_stock') return;

    let isMounted = true;
    const loadTx = async () => {
      setTxLoading(true);
      try {
        const res = await fetchTransactions({
          fileType: activeTab as 'sales' | 'debitors',
          page: txPage,
          limit: txLimit,
          search: txSearch,
          sortBy: txSortBy,
          sortOrder: txSortOrder,
          type: txTypeFilter === 'all' ? undefined : txTypeFilter,
          month: txSelectedMonths.length > 0 ? txSelectedMonths.join(',') : undefined,
        });
        if (isMounted) {
          setTxList(res.transactions);
          setTxTotal(res.pagination.total);
        }
      } catch (err) {
        console.error('Failed to load paginated transactions:', err);
        toast.error('Failed to load transaction ledger records');
      } finally {
        if (isMounted) {
          setTxLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      loadTx();
    }, 250); // debounce input search trigger slightly

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeSubTab, activeTab, txPage, txLimit, txSearch, txSortBy, txSortOrder, txTypeFilter, txSelectedMonths]);

  const isDebitors = activeTab === 'debitors';

  const formatINR = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const availableMonths = useMemo(() => {
    if (!summary.months) return [];
    return summary.months.map((m: MonthlySummary) => m.sheetName);
  }, [summary.months]);

  // Dynamic Debitors List based on date range
  const dynamicDebitorsList = useMemo(() => {
    if (!isDebitors || !summary.topDebitors) return [];
    
    if (selectedMonths.length === 0 || !summary.transactions) {
      return summary.topDebitors;
    }

    const filteredTx = summary.transactions.filter((t: Transaction) => {
      const txDate = new Date(t.date);
      return selectedMonths.some(monthStr => {
        const parsed = getSheetDate(monthStr);
        return parsed && 
               txDate.getFullYear() === parsed.getFullYear() && 
               txDate.getMonth() === parsed.getMonth();
      });
    });

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
    let list = dynamicDebitorsList;

    if (debouncedSearchTerm.trim()) {
      const q = debouncedSearchTerm.toLowerCase();
      list = list.filter((debtor: DebitorSummary) =>
        debtor.name.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      list = list.filter((debtor: DebitorSummary) => {
        const isBreach = debtor.pending > maxOutstandingDuesLimit;
        if (statusFilter === 'breached') return isBreach;
        if (statusFilter === 'watch') return !isBreach && debtor.pending > 5000;
        if (statusFilter === 'clear') return debtor.pending <= 5000;
        return true;
      });
    }

    return [...list].sort((a: DebitorSummary, b: DebitorSummary) => {
      const valA = a[debtorSortBy as keyof DebitorSummary];
      const valB = b[debtorSortBy as keyof DebitorSummary];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return debtorSortOrder === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }

      const numA = Number(valA ?? 0);
      const numB = Number(valB ?? 0);
      return debtorSortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [dynamicDebitorsList, debouncedSearchTerm, statusFilter, maxOutstandingDuesLimit, debtorSortBy, debtorSortOrder]);

  // Filter & Search Logic for Months
  const processedMonths = useMemo(() => {
    if (!summary.months) return [];
    
    let list = summary.months;
    
    if (selectedMonths.length > 0) {
      list = list.filter((m: MonthlySummary) => selectedMonths.includes(m.sheetName));
    }

    if (debouncedSearchTerm.trim()) {
      const q = debouncedSearchTerm.toLowerCase();
      list = list.filter((m: MonthlySummary) =>
        m.sheetName.toLowerCase().includes(q) ||
        m.status.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a: MonthlySummary, b: MonthlySummary) => {
      let valA: any;
      let valB: any;

      if (salesSortBy === 'sheetName') {
        valA = parseSheetNameToValue(a.sheetName);
        valB = parseSheetNameToValue(b.sheetName);
      } else {
        const dept = summary.departments?.find(d => d.name === salesSortBy);
        const isLiquorDept = dept ? (dept.code === '4001' || dept.id === 'liq') : (salesSortBy === 'Primary Revenue' || salesSortBy === 'Liquor' || salesSortBy === 'Liquor Sales');
        const isFoodDept = dept ? (dept.code === '4002' || dept.id === 'food') : (salesSortBy === 'Secondary Revenue' || salesSortBy === 'Food' || salesSortBy === 'Food Sales');

        const getDeptVal = (m: MonthlySummary) => {
          if (m.departments && (salesSortBy in m.departments)) {
            return m.departments[salesSortBy] || 0;
          }
          if (isLiquorDept) return m.liquor || 0;
          if (isFoodDept) return m.food || 0;
          return Number(m[salesSortBy as keyof MonthlySummary] || 0);
        };

        valA = getDeptVal(a);
        valB = getDeptVal(b);
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return salesSortOrder === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }

      const numA = Number(valA ?? 0);
      const numB = Number(valB ?? 0);
      return salesSortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [summary.months, debouncedSearchTerm, selectedMonths, salesSortBy, salesSortOrder]);

  // Filter & Search Logic for Stock Items
  const processedStock = useMemo(() => {
    if (!summary.items) return [];
    
    let list = summary.items as unknown as GodownStockTableItem[];

    if (debouncedSearchTerm.trim()) {
      const q = debouncedSearchTerm.toLowerCase();
      list = list.filter((item) =>
        item.itemName.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      const valA = a[stockSortBy as keyof GodownStockTableItem];
      const valB = b[stockSortBy as keyof GodownStockTableItem];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return stockSortOrder === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }

      const numA = Number(valA ?? 0);
      const numB = Number(valB ?? 0);
      return stockSortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [summary.items, debouncedSearchTerm, stockSortBy, stockSortOrder]);



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

  // Row drilldown click handlers
  const handleMonthClick = async (monthName: string) => {
    setDrawerTitle(`${monthName} Ledger Entries`);
    setDrawerDescription(`Raw accounting logs compiled for the ${monthName} statement sheet.`);
    setDrawerTransactions([]);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await fetchTransactions({
        fileType: 'sales',
        month: monthName,
        limit: 2000,
      });
      setDrawerTransactions(res.transactions);
    } catch (err) {
      console.error('Failed to load monthly transactions:', err);
      toast.error('Failed to retrieve monthly transaction list');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDebtorClick = async (debtorName: string) => {
    setDrawerTitle(`${debtorName} Transaction History`);
    setDrawerDescription(`Audit log of all credit extended and cash payments cleared for ${debtorName}.`);
    setDrawerTransactions([]);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await fetchTransactions({
        fileType: 'debitors',
        vendor: debtorName,
        limit: 2000,
      });
      setDrawerTransactions(res.transactions);
    } catch (err) {
      console.error('Failed to load customer transactions:', err);
      toast.error('Failed to retrieve customer transaction ledger history');
    } finally {
      setDrawerLoading(false);
    }
  };

  const onRowClick = isDebitors ? handleDebtorClick : handleMonthClick;

  // Pagination Logic
  const totalItems = isDebitors
    ? processedDebitors.length
    : (activeTab === 'godown_stock' || activeTab === 'counter_stock')
    ? processedStock.length
    : processedMonths.length;

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  
  const currentPg = activeSubTab === 'transactions' ? txPage : currentPage;
  const totalPgs = activeSubTab === 'transactions'
    ? Math.max(1, Math.ceil(txTotal / txLimit))
    : totalPages;

  const isTxSubTab = activeSubTab === 'transactions';
  const showStart = isTxSubTab 
    ? (txTotal === 0 ? 0 : (txPage - 1) * txLimit + 1)
    : (totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1);
  const showEnd = isTxSubTab
    ? Math.min(txTotal, txPage * txLimit)
    : Math.min(totalItems, currentPage * itemsPerPage);
  const showTotal = isTxSubTab ? txTotal : totalItems;

  const handleSort = (column: string) => {
    if (txSortBy === column) {
      setTxSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setTxSortBy(column);
      setTxSortOrder('desc');
    }
    setTxPage(1);
  };

  const renderSortIcon = (column: string) => {
    if (txSortBy !== column) return <ArrowUpDown className="ml-1 size-3 opacity-50 inline-block align-middle" />;
    return txSortOrder === 'asc' 
      ? <ArrowUp className="ml-1 size-3 text-foreground inline-block align-middle" /> 
      : <ArrowDown className="ml-1 size-3 text-foreground inline-block align-middle" />;
  };

  const renderPaginationItems = () => {
    const items = [];
    const maxVisible = 5;
    
    if (totalPgs <= maxVisible) {
      for (let i = 1; i <= totalPgs; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={currentPg === i}
              onClick={() => {
                if (isTxSubTab) setTxPage(i);
                else setCurrentPage(i);
                const scrollEl = document.querySelector('.overflow-auto');
                if (scrollEl) scrollEl.scrollTop = 0;
              }}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            isActive={currentPg === 1}
            onClick={() => {
              if (isTxSubTab) setTxPage(1);
              else setCurrentPage(1);
              const scrollEl = document.querySelector('.overflow-auto');
              if (scrollEl) scrollEl.scrollTop = 0;
            }}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      if (currentPg > 3) {
        items.push(<PaginationItem key="ellipsis-start"><PaginationEllipsis /></PaginationItem>);
      }

      const start = Math.max(2, currentPg - 1);
      const end = Math.min(totalPgs - 1, currentPg + 1);

      for (let i = start; i <= end; i++) {
        if (i === 1 || i === totalPgs) continue;
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={currentPg === i}
              onClick={() => {
                if (isTxSubTab) setTxPage(i);
                else setCurrentPage(i);
                const scrollEl = document.querySelector('.overflow-auto');
                if (scrollEl) scrollEl.scrollTop = 0;
              }}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      if (currentPg < totalPgs - 2) {
        items.push(<PaginationItem key="ellipsis-end"><PaginationEllipsis /></PaginationItem>);
      }

      items.push(
        <PaginationItem key={totalPgs}>
          <PaginationLink
            isActive={currentPg === totalPgs}
            onClick={() => {
              if (isTxSubTab) setTxPage(totalPgs);
              else setCurrentPage(totalPgs);
              const scrollEl = document.querySelector('.overflow-auto');
              if (scrollEl) scrollEl.scrollTop = 0;
            }}
          >
            {totalPgs}
          </PaginationLink>
        </PaginationItem>
      );
    }
    return items;
  };

  const paginatedDebitors = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedDebitors.slice(start, start + itemsPerPage);
  }, [processedDebitors, currentPage]);

  const paginatedMonths = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedMonths.slice(start, start + itemsPerPage);
  }, [processedMonths, currentPage]);

  const paginatedStock = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedStock.slice(start, start + itemsPerPage);
  }, [processedStock, currentPage]);



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

      {/* Tab Selector */}
      {activeTab !== 'godown_stock' && activeTab !== 'counter_stock' && (
        <div className="flex border bg-muted/20 rounded-lg p-0.5 select-none w-fit shrink-0">
          <button
            type="button"
            onClick={() => { setActiveSubTab('ledger'); setCurrentPage(1); }}
            className={`text-xs px-4 py-2 font-bold rounded-md transition-all cursor-pointer ${
              activeSubTab === 'ledger'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/10'
            }`}
          >
            {isDebitors ? 'Customer Balances' : 'Monthly Summaries'}
          </button>
          <button
            type="button"
            onClick={() => { setActiveSubTab('transactions'); setCurrentPage(1); }}
            className={`text-xs px-4 py-2 font-bold rounded-md transition-all cursor-pointer ${
              activeSubTab === 'transactions'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted/10'
            }`}
          >
            Raw Transactions
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <Card className="border shadow-xs bg-card/45 overflow-hidden flex flex-col justify-between">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Custom Database Toolbar */}
          <div className="p-3.5 border-b border-border/80 bg-muted/10 flex flex-col gap-3 shrink-0 select-none">
            <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="w-full md:w-auto flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Search Field */}
                <div className="relative w-full md:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  {activeSubTab === 'transactions' ? (
                    <>
                      <Input
                        type="text"
                        placeholder="Search transactions..."
                        value={txSearch}
                        onChange={(e) => {
                          setTxSearch(e.target.value);
                          setTxPage(1);
                        }}
                        className="pl-9 pr-8 h-10 sm:h-9 text-xs w-full"
                      />
                      {txSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setTxSearch('');
                            setTxPage(1);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-0.5 rounded-full hover:bg-muted"
                          aria-label="Clear transaction search"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <Input
                        type="text"
                        placeholder="Filter records..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pl-9 pr-8 h-10 sm:h-9 text-xs w-full"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm('');
                            setCurrentPage(1);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-0.5 rounded-full hover:bg-muted"
                          aria-label="Clear ledger search"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Date Filter Widget — only for sales (has month sheets) in ledger view and transactions view */}
                {!isDebitors && activeTab !== 'godown_stock' && activeTab !== 'counter_stock' && (activeSubTab === 'ledger' || activeSubTab === 'transactions') && (
                  <div className="w-full sm:w-auto">
                    <DatePickerWithRange 
                      selectedMonths={activeSubTab === 'transactions' ? txSelectedMonths : selectedMonths} 
                      setSelectedMonths={(m: string[]) => { 
                        if (activeSubTab === 'transactions') {
                          setTxSelectedMonths(m);
                          setTxPage(1);
                        } else {
                          setSelectedMonths(m);
                          setCurrentPage(1); 
                        }
                      }} 
                      availableMonths={availableMonths}
                    />
                  </div>
                )}
              </div>

              {/* Status filter dropdown for Debitors in ledger view */}
              {isDebitors && activeSubTab === 'ledger' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Filter className="size-3 text-muted-foreground" />
                    Filters:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(['all', 'breached', 'watch', 'clear'] as const).map((filter) => (
                      <button
                        type="button"
                        key={filter}
                        onClick={() => {
                          setStatusFilter(filter);
                          setCurrentPage(1);
                        }}
                        className={`text-xs px-3 h-8 rounded-lg border font-semibold capitalize transition-all duration-200 cursor-pointer select-none ${
                          statusFilter === filter
                            ? 'bg-foreground text-background border-foreground hover:bg-foreground/90'
                            : 'bg-background hover:bg-muted text-muted-foreground border-input dark:bg-input/30'
                        }`}
                      >
                        {filter === 'clear' ? 'cleared' : filter}
                      </button>
                    ))}
                  </div>
                </div>
              )}


              {/* Flow filter dropdown for Transactions tab */}
              {activeSubTab === 'transactions' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Filter className="size-3 text-muted-foreground" />
                    Filters:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(['all', 'credit', 'debit'] as const).map((filter) => (
                      <button
                        type="button"
                        key={filter}
                        onClick={() => {
                          setTxTypeFilter(filter);
                          setTxPage(1);
                        }}
                        className={`text-xs px-3 h-8 rounded-lg border font-semibold capitalize transition-all duration-200 cursor-pointer select-none ${
                          txTypeFilter === filter
                            ? 'bg-foreground text-background border-foreground hover:bg-foreground/90'
                            : 'bg-background hover:bg-muted text-muted-foreground border-input dark:bg-input/30'
                        }`}
                      >
                        {filter === 'all' ? 'All Flows' : filter === 'credit' ? 'Inflows' : 'Outflows'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Database Grid */}
          <div className="flex-1 overflow-auto">
            {activeSubTab === 'ledger' ? (
              <LedgerTable
                activeTab={activeTab}
                paginatedDebitors={paginatedDebitors}
                paginatedMonths={paginatedMonths}
                paginatedStock={paginatedStock}
                maxOutstandingDuesLimit={maxOutstandingDuesLimit}
                totalPendingSum={totalPendingSum}
                topDebtorValue={topDebtorValue}
                bestProfitValue={bestProfitValue}
                totalItems={totalItems}
                onRowClick={onRowClick}
                salesSortBy={salesSortBy}
                salesSortOrder={salesSortOrder}
                onSalesSort={handleSalesSort}
                debtorSortBy={debtorSortBy}
                debtorSortOrder={debtorSortOrder}
                onDebtorSort={handleDebtorSort}
                stockSortBy={stockSortBy}
                stockSortOrder={stockSortOrder}
                onStockSort={handleStockSort}
                departments={summary.departments}
              />
            ) : (              /* Raw Transactions Explorer Tab */
              <RawTransactionsTable
                txLoading={txLoading}
                txList={txList}
                txLimit={txLimit}
                handleSort={handleSort}
                renderSortIcon={renderSortIcon}
                formatINR={formatINR}
              />
            )}
          </div>
        </div>

        {/* Database Pagination Console */}
        <div className="border-t p-4 bg-muted/15 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 select-none shrink-0 text-xs font-semibold text-muted-foreground border-border/80">
          <span>
            Showing {showStart.toLocaleString()} to {showEnd.toLocaleString()} of {showTotal.toLocaleString()} items
          </span>
          
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => {
                    if (isTxSubTab) setTxPage(prev => Math.max(1, prev - 1));
                    else setCurrentPage(prev => Math.max(1, prev - 1));
                    const scrollEl = document.querySelector('.overflow-auto');
                    if (scrollEl) scrollEl.scrollTop = 0;
                  }}
                  disabled={currentPg === 1}
                  className="cursor-pointer"
                />
              </PaginationItem>
              
              {renderPaginationItems()}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => {
                    if (isTxSubTab) setTxPage(prev => Math.min(totalPgs, prev + 1));
                    else setCurrentPage(prev => Math.min(totalPgs, prev + 1));
                    const scrollEl = document.querySelector('.overflow-auto');
                    if (scrollEl) scrollEl.scrollTop = 0;
                  }}
                  disabled={currentPg === totalPgs}
                  className="cursor-pointer"
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </Card>

      {/* Side Drawer Drilldown overlay */}
      <LedgerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={drawerTitle}
        description={drawerDescription}
        loading={drawerLoading}
        transactions={drawerTransactions}
        formatINR={formatINR}
      />
    </div>
  );
};

