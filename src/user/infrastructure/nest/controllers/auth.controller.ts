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
import { ResetPasswordRequest } from '../dto/reset-password.request';
import { GoogleAuthGuard } from '../../../../shared/nest/guards/google-auth.guard';
import { CreateUser } from '../../../domain/services/user-create';
import { CreateAccountForUser } from '../../../../account/domain/services/account-create-for-user';
import { AcceptInvitation } from '../../../../workspace/domain/services/invitation-accept';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { RecordAutoCreated } from '../../../../audit-log/domain/services/audit-log-record-auto-created';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { SignupUserCommand } from '../../../application/commands/signup-user.command';
import { TypeOrmAccountRepository } from '../../../../account/infrastructure/typeorm/repositories/typeorm-account.repository';
import { TypeOrmWorkspaceInvitationRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-invitation.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { resolveFrontendUrl } from '../../../../shared/infrastructure/resolve-frontend-url';
import { TypeOrmUserSessionRepository } from '../../typeorm/repositories/typeorm-user-session.repository';
import { TypeOrmUsedTokenRepository } from '../../typeorm/repositories/typeorm-used-token.repository';
import { ConsumeOneTimeToken } from '../../../domain/services/user-token-consume';
import { VerifyOAuthState } from '../../../domain/services/user-oauth-state';
import { OAUTH_NONCE_COOKIE, readOAuthNonce } from '../../../../shared/nest/guards/oauth-state';
import { SessionPolicy, StartUserSession } from '../../../domain/services/user-session-start';
import { SignAccessToken } from '../../../domain/services/user-session-sign-access-token';
import { RefreshUserSession } from '../../../domain/services/user-session-refresh';
import { EndUserSession } from '../../../domain/services/user-session-end';
import { RevokeUserSessions } from '../../../domain/services/user-sessions-revoke';
import { ExchangeOAuthCodeCommand } from '../../../application/commands/exchange-oauth-code.command';
import { RefreshSessionCommand } from '../../../application/commands/refresh-session.command';
import { LogoutCommand } from '../../../application/commands/logout.command';
import { ExchangeOAuthCodeRequest } from '../dto/exchange-oauth-code.request';
import { RefreshSessionRequest } from '../dto/refresh-session.request';
import { sessionPolicyFromConfig } from '../session-policy';
import { DomainError, InvalidCredentialsError } from '../../../../shared/domain/errors';
import { clientInfo } from '../../../../shared/nest/client-info';

@Controller('auth')
export class AuthController {
  private readonly frontendUrl: string;
  private readonly googleEnabled: boolean;
  private readonly sessionPolicy: SessionPolicy;

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
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly sessionRepository: TypeOrmUserSessionRepository,
    @Inject() private readonly usedTokenRepository: TypeOrmUsedTokenRepository,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
    this.googleEnabled = !!config.get('GOOGLE_CLIENT_ID');
    this.sessionPolicy = sessionPolicyFromConfig(config);
  }

  private createSignAccessToken(): SignAccessToken {
    return new SignAccessToken(this.tokenService, this.sessionPolicy.accessTokenTtl);
  }

  private createStartSession(): StartUserSession {
    return new StartUserSession(this.sessionRepository, this.idGenerator, this.createSignAccessToken(), this.sessionPolicy);
  }

  private async isVerifiedDomain(hostname: string): Promise<boolean> {
    const workspaces = await this.workspaceRepository.findByCustomDomain(hostname);
    return workspaces.some((w) => w.customDomainVerified);
  }

  @Public()
  @Get('providers')
  getProviders() {
    return {
      google: this.googleEnabled,
    };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  async login(@Body() body: LoginUserRequest, @Req() req: Request) {
    const service = new AuthenticateUser(this.userRepository, this.passwordHasher);
    const command = new LoginUserCommand(service, this.createStartSession());
    let result: Awaited<ReturnType<LoginUserCommand['execute']>>;
    try {
      result = await command.execute({
        email: body.email,
        password: body.password,
        rememberMe: body.rememberMe ?? false,
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) await this.auditLoginFailed(body.email, error.reason ?? null, req);
      throw error;
    }

    const user = await this.userRepository.findByEmail(body.email);
    if (user) {
      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.USER_LOGGED_IN,
        entityType: 'user',
        entityId: user.getId(),
        userId: user.getId(),
        workspaceId: null,
        metadata: { email: user.email, client: clientInfo(req) },
        category: AuditCategory.USER,
        level: AuditLevel.INFO,
        source: 'ui',
      });
    }

    return result;
  }

  /**
   * Every failed sign-in is kept, also for addresses with no account: a run of them is what an
   * attack looks like. Nobody is the actor (the attempt proves nothing about who made it); the
   * account, when there is one, is the entity.
   */
  private async auditLoginFailed(email: string, reason: string | null, req: Request): Promise<void> {
    const typed = String(email ?? '').trim().toLowerCase().slice(0, 254);
    const user = typed ? await this.userRepository.findByEmail(typed) : null;
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.USER_LOGIN_FAILED,
      entityType: 'user',
      entityId: user?.getId() ?? typed,
      userId: null,
      workspaceId: null,
      metadata: { email: typed, reason, client: clientInfo(req) },
      category: AuditCategory.USER,
      level: AuditLevel.WARNING,
      source: 'ui',
    }).catch(() => undefined);
  }

  private async auditOAuthLoginFailed(provider: string | null, email: string | null, reason: string, req: Request): Promise<void> {
    const user = email ? await this.userRepository.findByEmail(email) : null;
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.USER_OAUTH_LOGIN_FAILED,
      entityType: 'user',
      entityId: user?.getId() ?? email ?? 'unknown',
      userId: null,
      workspaceId: null,
      metadata: { provider, email, reason, client: clientInfo(req) },
      category: AuditCategory.USER,
      level: AuditLevel.WARNING,
      source: 'ui',
    }).catch(() => undefined);
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
      this.invitationRepository, this.createStartSession(), createAuditLog,
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
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('oauth/exchange')
  exchangeOAuthCode(@Body() body: ExchangeOAuthCodeRequest) {
    const consumeToken = new ConsumeOneTimeToken(this.tokenService, this.usedTokenRepository);
    const command = new ExchangeOAuthCodeCommand(consumeToken, this.userRepository, this.createStartSession());
    return command.execute({ code: body.code, rememberMe: body.rememberMe ?? false });
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post('refresh')
  refresh(@Body() body: RefreshSessionRequest) {
    const service = new RefreshUserSession(this.sessionRepository, this.userRepository, this.createSignAccessToken(), this.sessionPolicy);
    const command = new RefreshSessionCommand(service);
    return command.execute({ refreshToken: body.refreshToken });
  }

  // Public on purpose: holding the refresh token is what proves the right to end its session,
  // and an expired access token must not stop someone from signing out.
  @Public()
  @Post('logout')
  async logout(@Body() body: RefreshSessionRequest) {
    const command = new LogoutCommand(new EndUserSession(this.sessionRepository));
    await command.execute({ refreshToken: body.refreshToken });
    return { message: 'Signed out' };
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }, @Req() req: Request) {
    const frontendUrl = await resolveFrontendUrl(req, this.frontendUrl, (h) => this.isVerifiedDomain(h));
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
        metadata: { email: body.email, client: clientInfo(req) },
        category: AuditCategory.USER,
        level: AuditLevel.INFO,
        source: 'ui',
      });
    }

    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordRequest, @Req() req: Request) {
    const service = new ResetPassword(this.userRepository, this.passwordHasher);
    const consumeToken = new ConsumeOneTimeToken(this.tokenService, this.usedTokenRepository);
    const command = new ResetPasswordCommand(service, consumeToken, new RevokeUserSessions(this.sessionRepository));
    try {
      await command.execute({ token: body.token, newPassword: body.newPassword });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        // The link was invalid, expired or already used; whose it was is known only if it still verifies
        let targetId: string | null = null;
        try {
          targetId = this.tokenService.verify<{ sub: string }>(body.token).sub ?? null;
        } catch { /* expired or forged */ }
        await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
          action: AuditAction.USER_PASSWORD_RESET_FAILED,
          entityType: 'user',
          entityId: targetId ?? 'unknown',
          userId: null,
          workspaceId: null,
          metadata: { reason: 'invalid-token', client: clientInfo(req) },
          category: AuditCategory.USER,
          level: AuditLevel.WARNING,
          source: 'ui',
        }).catch(() => undefined);
      }
      throw error;
    }

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
        metadata: { userId, client: clientInfo(req) },
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
    const frontendUrl = await resolveFrontendUrl(req, this.frontendUrl, (h) => this.isVerifiedDomain(h));
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

  private async handleOAuthCallback(req: Request, res: Response) {
    const oauthUser = req.user as { email: string; firstName: string; lastName: string; authProvider: string; emailVerified: boolean };
    // The state must be the one this browser was given when it started the sign-in
    const verifyState = new VerifyOAuthState(new ConsumeOneTimeToken(this.tokenService, this.usedTokenRepository));
    const verified = await verifyState.execute({
      state: typeof req.query?.state === 'string' ? req.query.state : null,
      browserNonce: readOAuthNonce(req),
    });
    res.clearCookie(OAUTH_NONCE_COOKIE, { path: '/' });
    if (!verified) {
      await this.auditOAuthLoginFailed(oauthUser?.authProvider ?? null, oauthUser?.email ?? null, 'invalid-state', req);
      return res.redirect(`${this.frontendUrl}/login?error=oauth_failed`);
    }

    const redirectUrl = await this.resolveRedirectUrl(verified.redirect ?? undefined);

    try {
      // Read before signing in: whether this sign-in created the account or verified its address
      const before = await this.userRepository.findByEmail(oauthUser.email);
      const service = new AuthenticateOAuth(this.idGenerator, this.userRepository, this.passwordHasher);
      const command = new OAuthLoginCommand(service, this.tokenService);
      const result = await command.execute({
        email: oauthUser.email,
        firstName: oauthUser.firstName,
        lastName: oauthUser.lastName,
        authProvider: oauthUser.authProvider,
        emailVerified: oauthUser.emailVerified,
      });

      const user = await this.userRepository.findByEmail(oauthUser.email);
      if (user) {
        const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
        if (!before) {
          await new RecordAutoCreated(auditLog).execute({
            via: 'oauth',
            user: { id: user.getId(), email: user.email },
            userCreated: true,
            workspaceId: null,
            actorUserId: null,
            source: 'ui',
          });
        }
        await auditLog.execute({
          action: AuditAction.USER_OAUTH_LOGIN,
          entityType: 'user',
          entityId: user.getId(),
          userId: user.getId(),
          workspaceId: null,
          metadata: {
            provider: oauthUser.authProvider,
            email: oauthUser.email,
            // The provider vouched for an address the account had never confirmed
            ...(before && !before.isEmailVerified && user.isEmailVerified ? { emailVerifiedByProvider: true } : {}),
            client: clientInfo(req),
          },
          category: AuditCategory.USER,
          level: AuditLevel.INFO,
          source: 'ui',
        });

        // An address the provider did not vouch for must be confirmed before the account is usable
        if (!user.isEmailVerified) {
          const verification = new ResendVerificationCommand(this.userRepository, this.tokenService, this.emailService);
          await verification.execute({ userId: user.getId(), frontendUrl: redirectUrl }).catch(() => undefined);
        }
      }

      return res.redirect(`${redirectUrl}/auth/callback?code=${encodeURIComponent(result.code)}`);
    } catch (error) {
      const reason = error instanceof DomainError ? error.message : 'error';
      await this.auditOAuthLoginFailed(oauthUser.authProvider, oauthUser.email, reason, req);
      return res.redirect(`${redirectUrl}/login?error=oauth_failed`);
    }
  }

  private async resolveRedirectUrl(redirect?: string): Promise<string> {
    if (!redirect || redirect === this.frontendUrl) return this.frontendUrl;
    try {
      const hostname = new URL(redirect).hostname;
      if (await this.isVerifiedDomain(hostname)) return redirect;
    } catch {}
    return this.frontendUrl;
  }
}
