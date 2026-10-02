import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('workspace_creation_settings')
export class WorkspaceCreationSettingsModel {
  @PrimaryColumn()
  id!: string;

  @Column({ default: false })
  selfService!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
