import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WorkspaceModel } from './workspace.model';

/**
 * Identity of what a workspace import created or matched: the id an entity had in the file
 * (`sourceId`, its origin id) and the entity it is in this workspace (`targetId`). The next import
 * of the same content finds its entities through these rows instead of by name, and an export
 * carries `sourceId` as the origin id of an imported entity.
 */
@Entity('workspace_import_links')
@Index('IDX_workspace_import_links_source', ['workspaceId', 'entityType', 'sourceId'], { unique: true })
@Index('IDX_workspace_import_links_target', ['workspaceId', 'entityType', 'targetId'])
export class WorkspaceImportLinkModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  @Column({ type: 'varchar', length: 40 })
  entityType!: string;

  @Column({ type: 'varchar', length: 26 })
  sourceId!: string;

  @Column({ type: 'varchar', length: 26 })
  targetId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
