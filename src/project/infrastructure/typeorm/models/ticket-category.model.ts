import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';
import { ProjectModel } from './project.model';

@Entity('ticket_categories')
export class TicketCategoryModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column()
  slug!: string;

  @Column({ default: 'blue' })
  color!: string;

  @ManyToOne(() => ProjectModel, { nullable: true, onDelete: 'CASCADE' })
  project!: ProjectModel | null;

  @Column({ type: 'varchar', nullable: true })
  projectId!: string | null;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
