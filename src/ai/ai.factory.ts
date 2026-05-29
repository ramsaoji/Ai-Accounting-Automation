import { AiProvider } from './ai.types.js';
import { OpenAiProvider } from './providers/openai.provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { ClaudeProvider } from './providers/claude.provider.js';
import { OllamaProvider } from './providers/ollama.provider.js';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';

/** Maps provider name to the env variable name that must be set. Ollama uses a base URL, not a key. */
const PROVIDER_KEY_MAP: Record<string, { envVar: string; getValue: () => string | undefined }> = {
  openai:     { envVar: 'OPENAI_API_KEY',     getValue: () => config.OPENAI_API_KEY },
  deepseek:   { envVar: 'DEEPSEEK_API_KEY',   getValue: () => config.DEEPSEEK_API_KEY },
  openrouter: { envVar: 'OPENROUTER_API_KEY', getValue: () => config.OPENROUTER_API_KEY },
  groq:       { envVar: 'GROQ_API_KEY',       getValue: () => config.GROQ_API_KEY },
  gemini:     { envVar: 'GEMINI_API_KEY',     getValue: () => config.GEMINI_API_KEY },
  claude:     { envVar: 'CLAUDE_API_KEY',     getValue: () => config.CLAUDE_API_KEY },
  ollama:     { envVar: 'OLLAMA_BASE_URL',    getValue: () => config.OLLAMA_BASE_URL },
};

export class AiProviderFactory {
  /**
   * Validates that the configured AI provider has the required credentials available.
   * Logs a fatal error immediately at startup if the key is missing, rather than
   * discovering the problem when the first pipeline/cron run is triggered.
   */
  static validateProviderConfig(): void {
    const providerName = config.AI_PROVIDER.toLowerCase();
    const mapping = PROVIDER_KEY_MAP[providerName];

    if (!mapping) {
      logger.warn({ providerName }, 'Unknown AI_PROVIDER — no key validation performed. Will fall back to Gemini.');
      return;
    }

    const value = mapping.getValue();
    if (!value || value.trim() === '') {
      logger.fatal(
        { provider: providerName, envVar: mapping.envVar },
        `AI provider "${providerName}" is configured but the required credential "${mapping.envVar}" is missing or empty. ` +
        `Set this environment variable before starting the service, or change AI_PROVIDER to a provider whose key is available.`
      );
      // Non-fatal: service continues so other features (data retrieval, rules) still work
    } else {
      logger.info({ provider: providerName }, 'AI provider credentials validated successfully.');
    }
  }

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
