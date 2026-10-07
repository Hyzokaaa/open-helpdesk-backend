import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('audit_retention_settings')
export class AuditRetentionSettingsModel {
  @PrimaryColumn()
  id!: string;

  @Column({ default: false })
  enabled!: boolean;

  /** Days per category; null keeps that category forever. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  days!: Record<string, number | null>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
