import { TokenService } from '../../../shared/domain/token-service';
import { Command } from '../../../shared/domain/command';
import { EmailService } from '../../../email/domain/email.service';
import { RecordEmailSend } from '../../../audit-log/domain/services/audit-log-record-email-send';
import { RequestPasswordReset } from '../../domain/services/user-request-password-reset';
import { PasswordResetTemplate } from '../../../email/templates/password-reset.template';
import { newTokenId } from '../../domain/services/user-token-consume';
import { PASSWORD_RESET_TYPE } from './reset-password.command';

interface Props {
  email: string;
  frontendUrl: string;
}

export class RequestPasswordResetCommand implements Command<Props, void> {
  constructor(
    private readonly requestReset: RequestPasswordReset,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly recordEmailSend?: RecordEmailSend,
  ) {}

  async execute(props: Props): Promise<void> {
    const result = await this.requestReset.execute({ email: props.email });
    if (!result) return;

    const token = this.tokenService.sign(
      { sub: result.userId, type: PASSWORD_RESET_TYPE, jti: newTokenId() },
      { expiresIn: '1h' },
    );

    const resetUrl = `${props.frontendUrl}/reset-password?token=${token}`;
    const template = new PasswordResetTemplate();
    const data = {
      firstName: result.firstName,
      resetUrl,
      lang: result.language,
    };

    const subject = template.subject(data);
    const sent = await this.emailService.send({
      to: result.email,
      subject,
      html: template.html(data),
    });
    // System log, on the account and with no actor; the link carries the token, so only the subject
    await this.recordEmailSend?.execute({
      result: sent, type: 'password-reset', to: result.email, subject, workspaceId: null, entityType: 'user', entityId: result.userId,
    });
  }
}
