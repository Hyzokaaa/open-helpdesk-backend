import { createHash, randomBytes } from 'crypto';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { ApiKey } from '../entities/api-key';
import { ApiKeyRepository } from '../repositories/api-key.repository';
import { ALL_API_KEY_SCOPES } from '../enums/api-key-scope.enum';

interface CreateApiKeyProps {
  workspaceId: string;
  name: string;
  scopes?: string[];
  expiresAt?: Date | null;
  createdById: string;
}

interface CreateApiKeyResult {
  apiKey: ApiKey;
  rawKey: string;
}

export class CreateApiKey {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: ApiKeyRepository,
  ) {}

  async execute(props: CreateApiKeyProps): Promise<CreateApiKeyResult> {
    const raw = 'ohd_' + randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(raw).digest('hex');
    const prefix = raw.substring(0, 8);

    const apiKey = new ApiKey({
      id: this.idGenerator.create(),
      workspaceId: props.workspaceId,
      name: props.name,
      key: hash,
      prefix,
      scopes: props.scopes ?? ALL_API_KEY_SCOPES,
      expiresAt: props.expiresAt ?? null,
      lastUsedAt: null,
      createdAt: null,
      createdById: props.createdById,
    });

    await this.repository.create(apiKey);

    return { apiKey, rawKey: raw };
  }
}
