import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import type { MasterSummary, DebitorSummary } from '@/types';

interface DebitorsAgeingItem {
  range: string;
  amount: number;
  color: string;
}

interface OverviewChartsProps {
  isDebitors: boolean;
  summary: MasterSummary;
  isMobile: boolean;
  activeChartTab: 'primary' | 'distribution';
  debitorsAgeingData: DebitorsAgeingItem[];
}

export const OverviewCharts: React.FC<OverviewChartsProps> = ({
  isDebitors,
  summary,
  isMobile,
  activeChartTab,
  debitorsAgeingData,
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      {activeChartTab === 'primary' ? (
        // Primary Tab: Top Debitors (Bar) or Sales Timeline (Area)
        isDebitors && summary.topDebitors ? (
          <BarChart
            layout="vertical"
            data={summary.topDebitors.slice(0, 8)}
            margin={{ left: isMobile ? 10 : 5, right: 20, top: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} horizontal={false} />
            <XAxis type="number" stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => `₹${v/1000}K`} />
            <YAxis
              dataKey="name"
              type="category"
              stroke="var(--muted-foreground)"
              fontSize={10}
              width={isMobile ? 85 : 110}
              tickFormatter={(v) => v.replace(/\s*\(.*?\)\s*/g, '').trim().slice(0, isMobile ? 12 : 22)}
            />
            <RechartsTooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.15 }}
              contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)', fontSize: '11px', color: 'var(--foreground)' }}
              itemStyle={{ color: 'var(--foreground)' }}
              labelStyle={{ color: 'var(--muted-foreground)' }}
              formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Outstanding Liability']}
            />
            <Bar dataKey="pending" radius={[0, 4, 4, 0]} barSize={16}>
              {summary.topDebitors.slice(0, 8).map((entry: DebitorSummary) => (
                <Cell key={`cell-${entry.name}`} fill={entry.pending > 15000 ? 'var(--destructive)' : entry.pending > 5000 ? 'var(--warning)' : 'var(--primary)'} />
              ))}
            </Bar>
          </BarChart>
        ) : summary.months ? (
          <AreaChart data={summary.months} margin={{ left: isMobile ? 0 : 5, right: 5, top: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="colorInflows" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="colorOutflows" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} />
            <XAxis dataKey="sheetName" stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => isMobile ? v.split(' ')[0] : v} />
            <YAxis stroke="var(--muted-foreground)" fontSize={10} width={isMobile ? 36 : 45} tickFormatter={(v) => `₹${v/100000}L`} />
            <RechartsTooltip 
              contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)', fontSize: '11px', color: 'var(--foreground)' }} 
              itemStyle={{ color: 'var(--foreground)' }}
              labelStyle={{ color: 'var(--muted-foreground)' }}
              formatter={(v) => `₹${Number(v).toLocaleString()}`} 
            />
            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
            <Area type="monotone" name="Inflow Receipts" dataKey="inflows" stroke="var(--primary)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorInflows)" />
            <Area type="monotone" name="Outflow Expenditures" dataKey="outflows" stroke="var(--destructive)" strokeWidth={1} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorOutflows)" />
          </AreaChart>
        ) : null
      ) : (
        // Secondary Tab: Ageing Splits (Bar) or Outflow splits
        isDebitors ? (
          <BarChart data={debitorsAgeingData} margin={{ left: isMobile ? 0 : 5, right: 5, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} vertical={false} />
            <XAxis dataKey="range" stroke="var(--muted-foreground)" fontSize={10} />
            <YAxis stroke="var(--muted-foreground)" fontSize={10} width={isMobile ? 36 : 45} tickFormatter={(v) => `₹${v/1000}K`} />
            <RechartsTooltip 
              cursor={{ fill: 'var(--muted)', opacity: 0.15 }}
              contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)', fontSize: '11px', color: 'var(--foreground)' }} 
              itemStyle={{ color: 'var(--foreground)' }}
              labelStyle={{ color: 'var(--muted-foreground)' }}
              formatter={(v) => `₹${Number(v).toLocaleString()}`} 
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={40}>
              {debitorsAgeingData.map((entry) => (
                <Cell key={`cell-${entry.range}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        ) : summary.months ? (
          <BarChart data={summary.months} margin={{ left: isMobile ? 0 : 5, right: 5, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} vertical={false} />
            <XAxis dataKey="sheetName" stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => isMobile ? v.split(' ')[0] : v} />
            <YAxis stroke="var(--muted-foreground)" fontSize={10} width={isMobile ? 36 : 45} tickFormatter={(v) => `₹${v/1000}K`} />
            <RechartsTooltip 
              cursor={{ fill: 'var(--muted)', opacity: 0.15 }}
              contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: 'var(--radius)', fontSize: '11px', color: 'var(--foreground)' }} 
              itemStyle={{ color: 'var(--foreground)' }}
              labelStyle={{ color: 'var(--muted-foreground)' }}
              formatter={(v) => `₹${Number(v).toLocaleString()}`} 
            />
            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="liquor" name="Liquor Split" stackId="a" fill="var(--chart-2)" />
            <Bar dataKey="food" name="Food Split" stackId="a" fill="var(--primary)" />
            <Bar dataKey="expenses" name="Operational Outflows" stackId="a" fill="var(--destructive)" />
          </BarChart>
        ) : null
      )}
    </ResponsiveContainer>
  );
};

export default OverviewCharts;
