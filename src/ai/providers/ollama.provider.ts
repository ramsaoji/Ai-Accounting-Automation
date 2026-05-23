import axios from 'axios';
import { AiOptions, AiProvider } from '../ai.types.js';
import { config } from '../../config/config.js';
import { logger } from '../../logger/logger.js';

export class OllamaProvider implements AiProvider {
  readonly id = 'ollama';

  async generateText(prompt: string, options?: AiOptions): Promise<string> {
    const model = options?.model || config.AI_MODEL || 'llama3';
    const temperature = options?.temperature ?? 0.2;
    const baseUrl = config.OLLAMA_BASE_URL || 'http://localhost:11434';

    logger.info({ provider: this.id, model, temperature, baseUrl }, 'Generating text via local Ollama');

    try {
      const response = await axios.post(
        `${baseUrl}/api/generate`,
        {
          model,
          prompt,
          stream: false,
          options: {
            temperature,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 90000, // Local inference can be slow, 90 seconds timeout
        }
      );

      const text = response.data?.response;
      if (!text) {
        throw new Error('Ollama returned an empty response');
      }

      return text;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(
          {
            status: error.response?.status,
            message: error.message,
          },
          'Ollama API connection failure'
        );
        throw new Error(`Ollama connection failed at ${baseUrl}: ${error.message}`);
      }
      throw error;
    }
  }
}
