export interface AiOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiProvider {
  readonly id: string;
  
  /**
   * Generates a string response from the AI provider for the given prompt.
   * Supports run-time option overrides such as custom model name and temperature.
   */
  generateText(prompt: string, options?: AiOptions): Promise<string>;
}
