import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserSignupSource } from '../../../domain/user-signup-source';

@Entity('users')
export class UserModel {
  @PrimaryColumn()
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isSystemAdmin!: boolean;

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ default: 'en' })
  language!: string;

  @Column({ default: 'system' })
  theme!: string;

  @Column({ default: 'DD/MM/YYYY' })
  dateFormat!: string;

  @Column({ default: 'auto' })
  timezone!: string;

  @Column({ default: false })
  autoCreated!: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  authProvider!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  avatarKey!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  signupMethod!: string | null;

  @Column({ type: 'jsonb', nullable: true, default: null })
  signupSource!: UserSignupSource | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
