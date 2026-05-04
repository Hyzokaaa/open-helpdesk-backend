import { EntityNotFoundError } from '../../../shared/domain/errors';
import { CannedResponseRepository } from '../repositories/canned-response.repository';
import { CannedResponse } from '../entities/canned-response';

interface UpdateCannedResponseProps {
  id: string;
  title?: string;
  content?: string;
}

export class UpdateCannedResponse {
  constructor(private readonly repository: CannedResponseRepository) {}

  async execute(props: UpdateCannedResponseProps): Promise<CannedResponse> {
    const cannedResponse = await this.repository.findById(props.id);
    if (!cannedResponse) {
      throw new EntityNotFoundError('Canned response not found');
    }

    if (props.title !== undefined) cannedResponse.title = props.title;
    if (props.content !== undefined) cannedResponse.content = props.content;

    await this.repository.update(cannedResponse);
    return cannedResponse;
  }
}
