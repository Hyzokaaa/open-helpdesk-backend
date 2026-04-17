import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EmailService,
  SendEmailParams,
  SendEmailResult,
} from '../domain/email.service';

@Injectable()
export class SmtpEmailService implements EmailService {
  private readonly logger = new Logger(SmtpEmailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly defaultFrom: string;
  private readonly maxRetries = 3;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = config.get<number>('SMTP_PORT', 465);
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    this.defaultFrom =
      config.get<string>('EMAIL_FROM') || 'noreply@dealernode.com';

    if (host && user && password) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass: password },
      });
      this.logger.log(`SMTP email service initialized (${host}:${port})`);
    } else {
      this.transporter = null;
      this.logger.warn(
        'SMTP_HOST/SMTP_USER/SMTP_PASSWORD not set, emails will be logged only',
      );
    }
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const recipient = Array.isArray(params.to)
      ? params.to.join(', ')
      : params.to;
    const sender = params.from || this.defaultFrom;

    if (!this.transporter) {
      this.logger.log(
        `[EMAIL MOCK] To: ${recipient} | Subject: ${params.subject}`,
      );
      return { success: true };
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.transporter.sendMail({
          from: sender,
          to: recipient,
          subject: params.subject,
          html: params.html,
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
