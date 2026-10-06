import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { TypeOrmSystemEmailSettingsRepository } from '../../typeorm/repositories/typeorm-system-email-settings.repository';
import { TypeOrmSystemBrandingRepository } from '../../typeorm/repositories/typeorm-system-branding.repository';
import { TypeOrmSystemNotificationSettingsRepository } from '../../typeorm/repositories/typeorm-system-notification-settings.repository';
import { TypeOrmSystemAnalyticsSettingsRepository } from '../../typeorm/repositories/typeorm-system-analytics-settings.repository';
import { toPublicAnalyticsConfig } from '../../../domain/services/analytics-public-config';
import { StorageService } from '../../../../shared/domain/storage-service';
import { STORAGE_SERVICE } from '../../../../shared/shared.module';

@Public()
@SkipThrottle()
@Controller('config')
export class CoreConfigController {
  constructor(
    @Inject() private readonly systemEmailRepo: TypeOrmSystemEmailSettingsRepository,
    @Inject() private readonly systemBrandingRepo: TypeOrmSystemBrandingRepository,
    @Inject() private readonly systemNotificationSettingsRepo: TypeOrmSystemNotificationSettingsRepository,
    @Inject() private readonly systemAnalyticsSettingsRepo: TypeOrmSystemAnalyticsSettingsRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  @Get('public')
  async getPublicConfig() {
    const dbSettings = await this.systemEmailRepo.find();
    const emailFrom = dbSettings?.smtpFrom || process.env.EMAIL_FROM || null;
    const branding = await this.systemBrandingRepo.find();
    const notificationSettings = await this.systemNotificationSettingsRepo.find();
    const analyticsSettings = await this.systemAnalyticsSettingsRepo.find();
    return {
      upgradeNotificationsEnabled: notificationSettings?.upgradeEnabled ?? true,
      saasMode: false,
      aiEnabled: !!process.env.AI_API_KEY,
      emailConfigured: !!(dbSettings?.smtpHost) || !!(process.env.SMTP_HOST && process.env.SMTP_USER) || !!process.env.EMAIL_API_KEY,
      systemEmailFrom: emailFrom,
      brandingAppName: branding?.appName ?? null,
      brandingAppSubtitle: branding?.appSubtitle ?? null,
      brandingLogo: branding?.logo ? await this.storage.getPresignedUrl(branding.logo) : null,
      brandingIcon: branding?.icon ? await this.storage.getPresignedUrl(branding.icon) : null,
      analytics: toPublicAnalyticsConfig(analyticsSettings),
    };
  }
}
