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
}

export const PlaybookSidebar: React.FC<PlaybookSidebarProps> = ({
  playbooks,
  activePlaybook,
  setActivePlaybook,
}) => {
  return (
    <div className="lg:col-span-1 flex flex-col border rounded-xl bg-card/50 overflow-hidden shrink-0 select-none min-w-0">
      <div className="hidden lg:flex p-4 border-b bg-muted/20 items-center gap-2">
        <Compass className="size-4 text-primary" />
        <span className="text-xs font-bold text-foreground">Advisory Playbooks</span>
      </div>
      <div className="p-2 lg:p-3 flex-1 grid grid-cols-3 lg:flex lg:flex-col gap-1.5 lg:gap-1 overflow-auto">
        {playbooks.map((p) => {
          const isActive = activePlaybook === p.id;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => setActivePlaybook(p.id)}
              className={`p-2 lg:p-3 rounded-lg border cursor-pointer transition-all duration-200 flex flex-row lg:flex-col gap-1.5 md:gap-1 items-center lg:items-start justify-center lg:justify-start text-center lg:text-left shrink-0 ${
                isActive
                  ? 'bg-muted border-foreground/20'
                  : 'bg-background hover:bg-muted/40'
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
        <Activity className="size-3 text-success animate-pulse" />
        LLM Layer: Local Ingestion
      </div>
    </div>
  );
};
