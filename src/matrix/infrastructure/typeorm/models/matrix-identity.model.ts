import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('matrix_identities')
export class MatrixIdentityModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  user!: UserModel;

  @Column({ unique: true })
  userId!: string;

  /** Null once disconnected: the row keeps the code limits. */
  @Column({ type: 'varchar', nullable: true })
  matrixUserId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  codeHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  codeExpiresAt!: Date | null;

  @Column({ default: 0 })
  codeAttempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  codeSentAt!: Date | null;

  @Column({ default: 0 })
  codeSends!: number;

  @Column({ type: 'timestamptz', nullable: true })
  sendWindowStartedAt!: Date | null;

  /** A new ID being verified while the one above keeps the notices. */
  @Column({ type: 'varchar', nullable: true })
  pendingMatrixUserId!: string | null;

  /** Not a foreign key: a bot gone meanwhile only means the new ID gets a new chat. */
  @Column({ type: 'varchar', nullable: true })
  pendingBotId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  pendingRoomId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
