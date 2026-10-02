import { existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * The version of this backend, read from its own package.json: the nearest one named
 * open-helpdesk-core above the running code. Whatever packages the core (its own image, or a
 * product built on top of it) must ship that manifest alongside the compiled core.
 */
export function resolveBackendVersion(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
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
