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

  @Column({ unique: true })
  address!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
