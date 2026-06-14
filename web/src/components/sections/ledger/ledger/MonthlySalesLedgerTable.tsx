import React from 'react';
import { FolderOpen, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
  onRowClick?: (sheetName: string) => void;
  salesSortBy: string;
  salesSortOrder: 'asc' | 'desc';
  onSalesSort: (column: string) => void;
  departments?: {
    id: string;
    code: string;
    name: string;
    type: string;
    colorHex: string | null;
  }[];
}

export const MonthlySalesLedgerTable: React.FC<MonthlySalesLedgerTableProps> = ({
  paginatedMonths,
  bestProfitValue,
  onRowClick,
  salesSortBy,
  salesSortOrder,
  onSalesSort,
  departments,
}) => {
  const revenueDepts = React.useMemo(() => {
    if (departments && departments.length > 0) {
      return departments.filter(
        (d) =>
          d.type === 'REVENUE' &&
          !d.name.toLowerCase().includes('recovery') &&
          !d.name.toLowerCase().includes('jama') &&
          !d.name.toLowerCase().includes('recover')
      );
    }
    return [
      { id: 'liq', code: '4001', name: 'Primary Revenue', type: 'REVENUE', colorHex: 'var(--chart-2)' },
      { id: 'food', code: '4002', name: 'Secondary Revenue', type: 'REVENUE', colorHex: 'var(--primary)' }
    ];
  }, [departments]);
  const formatINR = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const renderSortIcon = (column: string) => {
    if (salesSortBy !== column) {
      return <ArrowUpDown className="ml-1 size-3 opacity-50 inline-block align-middle" />;
    }
    return salesSortOrder === 'asc' 
      ? <ArrowUp className="ml-1 size-3 text-foreground inline-block align-middle" /> 
      : <ArrowDown className="ml-1 size-3 text-foreground inline-block align-middle" />;
  };

  return (
    <Table className="min-w-[700px] sm:min-w-full">
      <TableHeader className="bg-muted/15 select-none">
        <TooltipProvider>
          <TableRow className="text-[0.68rem] font-bold text-muted-foreground uppercase border-b hover:bg-transparent">
            <TableHead 
              className="pl-6 h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onSalesSort('sheetName')}
            >
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted">Register Sheet</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  The name of the monthly spreadsheet tab parsed.
                </TooltipContent>
              </Tooltip>
              {renderSortIcon('sheetName')}
            </TableHead>
            {revenueDepts.map((dept) => (
              <TableHead 
                key={dept.id}
                className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
                onClick={() => onSalesSort(dept.name)}
              >
                <Tooltip>
                  <TooltipTrigger render={
                    <span className="cursor-help underline underline-offset-2 decoration-dotted">{dept.name}</span>
                  } />
                  <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                    Consolidated monthly inflows generated from {dept.name.toLowerCase()}.
                  </TooltipContent>
                </Tooltip>
                {renderSortIcon(dept.name)}
              </TableHead>
            ))}
            <TableHead 
              className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onSalesSort('expenses')}
            >
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted text-destructive">Operational Expenses</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  Total outflows, supplier bills, and operating costs logged during this month.
                </TooltipContent>
              </Tooltip>
              {renderSortIcon('expenses')}
            </TableHead>
            <TableHead 
              className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onSalesSort('creditExtended')}
            >
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted text-warning">Credit Extended</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  Total volume of purchases made on credit during this month.
                </TooltipContent>
              </Tooltip>
              {renderSortIcon('creditExtended')}
            </TableHead>
            <TableHead 
              className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onSalesSort('creditRecovery')}
            >
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted text-success">Credit Recovery</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  Consolidated monthly credit recovered (jama) from outstanding customer accounts.
                </TooltipContent>
              </Tooltip>
              {renderSortIcon('creditRecovery')}
            </TableHead>
            <TableHead 
              className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onSalesSort('net')}
            >
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted">Net Cashflow</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  Net cash balance remaining after subtracting operational expenses from total inflows.
                </TooltipContent>
              </Tooltip>
              {renderSortIcon('net')}
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
            <TableHead 
              className="text-center pr-6 h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onSalesSort('status')}
            >
              <Tooltip>
                <TooltipTrigger render={
                  <span className="cursor-help underline underline-offset-2 decoration-dotted justify-center inline-flex">Operating Verdict</span>
                } />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                  The validation status of this month's sheet, checking for discrepancies or anomalies.
                </TooltipContent>
              </Tooltip>
              {renderSortIcon('status')}
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
            <TableRow 
              key={month.sheetName} 
              onClick={() => onRowClick?.(month.sheetName)}
              className="hover:bg-muted/30 transition-colors h-11 border-b cursor-pointer select-none"
            >
              <TableCell className="pl-6 font-semibold text-foreground">
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-4 text-muted-foreground shrink-0" />
                  <span>{month.sheetName}</span>
                </div>
              </TableCell>
              {revenueDepts.map((dept) => {
                const value = month.departments ? (month.departments[dept.name] || 0) : (dept.id === 'liq' ? month.liquor : month.food);
                return (
                  <TableCell key={dept.id} className="text-right font-mono font-semibold text-muted-foreground">
                    {formatINR(value)}
                  </TableCell>
                );
              })}
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
