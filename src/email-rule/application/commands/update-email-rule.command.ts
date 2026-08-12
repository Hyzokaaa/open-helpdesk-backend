import { Command } from '../../../shared/domain/command';
import { UpdateEmailRule } from '../../domain/services/email-rule-update';
import { RuleCondition, RuleAction } from '../../domain/entities/email-rule';

interface Props {
  id: string;
  name?: string;
  isActive?: boolean;
  mailboxIds?: string[];
  conditions?: RuleCondition[];
  actions?: RuleAction[];
}

export class UpdateEmailRuleCommand implements Command<Props, void> {
  constructor(private readonly updateEmailRule: UpdateEmailRule) {}

  async execute(props: Props): Promise<void> {
    await this.updateEmailRule.execute(props);
  }
}
