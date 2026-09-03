import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { VersionCheck } from '../../../domain/services/version-check';
import { resolveBackendVersion } from '../resolve-backend-version';

const backendVersion: string = resolveBackendVersion();

let instance: VersionCheck | null = null;

@Controller('admin')
export class SystemVersionController {
  @Get('version')
  async getVersion(@CurrentUser() user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');

    if (!instance) {
      instance = new VersionCheck(backendVersion);
    }

    return instance.execute();
  }
}
