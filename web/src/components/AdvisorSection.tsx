import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { marked } from 'marked';
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

const renderMessageText = (text: string, isUser = false) => {
  const htmlContent = marked.parse(text) as string;
  const textColor = isUser ? 'text-white' : 'text-foreground/90';
  return (
    <div 
      className={`markdown-content ${textColor}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
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

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([
      {
        sender: 'ai',
        text: `Namaskar! 🙏 I am your ${businessName} Financial Advisor. I have analyzed your parsed spreadsheet "${summary.fileName}". How can I help you optimize your business cashflows or recover customer dues today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  }, [businessName, summary.fileName]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const isInitialMount = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      desc: 'Evaluate category profit splits and margin expansions.',
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
          "Analyze seasonal profit changes."
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
    <div className="flex flex-col gap-4 md:gap-6 w-full animate-in fade-in duration-300">
      {/* Title */}
      <div className="border-b pb-4 md:pb-5">
        <h1 className="font-heading font-semibold text-xl tracking-tight text-foreground">
          AI Strategic Advisor
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ask questions, compare margins, or generate objectives using context-aware ledger modeling.
        </p>
      </div>

      {/* Production-grade Split Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 items-stretch lg:h-[calc(100vh-13rem)]">
        
        {/* Playbooks Sidebar (1/4 size) */}
        <div className="lg:col-span-1 flex flex-col border rounded-xl bg-card/50 overflow-hidden h-auto lg:h-full select-none shrink-0 min-w-0">
          <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Advisory Playbooks</span>
          </div>
          <div className="p-2 md:p-3 flex-1 grid grid-cols-3 lg:flex lg:flex-col gap-2 lg:gap-1 overflow-auto">
            {playbooks.map((p) => {
              const isActive = activePlaybook === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlaybook(p.id)}
                  className={`p-2.5 md:p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 flex flex-col gap-0.5 md:gap-1 items-center lg:items-start text-center lg:text-left shrink-0 ${
                    isActive
                      ? 'bg-muted border-foreground/20'
                      : 'bg-background hover:bg-muted/40'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-center gap-1.5 md:gap-2">
                    {p.icon}
                    <span className="text-[0.68rem] sm:text-xs font-bold text-foreground leading-none">{p.name.split(' ')[0]}</span>
                  </div>
                  <span className="text-[0.65rem] text-muted-foreground leading-normal mt-0.5 hidden lg:block">
                    {p.desc}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="p-3 border-t bg-muted/15 flex items-center gap-2 text-[0.62rem] font-bold text-muted-foreground font-mono">
            <Activity className="size-3 text-success animate-pulse" />
            LLM Layer: Local Ingestion
          </div>
        </div>

        {/* Chat Feed Pane (3/4 size) */}
        <Card className="lg:col-span-3 border bg-card/45 h-[620px] sm:h-[680px] lg:h-full overflow-hidden flex flex-col justify-between min-w-0">
          <CardHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0 select-none gap-2">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border shrink-0 mt-0.5">
                <Bot className="size-4.5" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xs font-bold flex flex-wrap items-center gap-1.5 sm:gap-2 leading-tight">
                  {businessName} Advisory Agent
                  <span className="flex items-center gap-1 text-[0.58rem] font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full leading-none shrink-0">
                    <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
                    Online
                  </span>
                </CardTitle>
                <p className="text-[0.68rem] text-muted-foreground mt-1 truncate max-w-[150px] sm:max-w-none">Context: {summary.fileName}</p>
              </div>
            </div>
            <Button variant="outline" size="xs" onClick={clearChat} className="text-[10px] sm:text-xs h-7 sm:h-7.5 px-2 sm:px-2.5 shrink-0">
              <RefreshCw className="size-3.5 mr-0 sm:mr-1 shrink-0 animate-in spin-in-12 duration-300" />
              <span className="hidden sm:inline">Clear Chat</span>
            </Button>
          </CardHeader>

          {/* Message Thread (Scrollable Viewport) */}
          <CardContent className="flex-1 min-h-0 px-4 py-3 sm:px-6 sm:py-4 overflow-y-auto flex flex-col scroll-smooth pr-3">
            <div className="flex flex-col gap-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
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
                    {renderMessageText(msg.text, msg.sender === 'user')}
                  </div>
                  <span className="text-[0.65rem] font-medium text-muted-foreground/60 px-1 select-none">{msg.timestamp}</span>
                </div>
              ))}

              {isTyping && (
                <div className="self-start flex flex-col gap-1.5 items-start select-none">
                  <div className="bg-muted border rounded-lg rounded-tl-none px-4 py-3 flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>

          {/* Form / Actions */}
          <CardFooter className="px-4 py-3 sm:px-6 sm:py-4 border-t bg-muted/10 flex flex-col gap-3">
            {/* Quick Suggestion Chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar select-none shrink-0">
              {suggestions.map((sug, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="xs"
                  onClick={() => handleSend(sug)}
                  className="text-[0.68rem] text-muted-foreground hover:text-foreground rounded-full flex-shrink-0 flex items-center gap-1 h-7 px-3 border-border/80 hover:bg-muted"
                >
                  {sug}
                  <ArrowUpRight className="size-3 text-muted-foreground/80 shrink-0" />
                </Button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="flex items-center gap-2 w-full shrink-0"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about sales, debtor caps, or staff checklists..."
                className="flex-1 bg-background dark:bg-muted/40 border border-border rounded-md px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 h-9"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!input.trim()}
                className="h-9 px-3.5 cursor-pointer"
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
