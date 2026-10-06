import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AnalyticsProvider } from '../../../../config/domain/enums/analytics-provider.enum';
import { WorkspaceModel } from './workspace.model';

@Entity('workspace_analytics_settings')
@Index('IDX_workspace_analytics_settings_workspace', ['workspaceId'], { unique: true })
export class WorkspaceAnalyticsSettingsModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  workspaceId!: string;

  @ManyToOne(() => WorkspaceModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace!: WorkspaceModel;

  @Column({ type: 'varchar', length: 20, nullable: true })
  provider!: AnalyticsProvider | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  serverUrl!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  siteId!: string | null;

  @Column({ default: false })
  useCookies!: boolean;

  @Column({ default: true })
  trackEvents!: boolean;

  @Column({ default: true })
  shareWithInstallation!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
