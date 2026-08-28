import {
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ProjectModel } from './project.model';
import { TicketCategoryModel } from './ticket-category.model';

@Entity('project_categories')
export class ProjectCategoryModel {
  @PrimaryColumn()
  projectId!: string;

  @PrimaryColumn()
  categoryId!: string;

  @ManyToOne(() => ProjectModel, { onDelete: 'CASCADE' })
  project!: ProjectModel;

  @ManyToOne(() => TicketCategoryModel, { onDelete: 'CASCADE' })
  category!: TicketCategoryModel;
}
