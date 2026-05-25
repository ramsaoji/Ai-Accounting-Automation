import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import {
  ArrowRight,
  Search,
  Calendar,
  Database,
  TrendingUp,
  Cpu
} from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';

interface PortalSectionProps {
  salesAlertCount: number;
  debitorsAlertCount: number;
  onLaunchWorkspace: (workspace: 'sales' | 'debitors') => void;
}

interface PortalStat {
  label: string;
  value: string;
  positive?: boolean;
  critical?: boolean;
}

interface PortalItem {
  id: string;
  title: string;
  type: string;
  filename: string;
  lastUpdated: string;
  stats: PortalStat[];
  alertCount: number;
  tags: string[];
  sparkline: any[];
  dataKey: string;
  stroke: string;
}

export const PortalSection: React.FC<PortalSectionProps> = ({
  salesAlertCount,
  debitorsAlertCount,
  onLaunchWorkspace,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'flagged' | 'audited'>('all');

  const nextScanTime = useMemo(() => {
    const now = new Date();
    const minutes = now.getMinutes();
    const nextMark = minutes < 30 ? 30 : 60;
    const diff = nextMark - minutes;
    const nextScan = new Date(now.getTime() + diff * 60 * 1000);
    return `today, ${nextScan.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, []);

  // Mini sparkline data derived from actual/mock variables
  const salesSparkline = [
    { net: 1373130 },
    { net: 1284630 },
    { net: 1486750 },
    { net: 1349165 },
    { net: 1441845 },
    { net: 1321645 },
    { net: 1615090 }
  ];

  const debitorsSparkline = [
    { pending: 20690 },
    { pending: 15650 },
    { pending: 8600 },
    { pending: 8540 },
    { pending: 7100 },
    { pending: 5620 },
    { pending: 5280 }
  ];

  const portals: PortalItem[] = [
    {
      id: 'sales',
      title: 'Hotel Gaurav Daily Sales',
      type: 'Sales cash register',
      filename: 'Hotel Gaurav Daily Sales Register.xlsx',
      lastUpdated: 'May 25, 2:09 PM',
      stats: [
        { label: 'Consolidated Inflows', value: '₹4.84 Cr' },
        { label: 'Net Cash Surplus', value: '₹3.75 Cr', positive: true },
      ],
      alertCount: salesAlertCount,
      tags: ['Sales Registry', '25 Months', '3.5K Transactions'],
      sparkline: salesSparkline,
      dataKey: 'net',
      stroke: 'var(--primary)'
    },
    {
      id: 'debitors',
      title: 'Customer Debitors Outstanding',
      type: 'Debitors Ledger',
      filename: 'DEBITORS LIST.xlsx',
      lastUpdated: 'May 25, 2:09 PM',
      stats: [
        { label: 'Outstanding Balance', value: '₹1,75,370', critical: true },
        { label: 'Recovery Success', value: '96.7%' },
      ],
      alertCount: debitorsAlertCount,
      tags: ['Debitors Ledger', '137 Customers', 'Udhari Register'],
      sparkline: debitorsSparkline,
      dataKey: 'pending',
      stroke: 'var(--destructive)'
    }
  ];

  // Filter logic
  const filteredPortals = useMemo(() => {
    return portals.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        activeFilter === 'all' ||
        (activeFilter === 'flagged' && p.alertCount > 0) ||
        (activeFilter === 'audited' && p.alertCount === 0);

      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, activeFilter, salesAlertCount, debitorsAlertCount]);

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
      {/* Vercel-style Sub-header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="font-heading font-semibold text-xl tracking-tight text-foreground">
            Financial Ledger Consoles
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overview of active spreadsheet imports, AI pipeline executions, and audit exceptions.
          </p>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search database consoles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Console Filters */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {(['all', 'flagged', 'audited'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium capitalize transition-all cursor-pointer ${
                activeFilter === filter
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Project Switcher Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-1">
        {filteredPortals.length === 0 ? (
          <div className="col-span-2 text-center py-20 border rounded-xl bg-card/20 text-xs text-muted-foreground">
            No active database consoles match your search filter.
          </div>
        ) : (
          filteredPortals.map((portal) => (
            <Card
              key={portal.id}
              className="border hover:border-primary/50 hover:shadow-sm transition-all duration-300 bg-card/45 overflow-hidden flex flex-col justify-between group cursor-pointer"
              onClick={() => onLaunchWorkspace(portal.id as 'sales' | 'debitors')}
            >
              <div className="p-6 flex flex-col gap-5">
                {/* Card Title & Icon */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-muted/60 flex items-center justify-center border border-border/80 text-muted-foreground group-hover:text-primary group-hover:border-primary/45 group-hover:bg-primary/10 transition-all">
                      <Database className="size-5" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-sm font-bold text-foreground tracking-tight transition-colors">
                        {portal.title}
                      </h3>
                      <span className="text-[0.65rem] text-muted-foreground font-semibold leading-none mt-0.5">
                        {portal.type}
                      </span>
                    </div>
                  </div>

                  {/* Active badge */}
                  <span className="flex items-center gap-1 text-[0.62rem] font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                    Active
                  </span>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border">
                  {portal.stats.map((stat, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">
                        {stat.label}
                      </span>
                      <span className="text-base font-extrabold font-mono leading-tight mt-0.5 text-foreground">
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Trend line and meta description */}
                <div className="flex items-center justify-between gap-4 py-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider">
                      Dynamic Trend
                    </span>
                    <span className="text-[0.68rem] text-foreground font-semibold flex items-center gap-1 mt-0.5">
                      <TrendingUp className="size-3.5 text-success" />
                      Audited stability log
                    </span>
                  </div>

                  {/* Sparkline Graph */}
                  <div className="w-24 h-8 select-none opacity-80 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={portal.sparkline as any}>
                        <Line
                          type="monotone"
                          dataKey={portal.dataKey}
                          stroke={portal.stroke}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Card Footer: Metadata tags + Action button */}
              <div className="border-t px-6 py-3.5 bg-muted/20 flex items-center justify-between gap-4">
                <div className="flex gap-1.5 overflow-hidden">
                  {portal.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[0.6rem] font-bold text-muted-foreground border px-2 py-0.5 rounded bg-background shrink-0 font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <span>Open</span>
                  <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Human-readable Business Protection Guide */}
      <div className="border border-border/80 rounded-xl p-5 bg-muted/15 flex flex-col gap-4 mt-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <Cpu className="size-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground text-sm">🛡️ Automated Bookkeeping Safety Checks</h4>
              <p className="text-[0.75rem] text-muted-foreground mt-1 leading-normal max-w-2xl">
                Every spreadsheet ingestion automatically passes through our <strong>Smart Integrity Engine</strong>. 
                We scan every transaction to safeguard your finances from manual typing errors, double billing, or cost spikes, sending instant alerts to your AI Strategic Advisor.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[0.68rem] text-muted-foreground font-mono bg-background border px-3 py-1.5 rounded-lg shrink-0 self-start sm:self-auto select-none">
            <Calendar className="size-3.5" />
            <span>Next Scan: {nextScanTime}</span>
          </div>
        </div>

        {/* Audit Scope Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-border/50 select-none">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
            <span className="text-base select-none">🚫</span>
            <div className="flex flex-col">
              <span className="font-bold text-[0.68rem] text-foreground">Duplicate Bills</span>
              <span className="text-[0.58rem] text-muted-foreground">Catches double entries</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
            <span className="text-base select-none">💸</span>
            <div className="flex flex-col">
              <span className="font-bold text-[0.68rem] text-foreground">Large Payments</span>
              <span className="text-[0.58rem] text-muted-foreground">Flags bills &gt; ₹50,000</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
            <span className="text-base select-none">📈</span>
            <div className="flex flex-col">
              <span className="font-bold text-[0.68rem] text-foreground">Cost Spikes</span>
              <span className="text-[0.58rem] text-muted-foreground">Alerts 3x average jumps</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
            <span className="text-base select-none">🕒</span>
            <div className="flex flex-col">
              <span className="font-bold text-[0.68rem] text-foreground">Late Logging</span>
              <span className="text-[0.58rem] text-muted-foreground">Checks off-hours posts</span>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border">
            <span className="text-base select-none">⚠️</span>
            <div className="flex flex-col">
              <span className="font-bold text-[0.68rem] text-foreground">Value Check</span>
              <span className="text-[0.58rem] text-muted-foreground">Flags zero/negative slips</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
