import React from 'react';
import { Search } from 'lucide-react';
import type { DebitorSummary, MonthlySummary } from '@/types';
import { DebitorLedgerTable } from './DebitorLedgerTable';
import { MonthlySalesLedgerTable } from './MonthlySalesLedgerTable';
import { GodownStockLedgerTable } from './GodownStockLedgerTable';
import type { GodownStockTableItem } from './GodownStockLedgerTable';

interface LedgerTableProps {
  activeTab: 'sales' | 'debitors' | 'godown_stock' | 'counter_stock';
  paginatedDebitors: DebitorSummary[];
  paginatedMonths: MonthlySummary[];
  paginatedStock: GodownStockTableItem[];
  maxOutstandingDuesLimit: number;
  totalPendingSum: number;
  topDebtorValue: number;
  bestProfitValue: number;
  totalItems: number;
  onRowClick?: (name: string) => void;
  salesSortBy: string;
  salesSortOrder: 'asc' | 'desc';
  onSalesSort: (column: string) => void;
  debtorSortBy: string;
  debtorSortOrder: 'asc' | 'desc';
  onDebtorSort: (column: string) => void;
  stockSortBy: string;
  stockSortOrder: 'asc' | 'desc';
  onStockSort: (column: string) => void;
  departments?: {
    id: string;
    code: string;
    name: string;
    type: string;
    colorHex: string | null;
  }[];
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  activeTab,
  paginatedDebitors,
  paginatedMonths,
  paginatedStock,
  maxOutstandingDuesLimit,
  totalPendingSum,
  topDebtorValue,
  bestProfitValue,
  totalItems,
  onRowClick,
  salesSortBy,
  salesSortOrder,
  onSalesSort,
  debtorSortBy,
  debtorSortOrder,
  onDebtorSort,
  stockSortBy,
  stockSortOrder,
  onStockSort,
  departments,
}) => {
  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 px-6 text-center select-none min-h-[300px] w-full">
        <Search className="size-10 text-muted-foreground/45 animate-pulse shrink-0" />
        <span className="text-sm font-bold text-foreground">
          {activeTab === 'debitors' 
            ? "No matching client profiles" 
            : activeTab === 'sales'
            ? "No matching spreadsheet monthly records"
            : "No matching inventory items"}
        </span>
        <span className="text-xs text-muted-foreground max-w-xs leading-normal">
          Try adjusting your search filters or clear the query.
        </span>
      </div>
    );
  }

  if (activeTab === 'debitors') {
    return (
      <DebitorLedgerTable
        paginatedDebitors={paginatedDebitors}
        maxOutstandingDuesLimit={maxOutstandingDuesLimit}
        totalPendingSum={totalPendingSum}
        topDebtorValue={topDebtorValue}
        onRowClick={onRowClick}
        debtorSortBy={debtorSortBy}
        debtorSortOrder={debtorSortOrder}
        onDebtorSort={onDebtorSort}
      />
    );
  }

  if (activeTab === 'godown_stock' || activeTab === 'counter_stock') {
    return (
      <GodownStockLedgerTable
        paginatedItems={paginatedStock}
        stockSortBy={stockSortBy}
        stockSortOrder={stockSortOrder}
        onStockSort={onStockSort}
      />
    );
  }

  return (
    <MonthlySalesLedgerTable
      paginatedMonths={paginatedMonths}
      bestProfitValue={bestProfitValue}
      onRowClick={onRowClick}
      salesSortBy={salesSortBy}
      salesSortOrder={salesSortOrder}
      onSalesSort={onSalesSort}
      departments={departments}
    />
  );
};

