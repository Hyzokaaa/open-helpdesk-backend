import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';
import { DepartmentModel } from '../../../../department/infrastructure/typeorm/models/department.model';
import { ProjectModel } from '../../../../project/infrastructure/typeorm/models/project.model';
import { OrganizationModel } from '../../../../organization/infrastructure/typeorm/models/organization.model';

@Entity('matrix_rooms')
export class MatrixRoomModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Index()
  @Column()
  workspaceId!: string;

  @Index()
  @Column()
  roomId!: string;

  /** At most one of department, project and organization; none: every ticket of the workspace. */
  @ManyToOne(() => DepartmentModel, { onDelete: 'CASCADE', nullable: true })
  department!: DepartmentModel | null;

  @Column({ type: 'varchar', nullable: true })
  departmentId!: string | null;

  @ManyToOne(() => ProjectModel, { onDelete: 'CASCADE', nullable: true })
  project!: ProjectModel | null;

  @Column({ type: 'varchar', nullable: true })
  projectId!: string | null;

  @ManyToOne(() => OrganizationModel, { onDelete: 'CASCADE', nullable: true })
  organization!: OrganizationModel | null;

  @Column({ type: 'varchar', nullable: true })
  organizationId!: string | null;

  @Column({ default: false })
  onlyTicketsWithoutOtherRoom!: boolean;

  @Column({ type: 'text', array: true, default: '{}' })
  events!: string[];

  @Column({ default: false })
  includeText!: boolean;

  @Column({ default: false })
  includeFiles!: boolean;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastErrorAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
