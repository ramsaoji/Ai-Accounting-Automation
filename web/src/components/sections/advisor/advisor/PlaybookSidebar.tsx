import React from 'react';
import { Compass, Activity } from 'lucide-react';

export interface Playbook {
  id: 'revenue' | 'recovery' | 'auditing';
  name: string;
  desc: string;
  icon: React.ReactNode;
}

interface PlaybookSidebarProps {
  playbooks: Playbook[];
  activePlaybook: 'revenue' | 'recovery' | 'auditing';
  setActivePlaybook: (id: 'revenue' | 'recovery' | 'auditing') => void;
  disabled?: boolean;
}

export const PlaybookSidebar: React.FC<PlaybookSidebarProps> = ({
  playbooks,
  activePlaybook,
  setActivePlaybook,
  disabled = false,
}) => {
  return (
    <div className="lg:col-span-1 flex flex-col border rounded-xl bg-card/50 overflow-hidden shrink-0 select-none min-w-0 lg:h-full">
      <div className="hidden lg:flex p-4 border-b bg-muted/20 items-center gap-2">
        <Compass className="size-4 text-primary" />
        <span className="text-xs font-bold text-foreground">Advisory Playbooks</span>
      </div>
      <div className="p-2 lg:p-3 flex-1 grid grid-cols-3 lg:flex lg:flex-col gap-1.5 lg:gap-1 overflow-auto">
        {playbooks.map((p) => {
          const isActive = activePlaybook === p.id;
          const activeStyles = isActive && !disabled
            ? p.id === 'revenue'
              ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-[0_0_12px_-3px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
              : p.id === 'recovery'
              ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-[0_0_12px_-3px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20'
              : 'bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-[0_0_12px_-3px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20'
            : 'bg-background hover:bg-muted/40 hover:scale-[1.01] hover:shadow-xs active:scale-[0.99]';

          return (
            <button
              type="button"
              key={p.id}
              onClick={() => !disabled && setActivePlaybook(p.id)}
              disabled={disabled}
              className={`p-2 lg:p-3 rounded-lg border cursor-pointer transition-all duration-200 flex flex-row lg:flex-col gap-1.5 md:gap-1 items-center lg:items-start justify-center lg:justify-start text-center lg:text-left shrink-0 ${activeStyles} ${
                disabled
                  ? 'opacity-40 cursor-not-allowed hover:bg-background border-border/50 hover:scale-100 hover:shadow-none active:scale-100'
                  : ''
              }`}
            >
              <div className="flex flex-row items-center gap-1.5 lg:gap-2">
                {p.icon}
                <span className="text-[10px] sm:text-xs font-bold text-foreground leading-none">
                  {p.name.split(' ')[0]}
                </span>
              </div>
              <span className="text-[0.65rem] text-muted-foreground leading-normal mt-0.5 hidden lg:block">
                {p.desc}
              </span>
            </button>
          );
        })}
      </div>
      <div className="hidden lg:flex p-3 border-t bg-muted/15 items-center gap-2 text-[0.62rem] font-bold text-muted-foreground font-mono">
        <Activity className={`size-3 ${disabled ? 'text-destructive' : 'text-success animate-pulse'}`} />
        LLM Layer: {disabled ? 'Offline' : 'Local Ingestion'}
      </div>
    </div>
  );
};
