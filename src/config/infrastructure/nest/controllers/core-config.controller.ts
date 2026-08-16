import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { TypeOrmSystemEmailSettingsRepository } from '../../typeorm/repositories/typeorm-system-email-settings.repository';
import { TypeOrmSystemBrandingRepository } from '../../typeorm/repositories/typeorm-system-branding.repository';
import { S3StorageService } from '../../../../shared/infrastructure/s3-storage.service';

@Public()
@SkipThrottle()
@Controller('config')
export class CoreConfigController {
  constructor(
    @Inject() private readonly systemEmailRepo: TypeOrmSystemEmailSettingsRepository,
    @Inject() private readonly systemBrandingRepo: TypeOrmSystemBrandingRepository,
    @Inject() private readonly s3Storage: S3StorageService,
  ) {}

  @Get('public')
  async getPublicConfig() {
    const dbSettings = await this.systemEmailRepo.find();
    const emailFrom = dbSettings?.smtpFrom || process.env.EMAIL_FROM || null;
    const branding = await this.systemBrandingRepo.find();
    return {
      saasMode: false,
      aiEnabled: !!process.env.AI_API_KEY,
      emailConfigured: !!(dbSettings?.smtpHost) || !!(process.env.SMTP_HOST && process.env.SMTP_USER) || !!process.env.EMAIL_API_KEY,
      systemEmailFrom: emailFrom,
      brandingAppName: branding?.appName ?? null,
      brandingAppSubtitle: branding?.appSubtitle ?? null,
      brandingLogo: branding?.logo ? await this.s3Storage.getPresignedUrl(branding.logo) : null,
    };
  }
}
