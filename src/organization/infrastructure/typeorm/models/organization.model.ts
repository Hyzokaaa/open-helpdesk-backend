import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('organizations')
export class OrganizationModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', nullable: true })
  logo!: string | null;

  @Column({ type: 'jsonb', default: [] })
  domains!: string[];

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;
}
