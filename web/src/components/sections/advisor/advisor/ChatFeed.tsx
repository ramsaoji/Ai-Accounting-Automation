import React from 'react';
import type { ChatMessage } from '@/types';
import { MessageText } from '@/utils/markdown';

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
        {messages.map((msg) => (
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
              <MessageText text={msg.text} isUser={msg.sender === 'user'} />
            </div>
            <span className="text-[0.65rem] font-medium text-muted-foreground/60 px-1 select-none">
              {msg.timestamp}
            </span>
          </div>
        ))}

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
