import { EmailService } from '../../../email/domain/email.service';
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
  deps: { tokenService: JwtTokenService; emailService: EmailService },
  users: WelcomedUser[],
  workspace: { name: string; frontendUrl: string },
): Promise<void> {
  for (const user of users) {
    const token = deps.tokenService.sign(
      { sub: user.userId, type: 'password-reset' },
      { expiresIn: '24h' },
    );
    try {
      await deps.emailService.send(importWelcomeEmail({
        to: user.email,
        firstName: user.firstName,
        workspaceName: workspace.name,
        resetUrl: `${workspace.frontendUrl}/reset-password?token=${token}`,
        workspaceUrl: workspace.frontendUrl,
        lang: 'en',
      }));
    } catch {
      // Email failure should not fail the import
    }
  }
}
