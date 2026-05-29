import React from 'react';
import { FolderOpen, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import type { DebitorSummary, MonthlySummary } from '../../types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@/components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface LedgerTableProps {
  isDebitors: boolean;
  paginatedDebitors: DebitorSummary[];
  paginatedMonths: MonthlySummary[];
  maxOutstandingDuesLimit: number;
  totalPendingSum: number;
  topDebtorValue: number;
  bestProfitValue: number;
  totalItems: number;
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  isDebitors,
  paginatedDebitors,
  paginatedMonths,
  maxOutstandingDuesLimit,
  totalPendingSum,
  topDebtorValue,
  bestProfitValue,
  totalItems
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

  return (
    <Table className="min-w-[700px] sm:min-w-full">
      <TableHeader className="bg-muted/15 select-none">
        <TooltipProvider>
          <TableRow className="text-[0.68rem] font-bold text-muted-foreground uppercase border-b hover:bg-transparent">
            {isDebitors ? (
              <>
                <TableHead className="pl-6 h-10 w-[240px]">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted">Customer Accounts</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      The name of the customer carrying credit accounts.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted">Purchase Volume</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      Total cumulative credit sales volume purchased by this customer.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted">Amount Settled</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      Total payments made by this customer to clear their dues.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted text-destructive">Net Balance</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      Net pending outstanding balance due from this customer.
                    </TooltipContent>
                  </Tooltip>
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
              </>
            ) : (
              <>
                <TableHead className="pl-6 h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted">Register Sheet</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      The name of the monthly spreadsheet tab parsed.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted">Liquor Sales</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      Consolidated monthly inflows generated from alcohol/liquor purchases.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted">Food Sales</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      Consolidated monthly inflows generated from restaurant food menu sales.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted text-destructive">Operational Expenses</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      Total outflows, supplier bills, and operating costs logged during this month.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted text-warning">Credit Extended</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      Total volume of purchases made on credit during this month.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-right h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted">Net Cashflow</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      Net cash balance remaining after subtracting operational expenses from total inflows.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-center h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted justify-center inline-flex">Surplus Scale</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      The relative monthly cash surplus weight scaled against the highest benchmark month.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
                <TableHead className="text-center pr-6 h-10">
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="cursor-help underline underline-offset-2 decoration-dotted justify-center inline-flex">Operating Verdict</span>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      The validation status of this month's sheet, checking for discrepancies or anomalies.
                    </TooltipContent>
                  </Tooltip>
                </TableHead>
              </>
            )}
          </TableRow>
        </TooltipProvider>
      </TableHeader>
      <TableBody className="text-xs">
        {isDebitors ? (
          paginatedDebitors.map((debtor) => {
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
              <TableRow key={debtor.name} className="hover:bg-muted/30 transition-colors h-11 border-b">
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
          })
        ) : (
          paginatedMonths.map((month) => {
            const isProfit = month.net >= 0;
            const netColor = isProfit ? 'text-success' : 'text-destructive';
            const badgeStyles = isProfit 
              ? 'bg-success/10 text-success border-success/20' 
              : 'bg-destructive/10 text-destructive border-destructive/20';

            return (
              <TableRow key={month.sheetName} className="hover:bg-muted/30 transition-colors h-11 border-b">
                <TableCell className="pl-6 font-semibold text-foreground flex items-center gap-2">
                  <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                  {month.sheetName}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-muted-foreground">{formatINR(month.liquor)}</TableCell>
                <TableCell className="text-right font-mono font-semibold text-muted-foreground">{formatINR(month.food)}</TableCell>
                <TableCell className="text-right font-mono font-semibold text-destructive">{formatINR(month.expenses)}</TableCell>
                <TableCell className="text-right font-mono font-semibold text-warning">{formatINR(month.creditExtended)}</TableCell>
                <TableCell className={`text-right font-mono font-bold ${netColor}`}>{formatINR(month.net)}</TableCell>
                
                <TableCell className="text-center">
                  <div className="flex items-center justify-center select-none">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden border">
                      <div
                        className={isProfit ? "bg-success h-full rounded-full" : "bg-destructive h-full rounded-full"}
                        style={{ width: `${Math.min(100, Math.max(8, Math.round(Math.abs(month.net) / bestProfitValue * 100)))}%` }}
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
        )}
      </TableBody>
    </Table>
  );
};
