import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

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

  /**
   * The workspace the entry belongs to. Deliberately not a foreign key: the history of a workspace
   * must keep pointing at it after the workspace is purged.
   */
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
