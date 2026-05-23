import { AiProvider } from './ai.types.js';
import { OpenAiProvider } from './providers/openai.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { ClaudeProvider } from './providers/claude.provider.js';
import { OllamaProvider } from './providers/ollama.provider.js';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

export class AiProviderFactory {
  /**
   * Instantiates and returns the configured AI provider based on environment variables.
   */
  static createProvider(): AiProvider {
    const providerName = config.AI_PROVIDER.toLowerCase();
    
    logger.info({ providerName }, 'AI Provider Factory creating provider instance');

    switch (providerName) {
      case 'openai':
        return new OpenAiProvider(
          'openai', 
          'https://api.openai.com/v1/chat/completions', 
          'OPENAI_API_KEY'
        );
      case 'deepseek':
        return new OpenAiProvider(
          'deepseek', 
          'https://api.deepseek.com/chat/completions', 
          'DEEPSEEK_API_KEY'
        );
      case 'openrouter':
        return new OpenAiProvider(
          'openrouter', 
          'https://openrouter.ai/api/v1/chat/completions', 
          'OPENROUTER_API_KEY'
        );
      case 'groq':
        return new OpenAiProvider(
          'groq',
          'https://api.groq.com/openai/v1/chat/completions',
          'GROQ_API_KEY'
        );
      case 'gemini':
        return new GeminiProvider();
      case 'claude':
        return new ClaudeProvider();
      case 'ollama':
        return new OllamaProvider();
      default:
        logger.warn({ providerName }, 'Unknown provider specified, falling back to Google Gemini');
        return new GeminiProvider();
    }
  }
}
