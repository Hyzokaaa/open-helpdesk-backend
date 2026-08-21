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
import { OrganizationModel } from '../../../../organization/infrastructure/typeorm/models/organization.model';

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

  @ManyToOne(() => OrganizationModel, { nullable: true, onDelete: 'SET NULL' })
  organization!: OrganizationModel | null;

  @Column({ type: 'varchar', nullable: true })
  organizationId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
