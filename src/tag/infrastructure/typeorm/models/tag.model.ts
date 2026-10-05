import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('tags')
@Index('IDX_tags_workspace', ['workspaceId'])
export class TagModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  color!: string | null;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
