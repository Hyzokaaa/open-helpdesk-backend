import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AnalyticsProvider } from '../../../domain/enums/analytics-provider.enum';

@Entity('system_analytics_settings')
export class SystemAnalyticsSettingsModel {
  @PrimaryColumn()
  id!: string;

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
