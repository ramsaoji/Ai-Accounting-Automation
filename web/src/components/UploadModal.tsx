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
  X
} from 'lucide-react';
import { uploadSpreadsheet } from '../services/api';

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFiles([]);
    setStatus('idle');
    setProgress(0);
    setCurrentFileIndex(0);
    setCurrentFileName('');
    setErrorMsg(null);
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

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const resultString = reader.result as string;
        const base64Data = resultString.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setErrorMsg(null);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFileIndex(i + 1);
        setCurrentFileName(file.name);
        
        // Compute overall progression thresholds per file
        const overallProgressStart = (i / files.length) * 100;
        const overallProgressWeight = 100 / files.length;
        
        // 1. Reading file
        setStatus('reading');
        setProgress(Math.round(overallProgressStart + overallProgressWeight * 0.15));
        const base64Data = await readFileAsBase64(file);
        
        // 2. Uploading payload
        setStatus('uploading');
        setProgress(Math.round(overallProgressStart + overallProgressWeight * 0.40));
        
        // 3. AI Ingestion & DB Upsert
        setStatus('processing');
        setProgress(Math.round(overallProgressStart + overallProgressWeight * 0.75));
        await uploadSpreadsheet(file.name, base64Data);
        
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

    } catch (err: any) {
      setStatus('error');
      setProgress(0);
      setErrorMsg(err.message || 'An error occurred during file ingestion');
      toast.error(`Ingestion failed: ${err.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button disabled={disabled} variant="outline" size="sm" className="gap-2 cursor-pointer border-primary/30 hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50">
            <UploadCloud className="size-4 text-primary" />
            <span>Upload Ledger</span>
          </Button>
        }
      />
      
      <DialogContent className="sm:max-w-md select-none">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Upload Accounting Spreadsheet(s)</DialogTitle>
          <DialogDescription className="text-xs">
            Ingest liquor registers, daily cash sales, or debtors lists. The AI auditor will parse, validate, and index all transactions immediately.
          </DialogDescription>
        </DialogHeader>

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
                    <span className="text-[0.62rem] text-muted-foreground mt-1 mb-3">Accepts only Excel files (.xlsx)</span>
                    <Button variant="outline" size="xs" onClick={triggerFileSelect} className="h-8 text-[0.68rem] px-3 font-semibold cursor-pointer">
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
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg border bg-background text-xs select-none">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileSpreadsheet className="size-4 text-primary shrink-0" />
                          <span className="font-semibold truncate text-foreground pr-2 text-left">{f.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[0.58rem] text-muted-foreground font-mono">{(f.size / 1024).toFixed(1)} KB</span>
                          <button
                            onClick={() => removeFile(idx)}
                            className="text-muted-foreground hover:text-destructive cursor-pointer p-0.5 rounded hover:bg-muted"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 justify-start mt-1">
                    <Button variant="outline" size="xs" onClick={triggerFileSelect} className="h-7 text-[0.62rem] px-2.5 font-semibold cursor-pointer">
                      Add More Files
                    </Button>
                    <Button variant="ghost" size="xs" onClick={reset} className="h-7 text-[0.62rem] px-2.5 text-destructive hover:bg-destructive/10 cursor-pointer">
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
                <CheckCircle2 className="size-6 text-success animate-bounce" />
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
              <Button variant="outline" size="xs" onClick={reset} className="mt-2 text-[0.62rem] h-7 px-3">
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
            className="text-xs cursor-pointer font-semibold"
          >
            {status === 'idle' || status === 'error' ? 'Upload & Audit' : 'Processing...'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
