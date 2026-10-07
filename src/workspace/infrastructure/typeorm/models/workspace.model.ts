import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('workspaces')
@Index('IDX_workspaces_purge_at', ['purgeAt'])
export class WorkspaceModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ default: '' })
  description!: string;

  @Column({ type: 'varchar', nullable: true })
  accountId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  slaPolicy!: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: true })
  systemMailboxEnabled!: boolean;

  @Column({ type: 'varchar', nullable: true })
  customDomain!: string | null;

  @Column({ type: 'boolean', default: false })
  customDomainVerified!: boolean;

  @Column({ type: 'varchar', nullable: true })
  domainVerificationToken!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  appName!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  appSubtitle!: string | null;

  @Column({ type: 'varchar', nullable: true })
  logo!: string | null;

  @Column({ type: 'varchar', nullable: true })
  icon!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Set when the workspace is deleted. Ordinary lookups skip it from then on (TypeORM soft
   * delete), so it is off everywhere until it is restored or purged.
   */
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  deletedById!: string | null;

  /** When the deleted workspace is erased for good. */
  @Column({ type: 'timestamptz', nullable: true })
  purgeAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  purgeReminderSentAt!: Date | null;
}
