import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSystemSetting, setSystemSetting, getAuditPolicySetting, setAuditPolicySetting } from '../../db/db.client.js';
import { config } from '../../config/config.js';
import { z } from 'zod';

export const updateSettingsSchema = z.object({
  webChatEnabled: z.boolean().optional(),
  telegramChatEnabled: z.boolean().optional(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
  ruleHighExpenseCeiling: z.number().optional(),
  ruleSuspiciousSpikeMultiplier: z.number().optional(),
  ruleOutstandingCreditCap: z.number().optional(),
});

function getAvailableProviders(): string[] {
  const available: string[] = ['none']; // none is always available

  const {
    OPENAI_API_KEY,
    GEMINI_API_KEY,
    CLAUDE_API_KEY,
    DEEPSEEK_API_KEY,
    GROQ_API_KEY,
    OPENROUTER_API_KEY,
  } = config;

  if (OPENAI_API_KEY && !OPENAI_API_KEY.includes('your_') && OPENAI_API_KEY.trim() !== '') {
    available.push('openai');
  }
  if (GEMINI_API_KEY && !GEMINI_API_KEY.includes('your_') && GEMINI_API_KEY.trim() !== '') {
    available.push('gemini');
  }
  if (CLAUDE_API_KEY && !CLAUDE_API_KEY.includes('your_') && CLAUDE_API_KEY.trim() !== '') {
    available.push('claude');
  }
  if (DEEPSEEK_API_KEY && !DEEPSEEK_API_KEY.includes('your_') && DEEPSEEK_API_KEY.trim() !== '') {
    available.push('deepseek');
  }
  if (GROQ_API_KEY && !GROQ_API_KEY.includes('your_') && GROQ_API_KEY.trim() !== '') {
    available.push('groq');
  }
  if (OPENROUTER_API_KEY && !OPENROUTER_API_KEY.includes('your_') && OPENROUTER_API_KEY.trim() !== '') {
    available.push('openrouter');
  }

  return available;
}

interface SettingsQuery {
  fileType?: string;
  fileName?: string;
}

export async function getSettings(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const query = request.query as SettingsQuery;
    const fileType = query.fileType || 'sales';
    const fileName = query.fileName || undefined;

    const webEnabledStr = await getSystemSetting('web_chat_enabled', 'true');
    const telegramEnabledStr = await getSystemSetting('telegram_chat_enabled', 'true');
    const aiProvider = await getSystemSetting('ai_provider', config.AI_PROVIDER);
    const aiModel = await getSystemSetting('ai_model', config.AI_MODEL);

    const ruleHighExpenseCeilingStr = await getAuditPolicySetting(fileType, fileName, 'ruleHighExpenseCeiling', '50000');
    const ruleSuspiciousSpikeMultiplierStr = await getAuditPolicySetting(fileType, fileName, 'ruleSuspiciousSpikeMultiplier', '3');
    const ruleOutstandingCreditCapStr = await getAuditPolicySetting(fileType, fileName, 'ruleOutstandingCreditCap', '100000');

    reply.code(200).send({
      webChatEnabled: webEnabledStr === 'true',
      telegramChatEnabled: telegramEnabledStr === 'true',
      aiProvider,
      aiModel,
      availableProviders: getAvailableProviders(),
      ruleHighExpenseCeiling: Number(ruleHighExpenseCeilingStr) || 50000,
      ruleSuspiciousSpikeMultiplier: Number(ruleSuspiciousSpikeMultiplierStr) || 3,
      ruleOutstandingCreditCap: Number(ruleOutstandingCreditCapStr) || 100000,
    });
  } catch (error: any) {
    reply.code(500).send({ error: 'Failed to retrieve system settings' });
  }
}

export async function updateSettings(
  request: FastifyRequest<{ Body: { 
    webChatEnabled?: boolean; 
    telegramChatEnabled?: boolean; 
    aiProvider?: string; 
    aiModel?: string;
    ruleHighExpenseCeiling?: number;
    ruleSuspiciousSpikeMultiplier?: number;
    ruleOutstandingCreditCap?: number;
  } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { 
      webChatEnabled, 
      telegramChatEnabled, 
      aiProvider, 
      aiModel,
      ruleHighExpenseCeiling,
      ruleSuspiciousSpikeMultiplier,
      ruleOutstandingCreditCap
    } = request.body;

    const query = request.query as SettingsQuery;
    const fileType = query.fileType || 'sales';
    const fileName = query.fileName || undefined;
    
    if (aiProvider !== undefined) {
      await setSystemSetting('ai_provider', aiProvider);
    }
    if (aiModel !== undefined) {
      await setSystemSetting('ai_model', aiModel);
    }

    if (ruleHighExpenseCeiling !== undefined) {
      await setAuditPolicySetting(fileType, fileName, 'RULE_002', 'ruleHighExpenseCeiling', String(ruleHighExpenseCeiling));
    }
    if (ruleSuspiciousSpikeMultiplier !== undefined) {
      await setAuditPolicySetting(fileType, fileName, 'RULE_003', 'ruleSuspiciousSpikeMultiplier', String(ruleSuspiciousSpikeMultiplier));
    }
    if (ruleOutstandingCreditCap !== undefined) {
      await setAuditPolicySetting(fileType, fileName, 'RULE_008', 'ruleOutstandingCreditCap', String(ruleOutstandingCreditCap));
    }

    const activeProvider = await getSystemSetting('ai_provider', config.AI_PROVIDER);
    const activeModel = await getSystemSetting('ai_model', config.AI_MODEL);

    const isAiConfigured = activeProvider !== 'none' && activeModel && activeModel !== 'none' && activeModel.trim() !== '';

    let finalWebChat = webChatEnabled;
    let finalTelegramChat = telegramChatEnabled;

    if (!isAiConfigured) {
      finalWebChat = false;
      finalTelegramChat = false;
    }

    if (finalWebChat !== undefined) {
      await setSystemSetting('web_chat_enabled', finalWebChat ? 'true' : 'false');
    } else if (!isAiConfigured) {
      await setSystemSetting('web_chat_enabled', 'false');
    }

    if (finalTelegramChat !== undefined) {
      await setSystemSetting('telegram_chat_enabled', finalTelegramChat ? 'true' : 'false');
    } else if (!isAiConfigured) {
      await setSystemSetting('telegram_chat_enabled', 'false');
    }

    const webEnabledStr = await getSystemSetting('web_chat_enabled', 'true');
    const telegramEnabledStr = await getSystemSetting('telegram_chat_enabled', 'true');
    const ruleHighExpenseCeilingStr = await getAuditPolicySetting(fileType, fileName, 'ruleHighExpenseCeiling', '50000');
    const ruleSuspiciousSpikeMultiplierStr = await getAuditPolicySetting(fileType, fileName, 'ruleSuspiciousSpikeMultiplier', '3');
    const ruleOutstandingCreditCapStr = await getAuditPolicySetting(fileType, fileName, 'ruleOutstandingCreditCap', '100000');

    reply.code(200).send({
      success: true,
      webChatEnabled: webEnabledStr === 'true',
      telegramChatEnabled: telegramEnabledStr === 'true',
      aiProvider: activeProvider,
      aiModel: activeModel,
      availableProviders: getAvailableProviders(),
      ruleHighExpenseCeiling: Number(ruleHighExpenseCeilingStr) || 50000,
      ruleSuspiciousSpikeMultiplier: Number(ruleSuspiciousSpikeMultiplierStr) || 3,
      ruleOutstandingCreditCap: Number(ruleOutstandingCreditCapStr) || 100000,
    });
  } catch (error: any) {
    reply.code(500).send({ error: 'Failed to update system settings' });
  }
}
