import { JwtService } from '@nestjs/jwt';
import { Command } from '../../../shared/domain/command';
import { EmailService } from '../../../email/domain/email.service';
import { RequestPasswordReset } from '../../domain/services/user-request-password-reset';
import { PasswordResetTemplate } from '../../../email/templates/password-reset.template';

interface Props {
  email: string;
  frontendUrl: string;
}

export class RequestPasswordResetCommand implements Command<Props, void> {
  constructor(
    private readonly requestReset: RequestPasswordReset,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async execute(props: Props): Promise<void> {
    const result = await this.requestReset.execute({ email: props.email });
    if (!result) return;

    const token = this.jwtService.sign(
      { sub: result.userId, type: 'password-reset' },
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
