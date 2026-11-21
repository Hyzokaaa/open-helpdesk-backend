import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { WorkspaceModel } from '../../../../workspace/infrastructure/typeorm/models/workspace.model';

@Entity('matrix_bots')
export class MatrixBotModel {
  @PrimaryColumn()
  id!: string;

  /** Null for the installation's bot. */
  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE', nullable: true })
  workspace!: WorkspaceModel | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  workspaceId!: string | null;

  @Column()
  homeserverUrl!: string;

  @Column()
  userId!: string;

  @Column({ type: 'varchar', nullable: true })
  deviceId!: string | null;

  @Column({ type: 'text' })
  encryptedAccessToken!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
