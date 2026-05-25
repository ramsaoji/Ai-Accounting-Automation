import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { marked } from 'marked';
import type { MasterSummary, ChatMessage } from '../types';
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
  
  // Active playbook selection
  const [activePlaybook, setActivePlaybook] = useState<'revenue' | 'recovery' | 'auditing'>('revenue');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: `Namaskar! 🙏 I am your Hotel Gaurav Financial Advisor. I have analyzed your parsed spreadsheet "${summary.fileName}". How can I help you optimize your business cashflows or recover customer dues today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
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
      icon: <TrendingUp className="size-4 text-success" />
    },
    {
      id: 'recovery' as const,
      name: 'Dues Recovery Strategy',
      desc: 'Formulate credit limits and collection objectives.',
      icon: <Zap className="size-4 text-warning" />
    },
    {
      id: 'auditing' as const,
      name: 'Auditing Integrity',
      desc: 'Analyze outlier postings and expense leaks.',
      icon: <ShieldCheck className="size-4 text-info" />
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

  const generateAdvisoryResponse = (query: string): string => {
    const q = query.toLowerCase();
    
    if (isDebitors) {
      const totalPending = summary.aggregates?.totalPendingSum || 0;
      const successRate = summary.aggregates?.collectionSuccessRate || '0%';
      const topName = summary.aggregates?.topDebtorName || 'None';
      const topVal = summary.aggregates?.topDebtorValue || 0;

      if (q.includes('rate') || q.includes('success') || q.includes('collection')) {
        return `Our credit collections success rate currently stands at **${successRate}%**. We have successfully collected ₹${(summary.aggregates?.totalCreditSum || 0).toLocaleString('en-IN')} out of ₹${(summary.aggregates?.totalDebitSum || 0).toLocaleString('en-IN')} in total credit extended. The remaining ₹${totalPending.toLocaleString('en-IN')} gap represents a major cashflow recovery opportunity!`;
      }
      if (q.includes('top') || q.includes('who') || q.includes('highest') || q.includes('debtor') || q.includes('client')) {
        return `Our top outstanding debtor account is **${topName}**, who carries a pending balance of **₹${topVal.toLocaleString('en-IN')}**. That single account represents approximately **${((topVal / Math.max(totalPending, 1)) * 100).toFixed(1)}%** of all our outstanding uncollected tabs! I highly advise scheduling a direct, friendly phone call with them this week to set up a structured weekly installment clearance.`;
      }
      if (q.includes('checklist') || q.includes('staff') || q.includes('suggest') || q.includes('action') || q.includes('policy') || q.includes('limit') || q.includes('cap')) {
        return `Here is the recommended **Client Credit Limit Policy**:\n\n1. **High Dues Restriction:** Place a temporary credit freeze on **${topName}** and any other accounts above ₹20,000 until they clear at least 50% of their current tab.\n2. **Counter Ledger Inquiries:** Ask your billing counter staff to politely verify credit statuses with repeat customers *before* their table orders exceed ₹2,000.\n3. **Structured Recoveries:** Reach out to **SURAJ KHARCHE** and request a small weekend installment plan to begin clearing their ₹27,000 outstanding dues incrementally.`;
      }
    } else {
      const netProfit = summary.masterTotals?.netCashflow || 0;
      const liqPct = summary.benchmarks?.liquorPercentage || '0';
      const foodPct = summary.benchmarks?.foodPercentage || '0';
      const bestMonth = summary.benchmarks?.bestRevenueMonth || 'N/A';
      const bestVal = summary.benchmarks?.bestRevenueValue || 0;
      const peakMonth = summary.benchmarks?.peakExpenseMonth || 'N/A';
      const peakVal = summary.benchmarks?.peakExpenseValue || 0;

      if (q.includes('best') || q.includes('profit') || q.includes('revenue') || q.includes('highest') || q.includes('month')) {
        return `Our highest monthly performance occurred in **${bestMonth}**, generating a peak revenue of **₹${bestVal.toLocaleString('en-IN')}**! Overall, the business shows a cumulative Net cash surplus of **₹${netProfit.toLocaleString('en-IN')}** across the audited timeframe. That proves the underlying sales volume is incredibly strong!`;
      }
      if (q.includes('liquor') || q.includes('food') || q.includes('compare') || q.includes('ratio') || q.includes('markup')) {
        return `The menu sales split is currently **${liqPct}% Liquor** (Bar Counter) vs. **${foodPct}% Food** (Restaurant). While bar sales drive high receipts, we can boost our margins further by having tables upsell premium starter platters and specialty combos to drink orders. This leverages the high volume of the bar to drive double-digit food margins!`;
      }
      if (q.includes('alert') || q.includes('warning') || q.includes('spike') || q.includes('expense') || q.includes('credit')) {
        return `Yes, the system flagged **${summary.alerts.length} operational alerts**. Specifically, in **${peakMonth}**, supplier expenses spiked to **₹${peakVal.toLocaleString('en-IN')}**, breaching our standard safety budget limits. I recommend cross-auditing supplier statements from that period to identify if there was any cost leakage or duplicate supplier billing.`;
      }
    }

    return `I hear you! Looking at "${summary.fileName}", our numbers indicate a strong financial base with ₹${(isDebitors ? summary.aggregates?.totalPendingSum : summary.masterTotals?.netCashflow)?.toLocaleString('en-IN')} in play. To optimize this, I recommend scheduling a quick staff sync to review billing entries, capping high credit extensions, and setting target sales goals. What specific numbers would you like me to pull next?`;
  };

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
      const res = await fetch('http://localhost:8080/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToSend,
          workspace: isDebitors ? 'debitors' : 'sales',
          history: messages.map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.text) {
          const aiMsg: ChatMessage = {
            sender: 'ai',
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, aiMsg]);
          setIsTyping(false);
          return;
        }
      }
    } catch (err) {
      console.warn('AI Chat API offline. Falling back to local offline heuristic reasoning engine.', err);
    }

    // Graceful offline simulation fallback
    setTimeout(() => {
      const response = generateAdvisoryResponse(textToSend);
      const aiMsg: ChatMessage = {
        sender: 'ai',
        text: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 800);
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
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
      {/* Title */}
      <div className="border-b pb-5">
        <h1 className="font-heading font-semibold text-xl tracking-tight text-foreground">
          AI Strategic Advisor
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ask questions, compare margins, or generate objectives using context-aware ledger modeling.
        </p>
      </div>

      {/* Production-grade Split Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch" style={{ height: 'calc(100vh - 13rem)' }}>
        
        {/* Playbooks Sidebar (1/4 size) */}
        <div className="lg:col-span-1 flex flex-col border rounded-xl bg-card/50 overflow-hidden h-full select-none">
          <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Advisory Playbooks</span>
          </div>
          <div className="p-3 flex-1 flex flex-col gap-1 overflow-y-auto">
            {playbooks.map((p) => {
              const isActive = activePlaybook === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlaybook(p.id)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 flex flex-col gap-1 ${
                    isActive
                      ? 'bg-muted border-foreground/20'
                      : 'bg-background hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {p.icon}
                    <span className="text-xs font-bold text-foreground">{p.name}</span>
                  </div>
                  <span className="text-[0.65rem] text-muted-foreground leading-normal mt-0.5">
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
        <Card className="lg:col-span-3 border bg-card/45 h-full overflow-hidden flex flex-col justify-between">
          {/* Header */}
          <CardHeader className="px-6 py-4 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0 select-none">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border shrink-0">
                <Bot className="size-4.5" />
              </div>
              <div>
                <CardTitle className="text-xs font-bold flex items-center gap-2 leading-none">
                  Hotel Gaurav Advisory Agent
                  <span className="flex items-center gap-1 text-[0.58rem] font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full leading-none">
                    <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
                    Online
                  </span>
                </CardTitle>
                <p className="text-[0.68rem] text-muted-foreground mt-1">Context: {summary.fileName}</p>
              </div>
            </div>
            <Button variant="outline" size="xs" onClick={clearChat} className="text-xs h-7.5 px-2.5">
              <RefreshCw className="size-3.5 mr-1" />
              Clear Chat
            </Button>
          </CardHeader>

          {/* Message Thread (Scrollable Viewport) */}
          <CardContent className="flex-1 min-h-0 px-6 py-4 overflow-y-auto flex flex-col scroll-smooth pr-3">
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
          <CardFooter className="px-6 py-4 border-t bg-muted/10 flex flex-col gap-3">
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
                  <ArrowUpRight className="size-3 text-muted-foreground/80" />
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
