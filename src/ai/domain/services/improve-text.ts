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
          content: `You are a text proofreader for a helpdesk ticketing system. Your ONLY job is to fix spelling and grammar mistakes in the user's text. Rules: 1) NEVER add new content, explanations, or expand on the topic. 2) NEVER change the meaning or length significantly. 3) If the text is already correct, return it unchanged. 4) Output ONLY the corrected text in ${lang}, nothing else.`,
        },
        { role: 'user', content: props.text },
      ],
      temperature: 0.1,
      maxTokens: 500,
    });

    return result.content;
  }
}
