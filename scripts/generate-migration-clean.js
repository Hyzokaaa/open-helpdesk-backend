#!/usr/bin/env node

/**
 * Generates a migration from a clean database state.
 *
 * Flow:
 *   1. Drop database (docker compose down -v)
 *   2. Start database (docker compose up -d)
 *   3. Wait for PostgreSQL to be ready
 *   4. Run all existing migrations
 *   5. Generate new migration
 *   6. Run all migrations to restore DB state
 *
 * Usage: npm run migration:generate:clean <migration-name>
 */

const { execSync } = require('child_process');
const path = require('path');

const typeormCli = require.resolve('typeorm/cli.js');
const migrationName = process.argv[2];

if (!migrationName) {
  console.error('Error: You must provide a migration name');
  console.error('Usage: npm run migration:generate:clean <migration-name>');
  process.exit(1);
}

function run(command, label) {
  console.log(`\n⏳ ${label}...`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`\n❌ Error: ${label}`);
    console.error(error.message);
    process.exit(1);
  }
}

function waitForDb(maxAttempts = 15) {
  console.log('\n⏳ Waiting for PostgreSQL to be ready...');
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      execSync(
        'docker compose exec -T postgres pg_isready -U postgres',
        { stdio: 'pipe' },
      );
      console.log('  ✓ PostgreSQL is ready');
      return;
    } catch {
      if (i === maxAttempts) {
        console.error('❌ PostgreSQL did not start in time');
        process.exit(1);
      }
      execSync('sleep 1');
    }
  }
}

// 1. Drop database
run('docker compose down -v', 'Dropping database');

// 2. Start database
run('docker compose up -d postgres', 'Starting database');

// 3. Wait for PostgreSQL
waitForDb();

// 4. Run existing migrations
run(
  `npx ts-node -P ./tsconfig.json -r tsconfig-paths/register ${typeormCli} migration:run -d ./src/database/typeorm.config.ts`,
  'Running existing migrations',
);

// 5. Generate new migration
const migrationPath = path.join('./src/database/migrations/', migrationName);

console.log(`\n⏳ Generating migration: ${migrationName}...`);
try {
  execSync(
    `npx ts-node -P ./tsconfig.json -r tsconfig-paths/register ${typeormCli} migration:generate -d ./src/database/typeorm.config.ts ${migrationPath}`,
    { stdio: 'inherit' },
  );
} catch {
  console.log('\n⚠️  No schema changes detected. No migration generated.');
  process.exit(0);
}

// 6. Run all migrations to restore DB state
run(
  `npx ts-node -P ./tsconfig.json -r tsconfig-paths/register ${typeormCli} migration:run -d ./src/database/typeorm.config.ts`,
  'Running all migrations (including new one)',
);

console.log(`\n✅ Migration ${migrationName} generated successfully.`);
