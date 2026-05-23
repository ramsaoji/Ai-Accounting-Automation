import axios from 'axios';
import { AiOptions, AiProvider } from '../ai.types.js';
import { config } from '../../config/config.js';
import { logger } from '../../logger/logger.js';

export class OpenAiProvider implements AiProvider {
  constructor(
    readonly id: string = 'openai',
    private readonly baseUrl: string = 'https://api.openai.com/v1/chat/completions',
    private readonly apiKeyName: 'OPENAI_API_KEY' | 'DEEPSEEK_API_KEY' | 'OPENROUTER_API_KEY' | 'GROQ_API_KEY' = 'OPENAI_API_KEY'
  ) {}

  async generateText(prompt: string, options?: AiOptions): Promise<string> {
    const apiKey = config[this.apiKeyName];
    if (!apiKey) {
      throw new Error(`API key for provider '${this.id}' (${this.apiKeyName}) is not defined in the environment variables`);
    }

    const model = options?.model || config.AI_MODEL;
    const temperature = options?.temperature ?? 0.2;
    const maxTokens = options?.maxTokens ?? 1500;

    logger.info(
      { 
        provider: this.id, 
        model, 
        temperature, 
        endpoint: this.baseUrl 
      }, 
      'Generating text via OpenAI-compatible API'
    );

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 45000, // 45 seconds timeout
        }
      );

      const text = response.data?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error(`${this.id} returned an empty completion response`);
      }

      return text;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(
          { 
            provider: this.id,
            status: error.response?.status, 
            data: error.response?.data,
            message: error.message 
          }, 
          `${this.id} API communication failure`
        );
        const detailedErr = error.response?.data?.error?.message || error.message;
        throw new Error(`${this.id} API failed: ${detailedErr}`);
      }
      throw error;
    }
  }
}
