import { Logger } from '@nestjs/common';
import { EmailService, SendEmailParams, SendEmailResult } from './email.service';
import { WorkspaceEmailSender } from '../../workspace/domain/entities/workspace-email-sender';
import { sendViaWorkspaceSmtp } from './workspace-email-send';

const logger = new Logger('ResolveEmailSender');

export async function sendWorkspaceEmail(
  globalService: EmailService,
  sender: WorkspaceEmailSender | null,
  params: SendEmailParams,
): Promise<SendEmailResult> {
  if (sender) {
    const config = sender.getSmtpConfig();
    const result = await sendViaWorkspaceSmtp(config, { ...params, from: config.from });
    if (!result.success) {
      logger.error(`Workspace SMTP failed for ${sender.smtpFrom}, email not sent`);
    }
    return result;
  }
  return await globalService.send(params);
}
