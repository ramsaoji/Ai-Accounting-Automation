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
  } catch (err) {
    console.warn('AI Chat API offline. Falling back to local offline heuristic reasoning engine.', err);
    return generateOfflineHeuristicResponse(message, isDebitors, summary);
  }
}
