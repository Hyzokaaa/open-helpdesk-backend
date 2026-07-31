import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EmailService,
  SendEmailParams,
  SendEmailResult,
} from '../domain/email.service';
import { SystemEmailSettingsRepository } from '../../config/domain/repositories/system-email-settings.repository';

export class SmtpEmailService implements EmailService {
  private readonly logger = new Logger(SmtpEmailService.name);
  private readonly envTransporter: nodemailer.Transporter | null;
  private readonly defaultFrom: string;
  private readonly maxRetries = 3;

  private dbTransporter: nodemailer.Transporter | null = null;
  private dbFrom: string | null = null;
  private dbConfigHash: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly systemEmailRepo?: SystemEmailSettingsRepository,
  ) {
    const host = config.get<string>('SMTP_HOST');
    const port = config.get<number>('SMTP_PORT', 465);
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASS');
    this.defaultFrom =
      config.get<string>('EMAIL_FROM') || 'noreply@example.com';

    if (host && user && password) {
      const rejectUnauthorized = config.get<string>('SMTP_TLS_REJECT_UNAUTHORIZED', 'true') !== 'false';
      this.envTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass: password },
        tls: { rejectUnauthorized },
        family: 4,
      } as any);
      this.logger.log(`SMTP email service initialized (${host}:${port})`);
    } else {
      this.envTransporter = null;
      this.logger.warn(
        'SMTP_HOST/SMTP_USER/SMTP_PASSWORD not set, emails will be logged only (unless configured via Admin UI)',
      );
    }
  }

  private async resolveTransporter(): Promise<{ transporter: nodemailer.Transporter | null; from: string }> {
    if (this.systemEmailRepo) {
      try {
        const dbSettings = await this.systemEmailRepo.find();
        if (dbSettings) {
          const hash = `${dbSettings.smtpHost}:${dbSettings.smtpPort}:${dbSettings.smtpUser}:${dbSettings.smtpPass}`;
          if (hash !== this.dbConfigHash) {
            this.dbTransporter = nodemailer.createTransport({
              host: dbSettings.smtpHost,
              port: dbSettings.smtpPort,
              secure: dbSettings.smtpPort === 465,
              auth: { user: dbSettings.smtpUser, pass: dbSettings.smtpPass },
              family: 4,
            } as any);
            this.dbFrom = dbSettings.smtpFrom;
            this.dbConfigHash = hash;
            this.logger.log(`SMTP transporter updated from DB config (${dbSettings.smtpHost}:${dbSettings.smtpPort})`);
          }
          return { transporter: this.dbTransporter, from: this.dbFrom! };
        }
      } catch {
        // DB not available, fall through to env
      }
    }
    return { transporter: this.envTransporter, from: this.defaultFrom };
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const recipient = Array.isArray(params.to)
      ? params.to.join(', ')
      : params.to;

    const { transporter, from } = await this.resolveTransporter();
    const sender = params.from || from;

    if (!transporter) {
      this.logger.log(
        `[EMAIL MOCK] To: ${recipient} | Subject: ${params.subject}`,
      );
      return { success: true };
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await transporter.sendMail({
          from: sender,
          to: recipient,
          subject: params.subject,
          html: params.html,
          ...(params.replyTo && { replyTo: params.replyTo }),
          ...(params.messageId && { messageId: params.messageId }),
          ...(params.inReplyTo && { inReplyTo: params.inReplyTo }),
          ...(params.references && { references: params.references }),
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
