import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { SkipEmailVerification } from '../../../../shared/nest/decorators/skip-email-verification.decorator';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { JwtTokenService } from '../../../../shared/infrastructure/jwt-token-service';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EmailService } from '../../../../email/domain/email.service';
import { EMAIL_SERVICE } from '../../../../email/email.constants';
import { AuthenticateUser } from '../../../domain/services/user-authenticate';
import { AuthenticateOAuth } from '../../../domain/services/user-authenticate-oauth';
import { RequestPasswordReset } from '../../../domain/services/user-request-password-reset';
import { ResetPassword } from '../../../domain/services/user-reset-password';
import { VerifyEmail } from '../../../domain/services/user-verify-email';
import { LoginUserCommand } from '../../../application/commands/login-user.command';
import { OAuthLoginCommand } from '../../../application/commands/oauth-login.command';
import { RequestPasswordResetCommand } from '../../../application/commands/request-password-reset.command';
import { ResetPasswordCommand } from '../../../application/commands/reset-password.command';
import { VerifyEmailCommand } from '../../../application/commands/verify-email.command';
import { ResendVerificationCommand } from '../../../application/commands/resend-verification.command';
import { TypeOrmUserRepository } from '../../typeorm/repositories/typeorm-user.repository';
import { LoginUserRequest } from '../dto/login-user.request';
import { SignupUserRequest } from '../dto/signup-user.request';
import { GoogleAuthGuard } from '../../../../shared/nest/guards/google-auth.guard';
import { MicrosoftAuthGuard } from '../../../../shared/nest/guards/microsoft-auth.guard';
import { CreateUser } from '../../../domain/services/user-create';
import { CreateAccountForUser } from '../../../../account/domain/services/account-create-for-user';
import { AcceptInvitation } from '../../../../workspace/domain/services/invitation-accept';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { SignupUserCommand } from '../../../application/commands/signup-user.command';
import { TypeOrmAccountRepository } from '../../../../account/infrastructure/typeorm/repositories/typeorm-account.repository';
import { TypeOrmWorkspaceInvitationRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-invitation.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { resolveFrontendUrl } from '../../../../shared/infrastructure/resolve-frontend-url';

@Controller('auth')
export class AuthController {
  private readonly frontendUrl: string;
  private readonly allowedFrontendUrls: string[];
  private readonly googleEnabled: boolean;
  private readonly microsoftEnabled: boolean;

  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly tokenService: JwtTokenService,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    @Inject() private readonly accountRepository: TypeOrmAccountRepository,
    @Inject() private readonly invitationRepository: TypeOrmWorkspaceInvitationRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
    const corsOrigins = config.get('CORS_ORIGINS', this.frontendUrl);
    this.allowedFrontendUrls = corsOrigins.split(',').map((u: string) => u.trim());
    this.googleEnabled = !!config.get('GOOGLE_CLIENT_ID');
    this.microsoftEnabled = !!config.get('MICROSOFT_CLIENT_ID');
  }

  @Public()
  @Get('providers')
  getProviders() {
    return {
      google: this.googleEnabled,
      microsoft: this.microsoftEnabled,
    };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  async login(@Body() body: LoginUserRequest) {
    const service = new AuthenticateUser(this.userRepository, this.passwordHasher);
    const command = new LoginUserCommand(service, this.tokenService);
    const result = await command.execute({
      email: body.email,
      password: body.password,
    });

    const user = await this.userRepository.findByEmail(body.email);
    if (user) {
      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.USER_LOGGED_IN,
        entityType: 'user',
        entityId: user.getId(),
        userId: user.getId(),
        workspaceId: null,
        metadata: { email: user.email },
        category: AuditCategory.USER,
        level: AuditLevel.INFO,
        source: 'ui',
      });
    }

    return result;
  }

  @Public()
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  @Post('signup')
  signup(@Body() body: SignupUserRequest) {
    const createUser = new CreateUser(this.idGenerator, this.userRepository, this.passwordHasher);
    const createAccount = new CreateAccountForUser(this.idGenerator, this.accountRepository);
    const acceptInvitation = new AcceptInvitation(this.idGenerator, this.invitationRepository, this.memberRepository);
    const createAuditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new SignupUserCommand(
      createUser, createAccount, acceptInvitation,
      this.invitationRepository, this.tokenService, createAuditLog,
    );
    return command.execute({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      invitationToken: body.invitationToken,
    });
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }, @Req() req: Request) {
    const frontendUrl = resolveFrontendUrl(req, this.allowedFrontendUrls, this.frontendUrl);
    const service = new RequestPasswordReset(this.userRepository);
    const command = new RequestPasswordResetCommand(service, this.tokenService, this.emailService);
    await command.execute({ email: body.email, frontendUrl });

    const user = await this.userRepository.findByEmail(body.email);
    if (user) {
      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.USER_FORGOT_PASSWORD,
        entityType: 'user',
        entityId: user.getId(),
        userId: user.getId(),
        workspaceId: null,
        metadata: { email: body.email },
        category: AuditCategory.USER,
        level: AuditLevel.INFO,
        source: 'ui',
      });
    }

    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    const service = new ResetPassword(this.userRepository, this.passwordHasher);
    const command = new ResetPasswordCommand(service, this.tokenService);
    await command.execute({ token: body.token, newPassword: body.newPassword });

    let userId: string | null = null;
    try {
      const payload = this.tokenService.verify<{ sub: string }>(body.token);
      userId = payload.sub;
    } catch { /* token already consumed, best effort */ }

    if (userId) {
      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.USER_RESET_PASSWORD,
        entityType: 'user',
        entityId: userId,
        userId,
        workspaceId: null,
        metadata: { userId },
        category: AuditCategory.USER,
        level: AuditLevel.INFO,
        source: 'ui',
      });
    }

    return { message: 'Password has been reset' };
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() body: { token: string }) {
    const service = new VerifyEmail(this.userRepository);
    const command = new VerifyEmailCommand(service, this.tokenService);
    await command.execute({ token: body.token });

    let userId: string | null = null;
    try {
      const payload = this.tokenService.verify<{ sub: string }>(body.token);
      userId = payload.sub;
    } catch { /* token already consumed, best effort */ }

    if (userId) {
      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.USER_EMAIL_VERIFIED,
        entityType: 'user',
        entityId: userId,
        userId,
        workspaceId: null,
        metadata: { userId },
        category: AuditCategory.USER,
        level: AuditLevel.INFO,
        source: 'ui',
      });
    }

    return { message: 'Email verified' };
  }

  @SkipEmailVerification()
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  @Post('resend-verification')
  async resendVerification(@CurrentUser() user: AuthUser, @Req() req: Request) {
    const frontendUrl = resolveFrontendUrl(req, this.allowedFrontendUrls, this.frontendUrl);
    const command = new ResendVerificationCommand(
      this.userRepository,
      this.tokenService,
      this.emailService,
    );
    await command.execute({ userId: user.userId, frontendUrl });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.USER_RESEND_VERIFICATION,
      entityType: 'user',
      entityId: user.userId,
      userId: user.userId,
      workspaceId: null,
      metadata: { email: user.email },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { message: 'Verification email sent' };
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // Guard redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleOAuthCallback(req, res);
  }

  @Public()
  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  microsoftLogin() {
    // Guard redirects to Microsoft
  }

  @Public()
  @Get('microsoft/callback')
  @UseGuards(MicrosoftAuthGuard)
  async microsoftCallback(@Req() req: Request, @Res() res: Response) {
    return this.handleOAuthCallback(req, res);
  }

  private async handleOAuthCallback(req: Request, res: Response) {
    const oauthUser = req.user as { email: string; firstName: string; lastName: string; authProvider: string };
    const redirectUrl = this.resolveRedirectUrl(req.query?.state as string);

    try {
      const service = new AuthenticateOAuth(this.idGenerator, this.userRepository, this.passwordHasher);
      const command = new OAuthLoginCommand(service, this.tokenService);
      const result = await command.execute({
        email: oauthUser.email,
        firstName: oauthUser.firstName,
        lastName: oauthUser.lastName,
        authProvider: oauthUser.authProvider,
      });

      const user = await this.userRepository.findByEmail(oauthUser.email);
      if (user) {
        const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
        await auditLog.execute({
          action: AuditAction.USER_OAUTH_LOGIN,
          entityType: 'user',
          entityId: user.getId(),
          userId: user.getId(),
          workspaceId: null,
          metadata: { provider: oauthUser.authProvider, email: oauthUser.email },
          category: AuditCategory.USER,
          level: AuditLevel.INFO,
          source: 'ui',
        });
      }

      return res.redirect(`${redirectUrl}/auth/callback?token=${result.accessToken}`);
    } catch {
      return res.redirect(`${redirectUrl}/login?error=oauth_failed`);
    }
  }

  private resolveRedirectUrl(state?: string): string {
    if (state && this.allowedFrontendUrls.includes(state)) {
      return state;
    }
    return this.frontendUrl;
  }
}
