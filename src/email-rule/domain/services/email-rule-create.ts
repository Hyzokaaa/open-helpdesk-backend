import { IdGenerator } from '../../../shared/domain/id-generator';
import { EmailRule, RuleCondition, RuleAction } from '../entities/email-rule';
import { EmailRuleRepository } from '../repositories/email-rule.repository';

interface CreateEmailRuleProps {
  workspaceId: string;
  name: string;
  mailboxIds: string[];
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export class CreateEmailRule {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: EmailRuleRepository,
  ) {}

  async execute(props: CreateEmailRuleProps): Promise<EmailRule> {
    const existing = await this.repository.findByWorkspaceId(props.workspaceId);
    const maxPosition = existing.reduce((max, r) => Math.max(max, r.position), -1);

    const rule = new EmailRule({
      id: this.idGenerator.create(),
      workspaceId: props.workspaceId,
      name: props.name,
      position: maxPosition + 1,
      isActive: true,
      mailboxIds: props.mailboxIds,
      conditions: props.conditions,
      actions: props.actions,
    });

    await this.repository.create(rule);
    return rule;
  }
}
