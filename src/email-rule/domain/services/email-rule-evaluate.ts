import { TicketPriority } from '../../../ticket/domain/enums/ticket-priority.enum';
import { TicketCategory } from '../../../ticket/domain/enums/ticket-category.enum';
import { EmailRuleRepository } from '../repositories/email-rule.repository';
import { EmailRule, RuleCondition } from '../entities/email-rule';
import { EmailRuleConditionField } from '../enums/email-rule-condition-field.enum';
import { EmailRuleOperator } from '../enums/email-rule-operator.enum';
import { EmailRuleActionType } from '../enums/email-rule-action-type.enum';

export interface EmailRuleContext {
  fromAddress: string;
  toAddresses: string[];
  subject: string;
}

export interface EmailRuleResult {
  action: 'proceed' | 'reject';
  priority?: TicketPriority;
  category?: TicketCategory;
  departmentId?: string;
  tagIds?: string[];
  assigneeId?: string;
  matchedRuleName?: string;
}

export class EvaluateEmailRules {
  constructor(private readonly repository: EmailRuleRepository) {}

  async execute(
    context: EmailRuleContext,
    workspaceId: string,
    mailboxId: string,
  ): Promise<EmailRuleResult> {
    const rules = await this.repository.findByWorkspaceId(workspaceId);

    const applicable = rules
      .filter((r) => r.isActive)
      .filter((r) => r.mailboxIds.length === 0 || r.mailboxIds.includes(mailboxId))
      .sort((a, b) => a.position - b.position);

    for (const rule of applicable) {
      if (this.matchesAll(rule.conditions, context)) {
        return this.buildResult(rule);
      }
    }

    return { action: 'proceed' };
  }

  private matchesAll(conditions: RuleCondition[], context: EmailRuleContext): boolean {
    return conditions.every((c) => this.matchesCondition(c, context));
  }

  private matchesCondition(condition: RuleCondition, context: EmailRuleContext): boolean {
    const target = this.getFieldValue(condition.field, context);
    const value = condition.value.toLowerCase();

    switch (condition.operator) {
      case EmailRuleOperator.CONTAINS:
        return target.includes(value);
      case EmailRuleOperator.EQUALS:
        return target === value;
      case EmailRuleOperator.STARTS_WITH:
        return target.startsWith(value);
      case EmailRuleOperator.ENDS_WITH:
        return target.endsWith(value);
      default:
        return false;
    }
  }

  private getFieldValue(field: EmailRuleConditionField, context: EmailRuleContext): string {
    switch (field) {
      case EmailRuleConditionField.FROM:
        return context.fromAddress.toLowerCase();
      case EmailRuleConditionField.SUBJECT:
        return context.subject.toLowerCase();
      case EmailRuleConditionField.TO:
        return context.toAddresses.join(' ').toLowerCase();
      default:
        return '';
    }
  }

  private buildResult(rule: EmailRule): EmailRuleResult {
    const result: EmailRuleResult = {
      action: 'proceed',
      matchedRuleName: rule.name,
    };

    for (const action of rule.actions) {
      switch (action.type) {
        case EmailRuleActionType.REJECT:
          result.action = 'reject';
          break;
        case EmailRuleActionType.SET_DEPARTMENT:
          result.departmentId = action.value;
          break;
        case EmailRuleActionType.SET_PRIORITY:
          result.priority = action.value as TicketPriority;
          break;
        case EmailRuleActionType.SET_CATEGORY:
          result.category = action.value as TicketCategory;
          break;
        case EmailRuleActionType.ADD_TAGS:
          result.tagIds = action.value?.split(',') ?? [];
          break;
        case EmailRuleActionType.ASSIGN_TO:
          result.assigneeId = action.value;
          break;
      }
    }

    return result;
  }
}
