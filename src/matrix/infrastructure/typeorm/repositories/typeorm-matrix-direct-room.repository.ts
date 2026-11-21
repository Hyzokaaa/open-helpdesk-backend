import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictError } from '../../../../shared/domain/errors';
import { isUniqueViolation } from '../../../../shared/infrastructure/typeorm/unique-violation';
import { MatrixDirectRoom } from '../../../domain/entities/matrix-direct-room';
import { MatrixDirectRoomRepository } from '../../../domain/repositories/matrix-direct-room.repository';
import { MatrixDirectRoomModel } from '../models/matrix-direct-room.model';

@Injectable()
export class TypeOrmMatrixDirectRoomRepository implements MatrixDirectRoomRepository {
  constructor(
    @InjectRepository(MatrixDirectRoomModel)
    private readonly repository: Repository<MatrixDirectRoomModel>,
  ) {}

  async find(botId: string, userId: string): Promise<MatrixDirectRoom | null> {
    const model = await this.repository.findOneBy({ botId, userId });
    return model ? this.toDomain(model) : null;
  }

  async findByUserId(userId: string): Promise<MatrixDirectRoom[]> {
    return (await this.repository.findBy({ userId })).map((model) => this.toDomain(model));
  }

  async findByBotId(botId: string): Promise<MatrixDirectRoom[]> {
    return (await this.repository.findBy({ botId })).map((model) => this.toDomain(model));
  }

  async save(room: MatrixDirectRoom): Promise<void> {
    try {
      await this.repository.save({ id: room.getId(), botId: room.botId, userId: room.userId, matrixUserId: room.matrixUserId, roomId: room.roomId, lostAt: room.lostAt });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('The bot already has a direct chat with this user');
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  private toDomain(model: MatrixDirectRoomModel): MatrixDirectRoom {
    return new MatrixDirectRoom({ id: model.id, botId: model.botId, userId: model.userId, matrixUserId: model.matrixUserId, roomId: model.roomId, lostAt: model.lostAt });
  }
}
