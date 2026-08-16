import { Command } from '../../../shared/domain/command';
import { DeleteEmailRule } from '../../domain/services/email-rule-delete';

interface Props {
  id: string;
}

export class DeleteEmailRuleCommand implements Command<Props, void> {
  constructor(private readonly deleteEmailRule: DeleteEmailRule) {}

  async execute(props: Props): Promise<void> {
    await this.deleteEmailRule.execute(props.id);
  }
}
