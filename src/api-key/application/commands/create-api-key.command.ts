import { Command } from '../../../shared/domain/command';
import { CreateApiKey } from '../../domain/services/api-key-create';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  name: string;
  scopes?: string[];
  expiresAt?: Date | null;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  prefix: string;
  key: string;
  scopes: string[];
  expiresAt: Date | null;
  createdAt: Date | null;
}

export class CreateApiKeyCommand implements Command<Props, CreateApiKeyResponse> {
  constructor(
    private readonly createApiKey: CreateApiKey,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<CreateApiKeyResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const { apiKey, rawKey } = await this.createApiKey.execute({
      workspaceId: props.workspaceId,
      name: props.name,
      scopes: props.scopes,
      expiresAt: props.expiresAt,
      createdById: props.userId,
    });

    return {
      id: apiKey.getId(),
      name: apiKey.name,
      prefix: apiKey.prefix,
      key: rawKey,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    };
  }
}
