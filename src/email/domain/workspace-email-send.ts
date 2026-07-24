import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SmtpConfig } from '../../workspace/domain/entities/workspace-email-sender';
import { SendEmailParams, SendEmailResult } from './email.service';

const logger = new Logger('WorkspaceEmailSend');

export async function sendViaWorkspaceSmtp(config: SmtpConfig, params: SendEmailParams): Promise<SendEmailResult> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: { rejectUnauthorized: true },
    family: 4,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  } as any);

  const recipient = Array.isArray(params.to) ? params.to.join(', ') : params.to;

  try {
    await transporter.sendMail({
      from: params.from || config.from,
      to: recipient,
      subject: params.subject,
      html: params.html,
      ...(params.replyTo && { replyTo: params.replyTo }),
      ...(params.messageId && { messageId: params.messageId }),
      ...(params.inReplyTo && { inReplyTo: params.inReplyTo }),
      ...(params.references && { references: params.references }),
    });
    logger.log(`Email sent via workspace SMTP to ${recipient}: ${params.subject}`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Workspace SMTP send failed for ${recipient}: ${msg}`);
    return { success: false };
  }
}
