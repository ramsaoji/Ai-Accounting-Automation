import axios from 'axios';
import { AiOptions, AiProvider } from '../ai.types.js';
import { config } from '../../config/config.js';
import { logger } from '../../logger/logger.js';

export class GeminiProvider implements AiProvider {
  readonly id = 'gemini';

  async generateText(prompt: string, options?: AiOptions): Promise<string> {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not defined');
    }

    // Default model if not overridden
    const model = options?.model || config.AI_MODEL || 'gemini-1.5-flash';
    const temperature = options?.temperature ?? 0.2;
    const maxTokens = options?.maxTokens ?? 1500;

    logger.info({ provider: this.id, model, temperature }, 'Generating text via Gemini API');

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await axios.post(
        url,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API returned an empty completion response');
      }

      const finishReason = response.data?.candidates?.[0]?.finishReason;
      const safetyRatings = response.data?.candidates?.[0]?.safetyRatings;

      logger.info(
        { 
          textLength: text.length,
          finishReason,
          safetyRatings: safetyRatings ? JSON.stringify(safetyRatings) : undefined,
          startSlice: text.substring(0, 150),
          endSlice: text.substring(text.length - 150)
        }, 
        'Gemini API response character analysis'
      );

      return text;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(
          {
            status: error.response?.status,
            data: JSON.stringify(error.response?.data),
            message: error.message,
          },
          'Gemini API communication failure'
        );
        const detailedErr = error.response?.data?.[0]?.error?.message || error.message;
        throw new Error(`Gemini API failed: ${detailedErr}`);
      }
      throw error;
    }
  }
}
