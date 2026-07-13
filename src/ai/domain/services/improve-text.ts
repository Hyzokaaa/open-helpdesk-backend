import { AIService } from '../ai.service';

interface ImproveTextProps {
  text: string;
  language?: string;
}

export class ImproveText {
  constructor(private readonly ai: AIService) {}

  async execute(props: ImproveTextProps): Promise<string> {
    const lang = props.language ?? 'the same language as the input';

    const result = await this.ai.complete({
      messages: [
        {
          role: 'system',
          content: `You are a text editor. Fix spelling, grammar, and improve readability. Keep the original meaning, tone, and intent intact. Do not add new information. Respond only with the corrected text in ${lang}, nothing else.`,
        },
        { role: 'user', content: props.text },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    });

    return result.content;
  }
}
