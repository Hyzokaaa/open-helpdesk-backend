import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('mailboxes')
export class MailboxModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  address!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE', nullable: true })
  workspace!: WorkspaceModel | null;

  @Column({ nullable: true })
  workspaceId!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: 'webhook' })
  type!: string;

  @Column({ type: 'varchar', nullable: true })
  imapHost!: string | null;

  @Column({ type: 'int', nullable: true })
  imapPort!: number | null;

  @Column({ type: 'varchar', nullable: true })
  imapUser!: string | null;

  @Column({ type: 'varchar', nullable: true })
  imapPass!: string | null;

  @Column({ type: 'boolean', nullable: true })
  imapTls!: boolean | null;

  @Column({ type: 'varchar', default: 'tls' })
  encryption!: string;

  @Column({ type: 'varchar', nullable: true, default: 'INBOX' })
  imapFolder!: string | null;

  @Column({ type: 'int', nullable: true, default: 30 })
  pollInterval!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  lastSyncDuration!: number | null;

  @Column({ type: 'varchar', nullable: true })
  lastError!: string | null;

  @Column({ type: 'varchar', default: 'address' })
  addressMode!: string;

  @Column({ type: 'jsonb', default: '[]' })
  acceptedAddresses!: string[];

  @Column({ type: 'boolean', default: true })
  autoReply!: boolean;

  @Column({ type: 'varchar', default: 'none' })
  postProcessAction!: string;

  @Column({ type: 'varchar', nullable: true })
  postProcessFolder!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
