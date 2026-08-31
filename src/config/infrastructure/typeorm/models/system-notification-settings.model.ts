import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class SystemNotificationSettingsModel {
  @PrimaryColumn()
  id!: string;

  @Column({ default: true })
  upgradeEnabled!: boolean;

  @Column({ default: true })
  upgradeEmail!: boolean;

  @Column({ default: true })
  upgradeInApp!: boolean;

  @Column({ type: 'varchar', nullable: true })
  lastNotifiedVersion!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
