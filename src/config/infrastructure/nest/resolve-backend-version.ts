import { existsSync } from 'fs';
import { join, dirname } from 'path';

export function resolveBackendVersion(): string {
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
