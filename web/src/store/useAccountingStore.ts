import { create } from 'zustand';
import type { ChatMessage } from '../types';

interface AccountingState {
  appSessionToken: string;
  activeWorkspace: 'sales' | 'debitors';
  activeView: 'portal' | 'overview' | 'ledger' | 'auditor' | 'advisor';
  chatHistories: Record<string, ChatMessage[]>;

  // Mutators
  setToken: (token: string) => void;
  clearToken: () => void;
  setActiveWorkspace: (workspace: 'sales' | 'debitors') => void;
  setActiveView: (view: 'portal' | 'overview' | 'ledger' | 'auditor' | 'advisor') => void;
  getChatHistory: (workspace: 'sales' | 'debitors', fileName: string) => ChatMessage[];
  loadChatHistory: (workspace: 'sales' | 'debitors', fileName: string, businessName: string) => void;
  addChatMessage: (workspace: 'sales' | 'debitors', fileName: string, message: ChatMessage) => void;
  clearChat: (workspace: 'sales' | 'debitors', fileName: string) => void;
  setChatHistory: (workspace: 'sales' | 'debitors', fileName: string, history: ChatMessage[]) => void;
}

export const useAccountingStore = create<AccountingState>((set, get) => {
  // Initialize from sessionStorage safely on client side
  const initialToken = typeof window !== 'undefined' ? (sessionStorage.getItem('app_session_token') || '') : '';

  return {
    appSessionToken: initialToken,
    activeWorkspace: 'sales',
    activeView: 'portal',
    chatHistories: {},

    setToken: (token) => {
      sessionStorage.setItem('app_session_token', token);
      set({ appSessionToken: token });
    },
    clearToken: () => {
      sessionStorage.removeItem('app_session_token');
      set({ appSessionToken: '' });
    },
    setActiveWorkspace: (workspace) => {
      set({ activeWorkspace: workspace });
    },
    setActiveView: (view) => {
      set({ activeView: view });
    },
    getChatHistory: (workspace, fileName) => {
      const state = get();
      const key = `chat:${workspace}:${fileName}`;
      if (state.chatHistories[key]) {
        return state.chatHistories[key];
      }

      const keyStorage = `chat:${workspace}:${fileName}`;
      let history: ChatMessage[] = [];
      try {
        const stored = localStorage.getItem(keyStorage);
        history = stored ? JSON.parse(stored) : [];
      } catch {
        // ignore
      }
      return history;
    },
    loadChatHistory: (workspace, fileName, businessName) => {
      const key = `chat:${workspace}:${fileName}`;
      const state = get();
      if (state.chatHistories[key] && state.chatHistories[key].length > 0) return;

      const keyStorage = `chat:${workspace}:${fileName}`;
      let history: ChatMessage[] = [];
      try {
        const stored = localStorage.getItem(keyStorage);
        history = stored ? JSON.parse(stored) : [];
      } catch {
        // ignore
      }

      if (history.length === 0) {
        history = [
          {
            sender: 'ai',
            text: `Namaskar! 🙏 I am your ${businessName} Financial Advisor. I have analyzed your parsed spreadsheet "${fileName}". How can I help you optimize your business cashflows or recover customer dues today?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ];
        try {
          localStorage.setItem(keyStorage, JSON.stringify(history));
        } catch {
          // ignore
        }
      }

      set((state) => ({
        chatHistories: {
          ...state.chatHistories,
          [key]: history,
        },
      }));
    },
    addChatMessage: (workspace, fileName, message) => {
      const key = `chat:${workspace}:${fileName}`;
      const keyStorage = `chat:${workspace}:${fileName}`;
      set((state) => {
        const current = state.chatHistories[key] || [];
        const updated = [...current, message];
        localStorage.setItem(keyStorage, JSON.stringify(updated));
        return {
          chatHistories: {
            ...state.chatHistories,
            [key]: updated,
          },
        };
      });
    },
    clearChat: (workspace, fileName) => {
      const key = `chat:${workspace}:${fileName}`;
      const keyStorage = `chat:${workspace}:${fileName}`;
      localStorage.removeItem(keyStorage);
      set((state) => ({
        chatHistories: {
          ...state.chatHistories,
          [key]: [],
        },
      }));
    },
    setChatHistory: (workspace, fileName, history) => {
      const key = `chat:${workspace}:${fileName}`;
      const keyStorage = `chat:${workspace}:${fileName}`;
      localStorage.setItem(keyStorage, JSON.stringify(history));
      set((state) => ({
        chatHistories: {
          ...state.chatHistories,
          [key]: history,
        },
      }));
    },
  };
});
