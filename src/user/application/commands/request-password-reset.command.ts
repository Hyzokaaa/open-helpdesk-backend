import { TokenService } from '../../../shared/domain/token-service';
import { Command } from '../../../shared/domain/command';
import { EmailService } from '../../../email/domain/email.service';
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

    await this.emailService.send({
      to: result.email,
      subject: template.subject(data),
      html: template.html(data),
    });
  }
}
