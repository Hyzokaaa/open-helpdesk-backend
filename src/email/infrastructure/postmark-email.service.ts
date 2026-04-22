import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';
import {
  EmailService,
  SendEmailParams,
  SendEmailResult,
} from '../domain/email.service';

export class PostmarkEmailService implements EmailService {
  private readonly logger = new Logger(PostmarkEmailService.name);
  private readonly client: postmark.ServerClient | null;
  private readonly defaultFrom: string;
  private readonly maxRetries = 3;

  constructor(private readonly config: ConfigService) {
    const token = config.get<string>('POSTMARK_SERVER_TOKEN');
    this.defaultFrom =
      config.get<string>('EMAIL_FROM') || 'noreply@example.com';

    if (token) {
      this.client = new postmark.ServerClient(token);
      this.logger.log('Postmark email service initialized');
    } else {
      this.client = null;
      this.logger.warn(
        'POSTMARK_SERVER_TOKEN not set, emails will be logged only',
      );
    }
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const recipient = Array.isArray(params.to)
      ? params.to.join(', ')
      : params.to;
    const sender = params.from || this.defaultFrom;

    if (!this.client) {
      this.logger.log(
        `[EMAIL MOCK] To: ${recipient} | Subject: ${params.subject}`,
      );
      return { success: true };
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.client.sendEmail({
          From: sender,
          To: recipient,
          Subject: params.subject,
          HtmlBody: params.html,
          TrackOpens: false,
          TrackLinks: postmark.Models.LinkTrackingOptions.None,
        });

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
