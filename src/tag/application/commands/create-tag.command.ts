import { Command } from '../../../shared/domain/command';
import { CreateTag } from '../../domain/services/tag-create';

interface Props {
  name: string;
  color: string | null;
  workspaceId: string;
}

export interface CreateTagResponse {
  id: string;
  name: string;
  color: string | null;
}

export class CreateTagCommand implements Command<Props, CreateTagResponse> {
  constructor(private readonly createTag: CreateTag) {}

  async execute(props: Props): Promise<CreateTagResponse> {
    const tag = await this.createTag.execute({
      name: props.name,
      color: props.color,
      workspaceId: props.workspaceId,
    });

    return { id: tag.getId(), name: tag.name, color: tag.color };
  }
}
