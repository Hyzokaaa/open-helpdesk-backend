#!/usr/bin/env node

/**
 * Generates a standalone package-lock.json for this workspace.
 *
 * npm workspaces use a single root lockfile. When deploying independently
 * (e.g. Docker build), `npm ci` needs a lockfile that matches package.json.
 *
 * This script copies package.json to a temp directory, runs
 * `npm install --package-lock-only`, and copies the resulting lockfile back.
 *
 * Usage: node scripts/sync-lockfile.js
 * Run before deploying or after adding/removing dependencies.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const workspaceDir = path.join(__dirname, '..');
const packageJsonPath = path.join(workspaceDir, 'package.json');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-lockfile-'));

try {
  console.log('Generating package-lock.json...');

  fs.copyFileSync(packageJsonPath, path.join(tmpDir, 'package.json'));

  execSync('npm install --package-lock-only --ignore-scripts', {
    cwd: tmpDir,
    stdio: 'pipe',
  });

  const lockfileSrc = path.join(tmpDir, 'package-lock.json');
  const lockfileDst = path.join(workspaceDir, 'package-lock.json');
  fs.copyFileSync(lockfileSrc, lockfileDst);

  console.log('✅ package-lock.json updated');
} catch (error) {
  console.error(`❌ Failed: ${error.message}`);
  process.exit(1);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
