import React from 'react';
import { Send, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputFormProps {
  input: string;
  setInput: (val: string) => void;
  handleSend: (text: string) => void;
  suggestions: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const ChatInputForm: React.FC<ChatInputFormProps> = ({
  input,
  setInput,
  handleSend,
  suggestions,
  textareaRef,
  handleKeyDown,
}) => {
  return (
    <div className="px-3 py-2.5 sm:px-6 sm:py-4 border-t bg-muted/10 flex flex-col gap-2 sm:gap-3 flex-shrink-0">
      {/* Quick Suggestion Chips */}
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
          placeholder="Ask a financial question..."
          aria-label="Ask a financial question..."
          className="flex-1 bg-background dark:bg-muted/40 border border-border rounded-md px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 resize-none min-h-[36px] scroll-smooth"
          style={{ height: '36px', overflowY: 'hidden' }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim()}
          className="h-10 sm:h-9 px-3.5 cursor-pointer shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
};
