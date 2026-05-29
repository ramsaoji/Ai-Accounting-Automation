import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface KpiCardProps {
  title: string;
  tooltipText: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  variant?: 'gold' | 'green' | 'red' | 'default';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  tooltipText,
  value,
  description,
  icon,
  variant = 'default',
}) => {
  const getBorderClass = () => {
    switch (variant) {
      case 'gold': return 'hover:border-amber-500/30';
      case 'green': return 'hover:border-emerald-500/30';
      case 'red': return 'hover:border-destructive/30';
      default: return 'hover:border-primary/30';
    }
  };

  return (
    <Card className={`border shadow-xs bg-card/45 relative overflow-hidden group transition-all duration-300 ${getBorderClass()}`}>
      <CardHeader className="p-4 pb-1 md:p-5 md:pb-1 flex flex-row items-center justify-between">
        <Tooltip>
          <TooltipTrigger render={
            <span className="text-[0.58rem] md:text-[0.62rem] font-bold text-muted-foreground uppercase tracking-widest cursor-help underline underline-offset-2 decoration-dotted select-none">
              {title}
            </span>
          } />
          <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
        <span className="text-muted-foreground group-hover:scale-110 transition-transform duration-300 shrink-0">
          {icon}
        </span>
      </CardHeader>
      <CardContent className="p-4 pt-0 md:p-5 md:pt-0 mt-1">
        <h3 className="text-lg sm:text-xl md:text-2xl font-bold font-mono text-foreground tracking-tight select-all">
          {value}
        </h3>
        <span className="text-[0.6rem] md:text-[0.65rem] text-muted-foreground mt-1 md:mt-1.5 block leading-normal select-none">
          {description}
        </span>
      </CardContent>
    </Card>
  );
};
