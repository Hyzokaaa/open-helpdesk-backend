import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('matrix_room_creations')
@Index(['workspaceId', 'createdAt'])
export class MatrixRoomCreationModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  workspace!: WorkspaceModel;

  @Column()
  workspaceId!: string;

  /** Set by the domain, not the database: the daily limit compares it with the domain's clock. */
  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
