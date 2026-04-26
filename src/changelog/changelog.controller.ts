import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../shared/nest/decorators/public.decorator';
import { coreChangelog } from './changelog.data';

@Public()
@SkipThrottle()
@Controller('changelog')
export class ChangelogController {
  @Get()
  list() {
    return coreChangelog;
  }
}
