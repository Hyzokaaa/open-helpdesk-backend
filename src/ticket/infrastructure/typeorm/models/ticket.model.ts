import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';
import { TagModel } from '../../../../tag/infrastructure/typeorm/models/tag.model';

@Entity('tickets')
export class TicketModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column('text')
  description!: string;

  @Column()
  priority!: string;

  @Column()
  status!: string;

  @Column()
  category!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @ManyToOne(() => UserModel)
  reporter!: UserModel;

  @Column()
  reporterId!: string;

  @ManyToOne(() => UserModel, { nullable: true })
  assignee!: UserModel | null;

  @Column({ type: 'varchar', nullable: true })
  assigneeId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  firstResponseAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  resolvedById!: string | null;

  @Column({ default: 0 })
  ticketNumber!: number;

  @Column({ type: 'jsonb', default: {} })
  customFields!: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  discardReason!: string | null;

  @Column({ type: 'varchar', nullable: true, unique: true })
  portalToken!: string | null;

  @Column({ default: false })
  firstResponseBreached!: boolean;

  @Column({ default: false })
  resolutionBreached!: boolean;

  @Column({ type: 'jsonb', default: {} })
  aiCache!: Record<string, { source: string; result: string }>;

  @ManyToOne(() => UserModel, { nullable: true })
  registeredBy!: UserModel | null;

  @Column({ type: 'varchar', default: 'ui' })
  source!: string;

  @Column({ type: 'varchar', nullable: true })
  registeredById!: string | null;

  @Column({ type: 'varchar', nullable: true })
  mailboxId!: string | null;

  @ManyToMany(() => TagModel)
  @JoinTable({ name: 'ticket_tag' })
  tags!: TagModel[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;
}
