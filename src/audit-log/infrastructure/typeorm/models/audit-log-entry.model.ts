import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('audit_log_entries')
@Index(['workspaceId', 'createdAt'])
@Index(['userId'])
@Index(['entityType', 'entityId'])
@Index(['category'])
@Index(['level'])
export class AuditLogEntryModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  action!: string;

  @Column()
  entityType!: string;

  @Column()
  entityId!: string;

  @ManyToOne(() => UserModel, { nullable: true })
  user!: UserModel | null;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @ManyToOne(() => WorkspaceModel, { nullable: true, onDelete: 'SET NULL' })
  workspace!: WorkspaceModel | null;

  @Column({ type: 'varchar', nullable: true })
  workspaceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'varchar', default: 'ticket' })
  category!: string;

  @Column({ type: 'varchar', default: 'info' })
  level!: string;

  @Column({ type: 'varchar', nullable: true })
  source!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
