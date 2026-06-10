import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('api_keys')
export class ApiKeyModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  key!: string;

  @Column()
  prefix!: string;

  @Column({ type: 'simple-array', default: 'tickets:read,tickets:write,comments:read,comments:write,members:read' })
  scopes!: string[];

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @ManyToOne(() => UserModel)
  createdBy!: UserModel;

  @Column()
  createdById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
