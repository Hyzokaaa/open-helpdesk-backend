import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailService,
  SendEmailParams,
  SendEmailResult,
} from '../domain/email.service';

export class ResendEmailService implements EmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly apiKey: string | null;
  private readonly defaultFrom: string;
  private readonly maxRetries = 3;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('EMAIL_API_KEY') || null;
    this.defaultFrom =
      config.get<string>('EMAIL_FROM') || 'noreply@example.com';

    if (this.apiKey) {
      this.logger.log('Resend email service initialized');
    } else {
      this.logger.warn(
        'EMAIL_API_KEY not set, emails will be logged only',
      );
    }
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const recipient = Array.isArray(params.to)
      ? params.to.join(', ')
      : params.to;
    const sender = params.from || this.defaultFrom;

    if (!this.apiKey) {
      this.logger.log(
        `[EMAIL MOCK] To: ${recipient} | Subject: ${params.subject}`,
      );
      return { success: true };
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const headers: Record<string, string> = {};
        if (params.messageId) headers['Message-ID'] = params.messageId;
        if (params.inReplyTo) headers['In-Reply-To'] = params.inReplyTo;
        if (params.references) headers['References'] = params.references;

        const body: Record<string, unknown> = {
          from: sender,
          to: Array.isArray(params.to) ? params.to : [params.to],
          subject: params.subject,
          html: params.html,
        };

        if (params.replyTo) body.reply_to = params.replyTo;
        if (Object.keys(headers).length > 0) body.headers = headers;

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Resend API error (${response.status}): ${errorBody}`);
        }

        this.logger.log(`Email sent to ${recipient}: ${params.subject}`);
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Email attempt ${attempt}/${this.maxRetries} failed for ${recipient}: ${msg}`,
        );

        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
        }
      }
    }

    return { success: false };
  }
}
