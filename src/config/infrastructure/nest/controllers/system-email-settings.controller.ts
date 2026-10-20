import { Body, Controller, Delete, Get, Inject, Post } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { SystemEmailSettings } from '../../../domain/entities/system-email-settings';
import { TypeOrmSystemEmailSettingsRepository } from '../../typeorm/repositories/typeorm-system-email-settings.repository';
import { SaveSystemEmailRequest } from '../dto/save-system-email.request';
import { TestSystemEmailRequest } from '../dto/test-system-email.request';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { connectionErrorDetail } from '../../../../shared/infrastructure/connection-error-detail';
import { connectionErrorKind } from '../../../../shared/infrastructure/connection-error-kind';
import { PASSWORD_REQUIRED, ensureSavedPasswordStaysWithItsServer, passwordForConnectionTest } from '../../../../shared/domain/stored-password';
import { ResolveMailServer } from '../../../../email/domain/services/mail-server-resolve';
import { NodeMailDnsLookup } from '../../../../email/infrastructure/dns/node-mail-dns-lookup';
import { ResolveMailServerRequest } from '../../../../email/infrastructure/nest/dto/resolve-mail-server.request';

@Controller('system')
export class SystemEmailSettingsController {
  constructor(
    @Inject() private readonly repository: TypeOrmSystemEmailSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly mailDns: NodeMailDnsLookup,
  ) {}

  private ensureAdmin(user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');
  }

  /** The domain's mail servers, for the installation's email and platform mailbox forms */
  @Post('resolve-mail-server')
  async resolveMailServer(@Body() body: ResolveMailServerRequest, @CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    return new ResolveMailServer(this.mailDns).execute(body.domain);
  }

  @Get('email-settings')
  async get(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    const settings = await this.repository.find();
    const envConfigured = !!(process.env.SMTP_HOST || process.env.EMAIL_API_KEY);
    return {
      settings: settings ? {
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpUser: settings.smtpUser,
        hasPassword: !!settings.smtpPass,
        smtpFrom: settings.smtpFrom,
        encryption: settings.encryption,
      } : null,
      envConfigured,
    };
  }

  @Post('email-settings')
  async save(
    @Body() body: SaveSystemEmailRequest,
    @CurrentUser() user: AuthUser,
  ) {
    this.ensureAdmin(user);
    const existing = await this.repository.find();
    ensureSavedPasswordStaysWithItsServer(
      { host: body.smtpHost, user: body.smtpUser, password: body.smtpPass },
      existing && { host: existing.smtpHost, user: existing.smtpUser, password: existing.smtpPass },
    );
    const settings = new SystemEmailSettings({
      id: existing?.getId() ?? this.idGenerator.create(),
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort,
      smtpUser: body.smtpUser,
      smtpPass: (!body.smtpPass || body.smtpPass === '__keep__') ? (existing?.smtpPass ?? '') : body.smtpPass,
      smtpFrom: body.smtpFrom,
      encryption: body.encryption,
    });
    await this.repository.save(settings);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.SYSTEM_EMAIL_SETTINGS_CONFIGURED,
      entityType: 'system-email-settings',
      entityId: 'system',
      userId: user.userId,
      workspaceId: null,
      metadata: { smtpHost: body.smtpHost, smtpFrom: body.smtpFrom },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { id: settings.getId() };
  }

  @Delete('email-settings')
  async remove(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    const existing = await this.repository.find();
    await this.repository.delete();

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.SYSTEM_EMAIL_SETTINGS_DELETED,
      entityType: 'system-email-settings',
      entityId: 'system',
      userId: user.userId,
      workspaceId: null,
      metadata: { smtpHost: existing?.smtpHost, smtpFrom: existing?.smtpFrom },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { message: 'System email settings removed' };
  }

  @Post('email-settings/test')
  async test(
    @Body() body: TestSystemEmailRequest,
    @CurrentUser() user: AuthUser,
  ) {
    this.ensureAdmin(user);

    const existing = await this.repository.find();
    const password = passwordForConnectionTest(
      { host: body.smtpHost, user: body.smtpUser, password: body.smtpPass },
      existing && { host: existing.smtpHost, user: existing.smtpUser, password: existing.smtpPass },
    );
    if (!password) return PASSWORD_REQUIRED;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer');
    const encryption = body.encryption ?? 'tls';
    const tls = encryption === 'tls-insecure' ? { rejectUnauthorized: false } :
                encryption === 'none' ? { rejectUnauthorized: false } : undefined;
    const transporter = nodemailer.createTransport({
      host: body.smtpHost,
      port: body.smtpPort,
      secure: body.smtpPort === 465,
      auth: { user: body.smtpUser, pass: password },
      ...(tls && { tls }),
      ...((encryption === 'none') && { ignoreTLS: true }),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      logger: false,
    });

    try {
      await transporter.verify();

      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.SYSTEM_EMAIL_TEST_CONNECTION,
        entityType: 'system-email-settings',
        entityId: 'system',
        userId: user.userId,
        workspaceId: null,
        metadata: { host: body.smtpHost, port: body.smtpPort, success: true },
        category: AuditCategory.SYSTEM,
        level: AuditLevel.INFO,
        source: 'ui',
      });

      return { success: true };
    } catch (error) {
      const msg = connectionErrorDetail(error);
      const errorCode = connectionErrorKind(error);

      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.SYSTEM_EMAIL_TEST_CONNECTION,
        entityType: 'system-email-settings',
        entityId: 'system',
        userId: user.userId,
        workspaceId: null,
        metadata: { host: body.smtpHost, port: body.smtpPort, success: false, error: msg, errorCode },
        category: AuditCategory.SYSTEM,
        level: AuditLevel.WARNING,
        source: 'ui',
      });

      return { success: false, error: msg, errorCode };
    } finally {
      transporter.close();
    }
  }
}
