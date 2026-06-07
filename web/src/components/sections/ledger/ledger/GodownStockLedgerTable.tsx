import React from 'react';
import { AlertTriangle, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';

export interface GodownStockTableItem {
  itemName: string;
  category: string;
  bottleSizeMl: number;
  openingStock: number;
  stockIn: number;
  stockOut: number;
  closingStock: number;
  costPrice: number | null;
  sellingPrice: number | null;
  totalCostValue: number | null;
  totalSellValue: number | null;
  packaging: string;
  location?: string;
}

interface GodownStockLedgerTableProps {
  paginatedItems: GodownStockTableItem[];
  stockSortBy: string;
  stockSortOrder: 'asc' | 'desc';
  onStockSort: (column: string) => void;
}

export const GodownStockLedgerTable: React.FC<GodownStockLedgerTableProps> = ({
  paginatedItems,
  stockSortBy,
  stockSortOrder,
  onStockSort,
}) => {
  const formatINR = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const renderSortIcon = (column: string) => {
    if (stockSortBy !== column) {
      return <ArrowUpDown className="ml-1 size-3 opacity-50 inline-block align-middle" />;
    }
    return stockSortOrder === 'asc' 
      ? <ArrowUp className="ml-1 size-3 text-foreground inline-block align-middle" /> 
      : <ArrowDown className="ml-1 size-3 text-foreground inline-block align-middle" />;
  };

  return (
    <Table className="min-w-[900px] sm:min-w-full">
      <TableHeader className="bg-muted/15 select-none">
        <TooltipProvider>
          <TableRow className="text-[0.68rem] font-bold text-muted-foreground uppercase border-b hover:bg-transparent">
            <TableHead 
              className="pl-6 h-10 w-[240px] cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onStockSort('itemName')}
            >
              Item Name {renderSortIcon('itemName')}
            </TableHead>
            <TableHead 
              className="h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onStockSort('category')}
            >
              Category {renderSortIcon('category')}
            </TableHead>

            <TableHead 
              className="h-10 text-center cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onStockSort('bottleSizeMl')}
            >
              Size (Ml) {renderSortIcon('bottleSizeMl')}
            </TableHead>
            <TableHead className="text-right h-10">Opening</TableHead>
            <TableHead className="text-right h-10">Stock In</TableHead>
            <TableHead className="text-right h-10">Stock Out</TableHead>
            <TableHead 
              className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onStockSort('closingStock')}
            >
              Closing {renderSortIcon('closingStock')}
            </TableHead>
            <TableHead 
              className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onStockSort('costPrice')}
            >
              Cost Price {renderSortIcon('costPrice')}
            </TableHead>
            <TableHead 
              className="text-right h-10 cursor-pointer hover:bg-muted/20 select-none transition-colors"
              onClick={() => onStockSort('totalCostValue')}
            >
              Total Cost {renderSortIcon('totalCostValue')}
            </TableHead>
            <TableHead className="text-right h-10">Daily Velocity</TableHead>
            <TableHead className="text-center h-10">Days Remaining</TableHead>
            <TableHead className="text-center pr-6 h-10">Status</TableHead>
          </TableRow>
        </TooltipProvider>
      </TableHeader>
      <TableBody className="text-xs">
        {paginatedItems.map((item, idx) => {
          const isNegative = item.closingStock < 0;
          const isMissingPrice = item.costPrice === null || item.costPrice === 0;
          
          let badgeStyles = 'bg-success/10 text-success border-success/20';
          let badgeLabel = 'In Stock';
          let statusIcon = <CheckCircle className="size-3 text-success" />;

          if (isNegative) {
            badgeStyles = 'bg-destructive/10 text-destructive border-destructive/20';
            badgeLabel = 'Negative Stock';
            statusIcon = <AlertTriangle className="size-3 text-destructive" />;
          } else if (item.closingStock === 0) {
            badgeStyles = 'bg-muted text-muted-foreground border-border';
            badgeLabel = 'Out of Stock';
            statusIcon = <AlertTriangle className="size-3 text-muted-foreground" />;
          } else if (isMissingPrice) {
            badgeStyles = 'bg-warning/10 text-warning border-warning/20';
            badgeLabel = 'No Price';
            statusIcon = <AlertTriangle className="size-3 text-warning" />;
          }

          const velocity = item.stockOut;
          const closing = item.closingStock;
          
          let daysRemainingNode: React.ReactNode = '—';
          if (closing < 0) {
            daysRemainingNode = <span className="text-destructive font-bold text-[10px]">Negative</span>;
          } else if (closing === 0) {
            daysRemainingNode = <span className="text-destructive font-bold text-[10px] bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/25">0 Days</span>;
          } else if (velocity === 0) {
            daysRemainingNode = <span className="text-muted-foreground font-medium text-[10px]">No Movement</span>;
          } else {
            const days = Math.round(closing / velocity);
            if (days < 3) {
              daysRemainingNode = <span className="text-destructive font-bold text-[10px] bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/25">{days} Days</span>;
            } else if (days <= 5) {
              daysRemainingNode = <span className="text-warning font-bold text-[10px] bg-warning/10 px-2 py-0.5 rounded-full border border-warning/25">{days} Days</span>;
            } else {
              daysRemainingNode = <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{days} Days</span>;
            }
          }

          return (
            <TableRow 
              key={`${item.itemName}-${item.bottleSizeMl}-${idx}`}
              className="hover:bg-muted/30 transition-colors h-11 border-b cursor-default select-none"
            >
              <TableCell className="pl-6 font-semibold text-foreground">
                <div className="flex flex-col">
                  <span>{item.itemName}</span>
                  <span className="text-[10px] text-muted-foreground font-normal lowercase tracking-wide capitalize">
                    {item.packaging}
                  </span>
                </div>
              </TableCell>
              
              <TableCell className="text-muted-foreground font-medium">{item.category}</TableCell>
              


              <TableCell className="text-center font-mono text-muted-foreground font-semibold">
                {item.bottleSizeMl === 0 ? 'Loose' : `${item.bottleSizeMl}ml`}
              </TableCell>
              
              <TableCell className="text-right font-mono font-medium text-muted-foreground">{item.openingStock}</TableCell>
              <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400 font-semibold">+{item.stockIn}</TableCell>
              <TableCell className="text-right font-mono font-medium text-destructive font-semibold font-bold">-{item.stockOut}</TableCell>
              <TableCell className={`text-right font-mono font-bold ${isNegative ? 'text-destructive' : 'text-foreground'}`}>
                {item.closingStock}
              </TableCell>
              
              <TableCell className="text-right font-mono text-muted-foreground">{formatINR(item.costPrice)}</TableCell>
              <TableCell className="text-right font-mono font-semibold text-foreground">{formatINR(item.totalCostValue)}</TableCell>

              <TableCell className="text-right font-mono text-muted-foreground">
                {velocity} {item.bottleSizeMl === 0 ? 'ml' : 'units'}
              </TableCell>
              <TableCell className="text-center font-mono">{daysRemainingNode}</TableCell>

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
