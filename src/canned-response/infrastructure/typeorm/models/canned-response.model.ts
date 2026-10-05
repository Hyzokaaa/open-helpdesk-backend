import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('canned_responses')
@Index('IDX_canned_responses_workspace', ['workspaceId'])
export class CannedResponseModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
