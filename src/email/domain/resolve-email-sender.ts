import { Logger } from '@nestjs/common';
import { EmailService, SendEmailParams } from './email.service';
import { WorkspaceEmailSender } from '../../workspace/domain/entities/workspace-email-sender';
import { sendViaWorkspaceSmtp } from './workspace-email-send';

const logger = new Logger('ResolveEmailSender');

export async function sendWorkspaceEmail(
  globalService: EmailService,
  sender: WorkspaceEmailSender | null,
  params: SendEmailParams,
): Promise<void> {
  if (sender) {
    const config = sender.getSmtpConfig();
    const result = await sendViaWorkspaceSmtp(config, { ...params, from: config.from });
    if (result.success) return;
    logger.warn(`Workspace SMTP failed for ${sender.smtpFrom}, falling back to global`);
  }
  await globalService.send(params);
}
