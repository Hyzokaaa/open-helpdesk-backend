import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('kb_categories')
@Unique(['workspaceId', 'slug'])
export class KbCategoryModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column()
  slug!: string;

  @Column({ type: 'varchar', nullable: true })
  icon!: string | null;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column()
  workspaceId!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
