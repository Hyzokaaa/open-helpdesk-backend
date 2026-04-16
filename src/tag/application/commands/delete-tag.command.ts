import { Command } from '../../../shared/domain/command';
import { DeleteTag } from '../../domain/services/tag-delete';

interface Props {
  id: string;
}

export class DeleteTagCommand implements Command<Props, void> {
  constructor(private readonly deleteTag: DeleteTag) {}

  async execute(props: Props): Promise<void> {
    await this.deleteTag.execute({ id: props.id });
  }
}
