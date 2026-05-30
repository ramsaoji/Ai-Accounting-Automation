import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UploadModal } from './UploadModal';
import { 
  Sparkles, 
  Cloud, 
  Loader2, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  FileSpreadsheet, 
  ShieldCheck, 
  Cpu,
  Info,
  ThumbsUp
} from 'lucide-react';

interface OnboardingWizardProps {
  connectionMode: 'live' | 'static' | 'empty';
  isSyncingDrive: boolean;
  isLoading: boolean;
  onDriveSync: () => void;
  onSuccess: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  connectionMode,
  isSyncingDrive,
  isLoading,
  onDriveSync,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);

  const steps = [
    { id: 1, title: 'Orientation' },
    { id: 2, title: 'Connect' },
    { id: 3, title: 'Ingest' },
    { id: 4, title: 'Ready' }
  ];

  return (
    <div className="flex h-screen w-screen bg-background text-foreground font-sans antialiased flex-col items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-300">
      <div className="max-w-xl w-full flex flex-col gap-6 md:gap-8 border rounded-2xl bg-card/65 p-6 md:p-8 shadow-xl relative overflow-hidden">
        
        {/* Decorative ambient background gradient */}
        <div className="absolute -top-40 -right-40 size-80 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 size-80 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        {/* Stepper Progress Bar */}
        <div className="flex items-center justify-between border-b pb-4 relative z-10">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary">
            <Sparkles className="size-4" />
            <span>Setup Wizard</span>
          </div>
          <div className="flex items-center gap-2">
            {steps.map((s) => (
              <React.Fragment key={s.id}>
                <div 
                  className={`size-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all duration-300 ${
                    step >= s.id 
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20' 
                      : 'bg-muted border-border text-muted-foreground'
                  }`}
                >
                  {step > s.id ? <Check className="size-3" /> : s.id}
                </div>
                {s.id < 4 && (
                  <div 
                    className={`h-0.5 w-4 sm:w-6 transition-all duration-300 ${
                      step > s.id ? 'bg-primary' : 'bg-muted'
                    }`} 
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Contents */}
        <div className="min-h-[220px] flex flex-col justify-center relative z-10">
          
          {/* Step 1: Orientation */}
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300">
              <div className="flex flex-col gap-1 text-center sm:text-left">
                <h2 className="text-lg font-bold font-heading tracking-tight text-foreground flex items-center justify-center sm:justify-start gap-2">
                  <span>Welcome to Accounting Command Center</span>
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Analyze hospitality ledger transactions, automate auditing, and generate AI insights in real-time.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                <div className="flex items-start gap-2.5 p-3 border rounded-xl bg-background/40 hover:border-primary/30 transition-colors">
                  <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-foreground">Integrity Auditing</span>
                    <span className="text-[10px] text-muted-foreground leading-normal">Catches duplication, zero-amounts, and suspicious cost spikes.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 border rounded-xl bg-background/40 hover:border-emerald-500/30 transition-colors">
                  <Cpu className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-foreground">Multi-Provider AI</span>
                    <span className="text-[10px] text-muted-foreground leading-normal">Swappable intelligence models compile executive summaries.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Storage Connection Check */}
          {step === 2 && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300">
              <div className="flex flex-col gap-1 text-center sm:text-left">
                <h2 className="text-lg font-bold font-heading tracking-tight text-foreground">
                  Connect Data Source
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Establish a secure connection channel. The platform can sync directly with Google Drive or import local files.
                </p>
              </div>

              <div className="p-4 border rounded-xl bg-background/40 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Active Sync Mode:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase select-none ${
                    connectionMode === 'live' 
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : connectionMode === 'static'
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {connectionMode} Connection
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground leading-relaxed">
                  {connectionMode === 'live' ? (
                    <>
                      <ThumbsUp className="size-3.5 text-emerald-500 shrink-0" />
                      <span>Google Drive API credentials detected! You can perform seamless fully automated directory syncing.</span>
                    </>
                  ) : (
                    <>
                      <Info className="size-3.5 text-blue-500 shrink-0" />
                      <span>No Google Drive keys detected or operating offline. You can upload files manually below.</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: First Spreadsheet Import */}
          {step === 3 && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300 text-center sm:text-left">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold font-heading tracking-tight text-foreground">
                  Ingest First Spreadsheets
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Import your excel registries to bootstrap the analytics engine. Choose manual file upload or trigger Drive sync below.
                </p>
              </div>

              <div className="border border-dashed border-border/80 rounded-xl p-4 bg-background/25 flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-1 select-none">
                <div className="flex items-center gap-2 text-left">
                  <FileSpreadsheet className="size-8 text-primary shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-foreground">Expected Ingestions</span>
                    <span className="text-[9px] text-muted-foreground leading-normal max-w-[220px]">
                      Daily Sales Register (`xlsx`) or Customer Debitors Outstanding Ledger (`xlsx`).
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                  <UploadModal disabled={connectionMode !== 'live' && connectionMode !== 'static'} onSuccess={onSuccess} />
                  {connectionMode === 'live' && (
                    <Button
                      onClick={onDriveSync}
                      disabled={isSyncingDrive || isLoading}
                      variant="outline"
                      size="sm"
                      className="gap-2 cursor-pointer border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 disabled:opacity-50 h-9"
                    >
                      {isSyncingDrive ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Cloud className="size-4" />
                      )}
                      <span>Sync Drive</span>
                    </Button>
                  )}
                  {connectionMode === 'static' && (
                    <Button
                      onClick={onDriveSync}
                      disabled={isSyncingDrive || isLoading}
                      variant="outline"
                      size="sm"
                      className="gap-2 cursor-pointer border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 disabled:opacity-50 h-9"
                    >
                      {isSyncingDrive ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="size-4" />
                      )}
                      <span>Load Local Files</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Graduation & Explore */}
          {step === 4 && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-300 text-center">
              <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto shadow-sm">
                <Check className="size-6" />
              </div>
              <div className="flex flex-col gap-1 max-w-sm mx-auto">
                <h2 className="text-lg font-bold font-heading tracking-tight text-foreground">
                  Ingestion Complete!
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your spreadsheets have been parsed, integrity checks have run, and AI summaries are generated!
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal italic">
                *Click Finish below to reload the console and launch your compliance dashboard.*
              </p>
            </div>
          )}

        </div>

        {/* Footer Navigation Tray */}
        <div className="flex items-center justify-between border-t pt-4 relative z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            disabled={step === 1 || step === 4}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30 h-9"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Button>

          {step < 4 ? (
            <Button
              size="sm"
              onClick={() => setStep(prev => Math.min(4, prev + 1))}
              disabled={step === 3}
              className="gap-1.5 text-xs font-semibold cursor-pointer h-9 px-4"
            >
              Continue
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-1.5 text-xs font-semibold cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-500/25 h-9 px-5"
            >
              Finish Setup
              <Check className="size-3.5" />
            </Button>
          )}
        </div>

      </div>
    </div>
  );
};
