import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Users,
  DollarSign,
  BarChart3,
  CalendarDays
} from 'lucide-react';
import { KpiCard } from './KpiCard';
import { formatINR } from '@/utils/format';

interface DebitorTotals {
  totalPendingSum: number;
  collectionSuccessRate: string;
  averageOutstandingDues: number;
  activeDebitorsCount: number;
}

interface SalesTotals {
  masterNet: number;
  liquorPercentage: string;
  foodPercentage: string;
  bestProfitValue: number;
  bestProfitMonth: string;
  creditRecoveryRate: string;
}

interface StockTotals {
  totalClosingValue: number;
  totalSellingValue: number;
  totalItemsCount: number;
  totalVolumeLiters: number;
  godown?: {
    totalClosingValue: number;
    totalSellingValue: number;
    totalItemsCount: number;
    totalVolumeLiters: number;
    stockInCount?: number;
    stockOutCount?: number;
  };
  counter?: {
    totalClosingValue: number;
    totalSellingValue: number;
    totalItemsCount: number;
    totalVolumeLiters: number;
    stockInCount?: number;
    stockOutCount?: number;
  };
}

interface OverviewKpiCardsProps {
  isDebitors: boolean;
  isStock?: boolean;
  dynamicDebitorTotals: DebitorTotals | null;
  dynamicSalesTotals: SalesTotals | null;
  dynamicStockTotals: StockTotals | null;
}

export const OverviewKpiCards: React.FC<OverviewKpiCardsProps> = ({
  isDebitors,
  isStock = false,
  dynamicDebitorTotals,
  dynamicSalesTotals,
  dynamicStockTotals,
}) => {
  if (isDebitors && dynamicDebitorTotals) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 select-none">
        <KpiCard
          title="Unrecovered Liability"
          tooltipText="Total pending customer credit outstanding in the debitors ledger."
          value={formatINR(dynamicDebitorTotals.totalPendingSum)}
          description="Total pending customer credit."
          icon={<TrendingDown className="text-destructive size-4 shrink-0" />}
          variant="red"
        />
        <KpiCard
          title="Clearance Index"
          tooltipText="Percentage of extended credit balances successfully paid back by customers."
          value={`${dynamicDebitorTotals.collectionSuccessRate}%`}
          description="Paid credit balance percentage."
          icon={<Percent className="text-success size-4 shrink-0" />}
          variant="green"
        />
        <KpiCard
          title="Mean Balances"
          tooltipText="Average outstanding pending dues per active debit customer."
          value={formatINR(dynamicDebitorTotals.averageOutstandingDues)}
          description="Average outstanding per customer."
          icon={<DollarSign className="text-primary size-4 shrink-0" />}
        />
        <KpiCard
          title="Open Ledgers"
          tooltipText="Total number of customers carrying outstanding pending credits."
          value={dynamicDebitorTotals.activeDebitorsCount}
          description="Outstanding credit profiles."
          icon={<Users className="text-primary size-4 shrink-0" />}
        />
      </div>
    );
  }

  if (isStock && dynamicStockTotals) {
    const godownCost = dynamicStockTotals.godown?.totalClosingValue || 0;
    const counterCost = dynamicStockTotals.counter?.totalClosingValue || 0;

    const godownSell = dynamicStockTotals.godown?.totalSellingValue || 0;
    const counterSell = dynamicStockTotals.counter?.totalSellingValue || 0;

    const godownLines = dynamicStockTotals.godown?.totalItemsCount || 0;
    const counterLines = dynamicStockTotals.counter?.totalItemsCount || 0;

    const godownVol = dynamicStockTotals.godown?.totalVolumeLiters || 0;
    const counterVol = dynamicStockTotals.counter?.totalVolumeLiters || 0;

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 select-none">
        <KpiCard
          title="Stock Valuation (Cost)"
          tooltipText={`Combined inventory cost valuation. Godown: ${formatINR(godownCost)} | Counter: ${formatINR(counterCost)}`}
          value={formatINR(dynamicStockTotals.totalClosingValue)}
          description="Total cost valuation of inventory."
          icon={<TrendingUp className="text-primary size-4 shrink-0" />}
          variant="green"
        />
        <KpiCard
          title="Estimated Sell Value"
          tooltipText={`Combined potential retail menu value. Godown: ${formatINR(godownSell)} | Counter: ${formatINR(counterSell)}`}
          value={formatINR(dynamicStockTotals.totalSellingValue)}
          description="Potential inventory sell value."
          icon={<BarChart3 className="text-amber-500 size-4 shrink-0" />}
          variant="gold"
        />
        <KpiCard
          title="Active Inventory Lines"
          tooltipText={`Combined active items in stock. Godown: ${godownLines} lines | Counter: ${counterLines} lines`}
          value={dynamicStockTotals.totalItemsCount}
          description="Active products in stock."
          icon={<Users className="text-primary size-4 shrink-0" />}
        />
        <KpiCard
          title="Total Volume"
          tooltipText={`Combined volume in liters. Godown: ${Math.round(godownVol).toLocaleString('en-IN')} L | Counter: ${Math.round(counterVol).toLocaleString('en-IN')} L`}
          value={`${Math.round(dynamicStockTotals.totalVolumeLiters).toLocaleString('en-IN')} Liters`}
          description="Consolidated volume in liters."
          icon={<Percent className="text-primary size-4 shrink-0" />}
        />
      </div>
    );
  }

  if (!isDebitors && !isStock && dynamicSalesTotals) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 select-none">
        <KpiCard
          title="Net Surplus"
          tooltipText="Net cash balance remaining after subtracting operational expenses from total inflows."
          value={formatINR(dynamicSalesTotals.masterNet)}
          description="Surplus cash after cost settlements."
          icon={<TrendingUp className="text-success size-4 shrink-0" />}
          variant="green"
        />
        <KpiCard
          title="Liquor vs Food Split"
          tooltipText="Proportional ratio of liquor sales compared to food menu sales."
          value={`${dynamicSalesTotals.liquorPercentage}% / ${dynamicSalesTotals.foodPercentage}%`}
          description="Ratio of liquor sales vs. food sales."
          icon={<Percent className="text-amber-500 size-4 shrink-0" />}
          variant="gold"
        />
        <KpiCard
          title="Peak Cash Surplus"
          tooltipText="The single highest monthly cash surplus value achieved in the historical ledger."
          value={formatINR(dynamicSalesTotals.bestProfitValue)}
          description={`Highest monthly cash surplus in ${dynamicSalesTotals.bestProfitMonth}.`}
          icon={<BarChart3 className="text-primary size-4 shrink-0" />}
        />
        <KpiCard
          title="Credit Recovery"
          tooltipText="The index measuring debt recovery success calculated over credits extended."
          value={`${dynamicSalesTotals.creditRecoveryRate}%`}
          description="Recovery performance over credits extended."
          icon={<CalendarDays className="text-primary size-4 shrink-0" />}
        />
      </div>
    );
  }

  return null;
};

