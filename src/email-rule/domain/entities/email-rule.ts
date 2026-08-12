import { Id } from '../../../shared/domain/id';
import { EmailRuleConditionField } from '../enums/email-rule-condition-field.enum';
import { EmailRuleOperator } from '../enums/email-rule-operator.enum';
import { EmailRuleActionType } from '../enums/email-rule-action-type.enum';

export interface RuleCondition {
  field: EmailRuleConditionField;
  operator: EmailRuleOperator;
  value: string;
}

export interface RuleAction {
  type: EmailRuleActionType;
  value?: string;
}

interface Props {
  id: string;
  workspaceId: string;
  name: string;
  position: number;
  isActive: boolean;
  mailboxIds: string[];
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export class EmailRule {
  readonly id: Id;
  workspaceId: string;
  name: string;
  position: number;
  isActive: boolean;
  mailboxIds: string[];
  conditions: RuleCondition[];
  actions: RuleAction[];

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.name = props.name;
    this.position = props.position;
    this.isActive = props.isActive;
    this.mailboxIds = props.mailboxIds;
    this.conditions = props.conditions;
    this.actions = props.actions;
  }

  getId(): string {
    return this.id.get();
  }
}
