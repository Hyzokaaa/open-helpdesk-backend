import { EntityNotFoundError } from '../../../shared/domain/errors';
import { CannedResponseRepository } from '../repositories/canned-response.repository';

interface DeleteCannedResponseProps {
  id: string;
}

export class DeleteCannedResponse {
  constructor(private readonly repository: CannedResponseRepository) {}

  async execute(props: DeleteCannedResponseProps): Promise<void> {
    const cannedResponse = await this.repository.findById(props.id);
    if (!cannedResponse) {
      throw new EntityNotFoundError('Canned response not found');
    }

    await this.repository.delete(props.id);
  }
}
