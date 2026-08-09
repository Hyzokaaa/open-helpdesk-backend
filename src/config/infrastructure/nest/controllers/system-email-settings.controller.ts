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

@Controller('system')
export class SystemEmailSettingsController {
  constructor(
    @Inject() private readonly repository: TypeOrmSystemEmailSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  private ensureAdmin(user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');
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

    let password = body.smtpPass;
    if (!password || password === '__keep__') {
      const existing = await this.repository.find();
      if (existing?.smtpPass) password = existing.smtpPass;
    }

    if (!password) {
      return { success: false, error: 'Password is required' };
    }

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
      const msg = error instanceof Error ? error.message : 'Unknown error';

      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.SYSTEM_EMAIL_TEST_CONNECTION,
        entityType: 'system-email-settings',
        entityId: 'system',
        userId: user.userId,
        workspaceId: null,
        metadata: { host: body.smtpHost, port: body.smtpPort, success: false, error: msg },
        category: AuditCategory.SYSTEM,
        level: AuditLevel.WARNING,
        source: 'ui',
      });

      return { success: false, error: msg };
    } finally {
      transporter.close();
    }
  }
}
