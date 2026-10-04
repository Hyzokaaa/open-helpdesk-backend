import { EntityNotFoundError } from '../../../shared/domain/errors';
import { CannedResponseRepository } from '../repositories/canned-response.repository';

interface DeleteCannedResponseProps {
  id: string;
  /** The workspace of the caller; an item of any other workspace is not found. */
  workspaceId: string;
}

export class DeleteCannedResponse {
  constructor(private readonly repository: CannedResponseRepository) {}

  async execute(props: DeleteCannedResponseProps): Promise<void> {
    const cannedResponse = await this.repository.findById(props.id);
    if (!cannedResponse || cannedResponse.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Canned response not found');
    }

    await this.repository.delete(props.id);
  }
}
