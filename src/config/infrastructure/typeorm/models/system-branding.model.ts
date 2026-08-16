import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_branding')
export class SystemBrandingModel {
  @PrimaryColumn()
  id!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  appName!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  appSubtitle!: string | null;

  @Column({ type: 'varchar', nullable: true })
  logo!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
