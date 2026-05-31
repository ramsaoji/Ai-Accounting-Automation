import React from 'react';
import { FolderOpen } from 'lucide-react';
import type { MonthlySummary } from '@/types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@/components/ui/table';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface MonthlySalesLedgerTableProps {
  paginatedMonths: MonthlySummary[];
  bestProfitValue: number;
}

export const MonthlySalesLedgerTable: React.FC<MonthlySalesLedgerTableProps> = ({
  paginatedMonths,
  bestProfitValue,
}) => {
  const formatINR = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  return (
    <Table className="min-w-[700px] sm:min-w-full">
      <TableHeader className="bg-muted/15 select-none">
        <TooltipProvider>
          <TableRow className="text-[0.68rem] font-bold text-muted-foreground uppercase border-b hover:bg-transparent">
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
                  <span className="cursor-help underline underline-offset-2 decoration-dotted text-success">Credit Recovery</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  Consolidated monthly credit recovered (jama) from outstanding customer accounts.
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
          </TableRow>
        </TooltipProvider>
      </TableHeader>
      <TableBody className="text-xs">
        {paginatedMonths.map((month) => {
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
              <TableCell className="text-right font-mono font-semibold text-success">{formatINR(month.creditRecovery)}</TableCell>
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
        })}
      </TableBody>
    </Table>
  );
};
