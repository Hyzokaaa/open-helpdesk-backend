import { Command } from '../../../shared/domain/command';
import { ReorderEmailRules } from '../../domain/services/email-rule-reorder';

interface Props {
  workspaceId: string;
  orderedIds: string[];
}

export class ReorderEmailRulesCommand implements Command<Props, void> {
  constructor(private readonly reorderRules: ReorderEmailRules) {}

  async execute(props: Props): Promise<void> {
    await this.reorderRules.execute(props.workspaceId, props.orderedIds);
  }
}
