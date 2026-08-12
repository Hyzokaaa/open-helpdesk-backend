import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';
import { RuleCondition, RuleAction } from '../../../domain/entities/email-rule';

@Entity('email_rules')
export class EmailRuleModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @Column()
  name!: string;

  @Column({ default: 0 })
  position!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'jsonb', default: [] })
  mailboxIds!: string[];

  @Column({ type: 'jsonb', default: [] })
  conditions!: RuleCondition[];

  @Column({ type: 'jsonb', default: [] })
  actions!: RuleAction[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
