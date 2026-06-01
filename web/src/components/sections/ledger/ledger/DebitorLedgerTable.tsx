import React from 'react';
import { AlertTriangle, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { DebitorSummary } from '@/types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@/components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface DebitorLedgerTableProps {
  paginatedDebitors: DebitorSummary[];
  maxOutstandingDuesLimit: number;
  totalPendingSum: number;
  topDebtorValue: number;
  onRowClick?: (name: string) => void;
  debtorSortBy: string;
  debtorSortOrder: 'asc' | 'desc';
  onDebtorSort: (column: string) => void;
}

export const DebitorLedgerTable: React.FC<DebitorLedgerTableProps> = ({
  paginatedDebitors,
  maxOutstandingDuesLimit,
  totalPendingSum,
  topDebtorValue,
  onRowClick,
  debtorSortBy,
  debtorSortOrder,
  onDebtorSort,
}) => {
  const formatINR = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const getAvatarInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const renderSortIcon = (column: string) => {
    if (debtorSortBy !== column) {
      return <ArrowUpDown className="ml-1 size-3 opacity-50 inline-block align-middle" />;
    }
    return debtorSortOrder === 'asc' 
      ? <ArrowUp className="ml-1 size-3 text-foreground inline-block align-middle" /> 
      : <ArrowDown className="ml-1 size-3 text-foreground inline-block align-middle" />;
  };

  return (
    <Table className="min-w-[700px] sm:min-w-full">
      <TableHeader className="bg-muted/15 select-none">
        <TooltipProvider>
          <TableRow className="text-[0.68rem] font-bold text-muted-foreground uppercase border-b hover:bg-transparent">
            <TableHead 
              className="pl-6 h-10 w-[240px] cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onDebtorSort('name')}
            >
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted">Customer Accounts</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  The name of the customer carrying credit accounts.
                </TooltipContent>
              </Tooltip>
              {renderSortIcon('name')}
            </TableHead>
            <TableHead 
              className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onDebtorSort('debit')}
            >
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted">Purchase Volume</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  Total cumulative credit sales volume purchased by this customer.
                </TooltipContent>
              </Tooltip>
              {renderSortIcon('debit')}
            </TableHead>
            <TableHead 
              className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onDebtorSort('credit')}
            >
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted">Amount Settled</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  Total payments made by this customer to clear their dues.
                </TooltipContent>
              </Tooltip>
              {renderSortIcon('credit')}
            </TableHead>
            <TableHead 
              className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onDebtorSort('pending')}
            >
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted text-destructive">Net Balance</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  Net pending outstanding balance due from this customer.
                </TooltipContent>
              </Tooltip>
              {renderSortIcon('pending')}
            </TableHead>
            <TableHead className="text-center h-10">
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted justify-center inline-flex">Total Contribution</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  The percentage of total pending business outstanding dues contributed by this customer.
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="text-center pr-6 h-10">
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted justify-center inline-flex">Policy Audit</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  The verification status showing if this customer's credit balance is within safe bounds.
                </TooltipContent>
              </Tooltip>
            </TableHead>
          </TableRow>
        </TooltipProvider>
      </TableHeader>
      <TableBody className="text-xs">
        {paginatedDebitors.map((debtor) => {
          const contribution = totalPendingSum ? ((debtor.pending / totalPendingSum) * 100).toFixed(1) : '0';
          const isBreach = debtor.pending > maxOutstandingDuesLimit;
          
          const badgeStyles = isBreach 
            ? 'bg-destructive/10 text-destructive border-destructive/20' 
            : debtor.pending > 5000 
              ? 'bg-warning/10 text-warning border-warning/20' 
              : 'bg-success/10 text-success border-success/20';
          
          const badgeLabel = isBreach ? 'Limit Breach' : debtor.pending > 5000 ? 'Audit Watch' : 'Clear Ledger';
          const statusIcon = isBreach ? <AlertTriangle className="size-3 text-destructive" /> : debtor.pending > 5000 ? <AlertTriangle className="size-3 text-warning" /> : <CheckCircle className="size-3 text-success" />;

          return (
            <TableRow 
              key={debtor.name} 
              onClick={() => onRowClick?.(debtor.name)}
              className="hover:bg-muted/30 transition-colors h-11 border-b cursor-pointer select-none"
            >
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
              
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2 select-none">
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden border">
                    <div
                      className={`h-full rounded-full ${isBreach ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${Math.min(100, Math.max(8, Math.round(debtor.pending / topDebtorValue * 100)))}%` }}
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
        })}
      </TableBody>
    </Table>
  );
};
