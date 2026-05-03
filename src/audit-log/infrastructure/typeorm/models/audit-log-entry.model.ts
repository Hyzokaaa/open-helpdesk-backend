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
export class AuditLogEntryModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  action!: string;

  @Column()
  entityType!: string;

  @Column()
  entityId!: string;

  @ManyToOne(() => UserModel)
  user!: UserModel;

  @Column()
  userId!: string;

  @ManyToOne(() => WorkspaceModel, { nullable: true, onDelete: 'SET NULL' })
  workspace!: WorkspaceModel | null;

  @Column({ type: 'varchar', nullable: true })
  workspaceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
