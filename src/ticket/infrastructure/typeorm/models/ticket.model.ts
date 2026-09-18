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
import { DepartmentModel } from '../../../../department/infrastructure/typeorm/models/department.model';
import { OrganizationModel } from '../../../../organization/infrastructure/typeorm/models/organization.model';
import { ProjectModel } from '../../../../project/infrastructure/typeorm/models/project.model';
import { TicketCategoryModel } from '../../../../project/infrastructure/typeorm/models/ticket-category.model';

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

  @ManyToOne(() => TicketCategoryModel, { nullable: true, onDelete: 'SET NULL' })
  category!: TicketCategoryModel | null;

  @Column({ type: 'varchar', nullable: true })
  categoryId!: string | null;

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

  @Column({ type: 'timestamptz', nullable: true })
  originDate!: Date | null;

  @ManyToOne(() => DepartmentModel, { nullable: true })
  department!: DepartmentModel | null;

  @Column({ type: 'varchar', nullable: true })
  departmentId!: string | null;

  @ManyToOne(() => ProjectModel, { nullable: true, onDelete: 'SET NULL' })
  project!: ProjectModel | null;

  @Column({ type: 'varchar', nullable: true })
  projectId!: string | null;

  @ManyToOne(() => OrganizationModel, { nullable: true, onDelete: 'SET NULL' })
  organization!: OrganizationModel | null;

  @Column({ type: 'varchar', nullable: true })
  organizationId!: string | null;

  @ManyToMany(() => TagModel)
  @JoinTable({ name: 'ticket_tag' })
  tags!: TagModel[];

  @Column({ type: 'timestamptz', nullable: true })
  descriptionEditedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;
}
