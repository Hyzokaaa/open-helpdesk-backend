import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('ticket_categories')
@Index('IDX_ticket_categories_workspace', ['workspaceId'])
export class TicketCategoryModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column()
  slug!: string;

  @Column({ default: 'blue' })
  color!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
