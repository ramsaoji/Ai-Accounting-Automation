import React from 'react';
import { Search } from 'lucide-react';
import type { DebitorSummary, MonthlySummary } from '@/types';
import { DebitorLedgerTable } from './DebitorLedgerTable';
import { MonthlySalesLedgerTable } from './MonthlySalesLedgerTable';

interface LedgerTableProps {
  isDebitors: boolean;
  paginatedDebitors: DebitorSummary[];
  paginatedMonths: MonthlySummary[];
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
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  isDebitors,
  paginatedDebitors,
  paginatedMonths,
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
}) => {
  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 px-6 text-center select-none min-h-[300px] w-full">
        <Search className="size-10 text-muted-foreground/45 animate-pulse shrink-0" />
        <span className="text-sm font-bold text-foreground">
          {isDebitors ? "No matching client profiles" : "No matching spreadsheet monthly records"}
        </span>
        <span className="text-xs text-muted-foreground max-w-xs leading-normal">
          Try adjusting your search filters or clear the query.
        </span>
      </div>
    );
  }

  if (isDebitors) {
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

  return (
    <MonthlySalesLedgerTable
      paginatedMonths={paginatedMonths}
      bestProfitValue={bestProfitValue}
      onRowClick={onRowClick}
      salesSortBy={salesSortBy}
      salesSortOrder={salesSortOrder}
      onSalesSort={onSalesSort}
    />
  );
};
