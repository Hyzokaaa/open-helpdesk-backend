import { Injectable } from '@nestjs/common';
import { AIService, ChatCompletionOptions, ChatCompletionResult } from '../domain/ai.service';

@Injectable()
export class OpenAICompatibleAIService implements AIService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor() {
    this.apiKey = process.env.AI_API_KEY ?? '';
    this.baseUrl = process.env.AI_BASE_URL ?? 'https://api.groq.com/openai/v1';
    this.defaultModel = process.env.AI_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct';
  }

  async complete(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model ?? this.defaultModel,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_completion_tokens: options.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI provider error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content ?? '',
      model: data.model ?? options.model ?? this.defaultModel,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }
}
