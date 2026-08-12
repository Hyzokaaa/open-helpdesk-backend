import { Command } from '../../../shared/domain/command';
import { CreateEmailRule } from '../../domain/services/email-rule-create';
import { RuleCondition, RuleAction } from '../../domain/entities/email-rule';

interface Props {
  workspaceId: string;
  name: string;
  mailboxIds: string[];
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface CreateEmailRuleResponse {
  id: string;
}

export class CreateEmailRuleCommand implements Command<Props, CreateEmailRuleResponse> {
  constructor(private readonly createEmailRule: CreateEmailRule) {}

  async execute(props: Props): Promise<CreateEmailRuleResponse> {
    const rule = await this.createEmailRule.execute(props);
    return { id: rule.getId() };
  }
}
