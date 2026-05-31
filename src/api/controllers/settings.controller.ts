import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSystemSetting, setSystemSetting } from '../../db/db.client.js';
import { config } from '../../config/config.js';
import { z } from 'zod';

export const updateSettingsSchema = z.object({
  webChatEnabled: z.boolean().optional(),
  telegramChatEnabled: z.boolean().optional(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
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

export async function getSettings(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const webEnabledStr = await getSystemSetting('web_chat_enabled', 'true');
    const telegramEnabledStr = await getSystemSetting('telegram_chat_enabled', 'true');
    const aiProvider = await getSystemSetting('ai_provider', config.AI_PROVIDER);
    const aiModel = await getSystemSetting('ai_model', config.AI_MODEL);

    reply.code(200).send({
      webChatEnabled: webEnabledStr === 'true',
      telegramChatEnabled: telegramEnabledStr === 'true',
      aiProvider,
      aiModel,
      availableProviders: getAvailableProviders(),
    });
  } catch (error: any) {
    reply.code(500).send({ error: 'Failed to retrieve system settings' });
  }
}

export async function updateSettings(
  request: FastifyRequest<{ Body: { webChatEnabled?: boolean; telegramChatEnabled?: boolean; aiProvider?: string; aiModel?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { webChatEnabled, telegramChatEnabled, aiProvider, aiModel } = request.body;
    
    if (aiProvider !== undefined) {
      await setSystemSetting('ai_provider', aiProvider);
    }
    if (aiModel !== undefined) {
      await setSystemSetting('ai_model', aiModel);
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

    reply.code(200).send({
      success: true,
      webChatEnabled: webEnabledStr === 'true',
      telegramChatEnabled: telegramEnabledStr === 'true',
      aiProvider: activeProvider,
      aiModel: activeModel,
      availableProviders: getAvailableProviders(),
    });
  } catch (error: any) {
    reply.code(500).send({ error: 'Failed to update system settings' });
  }
}
