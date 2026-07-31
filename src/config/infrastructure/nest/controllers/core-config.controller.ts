import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { TypeOrmSystemEmailSettingsRepository } from '../../typeorm/repositories/typeorm-system-email-settings.repository';

@Public()
@SkipThrottle()
@Controller('config')
export class CoreConfigController {
  constructor(
    @Inject() private readonly systemEmailRepo: TypeOrmSystemEmailSettingsRepository,
  ) {}

  @Get('public')
  async getPublicConfig() {
    const dbSettings = await this.systemEmailRepo.find();
    return {
      saasMode: false,
      aiEnabled: !!process.env.AI_API_KEY,
      emailConfigured: !!dbSettings || !!(process.env.SMTP_HOST || process.env.EMAIL_API_KEY),
    };
  }
}
