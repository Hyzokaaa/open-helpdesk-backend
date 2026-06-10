import { ApiKey } from '../entities/api-key';

export interface ApiKeyRepository {
  create(apiKey: ApiKey): Promise<void>;
  findByHash(keyHash: string): Promise<ApiKey | null>;
  findByWorkspaceId(workspaceId: string): Promise<ApiKey[]>;
  findById(id: string): Promise<ApiKey | null>;
  delete(id: string): Promise<void>;
  updateLastUsedAt(id: string, date: Date): Promise<void>;
}
