import React from 'react';
import type { ChatMessage } from '@/types';
import { MessageText } from '@/utils/markdown';
import { AlertTriangle, BarChart3 } from 'lucide-react';

interface ChatFeedProps {
  messages: ChatMessage[];
  isTyping: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  messages,
  isTyping,
  scrollContainerRef,
  messagesEndRef,
}) => {
  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 px-4 py-3 sm:px-6 sm:py-4 overflow-y-auto flex flex-col scroll-smooth pr-3"
    >
      <div className="flex flex-col gap-4">
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

          return (
            <div
              key={`${msg.sender}-${msg.timestamp}`}
              className={`flex max-w-[85%] flex-col gap-1.5 ${
                msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <div
                className={`rounded-lg px-4 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white rounded-tr-none font-medium shadow-sm'
                    : 'bg-muted border text-foreground rounded-tl-none font-medium'
                }`}
              >
                {isLedgerAnalysis && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold w-fit mb-1.5 select-none">
                    <BarChart3 className="size-3.5" />
                    Ledger Analysis
                  </div>
                )}
                <MessageText text={displayText} isUser={msg.sender === 'user'} />
              </div>
              <span className="text-[0.65rem] font-medium text-muted-foreground/60 px-1 select-none">
                {msg.timestamp}
              </span>
            </div>
          );
        })}

        {isTyping && (
          <div className="self-start flex flex-col gap-1.5 items-start select-none">
            <div className="bg-muted border rounded-lg rounded-tl-none px-4 py-3 flex gap-1 items-center">
              <span
                className="size-1.5 bg-muted-foreground/60 rounded-full"
                style={{
                  animation: 'typing-dot 0.9s cubic-bezier(0.16,1,0.3,1) infinite',
                  animationDelay: '0ms',
                }}
              ></span>
              <span
                className="size-1.5 bg-muted-foreground/60 rounded-full"
                style={{
                  animation: 'typing-dot 0.9s cubic-bezier(0.16,1,0.3,1) infinite',
                  animationDelay: '180ms',
                }}
              ></span>
              <span
                className="size-1.5 bg-muted-foreground/60 rounded-full"
                style={{
                  animation: 'typing-dot 0.9s cubic-bezier(0.16,1,0.3,1) infinite',
                  animationDelay: '360ms',
                }}
              ></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
