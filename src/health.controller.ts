import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './shared/nest/decorators/public.decorator';

@Public()
@SkipThrottle()
@Controller()
export class HealthController {
  @Get('health')
  check() {
    return { status: 'ok' };
  }
}
