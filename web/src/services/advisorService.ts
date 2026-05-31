import { sendAdvisorChatMessage as apiSendAdvisorChatMessage } from './api';
import { generateOfflineHeuristicResponse } from './chatHeuristics';
import type { MasterSummary } from '../types';

/**
 * Handles sending chat messages to the advisor backend, falling back to offline heuristics if network fails.
 */
export async function sendAdvisorChatMessage(
  message: string,
  isDebitors: boolean,
  summary: MasterSummary,
  history: { sender: 'user' | 'ai'; text: string }[]
): Promise<string> {
  try {
    return await apiSendAdvisorChatMessage(message, isDebitors, history);
  } catch (err: any) {
    console.warn('AI Chat API offline or disabled.', err);
    const errMsg = err?.message || '';
    if (errMsg.includes('disabled by configuration') || errMsg.includes('AI advisor chat is disabled')) {
      return `[AI-OFFLINE]`;
    }
    const offlineResponse = generateOfflineHeuristicResponse(message, isDebitors, summary);
    return `[LEDGER-ANALYSIS] ${offlineResponse}`;
  }
}
