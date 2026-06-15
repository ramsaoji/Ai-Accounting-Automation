import React from 'react';
import type { Transaction } from '@/types';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Search } from 'lucide-react';

interface RawTransactionsTableProps {
  txLoading: boolean;
  txList: Transaction[];
  txLimit: number;
  handleSort: (column: string) => void;
  renderSortIcon: (column: string) => React.ReactNode;
  formatINR: (val: number) => string;
}

export const RawTransactionsTable: React.FC<RawTransactionsTableProps> = ({
  txLoading,
  txList,
  txLimit,
  handleSort,
  renderSortIcon,
  formatINR,
}) => {
  if (txLoading) {
    return (
      <Table className="min-w-[700px] sm:min-w-full">
        <TableHeader className="bg-muted/15 select-none">
          <TableRow className="text-[0.68rem] font-bold text-muted-foreground uppercase border-b hover:bg-transparent">
            <TableHead className="pl-6 h-10">Date</TableHead>
            <TableHead className="h-10">Invoice</TableHead>
            <TableHead className="h-10">Category</TableHead>
            <TableHead className="h-10">Party / Vendor</TableHead>
            <TableHead className="h-10">Description</TableHead>
            <TableHead className="text-center h-10">Type</TableHead>
            <TableHead className="text-right pr-6 h-10">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="text-xs">
          {Array.from({ length: txLimit }).map((_, idx) => (
            <TableRow key={idx} className="border-b h-11 animate-pulse">
              <TableCell className="pl-6"><div className="h-4 w-16 bg-muted rounded"></div></TableCell>
              <TableCell><div className="h-4 w-12 bg-muted rounded"></div></TableCell>
              <TableCell><div className="h-4 w-24 bg-muted rounded"></div></TableCell>
              <TableCell><div className="h-4 w-32 bg-muted rounded"></div></TableCell>
              <TableCell><div className="h-4 w-40 bg-muted rounded"></div></TableCell>
              <TableCell className="text-center"><div className="mx-auto h-5 w-16 bg-muted rounded-full"></div></TableCell>
              <TableCell className="text-right pr-6"><div className="ml-auto h-4 w-16 bg-muted rounded"></div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (txList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 px-6 text-center select-none min-h-[300px] w-full">
        <Search className="size-10 text-muted-foreground/45 animate-pulse shrink-0" />
        <span className="text-sm font-bold text-foreground">No matching transactions found</span>
        <span className="text-xs text-muted-foreground max-w-xs leading-normal">
          Try adjusting your search query or clear the filter.
        </span>
      </div>
    );
  }

  return (
    <Table className="min-w-[700px] sm:min-w-full">
      <TableHeader className="bg-muted/15 select-none">
        <TableRow className="text-[0.68rem] font-bold text-muted-foreground uppercase border-b hover:bg-transparent">
          <TableHead 
            className="pl-6 h-10 cursor-pointer hover:bg-muted/20 transition-colors select-none"
            onClick={() => handleSort('date')}
          >
            Date {renderSortIcon('date')}
          </TableHead>
          <TableHead 
            className="h-10 cursor-pointer hover:bg-muted/20 transition-colors select-none"
            onClick={() => handleSort('invoice')}
          >
            Invoice {renderSortIcon('invoice')}
          </TableHead>
          <TableHead 
            className="h-10 cursor-pointer hover:bg-muted/20 transition-colors select-none"
            onClick={() => handleSort('category')}
          >
            Category {renderSortIcon('category')}
          </TableHead>
          <TableHead 
            className="h-10 cursor-pointer hover:bg-muted/20 transition-colors select-none"
            onClick={() => handleSort('vendor')}
          >
            Party / Vendor {renderSortIcon('vendor')}
          </TableHead>
          <TableHead className="h-10">Description</TableHead>
          <TableHead className="text-center h-10">Type</TableHead>
          <TableHead 
            className="text-right pr-6 h-10 cursor-pointer hover:bg-muted/20 transition-colors select-none"
            onClick={() => handleSort('amount')}
          >
            Amount {renderSortIcon('amount')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="text-xs">
        {txList.map((tx, idx) => {
          const isCredit = tx.type === 'credit';
          return (
            <TableRow key={idx} className="hover:bg-muted/20 border-b h-11">
              <TableCell className="pl-6 font-mono text-muted-foreground">
                {tx.date}
              </TableCell>
              <TableCell className="font-mono text-foreground">{tx.invoice || '—'}</TableCell>
              <TableCell className="font-semibold text-foreground">{tx.category}</TableCell>
              <TableCell className="text-foreground font-semibold">{tx.vendor || '—'}</TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground" title={tx.particulars}>
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
              <TableCell className={`text-right font-mono font-bold pr-6 ${isCredit ? 'text-success' : 'text-destructive'}`}>
                {formatINR(tx.amount)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
