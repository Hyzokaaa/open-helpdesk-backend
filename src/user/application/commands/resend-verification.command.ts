import { Command } from '../../../shared/domain/command';
import { TokenService } from '../../../shared/domain/token-service';
import { EmailService } from '../../../email/domain/email.service';
import { RecordEmailSend } from '../../../audit-log/domain/services/audit-log-record-email-send';
import { UserRepository } from '../../domain/repositories/user.repository';
import { EmailVerificationTemplate } from '../../../email/templates/email-verification.template';
import { EntityNotFoundError } from '../../../shared/domain/errors';

interface Props {
  userId: string;
  frontendUrl: string;
}

export class ResendVerificationCommand implements Command<Props, void> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly recordEmailSend?: RecordEmailSend,
  ) {}

  async execute(props: Props): Promise<void> {
    const user = await this.userRepository.findById(props.userId);
    if (!user) {
      throw new EntityNotFoundError('User not found');
    }

    if (user.isEmailVerified) return;

    const token = this.tokenService.sign(
      { sub: user.getId(), type: 'email-verification' },
      { expiresIn: '24h' },
    );

    const verificationUrl = `${props.frontendUrl}/verify-email?token=${token}`;
    const template = new EmailVerificationTemplate();

    const subject = template.subject({ firstName: user.firstName, verificationUrl, lang: user.language });
    const sent = await this.emailService.send({
      to: user.email,
      subject,
      html: template.html({ firstName: user.firstName, verificationUrl, lang: user.language }),
    });
    // System log; the link carries the token, so only the subject
    await this.recordEmailSend?.execute({
      result: sent, type: 'email-verification', to: user.email, subject, workspaceId: null, entityType: 'user', entityId: user.getId(), userId: user.getId(),
    });
  }
}
