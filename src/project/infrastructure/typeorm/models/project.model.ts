import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('projects')
export class ProjectModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;
}
