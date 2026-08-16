import { EntityNotFoundError } from '../../../shared/domain/errors';
import { EmailRule, RuleCondition, RuleAction } from '../entities/email-rule';
import { EmailRuleRepository } from '../repositories/email-rule.repository';

interface UpdateEmailRuleProps {
  id: string;
  name?: string;
  isActive?: boolean;
  mailboxIds?: string[];
  conditions?: RuleCondition[];
  actions?: RuleAction[];
}

export class UpdateEmailRule {
  constructor(private readonly repository: EmailRuleRepository) {}

  async execute(props: UpdateEmailRuleProps): Promise<EmailRule> {
    const rule = await this.repository.findById(props.id);
    if (!rule) throw new EntityNotFoundError('Email rule not found');

    if (props.name !== undefined) rule.name = props.name;
    if (props.isActive !== undefined) rule.isActive = props.isActive;
    if (props.mailboxIds !== undefined) rule.mailboxIds = props.mailboxIds;
    if (props.conditions !== undefined) rule.conditions = props.conditions;
    if (props.actions !== undefined) rule.actions = props.actions;

    await this.repository.update(rule);
    return rule;
  }
}
