import { EntityNotFoundError } from '../../../shared/domain/errors';
import { EmailRuleRepository } from '../repositories/email-rule.repository';

export class DeleteEmailRule {
  constructor(private readonly repository: EmailRuleRepository) {}

  async execute(id: string, workspaceId: string): Promise<void> {
    const rule = await this.repository.findById(id);
    if (!rule || rule.workspaceId !== workspaceId) throw new EntityNotFoundError('Email rule not found');
    await this.repository.delete(id);
  }
}
