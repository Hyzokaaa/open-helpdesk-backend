import { IdGenerator } from '../../../shared/domain/id-generator';
import { CannedResponse } from '../entities/canned-response';
import { CannedResponseRepository } from '../repositories/canned-response.repository';

interface CreateCannedResponseProps {
  title: string;
  content: string;
  workspaceId: string;
}

export class CreateCannedResponse {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: CannedResponseRepository,
  ) {}

  async execute(props: CreateCannedResponseProps): Promise<CannedResponse> {
    const cannedResponse = new CannedResponse({
      id: this.idGenerator.create(),
      title: props.title,
      content: props.content,
      workspaceId: props.workspaceId,
    });

    await this.repository.create(cannedResponse);
    return cannedResponse;
  }
}
