import { EmailRuleRepository } from '../repositories/email-rule.repository';

export class ReorderEmailRules {
  constructor(private readonly repository: EmailRuleRepository) {}

  async execute(workspaceId: string, orderedIds: string[]): Promise<void> {
    const rules = await this.repository.findByWorkspaceId(workspaceId);
    const ruleMap = new Map(rules.map((r) => [r.getId(), r]));

    for (let i = 0; i < orderedIds.length; i++) {
      const rule = ruleMap.get(orderedIds[i]);
      if (rule) {
        rule.position = i;
        await this.repository.update(rule);
      }
    }
  }
}
