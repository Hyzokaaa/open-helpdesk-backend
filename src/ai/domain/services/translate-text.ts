import { AIService } from '../ai.service';

interface TranslateTextProps {
  text: string;
  targetLanguage: string;
}

export class TranslateText {
  constructor(private readonly ai: AIService) {}

  async execute(props: TranslateTextProps): Promise<string> {
    const result = await this.ai.complete({
      messages: [
        {
          role: 'system',
          content: `You are a translator. Translate the following text to ${props.targetLanguage}. Preserve the original tone, intent, and formatting. If the text is already in ${props.targetLanguage}, return it unchanged. Respond only with the translated text, nothing else.`,
        },
        { role: 'user', content: props.text },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    });

    return result.content;
  }
}
