import { EntityNotFoundError } from '../../../shared/domain/errors';
import { ApiKeyRepository } from '../repositories/api-key.repository';

interface DeleteApiKeyProps {
  id: string;
  workspaceId: string;
}

export class DeleteApiKey {
  constructor(
    private readonly repository: ApiKeyRepository,
  ) {}

  async execute(props: DeleteApiKeyProps): Promise<void> {
    const apiKey = await this.repository.findById(props.id);
    if (!apiKey || apiKey.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('API key not found');
    }
    await this.repository.delete(props.id);
  }
}
