import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../../../shared/nest/decorators/public.decorator';

@Public()
@SkipThrottle()
@Controller('config')
export class CoreConfigController {
  @Get('public')
  getPublicConfig() {
    return {
      saasMode: false,
      aiEnabled: !!process.env.AI_API_KEY,
    };
  }
}
