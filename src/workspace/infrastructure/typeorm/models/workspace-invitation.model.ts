import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from './workspace.model';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('workspace_invitations')
export class WorkspaceInvitationModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @Column()
  email!: string;

  @Column()
  role!: string;

  @Column()
  token!: string;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @ManyToOne(() => UserModel)
  invitedBy!: UserModel;

  @Column()
  invitedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
