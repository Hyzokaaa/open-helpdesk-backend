import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResolveWorkspaceCreationPolicy } from '../../domain/services/workspace-creation-policy-resolve';
import { WorkspaceCreationSettingsRepository } from '../../domain/repositories/workspace-creation-settings.repository';

/**
 * WORKSPACE_SELF_SERVICE fixes who may create workspaces for the whole deployment:
 * "true" lets any signed-in user, "false" only system admins. Left unset, the system
 * admin chooses in the admin panel (closed by default).
 */
export function workspaceSelfServiceFromEnv(config: ConfigService): boolean | null {
  const raw = config.get<string>('WORKSPACE_SELF_SERVICE')?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  new Logger('Config').warn(`Ignoring WORKSPACE_SELF_SERVICE="${raw}": use true or false`);
  return null;
}

export function workspaceCreationPolicy(
  repository: WorkspaceCreationSettingsRepository,
  config: ConfigService,
): ResolveWorkspaceCreationPolicy {
  return new ResolveWorkspaceCreationPolicy(repository, workspaceSelfServiceFromEnv(config));
}
