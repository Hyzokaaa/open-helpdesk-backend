import { EntityNotFoundError } from '../../../shared/domain/errors';
import { CannedResponseRepository } from '../repositories/canned-response.repository';
import { CannedResponse } from '../entities/canned-response';

interface UpdateCannedResponseProps {
  id: string;
  /** The workspace of the caller; an item of any other workspace is not found. */
  workspaceId: string;
  title?: string;
  content?: string;
}

export class UpdateCannedResponse {
  constructor(private readonly repository: CannedResponseRepository) {}

  async execute(props: UpdateCannedResponseProps): Promise<CannedResponse> {
    const cannedResponse = await this.repository.findById(props.id);
    if (!cannedResponse || cannedResponse.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Canned response not found');
    }

    if (props.title !== undefined) cannedResponse.title = props.title;
    if (props.content !== undefined) cannedResponse.content = props.content;

    await this.repository.update(cannedResponse);
    return cannedResponse;
  }
}
