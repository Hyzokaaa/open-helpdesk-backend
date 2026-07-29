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
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';
import { KbCategoryModel } from './kb-category.model';

@Entity('kb_articles')
@Unique(['workspaceId', 'slug'])
export class KbArticleModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  title!: string;

  @Column()
  slug!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ default: 'draft' })
  status!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column()
  categoryId!: string;

  @ManyToOne(() => KbCategoryModel, { onDelete: 'CASCADE' })
  category!: KbCategoryModel;

  @Column()
  workspaceId!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  createdById!: string;

  @ManyToOne(() => UserModel, { onDelete: 'SET NULL' })
  createdBy!: UserModel;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
