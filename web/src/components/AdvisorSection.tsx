import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import type { MasterSummary, ChatMessage } from '../types';
import { sendAdvisorChatMessage } from '../services/api';
import {
  Send,
  Bot,
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Activity,
  Compass,
  Zap
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AdvisorSectionProps {
  summary: MasterSummary;
}

interface MessageTextProps {
  text: string;
  isUser?: boolean;
}

function parseInlineStyles(text: string): React.ReactNode[] {
  // Split on bold (**), italic (*), inline code (`), and links ([text](url))
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index} className="italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="bg-muted dark:bg-muted/80 text-foreground px-1.5 py-0.5 rounded font-mono text-[0.85em] border border-border/50">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        return (
          <a key={index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors font-medium">
            {match[1]}
          </a>
        );
      }
    }
    return part;
  });
}

interface MarkdownBlock {
  type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'list-unordered' | 'list-ordered' | 'code-block' | 'table' | 'spacer';
  lines: string[];
  lang?: string;
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split('\n');
  const blocks: MarkdownBlock[] = [];
  let currentBlock: MarkdownBlock | null = null;
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 1. Code block
    if (trimmed.startsWith('```')) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code-block',
        lines: codeLines,
        lang
      });
      i++; // skip closing backticks
      continue;
    }
    
    // 2. Table lines (outside code block)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (currentBlock && currentBlock.type !== 'table') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'table', lines: [] };
      }
      currentBlock.lines.push(line);
      i++;
      continue;
    }
    
    if (currentBlock && currentBlock.type === 'table') {
      blocks.push(currentBlock);
      currentBlock = null;
    }
    
    // 3. Headings
    if (line.startsWith('# ')) {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ type: 'heading1', lines: [line.slice(2)] });
      currentBlock = null;
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ type: 'heading2', lines: [line.slice(3)] });
      currentBlock = null;
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ type: 'heading3', lines: [line.slice(4)] });
      currentBlock = null;
      i++;
      continue;
    }
    
    // 4. Unordered List Items
    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (currentBlock && currentBlock.type !== 'list-unordered') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'list-unordered', lines: [] };
      }
      currentBlock.lines.push(line.slice(2));
      i++;
      continue;
    }
    
    // 5. Ordered List Items
    const orderedMatch = line.match(/^(\d+)\.\s(.*)/);
    if (orderedMatch) {
      if (currentBlock && currentBlock.type !== 'list-ordered') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'list-ordered', lines: [] };
      }
      currentBlock.lines.push(orderedMatch[2]);
      i++;
      continue;
    }
    
    // 6. Spacer
    if (!trimmed) {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      blocks.push({ type: 'spacer', lines: [''] });
      i++;
      continue;
    }
    
    // 7. Paragraph
    if (currentBlock && currentBlock.type !== 'paragraph') {
      blocks.push(currentBlock);
      currentBlock = null;
    }
    if (!currentBlock) {
      currentBlock = { type: 'paragraph', lines: [] };
    }
    currentBlock.lines.push(line);
    i++;
  }
  
  if (currentBlock) {
    blocks.push(currentBlock);
  }
  
  return blocks;
}

const SafeMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);
  
  return (
    <div className="space-y-2">
      {blocks.map((block, bIdx) => {
        switch (block.type) {
          case 'heading1':
            return <h1 key={bIdx} className="text-base sm:text-lg font-bold mt-4 mb-2 text-foreground">{parseInlineStyles(block.lines[0])}</h1>;
          case 'heading2':
            return <h2 key={bIdx} className="text-sm sm:text-base font-bold mt-3 mb-1.5 text-foreground">{parseInlineStyles(block.lines[0])}</h2>;
          case 'heading3':
            return <h3 key={bIdx} className="text-xs sm:text-sm font-bold mt-2 mb-1 text-foreground">{parseInlineStyles(block.lines[0])}</h3>;
          case 'list-unordered':
            return (
              <ul key={bIdx} className="list-disc list-inside pl-1 sm:pl-2 my-1 space-y-1">
                {block.lines.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">{parseInlineStyles(item)}</li>
                ))}
              </ul>
            );
          case 'list-ordered':
            return (
              <ol key={bIdx} className="list-decimal list-inside pl-1 sm:pl-2 my-1 space-y-1">
                {block.lines.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">{parseInlineStyles(item)}</li>
                ))}
              </ol>
            );
          case 'code-block':
            return (
              <pre key={bIdx} className="bg-muted dark:bg-muted/70 p-2 sm:p-3 rounded-lg font-mono text-[0.78rem] sm:text-xs overflow-x-auto my-2 border border-border/80 text-foreground">
                <code>{block.lines.join('\n')}</code>
              </pre>
            );
          case 'spacer':
            return <div key={bIdx} className="h-1 sm:h-1.5" />;
          case 'table': {
            const rows = block.lines.map(line => 
              line.split('|')
                .map(cell => cell.trim())
                .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
            );
            
            const isDividerRow = (row: string[]) => row.every(cell => /^:?-+:?$/.test(cell) || cell.length === 0);
            
            const headerRow = rows[0] || [];
            const bodyRows = rows.slice(1).filter(row => !isDividerRow(row));
            
            return (
              <div key={bIdx} className="overflow-x-auto my-2.5 rounded-lg border border-border max-w-full">
                <table className="min-w-full divide-y divide-border text-[0.75rem] sm:text-xs leading-normal">
                  <thead className="bg-muted/65">
                    <tr>
                      {headerRow.map((cell, idx) => (
                        <th key={idx} className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-left font-bold text-foreground/80 border-r last:border-r-0 border-border">
                          {parseInlineStyles(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {bodyRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-muted/20">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-foreground/95 border-r last:border-r-0 border-border">
                            {parseInlineStyles(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case 'paragraph':
          default:
            return <p key={bIdx} className="leading-relaxed my-1">{parseInlineStyles(block.lines.join('\n'))}</p>;
        }
      })}
    </div>
  );
};

const MessageText: React.FC<MessageTextProps> = ({ text, isUser = false }) => {
  const textColor = isUser ? 'text-white' : 'text-foreground/90';
  return (
    <div className={`markdown-content ${textColor}`}>
      <SafeMarkdown text={text} />
    </div>
  );
};

export const AdvisorSection: React.FC<AdvisorSectionProps> = ({ summary }) => {
  const isDebitors = summary.isDebitorsList === true;
  
  const businessName = useMemo(() => {
    const fn = summary.fileName;
    const lower = fn.toLowerCase();
    if (lower.includes('gaurav')) return 'Hotel Gaurav';
    let name = fn.replace(/\.[^/.]+$/, "");
    name = name.replace(/(daily\s*sales\s*register|debitors\s*list|debitors|sales|ledger|list)/gi, '').trim();
    name = name.replace(/[_\-]+/g, ' ').trim();
    if (name.length > 2) {
      return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return 'Strategic AI';
  }, [summary.fileName]);

  // Active playbook selection
  const [activePlaybook, setActivePlaybook] = useState<'revenue' | 'recovery' | 'auditing'>('revenue');

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      sender: 'ai',
      text: `Namaskar! 🙏 I am your ${businessName} Financial Advisor. I have analyzed your parsed spreadsheet "${summary.fileName}". How can I help you optimize your business cashflows or recover customer dues today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const isInitialMount = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      if (!input.trim()) {
        textareaRef.current.style.height = '36px';
        textareaRef.current.style.overflowY = 'hidden';
      } else {
        textareaRef.current.style.height = 'auto';
        // Cap height mathematically at 120px to match standard modern chat input caps
        const nextHeight = Math.min(120, textareaRef.current.scrollHeight);
        textareaRef.current.style.height = `${nextHeight}px`;
        textareaRef.current.style.overflowY = textareaRef.current.scrollHeight > 120 ? 'auto' : 'hidden';
      }
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  useEffect(() => {
    // Skip the very first render — only auto-scroll when new messages arrive
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    scrollToBottom();
  }, [messages, isTyping]);

  // Advisor playbooks definition
  const playbooks = [
    {
      id: 'revenue' as const,
      name: 'Revenue Optimization',
      desc: 'Evaluate category sales performance and splits.',
      icon: <TrendingUp className="size-4 text-success shrink-0" />
    },
    {
      id: 'recovery' as const,
      name: 'Dues Recovery Strategy',
      desc: 'Formulate credit limits and collection objectives.',
      icon: <Zap className="size-4 text-warning shrink-0" />
    },
    {
      id: 'auditing' as const,
      name: 'Auditing Integrity',
      desc: 'Analyze outlier postings and expense leaks.',
      icon: <ShieldCheck className="size-4 text-info shrink-0" />
    }
  ];

  // Chips derived from selected playbook & register context
  const suggestions = useMemo(() => {
    if (isDebitors) {
      if (activePlaybook === 'recovery') {
        return [
          "Who is our top outstanding debtor?",
          "What is our collection success rate?",
          "Formulate customer credit cap policy."
        ];
      }
      if (activePlaybook === 'auditing') {
        return [
          "Audit outstanding ledger balance breaches.",
          "Identify delayed settlement warnings.",
          "Verify uncollected account ratios."
        ];
      }
      return [
        "Which client has highest purchases?",
        "Provide customer recovery action steps.",
        "Assess total unrecovered debit totals."
      ];
    } else {
      if (activePlaybook === 'revenue') {
        return [
          "Compare liquor vs food performance.",
          "What was our best revenue month?",
          "Analyze seasonal sales trends."
        ];
      }
      if (activePlaybook === 'auditing') {
        return [
          "What spending alerts were flagged?",
          "Reconcile monthly supplier invoice spikes.",
          "Check counter credits above ₹2,000."
        ];
      }
      return [
        "Audit seasonal liquor markup splits.",
        "Evaluate cumulative restaurant net surplus.",
        "Calculate gross margin split forecasts."
      ];
    }
  }, [isDebitors, activePlaybook]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const responseText = await sendAdvisorChatMessage(
        textToSend,
        isDebitors,
        summary,
        messages.map((m) => ({ sender: m.sender, text: m.text }))
      );

      const aiMsg: ChatMessage = {
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Failed to get chat response:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        sender: 'ai',
        text: `Namaskar! 🙏 Conversation context re-initialized. How can I help you audit your spreadsheet values today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
    toast.success("Chat history cleared.");
  };

  return (
    <div className="flex flex-col gap-3 w-full animate-in fade-in duration-300">
      {/* Title */}
      <div className="border-b pb-2.5 md:pb-4">
        <h1 className="font-heading font-semibold text-lg sm:text-xl tracking-tight text-foreground">
          AI Strategic Advisor
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ask questions, compare margins, or generate objectives using context-aware ledger modeling.
        </p>
      </div>

      {/* Production-grade Split Chat Layout */}
      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-3 md:gap-4">
        
        {/* Playbooks Sidebar */}
        <div className="lg:col-span-1 flex flex-col border rounded-xl bg-card/50 overflow-hidden shrink-0 select-none min-w-0">
          <div className="hidden lg:flex p-4 border-b bg-muted/20 items-center gap-2">
            <Compass className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Advisory Playbooks</span>
          </div>
          <div className="p-2 lg:p-3 flex-1 grid grid-cols-3 lg:flex lg:flex-col gap-1.5 lg:gap-1 overflow-auto">
            {playbooks.map((p) => {
              const isActive = activePlaybook === p.id;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setActivePlaybook(p.id)}
                  className={`p-2 lg:p-3 rounded-lg border cursor-pointer transition-all duration-200 flex flex-row lg:flex-col gap-1.5 md:gap-1 items-center lg:items-start justify-center lg:justify-start text-center lg:text-left shrink-0 ${
                    isActive
                      ? 'bg-muted border-foreground/20'
                      : 'bg-background hover:bg-muted/40'
                  }`}
                >
                  <div className="flex flex-row lg:flex-row items-center gap-1.5 lg:gap-2">
                    {p.icon}
                    <span className="text-[10px] sm:text-xs font-bold text-foreground leading-none">{p.name.split(' ')[0]}</span>
                  </div>
                  <span className="text-[0.65rem] text-muted-foreground leading-normal mt-0.5 hidden lg:block">
                    {p.desc}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="hidden lg:flex p-3 border-t bg-muted/15 items-center gap-2 text-[0.62rem] font-bold text-muted-foreground font-mono">
            <Activity className="size-3 text-success animate-pulse" />
            LLM Layer: Local Ingestion
          </div>
        </div>

        {/* Chat Feed Pane (3/4 size) */}
        <Card className="lg:col-span-3 border bg-card/45 h-[650px] sm:h-[720px] flex flex-col overflow-hidden min-w-0">
          {/* Chat card header — compact on mobile */}
          <CardHeader className="px-3 py-2 sm:px-6 sm:py-4 border-b bg-muted/20 flex flex-row items-center justify-between select-none gap-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border shrink-0">
                <Bot className="size-4" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col sm:block">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CardTitle className="text-xs font-bold leading-tight">
                    {businessName} Advisory Agent
                  </CardTitle>
                  <span className="flex items-center gap-1 text-[0.58rem] font-bold text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-full leading-none shrink-0">
                    <span className="size-1.5 bg-success rounded-full animate-pulse"></span>
                    Online
                  </span>
                </div>
                <p className="text-[0.65rem] text-muted-foreground truncate hidden sm:block mt-0.5">Context: {summary.fileName}</p>
              </div>
            </div>
            <Button variant="outline" size="xs" onClick={clearChat} className="text-[10px] sm:text-xs h-8 sm:h-7 px-2 sm:px-2.5 shrink-0">
              <RefreshCw className="size-3.5 shrink-0" />
              <span className="hidden sm:inline ml-1">Clear Chat</span>
            </Button>
          </CardHeader>

          {/* Message Thread (Scrollable Viewport) */}
          <CardContent ref={scrollContainerRef} className="flex-1 min-h-0 px-4 py-3 sm:px-6 sm:py-4 overflow-y-auto flex flex-col scroll-smooth pr-3">
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
                  <span className="text-[0.65rem] font-medium text-muted-foreground/60 px-1 select-none">{msg.timestamp}</span>
                </div>
              ))}

              {isTyping && (
                <div className="self-start flex flex-col gap-1.5 items-start select-none">
                  <div className="bg-muted border rounded-lg rounded-tl-none px-4 py-3 flex gap-1 items-center">
                    <span className="size-1.5 bg-muted-foreground/60 rounded-full" style={{ animation: 'typing-dot 0.9s cubic-bezier(0.16,1,0.3,1) infinite', animationDelay: '0ms' }}></span>
                    <span className="size-1.5 bg-muted-foreground/60 rounded-full" style={{ animation: 'typing-dot 0.9s cubic-bezier(0.16,1,0.3,1) infinite', animationDelay: '180ms' }}></span>
                    <span className="size-1.5 bg-muted-foreground/60 rounded-full" style={{ animation: 'typing-dot 0.9s cubic-bezier(0.16,1,0.3,1) infinite', animationDelay: '360ms' }}></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>

          {/* Form / Actions */}
          <CardFooter className="px-3 py-2.5 sm:px-6 sm:py-4 border-t bg-muted/10 flex flex-col gap-2 sm:gap-3 flex-shrink-0">
            {/* Quick Suggestion Chips */}
            <div className="flex gap-1.5 overflow-x-auto max-w-full no-scrollbar select-none flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
              {suggestions.map((sug) => (
                <Button
                  key={sug}
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
          </CardFooter>
        </Card>

      </div>
    </div>
  );
};
