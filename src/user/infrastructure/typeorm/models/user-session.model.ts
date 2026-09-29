import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserModel } from './user.model';

@Entity('user_sessions')
@Index('IDX_user_sessions_token_hash', ['tokenHash'], { unique: true })
@Index('IDX_user_sessions_previous_token_hash', ['previousTokenHash'])
@Index('IDX_user_sessions_user', ['userId'])
export class UserSessionModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  user!: UserModel;

  @Column()
  userId!: string;

  @Column()
  tokenHash!: string;

  @Column({ type: 'varchar', nullable: true })
  previousTokenHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rotatedAt!: Date | null;

  @Column({ default: false })
  rememberMe!: boolean;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
