import { EmailRule } from '../entities/email-rule';

export interface EmailRuleRepository {
  create(rule: EmailRule): Promise<void>;
  update(rule: EmailRule): Promise<void>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<EmailRule | null>;
  findByWorkspaceId(workspaceId: string): Promise<EmailRule[]>;
}
