import React from 'react';
import { RefreshCw } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="flex h-screen w-screen bg-background text-foreground font-sans antialiased flex-col items-center justify-center p-6 select-none">
      <div className="flex flex-col items-center gap-4">
        <RefreshCw className="size-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-semibold animate-pulse">Syncing accounting console…</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
