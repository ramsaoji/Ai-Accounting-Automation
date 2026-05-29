import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Sparkles, WifiOff, Activity } from 'lucide-react';

interface AiRecommendationsQueueProps {
  intelligence: string[];
  aiGenerated?: boolean;
  connectionMode: 'live' | 'static' | 'empty';
}

export const AiRecommendationsQueue: React.FC<AiRecommendationsQueueProps> = ({
  intelligence,
  aiGenerated,
  connectionMode,
}) => {
  return (
    <Card className="border bg-card/45 shadow-xs overflow-hidden">
      <CardHeader className="p-4 md:p-6 pb-4 border-b flex flex-col sm:flex-row sm:items-start justify-between gap-4 select-none">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-warning/10 flex items-center justify-center text-warning border border-warning/20 shrink-0">
            <Sparkles className="size-4.5" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">AI Recommendation Queue</CardTitle>
            <CardDescription className="text-xs">
              Identified strategic action plans derived from accounting metrics.
              <span className="ml-1.5 opacity-90 hidden lg:inline text-muted-foreground/80 font-medium">
                ({connectionMode === 'empty' 
                  ? 'Showing offline simulated demo recommendations for display purposes.' 
                  : aiGenerated === true 
                    ? 'Dynamically generated in real-time by the LLM advisor.' 
                    : 'Calculated deterministically by our local rules engine due to LLM timeout.'
                })
              </span>
            </CardDescription>
          </div>
        </div>
        <div className="shrink-0 self-start sm:self-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger render={
                <button
                  type="button"
                  className={`text-[0.62rem] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border transition-all duration-300 select-none cursor-pointer ${
                    connectionMode === 'empty'
                      ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25'
                      : aiGenerated === true
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 dark:border-emerald-500/20 shadow-[0_0_12px_-3px_rgba(16,185,129,0.25)]'
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25'
                  }`}
                >
                  {connectionMode === 'empty' ? (
                    <WifiOff className="size-3" />
                  ) : aiGenerated === true ? (
                    <Sparkles className="size-3 text-emerald-500 animate-pulse" />
                  ) : (
                    <Activity className="size-3 text-indigo-500" />
                  )}
                  <span>
                    {connectionMode === 'empty'
                      ? 'Simulated Demo'
                      : aiGenerated === true
                        ? 'Live AI Generated'
                        : 'Rule Engine (Fallback)'
                    }
                  </span>
                </button>
              } />
              <TooltipContent className="max-w-[260px] p-2.5 text-[0.72rem] leading-relaxed border bg-popover text-popover-foreground shadow-md rounded-lg">
                {connectionMode === 'empty'
                  ? 'Showing offline simulated demo recommendations for display purposes. Connect a database to trigger live insights.'
                  : aiGenerated === true
                    ? 'This recommendation was dynamically generated in real-time by the LLM advisor from your sheet details.'
                    : 'Calculated deterministically by our local accounting heuristics rules engine due to LLM provider timeout or error.'
                }
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {intelligence.map((intel: string, idx: number) => {
          const types = [
            { label: 'Cashflow Optimization', badge: 'bg-success/10 text-success border-success/20', impact: 'High Impact' },
            { label: 'Revenue Yield Target', badge: 'bg-info/10 text-info border-info/20', impact: 'Moderate Impact' },
            { label: 'Exposure Risk Containment', badge: 'bg-destructive/10 text-destructive border-destructive/20', impact: 'Critical Action' }
          ];
          const meta = types[idx] || { label: 'Operational Advice', badge: 'bg-muted border', impact: 'Review Action' };

          return (
            <div
              key={intel.slice(0, 40)}
              className="border rounded-xl p-4 bg-card/45 hover:border-primary/30 hover:shadow-xs transition-all duration-300 flex flex-col justify-between gap-3.5 relative group"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 select-none">
                  <span className={`text-[0.62rem] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <span className="text-[0.62rem] font-bold text-muted-foreground font-mono flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <span className={`size-1.5 rounded-full shrink-0 ${idx === 0 ? 'bg-success' : idx === 1 ? 'bg-info' : 'bg-destructive'}`}></span>
                    {meta.impact}
                  </span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed mt-2 font-medium">
                  {intel}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
