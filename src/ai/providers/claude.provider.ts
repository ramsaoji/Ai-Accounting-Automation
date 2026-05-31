import axios from 'axios';
import { AiOptions, AiProvider } from '../ai.types.js';
import { config } from '../../config/config.js';
import { logger } from '../../logger/logger.js';

export class ClaudeProvider implements AiProvider {
  readonly id = 'claude';

  constructor(private readonly modelOverride?: string) {}

  async generateText(prompt: string, options?: AiOptions): Promise<string> {
    const apiKey = config.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new Error('CLAUDE_API_KEY environment variable is not defined');
    }

    const model = this.modelOverride || options?.model || config.AI_MODEL || 'claude-3-5-sonnet-20240620';
    const temperature = options?.temperature ?? 0.2;
    const maxTokens = options?.maxTokens ?? 1500;

    logger.info({ provider: this.id, model, temperature }, 'Generating text via Claude API');

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          timeout: 45000,
        }
      );

      const text = response.data?.content?.[0]?.text;
      if (!text) {
        throw new Error('Claude API returned an empty content block');
      }

      return text;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(
          {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
          },
          'Claude API communication failure'
        );
        const detailedErr = error.response?.data?.error?.message || error.message;
        throw new Error(`Claude API failed: ${detailedErr}`);
      }
      throw error;
    }
  }
}
