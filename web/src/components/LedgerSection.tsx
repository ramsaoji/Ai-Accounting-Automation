import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { MasterSummary } from '../types';
import {
  Search,
  // Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@/components/ui/table';

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
  const itemsPerPage = 10;

  const formatINR = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const isDebitors = activeTab === 'debitors';

  // Helper to generate initials avatar
  const getAvatarInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Filter & Search Logic
  const processedDebitors = useMemo(() => {
    if (!summary.topDebitors) return [];
    
    // Apply search
    let list = summary.topDebitors.filter((debtor) =>
      debtor.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply status filter
    if (statusFilter !== 'all') {
      list = list.filter((debtor) => {
        const isBreach = debtor.pending > maxOutstandingDuesLimit;
        if (statusFilter === 'breached') return isBreach;
        if (statusFilter === 'watch') return !isBreach && debtor.pending > 5000;
        if (statusFilter === 'clear') return debtor.pending <= 5000;
        return true;
      });
    }

    return list;
  }, [summary.topDebitors, searchTerm, statusFilter, maxOutstandingDuesLimit]);

  const parseSheetNameToValue = (sheetName: string) => {
    const clean = sheetName.trim().toLowerCase();
    const yearMatch = clean.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      const monthsMap: Record<string, number> = {
        jan: 0, january: 0,
        feb: 1, february: 1,
        mar: 2, march: 2,
        apr: 3, april: 3,
        may: 4,
        jun: 5, june: 5,
        jul: 6, july: 6,
        aug: 7, august: 7,
        sep: 8, sept: 8, september: 8,
        oct: 9, october: 9,
        nov: 10, november: 10,
        dec: 11, december: 11
      };
      let monthIdx = 0;
      for (const [key, value] of Object.entries(monthsMap)) {
        if (clean.includes(key)) {
          monthIdx = value;
          break;
        }
      }
      return year * 12 + monthIdx;
    }
    return 0;
  };

  const processedMonths = useMemo(() => {
    if (!summary.months) return [];
    const list = summary.months.filter((m) =>
      m.sheetName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return [...list].sort((a, b) => {
      const valA = parseSheetNameToValue(a.sheetName);
      const valB = parseSheetNameToValue(b.sheetName);
      return valB - valA;
    });
  }, [summary.months, searchTerm]);

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

  // Reset page when search or filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // const handleExportCSV = () => {
  //   try {
  //     let csvContent = "\uFEFF"; // Unicode BOM for Excel compatibility
      
  //     if (isDebitors) {
  //       // Header
  //       csvContent += "Customer Name,Total Credit purchases,Cleared Amount,Outstanding Balance,Risk Category\n";
  //       // Rows
  //       processedDebitors.forEach((debtor) => {
  //         const isBreach = debtor.pending > maxOutstandingDuesLimit;
  //         const risk = isBreach ? "Breached Credit Limit" : debtor.pending > 5000 ? "Watchlist" : "Good Standing";
  //         const row = `"${debtor.name.replace(/"/g, '""')}",${debtor.debit},${debtor.credit},${debtor.pending},"${risk}"`;
  //         csvContent += row + "\n";
  //       });
  //     } else {
  //       // Header
  //       csvContent += "Sheet Month,Consolidated Inflows,Operational Outflows,Net Surplus,Liquor Split,Food Split,Other Expenses\n";
  //       // Rows
  //       processedMonths.forEach((m) => {
  //         const row = `"${m.sheetName.replace(/"/g, '""')}",${m.inflows},${m.outflows},${m.net},${m.liquor},${m.food},${m.expenses}`;
  //         csvContent += row + "\n";
  //       });
  //     }
      
  //     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  //     const url = URL.createObjectURL(blob);
  //     const link = document.createElement("a");
  //     const filename = isDebitors 
  //       ? `Debitors_Outstanding_Ledger_Report_${new Date().toISOString().slice(0,10)}.csv`
  //       : `Daily_Sales_Consolidated_Report_${new Date().toISOString().slice(0,10)}.csv`;
        
  //     link.setAttribute("href", url);
  //     link.setAttribute("download", filename);
  //     document.body.appendChild(link);
  //     link.click();
  //     document.body.removeChild(link);
  //     URL.revokeObjectURL(url);
      
  //     toast.success("CSV file downloaded successfully.");
  //   } catch (err) {
  //     toast.error("Failed to generate CSV export.");
  //     console.error(err);
  //   }
  // };

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
              {/* Search Field */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Filter records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Status filter dropdown for Debitors */}
              {isDebitors && (
                <div className="flex items-center gap-1.5">
                  <Filter className="size-3.5 text-muted-foreground" />
                  <div className="flex gap-1">
                    {(['all', 'breached', 'watch', 'clear'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-semibold capitalize transition-all duration-200 cursor-pointer select-none ${
                          statusFilter === filter
                            ? 'bg-foreground text-background border-foreground hover:bg-foreground/90'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border/80'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Export Actions */}
            {/* <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs h-9">
                <Download className="size-3.5 mr-1.5" />
                Export CSV
              </Button>
            </div> */}
          </div>

          {/* Database Grid */}
          <div className="flex-1 overflow-auto">
            <Table className="min-w-[700px] sm:min-w-full">
              <TableHeader className="bg-muted/15 select-none">
                <TableRow className="text-[0.68rem] font-bold text-muted-foreground uppercase border-b hover:bg-transparent">
                  {isDebitors ? (
                    <>
                      <TableHead className="pl-6 h-10 w-[240px]">Customer Accounts</TableHead>
                      <TableHead className="text-right h-10">Purchase Volume</TableHead>
                      <TableHead className="text-right h-10">Amount Settled</TableHead>
                      <TableHead className="text-right h-10">Net Balance</TableHead>
                      <TableHead className="text-center h-10">Total Contribution</TableHead>
                      <TableHead className="text-center pr-6 h-10">Policy Audit</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="pl-6 h-10">Register Sheet</TableHead>
                      <TableHead className="text-right h-10">Liquor Receipts</TableHead>
                      <TableHead className="text-right h-10">Food Receipts</TableHead>
                      <TableHead className="text-right h-10">Expenses Outflow</TableHead>
                      <TableHead className="text-right h-10">Debits Extended</TableHead>
                      <TableHead className="text-right h-10">Net Cash Balance</TableHead>
                      <TableHead className="text-center h-10">Surplus Ratio</TableHead>
                      <TableHead className="text-center pr-6 h-10">Operating Verdict</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {isDebitors ? (
                  paginatedDebitors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium">
                        No matching client profiles.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedDebitors.map((debtor, idx) => {
                      const contribution = summary.aggregates?.totalPendingSum ? ((debtor.pending / summary.aggregates.totalPendingSum) * 100).toFixed(1) : '0';
                      const isBreach = debtor.pending > maxOutstandingDuesLimit;
                      
                      const badgeStyles = isBreach 
                        ? 'bg-destructive/10 text-destructive border-destructive/20' 
                        : debtor.pending > 5000 
                          ? 'bg-warning/10 text-warning border-warning/20' 
                          : 'bg-success/10 text-success border-success/20';
                      
                      const badgeLabel = isBreach ? 'Limit Breach' : debtor.pending > 5000 ? 'Audit Watch' : 'Clear Ledger';
                      const statusIcon = isBreach ? <AlertTriangle className="size-3 text-destructive" /> : debtor.pending > 5000 ? <AlertTriangle className="size-3 text-warning" /> : <CheckCircle className="size-3 text-success" />;

                      return (
                        <TableRow key={idx} className="hover:bg-muted/30 transition-colors h-11 border-b">
                          {/* Name + Initials Avatar */}
                          <TableCell className="pl-6 font-semibold text-foreground flex items-center gap-3">
                            <div className="size-7 rounded-full bg-primary/10 text-primary border flex items-center justify-center font-bold text-[0.68rem] font-mono select-none">
                              {getAvatarInitials(debtor.name)}
                            </div>
                            <span className="truncate max-w-[150px]">{debtor.name}</span>
                          </TableCell>
                          
                          <TableCell className="text-right font-mono font-semibold text-muted-foreground">{formatINR(debtor.debit)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-muted-foreground">{formatINR(debtor.credit)}</TableCell>
                          
                          <TableCell className={`text-right font-mono font-bold ${debtor.pending > 0 ? 'text-destructive' : 'text-success'}`}>
                            {formatINR(debtor.pending)}
                          </TableCell>
                          
                          {/* Contribution Progress bar */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2 select-none">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden border">
                                <div
                                  className={`h-full rounded-full ${isBreach ? 'bg-destructive' : 'bg-primary'}`}
                                  style={{ width: `${Math.min(100, Math.max(8, Math.round(debtor.pending / (summary.aggregates?.topDebtorValue || 1) * 100)))}%` }}
                                ></div>
                              </div>
                              <span className="text-[0.65rem] font-bold text-muted-foreground font-mono w-8 text-left">{contribution}%</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center pr-6 select-none">
                            <span className={`text-[0.62rem] font-bold border rounded-full px-2.5 py-0.8 uppercase tracking-wider inline-flex items-center gap-1.5 ${badgeStyles}`}>
                              {statusIcon}
                              {badgeLabel}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )
                ) : (
                  paginatedMonths.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-20 text-muted-foreground font-medium">
                        No matching spreadsheet monthly records.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedMonths.map((month, idx) => {
                      const isProfit = month.net >= 0;
                      const netColor = isProfit ? 'text-success' : 'text-destructive';
                      const badgeStyles = isProfit 
                        ? 'bg-success/10 text-success border-success/20' 
                        : 'bg-destructive/10 text-destructive border-destructive/20';

                      return (
                        <TableRow key={idx} className="hover:bg-muted/30 transition-colors h-11 border-b">
                          <TableCell className="pl-6 font-semibold text-foreground flex items-center gap-2">
                            <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                            {month.sheetName}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-muted-foreground">{formatINR(month.liquor)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-muted-foreground">{formatINR(month.food)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-destructive">{formatINR(month.expenses)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-warning">{formatINR(month.creditExtended)}</TableCell>
                          <TableCell className={`text-right font-mono font-bold ${netColor}`}>{formatINR(month.net)}</TableCell>
                          
                          {/* Weighting bar */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center select-none">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden border">
                                <div
                                  className={isProfit ? "bg-success h-full rounded-full" : "bg-destructive h-full rounded-full"}
                                  style={{ width: `${Math.min(100, Math.max(8, Math.round(Math.abs(month.net) / (summary.benchmarks?.bestProfitValue || 1) * 100)))}%` }}
                                ></div>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-center pr-6 select-none">
                            <span className={`text-[0.62rem] font-bold border rounded-full px-2.5 py-0.8 uppercase tracking-wider ${badgeStyles}`}>
                              {month.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Database Pagination Console */}
        <div className="border-t p-4 bg-muted/15 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 select-none shrink-0 text-xs font-semibold text-muted-foreground">
          <span>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(totalItems, currentPage * itemsPerPage)} of {totalItems.toLocaleString()} items
          </span>
          
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-8 cursor-pointer"
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
              className="size-8 cursor-pointer"
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
