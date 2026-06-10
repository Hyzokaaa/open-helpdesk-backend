import { Query } from '../../../shared/domain/query';
import { ApiKeyRepository } from '../../domain/repositories/api-key.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date | null;
}

export class ListApiKeysQuery implements Query<Props, ApiKeyListItem[]> {
  constructor(
    private readonly repository: ApiKeyRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<ApiKeyListItem[]> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const keys = await this.repository.findByWorkspaceId(props.workspaceId);
    return keys.map((k) => ({
      id: k.getId(),
      name: k.name,
      prefix: k.prefix,
      scopes: k.scopes,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));
  }
}
