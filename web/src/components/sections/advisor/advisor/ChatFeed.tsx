import React from 'react';
import type { ChatMessage } from '@/types';
import { MessageText } from '@/utils/markdown';
import { AlertTriangle, BarChart3, Bot, User } from 'lucide-react';

interface ChatFeedProps {
  messages: ChatMessage[];
  isTyping: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  activePlaybook: 'revenue' | 'recovery' | 'auditing';
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  messages,
  isTyping,
  scrollContainerRef,
  messagesEndRef,
  activePlaybook,
}) => {
  const getAiAccentBorder = () => {
    if (activePlaybook === 'revenue') return 'border-l-2 border-l-emerald-500/70';
    if (activePlaybook === 'recovery') return 'border-l-2 border-l-amber-500/70';
    return 'border-l-2 border-l-blue-500/70';
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 px-3 py-2.5 sm:px-5 sm:py-3.5 overflow-y-auto flex flex-col scroll-smooth pr-2"
    >
      <div className="flex flex-col gap-3.5">
        {messages.map((msg) => {
          const isOffline = msg.text === '[AI-OFFLINE]';
          const isLedgerAnalysis = msg.text.startsWith('[LEDGER-ANALYSIS]');

          if (isOffline) {
            return (
              <div
                key={`${msg.sender}-${msg.timestamp}`}
                className="self-start flex flex-col gap-1.5 items-start max-w-[85%] animate-in fade-in slide-in-from-left-2 duration-300"
              >
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10 px-4 py-3.5 flex gap-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300 font-medium">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-amber-900 dark:text-amber-200">AI Advisor Unavailable</span>
                    <span>The AI Advisor is currently offline. Please contact your system administrator to enable live AI consulting.</span>
                  </div>
                </div>
                <span className="text-[0.65rem] font-medium text-muted-foreground/60 px-1 select-none">
                  {msg.timestamp}
                </span>
              </div>
            );
          }

          const displayText = isLedgerAnalysis
            ? msg.text.slice('[LEDGER-ANALYSIS]'.length).trim()
            : msg.text;

          const isUser = msg.sender === 'user';

          return (
            <div
              key={`${msg.sender}-${msg.timestamp}`}
              className={`flex gap-2.5 max-w-[90%] sm:max-w-[85%] ${
                isUser ? 'self-end flex-row-reverse' : 'self-start'
              } animate-in fade-in slide-in-from-bottom-1 duration-200`}
            >
              {/* Avatar Icon */}
              {isUser ? (
                <div className="w-6 h-6 rounded-md bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 select-none shadow-xs">
                  <User className="size-3.5" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 select-none shadow-xs">
                  <Bot className="size-3.5" />
                </div>
              )}

              {/* Message Content */}
              <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-lg px-3 py-2 text-xs leading-normal shadow-xs ${
                    isUser
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 dark:from-indigo-500 dark:to-violet-500 text-white rounded-tr-none font-medium'
                      : `bg-muted/35 dark:bg-muted/20 border text-foreground rounded-tl-none font-medium backdrop-blur-xs border-border/50 ${getAiAccentBorder()}`
                  }`}
                >
                  {isLedgerAnalysis && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold w-fit mb-1.5 select-none">
                      <BarChart3 className="size-3.5" />
                      Ledger Analysis
                    </div>
                  )}
                  <MessageText text={displayText} isUser={isUser} />
                </div>
                <span className="text-[0.6rem] font-medium text-muted-foreground/60 px-1 select-none">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="self-start flex gap-2.5 items-start select-none animate-in fade-in duration-200">
            <div className="w-6 h-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <Bot className="size-3.5 animate-bounce" />
            </div>
            <div className="bg-muted/40 border border-border/50 rounded-lg rounded-tl-none px-3.5 py-2.5 flex gap-1 items-center">
              <span
                className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              ></span>
              <span
                className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              ></span>
              <span
                className="size-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              ></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
