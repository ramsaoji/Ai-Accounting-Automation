import React from 'react';
import { Card } from '@/components/ui/card';
import { Database, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';

const PortalCharts = React.lazy(() => import('../PortalCharts'));

interface PortalStat {
  label: string;
  value: string;
  positive?: boolean;
  critical?: boolean;
}

interface SparklineItem {
  net?: number;
  pending?: number;
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
  sparkline: SparklineItem[];
  dataKey: string;
  stroke: string;
}

interface PortalCardProps {
  portal: PortalItem;
  onLaunchWorkspace: (workspace: 'sales' | 'debitors', view?: 'overview' | 'ledger' | 'auditor' | 'advisor') => void;
}

export const PortalCard: React.FC<PortalCardProps> = ({ portal, onLaunchWorkspace }) => {
  return (
    <Card
      className="border hover:border-primary/50 hover:shadow-sm transition-all duration-300 bg-card/45 overflow-hidden flex flex-col justify-between group cursor-pointer"
      onClick={() => onLaunchWorkspace(portal.id as 'sales' | 'debitors')}
    >
      <div className="p-4 md:p-6 flex flex-col gap-4 md:gap-5">
        {/* Card Title & Icon */}
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-muted/60 flex items-center justify-center border border-border/80 text-muted-foreground group-hover:text-primary group-hover:border-primary/45 group-hover:bg-primary/10 transition-all shrink-0">
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
            <span className="size-1.5 rounded-full bg-success"></span>
            Active
          </span>
        </div>

        {/* Grid stats */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 bg-muted/20 p-2.5 md:p-3 rounded-lg border">
          {portal.stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5">
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
            <span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider select-none">
              Dynamic Trend
            </span>
            {portal.alertCount > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLaunchWorkspace(portal.id as 'sales' | 'debitors', 'auditor');
                }}
                className="text-[0.68rem] text-destructive dark:text-red-400 font-semibold flex items-center gap-1 mt-0.5 hover:underline focus:outline-none cursor-pointer text-left"
              >
                <AlertTriangle className="size-3.5 text-destructive dark:text-red-400 shrink-0" />
                <span>Flagged: {portal.alertCount} {portal.alertCount === 1 ? 'anomaly' : 'anomalies'}</span>
              </button>
            ) : (
              <span className="text-[0.68rem] text-success font-semibold flex items-center gap-1 mt-0.5">
                <TrendingUp className="size-3.5 text-success" />
                <span>Audited stability log</span>
              </span>
            )}
          </div>

          {/* Sparkline Graph */}
          <div className="w-24 h-8 select-none opacity-80 group-hover:opacity-100 transition-opacity">
            {portal.sparkline && portal.sparkline.length > 0 ? (
              <React.Suspense fallback={<div className="w-full h-full border border-dashed border-border/40 rounded-lg flex items-center justify-center text-[0.58rem] text-muted-foreground font-mono bg-muted/5 animate-pulse select-none">Loading…</div>}>
                <PortalCharts data={portal.sparkline} dataKey={portal.dataKey} stroke={portal.stroke} />
              </React.Suspense>
            ) : (
              <div className="w-full h-full border border-dashed border-border/40 rounded-lg flex items-center justify-center text-[0.58rem] text-muted-foreground font-mono bg-muted/5 select-none">
                No trend data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer: Metadata tags + Action button */}
      <div className="border-t px-4 py-3 md:px-6 md:py-3.5 bg-muted/20 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {portal.tags.map((tag) => (
            <span
              key={tag}
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
  );
};
