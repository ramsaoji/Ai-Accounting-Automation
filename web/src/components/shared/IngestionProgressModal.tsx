import React from 'react';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileSpreadsheet, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface FileProgress {
  name: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

interface IngestionProgressModalProps {
  isOpen: boolean;
  progress: {
    totalFiles: number;
    processedFiles: number;
    currentFile: string;
    statusText: string;
    files: FileProgress[];
  } | null;
}

export const IngestionProgressModal: React.FC<IngestionProgressModalProps> = ({ isOpen, progress }) => {
  if (!isOpen || !progress) return null;

  const { totalFiles, processedFiles, currentFile, statusText, files } = progress;
  
  // Calculate overall percentage
  const percentage = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;
  
  // Count counts
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-all duration-300 animate-in fade-in select-none">
      <div className="max-w-md w-full border border-border/80 rounded-2xl bg-card/90 p-6 md:p-7 shadow-2xl relative overflow-hidden flex flex-col gap-5 select-none animate-in zoom-in-95 duration-200">
        
        {/* Ambient background decorative blur circles */}
        <div className="absolute -top-32 -right-32 size-60 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 size-60 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3 relative z-10">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="size-4 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-wider text-primary">Analytics Engine</span>
              <span className="text-[10px] text-muted-foreground font-semibold">Consolidated Spreadsheet Ingestion</span>
            </div>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase select-none">
            Ingesting...
          </div>
        </div>

        {/* Current File Panel */}
        <div className="flex flex-col gap-2 relative z-10 text-center sm:text-left">
          <span className="text-xs font-bold text-foreground block truncate">
            {currentFile ? `Active File: ${currentFile}` : 'Initializing batch scan...'}
          </span>
          <span className="text-[10px] text-muted-foreground/80 leading-normal block italic font-mono truncate">
            {statusText}
          </span>
        </div>

        {/* Progress Bar & Numerical stats */}
        <div className="flex flex-col gap-2 relative z-10 bg-background/30 border border-border/40 p-4 rounded-xl">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-foreground">Overall Progression</span>
            <span className="text-primary font-mono">{percentage}%</span>
          </div>
          
          {/* Main slider bar */}
          <div className="h-2 w-full bg-muted border border-border/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold pt-1 border-t border-border/20 mt-1">
            <span>Processed: <strong className="text-foreground font-bold">{processedFiles}</strong> of <strong className="text-foreground font-bold">{totalFiles}</strong></span>
            <div className="flex items-center gap-2">
              {successCount > 0 && <span className="text-emerald-500 font-bold">✓ {successCount}</span>}
              {errorCount > 0 && <span className="text-destructive font-bold">✗ {errorCount}</span>}
            </div>
          </div>
        </div>

        {/* Batch Queue list */}
        <div className="flex flex-col gap-1.5 relative z-10">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">
            Ingestion Pipeline Queue ({files.length})
          </span>
          
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 no-scrollbar border border-border/30 rounded-xl p-2 bg-background/20 select-none">
            {files.map((file) => {
              const isProcessing = file.status === 'processing';
              const isSuccess = file.status === 'success';
              const isError = file.status === 'error';
              const isPending = file.status === 'pending';

              return (
                <div 
                  key={file.name} 
                  className={`flex flex-col p-2.5 rounded-lg border transition-all duration-300 ${
                    isProcessing 
                      ? 'bg-primary/5 border-primary/30 text-foreground shadow-sm shadow-primary/5' 
                      : isSuccess 
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400/90' 
                        : isError 
                          ? 'bg-destructive/5 border-destructive/20 text-destructive' 
                          : 'bg-muted/10 border-border/40 text-muted-foreground/75'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs select-none">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileSpreadsheet className={`size-3.5 shrink-0 ${
                        isProcessing ? 'text-primary' : isSuccess ? 'text-emerald-500' : isError ? 'text-destructive' : 'text-muted-foreground/60'
                      }`} />
                      <span className="font-semibold truncate text-left pr-2">{file.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      {isPending && (
                        <>
                          <Clock className="size-3 text-muted-foreground/60" />
                          <span className="text-[9px] uppercase font-bold text-muted-foreground/60">Pending</span>
                        </>
                      )}
                      {isProcessing && (
                        <>
                          <Loader2 className="size-3 text-primary animate-spin" />
                          <span className="text-[9px] uppercase font-black text-primary animate-pulse">Processing</span>
                        </>
                      )}
                      {isSuccess && (
                        <>
                          <CheckCircle2 className="size-3 text-emerald-500" />
                          <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Success</span>
                        </>
                      )}
                      {isError && (
                        <>
                          <XCircle className="size-3 text-destructive" />
                          <span className="text-[9px] uppercase font-bold text-destructive">Failed</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {isError && file.error && (
                    <div className="mt-1.5 pl-5 border-l border-destructive/35 flex items-start gap-1 text-[9px] text-destructive/80 font-medium leading-relaxed max-w-[340px] break-words">
                      <AlertCircle className="size-3 shrink-0 mt-0.5" />
                      <span>{file.error}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Completion Subtitle tip */}
        <p className="text-[9.5px] text-muted-foreground/75 text-center leading-normal italic relative z-10 border-t border-border/30 pt-3">
          *Dashboard data and dynamic charts will refresh automatically once all files complete parsing.*
        </p>

      </div>
    </div>
  );
};
