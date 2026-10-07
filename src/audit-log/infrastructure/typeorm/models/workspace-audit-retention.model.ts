import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('workspace_audit_retention')
export class WorkspaceAuditRetentionModel {
  @PrimaryColumn()
  workspaceId!: string;

  @OneToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: WorkspaceModel;

  /** Days per category it keeps longer than the installation; null keeps it forever. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  days!: Record<string, number | null>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
