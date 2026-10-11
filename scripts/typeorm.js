#!/usr/bin/env node

/**
 * Runs the TypeORM CLI against the TypeScript data source.
 *
 * The CLI is located with require.resolve, so it works whether dependencies sit in this
 * repo's node_modules or are hoisted to the root of an npm workspace.
 *
 * Usage: node scripts/typeorm.js <command> [args...]
 * Example: node scripts/typeorm.js migration:run -d ./src/database/typeorm.config.ts
 */

const { spawnSync } = require('child_process');

const typeormCli = require.resolve('typeorm/cli.js');

const result = spawnSync(
  process.execPath,
  ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', typeormCli, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: { ...process.env, TS_NODE_PROJECT: './tsconfig.json' },
  },
);

process.exit(result.status ?? 1);
