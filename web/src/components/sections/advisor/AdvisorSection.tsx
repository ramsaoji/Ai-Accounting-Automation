import React, { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { deriveBusinessName } from '@/utils/business';
import type { MasterSummary, ChatMessage } from '@/types';
import { sendAdvisorChatMessage } from '@/services/advisorService';
import { useAccountingStore } from '@/store/useAccountingStore';
import {
  Bot,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlaybookSidebar } from './advisor/PlaybookSidebar';
import type { Playbook } from './advisor/PlaybookSidebar';
import { ChatFeed } from './advisor/ChatFeed';
import { ChatInputForm } from './advisor/ChatInputForm';

interface AdvisorSectionProps {
  summary: MasterSummary;
}

export const AdvisorSection: React.FC<AdvisorSectionProps> = ({ summary }) => {
  const isDebitors = summary.isDebitorsList === true;
  
  const businessName = useMemo(() => {
    return deriveBusinessName(summary?.fileName);
  }, [summary?.fileName]);

  // Active playbook selection
  const [activePlaybook, setActivePlaybook] = useState<'revenue' | 'recovery' | 'auditing'>('revenue');

  // Zustand Store hooks for persistent chat logs
  const workspaceKey = isDebitors ? 'debitors' : 'sales';
  const messages = useAccountingStore((state) => state.chatHistories[`chat:${workspaceKey}:${summary.fileName}`] || []);
  const loadChatHistory = useAccountingStore((state) => state.loadChatHistory);
  const addChatMessage = useAccountingStore((state) => state.addChatMessage);
  const setChatHistory = useAccountingStore((state) => state.setChatHistory);

  useEffect(() => {
    loadChatHistory(workspaceKey, summary.fileName, businessName);
  }, [workspaceKey, summary.fileName, businessName, loadChatHistory]);

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
  const playbooks: Playbook[] = [
    {
      id: 'revenue',
      name: 'Revenue Optimization',
      desc: 'Evaluate category sales performance and splits.',
      icon: <TrendingUp className="size-4 text-success shrink-0" />
    },
    {
      id: 'recovery',
      name: 'Dues Recovery Strategy',
      desc: 'Formulate credit limits and collection objectives.',
      icon: <Zap className="size-4 text-warning shrink-0" />
    },
    {
      id: 'auditing',
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

    addChatMessage(workspaceKey, summary.fileName, userMsg);
    setInput('');
    setIsTyping(true);

    try {
      const responseText = await sendAdvisorChatMessage(
        textToSend,
        isDebitors,
        summary,
        [...messages, userMsg].map((m) => ({ sender: m.sender, text: m.text }))
      );

      const aiMsg: ChatMessage = {
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      addChatMessage(workspaceKey, summary.fileName, aiMsg);
    } catch (err) {
      console.error('Failed to get chat response:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    const workspaceKey = isDebitors ? 'debitors' : 'sales';
    setChatHistory(workspaceKey, summary.fileName, [
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
        <PlaybookSidebar
          playbooks={playbooks}
          activePlaybook={activePlaybook}
          setActivePlaybook={setActivePlaybook}
        />

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
          <ChatFeed
            messages={messages}
            isTyping={isTyping}
            scrollContainerRef={scrollContainerRef}
            messagesEndRef={messagesEndRef}
          />

          {/* Form / Actions */}
          <ChatInputForm
            input={input}
            setInput={setInput}
            handleSend={handleSend}
            suggestions={suggestions}
            textareaRef={textareaRef}
            handleKeyDown={handleKeyDown}
          />
        </Card>

      </div>
    </div>
  );
};
