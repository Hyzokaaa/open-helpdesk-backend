import { EmailService, SendEmailResult } from '../../../email/domain/email.service';
import { RecordEmailSend } from '../../../audit-log/domain/services/audit-log-record-email-send';
import { connectionErrorDetail } from '../../../shared/infrastructure/connection-error-detail';
import { importWelcomeEmail } from '../../../email/templates/import-welcome.template';
import { JwtTokenService } from '../../../shared/infrastructure/jwt-token-service';

interface WelcomedUser {
  userId: string;
  email: string;
  firstName: string;
}

/**
 * Imported accounts start without a usable password; each person gets a link to set their own,
 * valid for a day. After that, "forgot password" on the sign-in page does the same.
 */
export async function sendImportWelcomeEmails(
  deps: { tokenService: JwtTokenService; emailService: EmailService; recordEmailSend?: RecordEmailSend },
  users: WelcomedUser[],
  workspace: { name: string; frontendUrl: string; id?: string },
): Promise<void> {
  for (const user of users) {
    const token = deps.tokenService.sign(
      { sub: user.userId, type: 'password-reset' },
      { expiresIn: '24h' },
    );
    const params = importWelcomeEmail({
      to: user.email,
      firstName: user.firstName,
      workspaceName: workspace.name,
      resetUrl: `${workspace.frontendUrl}/reset-password?token=${token}`,
      workspaceUrl: workspace.frontendUrl,
      lang: 'en',
    });
    let result: SendEmailResult;
    try {
      result = await deps.emailService.send(params);
    } catch (err) {
      // Email failure should not fail the import
      result = { success: false, error: connectionErrorDetail(err) };
    }
    // The link carries a reset token: only the subject is recorded
    await deps.recordEmailSend?.execute({
      result, type: 'import-welcome', to: user.email, subject: params.subject,
      workspaceId: workspace.id ?? null, entityType: 'user', entityId: user.userId,
    });
  }
}
