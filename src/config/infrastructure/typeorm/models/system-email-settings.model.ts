import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_email_settings')
export class SystemEmailSettingsModel {
  @PrimaryColumn()
  id!: string;

  @Column()
  smtpHost!: string;

  @Column()
  smtpPort!: number;

  @Column()
  smtpUser!: string;

  @Column()
  smtpPass!: string;

  @Column()
  smtpFrom!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
