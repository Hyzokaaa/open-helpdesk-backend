import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { VersionCheck } from '../../../domain/services/version-check';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

function resolveBackendVersion(): string {
  // Walk up from __dirname to find backend/package.json (cloud) or package.json (standalone)
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const backendPkg = join(dir, 'backend', 'package.json');
    if (existsSync(backendPkg)) return require(backendPkg).version;
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      const data = require(pkg);
      if (data.name === 'open-helpdesk-core') return data.version;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return '0.0.0';
}

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
