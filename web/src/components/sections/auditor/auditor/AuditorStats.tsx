import React from 'react';
import { FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

interface AuditorStatsProps {
  totalTransactions: number;
  activeExceptionsCount: number;
  criticalCount: number;
  exceptionRatio: string;
}

export const AuditorStats: React.FC<AuditorStatsProps> = ({
  totalTransactions,
  activeExceptionsCount,
  criticalCount,
  exceptionRatio
}) => {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none">
        {/* Audited Transactions */}
        <Card className="shadow-xs border bg-card/45">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5 text-left">
              <Tooltip>
                <TooltipTrigger render={<span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider cursor-help underline underline-offset-2 decoration-dotted">Audited Transactions</span>} />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                  Total ledger entries parsed and verified across all historical files.
                </TooltipContent>
              </Tooltip>
              <span className="text-lg font-extrabold font-mono text-foreground mt-0.5">
                {totalTransactions.toLocaleString()}
              </span>
            </div>
            <div className="size-8 rounded-lg bg-muted border flex items-center justify-center text-muted-foreground">
              <FileText className="size-4" />
            </div>
          </CardContent>
        </Card>

        {/* Active Exceptions */}
        <Card className="shadow-xs border bg-card/45">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5 text-left">
              <Tooltip>
                <TooltipTrigger render={<span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider cursor-help underline underline-offset-2 decoration-dotted">Active Exceptions</span>} />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                  Compliance violations, ledger imbalances, or large payment spikes currently requiring sign-off or investigation.
                </TooltipContent>
              </Tooltip>
              <span className="text-lg font-extrabold font-mono text-foreground mt-0.5">
                {activeExceptionsCount.toLocaleString()}
              </span>
            </div>
            <div className="size-8 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center">
              <AlertTriangle className="size-4" />
            </div>
          </CardContent>
        </Card>

        {/* Audit Compliance Index */}
        <Card className="shadow-xs border bg-card/45">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5 text-left">
              <Tooltip>
                <TooltipTrigger render={<span className="text-[0.58rem] font-bold text-muted-foreground uppercase tracking-wider cursor-help underline underline-offset-2 decoration-dotted">Audit Compliance Index</span>} />
                <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
                  A percentage representing ledger health and compliance based on active critical anomalies.
                </TooltipContent>
              </Tooltip>
              <span className="text-lg font-extrabold font-mono mt-0.5 text-foreground">
                {criticalCount > 0 ? `${(100 - parseFloat(exceptionRatio)).toFixed(1)}%` : '100%'}
              </span>
            </div>
            <div className={`size-8 rounded-lg border flex items-center justify-center ${
              criticalCount > 0 ? 'bg-warning/10 border-warning/20 text-warning' : 'bg-success/10 border-success/20 text-success'
            }`}>
              {criticalCount > 0 ? <AlertTriangle className="size-4" /> : <ShieldCheck className="size-4" />}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};
