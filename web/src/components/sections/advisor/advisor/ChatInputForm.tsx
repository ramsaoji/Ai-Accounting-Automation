import React from 'react';
import { Send, ArrowUpRight, MessageSquareOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputFormProps {
  input: string;
  setInput: (val: string) => void;
  handleSend: (text: string) => void;
  suggestions: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  aiProvider?: string;
  aiModel?: string;
}

export const ChatInputForm: React.FC<ChatInputFormProps> = ({
  input,
  setInput,
  handleSend,
  suggestions,
  textareaRef,
  handleKeyDown,
  disabled = false,
  aiProvider = 'none',
  aiModel = 'none',
}) => {
  const isUnconfigured = aiProvider === 'none' || aiModel === 'none' || !aiModel.trim();

  return (
    <div className="px-3 py-2.5 sm:px-6 sm:py-4 border-t bg-muted/10 flex flex-col gap-2 sm:gap-3 flex-shrink-0">
      {/* Quick Suggestion Chips or Disabled Warning Banner */}
      {disabled ? (
        isUnconfigured ? (
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300 animate-in fade-in duration-200">
            <div className="size-8.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
              <MessageSquareOff className="size-4" />
            </div>
            <div className="flex-1 text-center sm:text-left flex flex-col gap-0.5">
              <h4 className="text-xs font-bold text-foreground">AI Advisor Unconfigured</h4>
              <p className="text-[10px] text-muted-foreground leading-normal">
                The AI Advisor is disabled because no AI model is active. Please configure an active AI Provider and Model name in the **System Settings** menu above to enable live strategic consulting.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive-foreground animate-in fade-in duration-200">
            <div className="size-8.5 rounded-lg bg-destructive/10 border border-destructive/25 flex items-center justify-center text-destructive shrink-0 mt-0.5">
              <MessageSquareOff className="size-4" />
            </div>
            <div className="flex-1 text-center sm:text-left flex flex-col gap-0.5">
              <h4 className="text-xs font-bold text-foreground">AI Advisor Deactivated</h4>
              <p className="text-[10px] text-muted-foreground leading-normal">
                The AI Advisor Chat is currently deactivated by the system administrator. Other features, reports, and manual ledger sync controls remain 100% operational.
              </p>
            </div>
          </div>
        )
      ) : (
        <div
          className="flex gap-1.5 overflow-x-auto max-w-full no-scrollbar select-none flex-shrink-0"
          style={{ scrollbarWidth: 'none' }}
        >
          {suggestions.map((sug) => (
            <Button
              key={sug}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => handleSend(sug)}
              className="text-[0.65rem] text-muted-foreground hover:text-foreground rounded-full flex-shrink-0 flex items-center gap-1 h-8 sm:h-7 px-2.5 sm:px-3 border-border/80 hover:bg-muted whitespace-nowrap"
            >
              {sug}
              <ArrowUpRight className="size-2.5 sm:size-3 text-muted-foreground/80 shrink-0" />
            </Button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        noValidate
        className="flex items-end gap-2 w-full shrink-0 animate-in fade-in duration-200"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "AI Advisor is currently offline..." : "Ask a financial question..."}
          aria-label="Ask a financial question..."
          disabled={disabled}
          className="flex-1 bg-background dark:bg-muted/40 border border-border rounded-md px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 resize-none min-h-[36px] scroll-smooth disabled:opacity-60 disabled:bg-muted/10 disabled:cursor-not-allowed"
          style={{ height: '36px', overflowY: 'hidden' }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={disabled || !input.trim()}
          className="h-10 sm:h-9 px-3.5 cursor-pointer shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
};
