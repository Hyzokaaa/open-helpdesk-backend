import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('custom_field_definitions')
@Index('IDX_custom_field_definitions_workspace', ['workspaceId'])
export class CustomFieldDefinitionModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column()
  type!: string;

  @Column({ type: 'jsonb', nullable: true })
  options!: string[] | null;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'boolean', default: false })
  required!: boolean;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
