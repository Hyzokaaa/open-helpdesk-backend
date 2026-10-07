import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { WorkspaceModel } from './workspace.model';

@Entity('workspace_ticket_references')
export class WorkspaceTicketReferenceModel {
  @PrimaryColumn()
  workspaceId!: string;

  @OneToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: WorkspaceModel;

  /** 'sequential' (TK-000042) or 'random' (TK-7QX4M2K). */
  @Column({ type: 'varchar', length: 20, default: 'sequential' })
  style!: string;

  @Column({ type: 'varchar', length: 10, default: 'TK' })
  prefix!: string;

  /** Key of the random references; generated once and never changed, or every reference would. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  secret!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
