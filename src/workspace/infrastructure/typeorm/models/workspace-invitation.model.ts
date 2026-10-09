import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from './workspace.model';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('workspace_invitations')
@Index('IDX_workspace_invitations_workspace', ['workspaceId'])
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

  /** When the current link was issued: on creation and on every resend */
  @Column({ type: 'timestamptz', nullable: true })
  lastSentAt!: Date | null;

  /** When the inviter was told the invitation expired */
  @Column({ type: 'timestamptz', nullable: true })
  expiryNotifiedAt!: Date | null;

  @ManyToOne(() => UserModel)
  invitedBy!: UserModel;

  @Column()
  invitedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
