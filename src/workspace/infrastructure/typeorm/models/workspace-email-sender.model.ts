import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkspaceModel } from './workspace.model';

@Entity('workspace_email_senders')
export class WorkspaceEmailSenderModel {
  @PrimaryColumn()
  id!: string;

  @Column({ unique: true })
  workspaceId!: string;

  @OneToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  @JoinColumn()
  workspace!: WorkspaceModel;

  @Column()
  smtpHost!: string;

  @Column({ type: 'int' })
  smtpPort!: number;

  @Column()
  smtpUser!: string;

  @Column()
  smtpPass!: string;

  @Column()
  smtpFrom!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
