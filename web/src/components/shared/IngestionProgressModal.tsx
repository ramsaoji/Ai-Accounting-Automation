import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  UploadCloud,
  Cloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  XCircle,
  CheckCheck,
} from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import type { IngestionFile, IngestionProgress } from '@/types/ingestion';

interface IngestionProgressModalProps {
  progress: IngestionProgress | null;
  isActive: boolean;
  onClose: () => void;
}

/* ─── Derived colour tokens based on mode / state ──────────────────────── */
function useThemeTokens(
  isDrive: boolean,
  isComplete: boolean,
  successCount: number,
  errorCount: number,
  hasError: boolean
) {
  const allFailed = isComplete && (successCount === 0 && (errorCount > 0 || hasError));
  const partialSuccess = isComplete && errorCount > 0 && successCount > 0;
  const cleanSuccess = isComplete && !allFailed && !partialSuccess;

  if (allFailed) {
    return {
      accent: 'text-destructive',
      accentBg: 'bg-destructive/8',
      accentBorder: 'border-destructive/20',
      iconRing: 'bg-destructive/10 border-destructive/25 text-destructive',
      progressBar: '[&_[data-slot=progress-indicator]]:bg-destructive',
      headerGradient: 'from-destructive/6',
      statusDot: 'bg-destructive',
    };
  }

  if (partialSuccess) {
    return {
      accent: 'text-amber-500',
      accentBg: 'bg-amber-500/8',
      accentBorder: 'border-amber-500/20',
      iconRing: 'bg-amber-500/10 border-amber-500/25 text-amber-500',
      progressBar: '[&_[data-slot=progress-indicator]]:bg-amber-500',
      headerGradient: 'from-amber-500/6',
      statusDot: 'bg-amber-500',
    };
  }

  if (cleanSuccess) {
    return {
      accent: 'text-emerald-500',
      accentBg: 'bg-emerald-500/8',
      accentBorder: 'border-emerald-500/20',
      iconRing: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500',
      progressBar: '[&_[data-slot=progress-indicator]]:bg-emerald-500',
      headerGradient: 'from-emerald-500/8',
      statusDot: 'bg-emerald-500',
    };
  }

  if (isDrive) {
    return {
      accent: 'text-emerald-500',
      accentBg: 'bg-emerald-500/8',
      accentBorder: 'border-emerald-500/20',
      iconRing: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500',
      progressBar: '[&_[data-slot=progress-indicator]]:bg-emerald-500',
      headerGradient: 'from-emerald-500/8',
      statusDot: 'bg-emerald-500',
    };
  }

  // Active manual upload
  return {
    accent: 'text-primary',
    accentBg: 'bg-primary/8',
    accentBorder: 'border-primary/20',
    iconRing: 'bg-primary/10 border-primary/25 text-primary',
    progressBar: '[&_[data-slot=progress-indicator]]:bg-primary',
    headerGradient: 'from-primary/6',
    statusDot: 'bg-primary',
  };
}

/* ─── File row ──────────────────────────────────────────────────────────── */
function FileRow({ file, isDrive }: { file: IngestionFile; isDrive: boolean }) {
  const isProcessing = file.status === 'processing';
  const isSuccess = file.status === 'success';
  const isError = file.status === 'error';
  const isPending = file.status === 'pending';

  return (
    <div
      className={`group relative flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all duration-300 ${
        isProcessing
          ? isDrive
            ? 'border-emerald-500/25 bg-emerald-500/5 shadow-sm'
            : 'border-primary/25 bg-primary/5 shadow-sm'
          : isSuccess
          ? 'border-emerald-600/20 bg-emerald-500/5'
          : isError
          ? 'border-destructive/25 bg-destructive/5'
          : 'border-border/60 bg-muted/20'
      }`}
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-all duration-300 ${
          isProcessing
            ? isDrive
              ? 'bg-emerald-500'
              : 'bg-primary'
            : isSuccess
            ? 'bg-emerald-500'
            : isError
            ? 'bg-destructive'
            : 'bg-transparent'
        }`}
      />

      {/* Icon */}
      <div
        className={`shrink-0 size-8 rounded-lg flex items-center justify-center border transition-colors duration-300 ${
          isProcessing
            ? isDrive
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-primary/10 border-primary/20'
            : isSuccess
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : isError
            ? 'bg-destructive/10 border-destructive/20'
            : 'bg-muted/60 border-border/50'
        }`}
      >
        <FileSpreadsheet
          className={`size-4 transition-colors duration-300 ${
            isProcessing
              ? isDrive
                ? 'text-emerald-500'
                : 'text-primary'
              : isSuccess
              ? 'text-emerald-500'
              : isError
              ? 'text-destructive'
              : 'text-muted-foreground'
          }`}
        />
      </div>

      {/* File details */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-[11.5px] font-semibold text-foreground truncate leading-none">
          {file.name}
        </span>
        {file.size && (isPending || isProcessing) && (
          <span className="text-[10px] text-muted-foreground font-mono leading-none mt-0.5">
            {file.size >= 1024 * 1024
              ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
              : `${(file.size / 1024).toFixed(1)} KB`}
          </span>
        )}
        {isError && file.error && (
          <span className="text-[10px] text-destructive/80 leading-snug mt-0.5 truncate">
            {file.error}
          </span>
        )}
      </div>

      {/* Status indicator */}
      <div className="shrink-0">
        {isPending && (
          <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/80 px-2 py-1 rounded-md">
            Queued
          </span>
        )}
        {isProcessing && (
          <span
            className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
              isDrive
                ? 'text-emerald-600 bg-emerald-500/12 dark:text-emerald-400'
                : 'text-primary bg-primary/10'
            }`}
          >
            <Loader2 className="size-2.5 animate-spin" />
            Active
          </span>
        )}
        {isSuccess && (
          <div className="size-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          </div>
        )}
        {isError && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="size-6 rounded-full bg-destructive/15 flex items-center justify-center hover:bg-destructive/25 transition-colors cursor-pointer focus:outline-none"
                  aria-label="View error"
                >
                  <AlertCircle className="size-3.5 text-destructive" />
                </button>
              }
            />
            <TooltipContent className="max-w-[240px] p-3 text-[0.72rem] leading-relaxed border bg-popover text-popover-foreground shadow-lg rounded-xl break-words">
              {file.error || 'This file failed to process. Please try again.'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export const IngestionProgressModal: React.FC<IngestionProgressModalProps> = ({
  progress,
  isActive,
  onClose,
}) => {
  const [open, setOpen] = useState(false);

  const isDrive = progress?.mode === 'drive';
  const isComplete = progress?.isComplete ?? false;
  const hasError = !!progress?.errorMsg;
  const percent = progress?.percent ?? 0;
  const files = progress?.files ?? [];

  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const processedCount = files.filter(
    (f) => f.status === 'success' || f.status === 'error'
  ).length;
  const allFailed = isComplete && hasError && successCount === 0;
  const hasErrors = errorCount > 0 || hasError;
  const statusText =
    progress?.statusText ??
    (isDrive ? 'Connecting to Google Drive...' : 'Preparing upload...');
  const currentFile = progress?.currentFile ?? '';

  useEffect(() => {
    if (isActive || (progress && !progress.isComplete)) {
      setOpen(true);
    }
    if (!isActive && progress?.isComplete && !hasErrors) {
      const t = setTimeout(() => {
        setOpen(false);
        onClose();
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [isActive, progress, onClose, hasErrors]);

  if (!progress) return null;

  const tokens = useThemeTokens(isDrive, isComplete, successCount, errorCount, hasError);

  const ModeIcon = isDrive ? Cloud : UploadCloud;

  /* Header icon */
  const headerIcon = isComplete
    ? allFailed
      ? <XCircle className="size-5" />
      : errorCount > 0
      ? <AlertCircle className="size-5" />
      : <CheckCheck className="size-5" />
    : <ModeIcon className="size-5" />;

  /* Titles */
  const titleText = isComplete
    ? allFailed
      ? 'Ingestion Failed'
      : errorCount > 0
      ? `Done · ${errorCount} error${errorCount !== 1 ? 's' : ''}`
      : `${isDrive ? 'Drive Sync' : 'Upload'} Complete`
    : isDrive
    ? 'Cloud Drive Sync'
    : 'Ledger Upload';

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (isActive && !isComplete) return;
        if (!val) {
          setOpen(false);
          onClose();
        }
      }}
    >
      <DialogContent
        showCloseButton={isComplete}
        className="sm:max-w-[420px] w-full gap-0 p-0 overflow-hidden rounded-2xl"
      >
        {/* ── Header ── */}
        <div
          className={`relative bg-gradient-to-br ${tokens.headerGradient} via-transparent to-transparent border-b border-border/60 px-6 pt-6 pb-5`}
        >
          <DialogHeader>
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div
                className={`relative shrink-0 size-11 rounded-xl border flex items-center justify-center transition-all duration-500 ${tokens.iconRing}`}
              >
                {headerIcon}
                {/* Pulse ring while active */}
                {!isComplete && (
                  <span
                    className={`absolute inset-0 rounded-xl animate-ping opacity-20 ${
                      isDrive ? 'bg-emerald-500' : 'bg-primary'
                    }`}
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5 min-w-0 flex-1 pt-0.5">
                <DialogTitle className="text-[15px] font-bold leading-none text-foreground">
                  {titleText}
                </DialogTitle>

                {/* Live status pill */}
                <div className="flex items-center gap-2">
                  {!isComplete ? (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tokens.accentBg} ${tokens.accentBorder} border ${tokens.accent}`}
                    >
                      <span className={`size-1.5 rounded-full ${tokens.statusDot} animate-pulse`} />
                      {isDrive ? 'Syncing from Drive' : 'Uploading files'}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tokens.accentBg} ${tokens.accentBorder} border ${tokens.accent}`}
                    >
                      {allFailed ? (
                        <XCircle className="size-3" />
                      ) : errorCount > 0 ? (
                        <AlertCircle className="size-3" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                      {allFailed
                        ? 'All files failed'
                        : `${successCount} of ${files.length} succeeded`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-col gap-5 px-6 py-5">

          {/* Progress section */}
          <div className="flex flex-col gap-3">
            {/* Label row */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {files.length > 0
                  ? `${processedCount} of ${files.length} file${files.length !== 1 ? 's' : ''} processed`
                  : 'Initializing…'}
              </span>
              <span
                className={`text-sm font-black font-mono tabular-nums transition-colors duration-300 ${tokens.accent}`}
              >
                {percent}%
              </span>
            </div>

            {/* Track */}
            <div className="relative">
              <Progress
                value={percent}
                className={`w-full [&_[data-slot=progress-track]]:h-2.5 ${tokens.progressBar}`}
              />
            </div>
          </div>

          {/* Current status message */}
          {!isComplete && (
            <div
              className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border ${tokens.accentBorder} ${tokens.accentBg}`}
            >
              <Loader2
                className={`size-4 shrink-0 animate-spin mt-[1px] ${tokens.accent}`}
              />
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground leading-snug">
                  {statusText}
                </p>
                {currentFile && (
                  <p
                    className={`text-[10.5px] font-mono font-bold truncate ${tokens.accent} opacity-80`}
                  >
                    {currentFile}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* All-failed error message */}
          {isComplete && allFailed && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-destructive/25 bg-destructive/5">
              <AlertCircle className="size-4 shrink-0 text-destructive mt-[1px]" />
              <div className="flex flex-col gap-0.5">
                <p className="text-[12px] font-semibold text-destructive leading-snug">
                  {progress?.errorMsg ?? 'Ingestion failed. Please try again.'}
                </p>
              </div>
            </div>
          )}

          {/* File queue */}
          {files.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {/* Section header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Files · {files.length}
                </span>
                {isComplete && (successCount > 0 || errorCount > 0) && (
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    {successCount > 0 && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        {successCount} ok
                      </span>
                    )}
                    {errorCount > 0 && (
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="size-3" />
                        {errorCount} failed
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Scrollable file list */}
              <TooltipProvider>
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto -mx-1 px-1 no-scrollbar">
                  {files.map((file) => (
                    <FileRow key={file.name} file={file} isDrive={isDrive} />
                  ))}
                </div>
              </TooltipProvider>
            </div>
          )}

          {/* Empty — waiting on file list */}
          {files.length === 0 && !isComplete && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="relative size-12 flex items-center justify-center">
                <div
                  className={`absolute inset-0 rounded-full animate-ping opacity-15 ${
                    isDrive ? 'bg-emerald-500' : 'bg-primary'
                  }`}
                />
                <div
                  className={`size-8 rounded-full flex items-center justify-center ${tokens.accentBg} ${tokens.accentBorder} border`}
                >
                  <ModeIcon className={`size-4 ${tokens.accent}`} />
                </div>
              </div>
              <p className="text-[11.5px] text-muted-foreground font-medium text-center leading-relaxed">
                {isDrive
                  ? 'Fetching spreadsheets from Google Drive…'
                  : 'Preparing your files for ingestion…'}
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!isComplete && (
          <div className="border-t border-border/60 px-6 py-3.5 bg-muted/20">
            <p className="text-[10.5px] text-muted-foreground text-center leading-relaxed font-medium">
              {isDrive
                ? 'Please keep this open — the dashboard refreshes automatically when done.'
                : 'Processing your ledgers. Do not close this window.'}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
