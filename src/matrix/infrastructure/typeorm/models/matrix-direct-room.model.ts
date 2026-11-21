import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryColumn, Unique } from 'typeorm';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';
import { MatrixBotModel } from './matrix-bot.model';

@Entity('matrix_direct_rooms')
@Unique(['botId', 'userId'])
export class MatrixDirectRoomModel {
  @PrimaryColumn()
  id!: string;

  /** Gone with the bot: a bot connected again opens new chats. */
  @ManyToOne(() => MatrixBotModel, { onDelete: 'CASCADE' })
  bot!: MatrixBotModel;

  @Column()
  botId!: string;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  user!: UserModel;

  @Column()
  userId!: string;

  @Column()
  matrixUserId!: string;

  /** The Matrix room ID (!…). */
  @Column()
  roomId!: string;

  /** The user left or rejected the chat: paused until they reconnect it. */
  @Column({ type: 'timestamptz', nullable: true })
  lostAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
