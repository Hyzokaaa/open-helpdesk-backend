import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { WorkspaceModel } from './workspace.model';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('workspace_members')
@Unique(['workspaceId', 'userId'])
export class WorkspaceMemberModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @ManyToOne(() => UserModel)
  user!: UserModel;

  @Column()
  userId!: string;

  @Column()
  role!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
