import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('workspaces')
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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
