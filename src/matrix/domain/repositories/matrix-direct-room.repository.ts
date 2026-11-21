import { MatrixDirectRoom } from '../entities/matrix-direct-room';

export interface MatrixDirectRoomRepository {
  find(botId: string, userId: string): Promise<MatrixDirectRoom | null>;
  findByUserId(userId: string): Promise<MatrixDirectRoom[]>;
  findByBotId(botId: string): Promise<MatrixDirectRoom[]>;
  /** Throws ConflictError when the bot opened another chat with the same user meanwhile. */
  save(room: MatrixDirectRoom): Promise<void>;
  delete(id: string): Promise<void>;
}
