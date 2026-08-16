import { Query } from '../../../shared/domain/query';
import { EmailRuleRepository } from '../../domain/repositories/email-rule.repository';
import { RuleCondition, RuleAction } from '../../domain/entities/email-rule';

interface Props {
  workspaceId: string;
}

export interface EmailRuleListItem {
  id: string;
  name: string;
  position: number;
  isActive: boolean;
  mailboxIds: string[];
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export class ListEmailRulesQuery implements Query<Props, EmailRuleListItem[]> {
  constructor(private readonly repository: EmailRuleRepository) {}

  async execute(props: Props): Promise<EmailRuleListItem[]> {
    const rules = await this.repository.findByWorkspaceId(props.workspaceId);
    return rules.map((r) => ({
      id: r.getId(),
      name: r.name,
      position: r.position,
      isActive: r.isActive,
      mailboxIds: r.mailboxIds,
      conditions: r.conditions,
      actions: r.actions,
    }));
  }
}
