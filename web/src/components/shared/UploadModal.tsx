import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { uploadSpreadsheet, verifyUploadPassword } from '@/services/api';

interface UploadModalProps {
  onSuccess: () => void;
  disabled?: boolean;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onSuccess, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'reading' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const sessionTokenRef = useRef('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFiles([]);
    setStatus('idle');
    setProgress(0);
    setCurrentFileIndex(0);
    setCurrentFileName('');
    setErrorMsg(null);
    setPasswordInput('');
    sessionTokenRef.current = '';
    setIsAuthorized(false);
    setIsVerifying(false);
    setShowPassword(false);
  };

  const handleAuthorize = async () => {
    if (!passwordInput.trim()) return;
    setIsVerifying(true);
    try {
      const token = await verifyUploadPassword(passwordInput);
      if (token) {
        sessionTokenRef.current = token;
        setIsAuthorized(true);
        setPasswordInput(''); // COMPLETELY ERASE THE PASSWORD FROM STATE IMMEDIATELY!
        toast.success("Security authorization accepted.");
      } else {
        toast.error("Invalid upload password. Access denied.");
      }
    } catch {
      toast.error("Security verification request failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      reset();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter(file => {
        const isValid = file.name.endsWith('.xlsx');
        if (!isValid) {
          toast.error(`"${file.name}" is not supported. Only Excel (.xlsx) files are allowed.`);
        }
        return isValid;
      });

      // Filter out files that are already in the list to avoid duplicates
      setFiles(prev => {
        const existingNames = new Set(prev.map(f => f.name));
        const uniqueNewFiles = validFiles.filter(f => !existingNames.has(f.name));
        return [...prev, ...uniqueNewFiles];
      });
      setErrorMsg(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setErrorMsg(null);
    
    try {
      // Sequential processing is required here to show step-by-step progress tracking for
      // each individual file in the UI, and to preserve database transactional order.
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFileIndex(i + 1);
        setCurrentFileName(file.name);
        
        // Compute overall progression thresholds per file
        const overallProgressStart = (i / files.length) * 100;
        const overallProgressWeight = 100 / files.length;
        
        // 1. Uploading payload
        setStatus('uploading');
        setProgress(Math.round(overallProgressStart + overallProgressWeight * 0.35));
        
        // 2. AI Ingestion & DB Upsert
        setStatus('processing');
        setProgress(Math.round(overallProgressStart + overallProgressWeight * 0.75));
        await uploadSpreadsheet(file, sessionTokenRef.current);
        
        // Finished file i
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      
      setStatus('success');
      toast.success(`Successfully uploaded and processed ${files.length} spreadsheet(s).`);
      
      // Refresh workspace after queue settles
      setTimeout(() => {
        onSuccess();
        handleOpenChange(false);
      }, 1500);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred during file ingestion';
      setStatus('error');
      setProgress(0);
      setErrorMsg(message);
      toast.error(`Ingestion failed: ${message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button disabled={disabled} variant="outline" size="sm" className="gap-2 cursor-pointer border-primary/30 hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50">
            <UploadCloud className="size-4 text-primary" />
            <span className="hidden sm:inline">Upload Ledger</span>
          </Button>
        }
      />
      
      <DialogContent className="sm:max-w-md select-none animate-in fade-in duration-200">
        {!isAuthorized ? (
          <>
            <DialogHeader className="flex flex-col items-center text-center">
              <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mb-2">
                <UploadCloud className="size-5 text-primary" />
              </div>
              <DialogTitle className="text-sm font-bold text-center">Upload Security Authorization</DialogTitle>
              <DialogDescription className="text-xs text-center max-w-[320px]">
                Please enter your administrative authorization password to unlock Excel spreadsheet ingestion controls.
              </DialogDescription>
            </DialogHeader>

            <TooltipProvider>
              <div className="flex flex-col gap-1.5 py-4 w-full select-none text-left">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="upload-auth-password" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                    Authorization Password
                  </label>
                  <Tooltip>
                    <TooltipTrigger render={
                      <button type="button" className="text-muted-foreground hover:text-foreground cursor-help p-0.5 focus:outline-none mb-0.5">
                        <AlertCircle className="size-3" />
                      </button>
                    } />
                    <TooltipContent className="block max-w-[220px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                      Administrative security key required to authorize database writes and protect against unverified spreadsheet uploads.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative w-full">
                  <input
                    id="upload-auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAuthorize();
                      }
                    }}
                    placeholder="Enter security key to unlock…"
                    aria-label="Authorization password"
                    className="w-full bg-background border border-border rounded-md pl-3.5 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                    disabled={isVerifying}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </TooltipProvider>

            <DialogFooter className="sm:justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAuthorize}
                disabled={!passwordInput.trim() || isVerifying}
                className="text-xs font-semibold cursor-pointer shrink-0"
              >
                {isVerifying ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" />
                    Verifying…
                  </span>
                ) : 'Verify & Proceed'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Upload Accounting Spreadsheet(s)</DialogTitle>
              <DialogDescription className="text-xs">
                Ingest liquor registers, daily cash sales, or debtors lists. The AI auditor will parse, validate, and index all transactions immediately.
              </DialogDescription>
            </DialogHeader>

            {/* Google Drive Overwrite Info Note */}
            <div className="p-3 border border-warning/20 bg-warning/5 rounded-lg flex items-start gap-2.5 text-[11.5px] text-warning select-none leading-normal">
              <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-foreground text-xs leading-none mb-0.5">Google Drive Synchronization Note</span>
                <span className="text-muted-foreground text-[11px] leading-relaxed">
                  If Google Drive sync is active, uploading a sheet manually will <strong className="text-warning font-semibold">override</strong> the synced worksheet in the database.
                </span>
              </div>
            </div>

            {/* Dynamic State Viewports */}
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/80 rounded-xl p-6 bg-muted/10 transition-colors">
              {status === 'idle' && (
                <div className="flex flex-col items-center text-center gap-3 w-full">
                  {files.length === 0 ? (
                    <>
                      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                        <FileSpreadsheet className="size-6 text-primary" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-semibold">Select ledger sheets</span>
                        <div className="flex items-center gap-1 mt-1 mb-3">
                          <span className="text-[0.62rem] text-muted-foreground">Accepts only Excel files (.xlsx)</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger render={
                                <button type="button" className="text-muted-foreground hover:text-foreground cursor-help focus:outline-none">
                                  <AlertCircle className="size-3" />
                                </button>
                              } />
                              <TooltipContent className="block max-w-[240px] p-2 text-[0.72rem] leading-normal border bg-popover text-popover-foreground shadow-md rounded-lg normal-case font-medium">
                                Upload a Daily Sales Register spreadsheet containing monthly sales sheets (e.g. "January 2026"), or a Customer Debitors Outstanding ledger spreadsheet.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Button variant="outline" size="sm" onClick={triggerFileSelect} className="w-full sm:w-auto font-semibold cursor-pointer">
                          Browse Files
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full flex flex-col gap-2">
                      <span className="text-[0.62rem] font-bold text-muted-foreground uppercase tracking-wider text-left self-start">
                        Selected Spreadsheets ({files.length})
                      </span>
                      
                      {/* Scrollable file queue list */}
                      <div className="flex flex-col gap-1.5 w-full max-h-36 overflow-y-auto pr-1 no-scrollbar my-1.5">
                        {files.map((f, idx) => (
                          <div key={f.name} className="flex items-center justify-between p-2 rounded-lg border bg-background text-xs select-none">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileSpreadsheet className="size-4 text-primary shrink-0" />
                              <span className="font-semibold truncate text-foreground pr-2 text-left">{f.name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[0.58rem] text-muted-foreground font-mono">{(f.size / 1024).toFixed(1)} KB</span>
                              <button
                                type="button"
                                onClick={() => removeFile(idx)}
                                className="text-muted-foreground hover:text-destructive cursor-pointer p-0.5 rounded hover:bg-muted"
                                aria-label="Remove file"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 w-full mt-1">
                        <Button variant="outline" size="sm" onClick={triggerFileSelect} className="w-full sm:w-auto font-semibold cursor-pointer">
                          Add More Files
                        </Button>
                        <Button variant="ghost" size="sm" onClick={reset} className="w-full sm:w-auto text-destructive hover:bg-destructive/10 cursor-pointer">
                          Clear All
                        </Button>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx"
                    multiple
                    className="hidden"
                    aria-label="Upload spreadsheets"
                  />
                </div>
              )}

              {(status === 'reading' || status === 'uploading' || status === 'processing') && (
                <div className="flex flex-col items-center text-center gap-4 w-full px-4">
                  <Loader2 className="size-8 text-primary animate-spin" />
                  <div className="flex flex-col gap-1 w-full">
                    <span className="text-xs font-bold capitalize text-foreground">
                      File {currentFileIndex} of {files.length}
                    </span>
                    <span className="text-[0.68rem] text-primary font-semibold truncate max-w-xs block mx-auto font-mono">
                      {currentFileName}
                    </span>
                    <span className="text-[0.62rem] text-muted-foreground mt-1">
                      {status === 'reading' ? 'Reading data buffer...' : status === 'uploading' ? 'Transmitting payload to accounting server...' : 'AI compliance auditor indexing ledger details...'}
                    </span>
                  </div>
                  <Progress value={progress} className="w-full h-1 mt-1" />
                </div>
              )}

              {status === 'success' && (
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="size-12 rounded-full bg-success/15 flex items-center justify-center border border-success/35">
                    <CheckCircle2 className="size-6 text-success" style={{ animation: 'scale-in 0.5s cubic-bezier(0.16,1,0.3,1) both' }} />
                  </div>
                  <span className="text-xs font-bold text-foreground">All Uploads Complete!</span>
                  <span className="text-[0.62rem] text-muted-foreground">Refreshing consolidated dashboard registers</span>
                </div>
              )}

              {status === 'error' && (
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20">
                    <AlertCircle className="size-6 text-destructive" />
                  </div>
                  <span className="text-xs font-bold text-destructive">Ingestion Pipeline Failed</span>
                  <span className="text-[0.62rem] text-muted-foreground text-center font-semibold text-foreground/80 font-mono break-all px-2">
                    Failed on: {currentFileName}
                  </span>
                  <span className="text-[0.62rem] text-muted-foreground px-4 leading-normal break-all">
                    {errorMsg || 'An error occurred while compiling summaries.'}
                  </span>
                  <Button variant="outline" size="sm" onClick={reset} className="mt-2 w-full sm:w-auto">
                    Clear & Reset
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} disabled={status !== 'idle' && status !== 'error'} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUpload}
                disabled={files.length === 0 || (status !== 'idle' && status !== 'error')}
                className="text-xs cursor-pointer font-semibold animate-in fade-in duration-300"
              >
                {status === 'idle' || status === 'error' ? 'Upload & Audit' : 'Processing...'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
