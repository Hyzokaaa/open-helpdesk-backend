import { Body, Controller, Delete, Get, Inject, Post } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { SystemEmailSettings } from '../../../domain/entities/system-email-settings';
import { TypeOrmSystemEmailSettingsRepository } from '../../typeorm/repositories/typeorm-system-email-settings.repository';
import { SaveSystemEmailRequest } from '../dto/save-system-email.request';
import { TestSystemEmailRequest } from '../dto/test-system-email.request';

@Controller('system')
export class SystemEmailSettingsController {
  constructor(
    @Inject() private readonly repository: TypeOrmSystemEmailSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
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
    });
    await this.repository.save(settings);
    return { id: settings.getId() };
  }

  @Delete('email-settings')
  async remove(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    await this.repository.delete();
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
    const transporter = nodemailer.createTransport({
      host: body.smtpHost,
      port: body.smtpPort,
      secure: body.smtpPort === 465,
      auth: { user: body.smtpUser, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      logger: false,
    });

    try {
      await transporter.verify();
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    } finally {
      transporter.close();
    }
  }
}
