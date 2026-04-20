import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';
import { TagModel } from '../../../../tag/infrastructure/typeorm/models/tag.model';

@Entity('tickets')
export class TicketModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column('text')
  description!: string;

  @Column()
  priority!: string;

  @Column()
  status!: string;

  @Column()
  category!: string;

  @ManyToOne(() => WorkspaceModel)
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @ManyToOne(() => UserModel)
  creator!: UserModel;

  @Column()
  creatorId!: string;

  @ManyToOne(() => UserModel, { nullable: true })
  assignee!: UserModel | null;

  @Column({ type: 'varchar', nullable: true })
  assigneeId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt!: Date | null;

  @ManyToMany(() => TagModel)
  @JoinTable({ name: 'ticket_tag' })
  tags!: TagModel[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;
}
