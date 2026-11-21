import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { MatrixRoomCreation } from '../../../domain/entities/matrix-room-creation';
import { MatrixRoomCreationRepository } from '../../../domain/repositories/matrix-room-creation.repository';
import { MatrixRoomCreationModel } from '../models/matrix-room-creation.model';

@Injectable()
export class TypeOrmMatrixRoomCreationRepository implements MatrixRoomCreationRepository {
  constructor(
    @InjectRepository(MatrixRoomCreationModel)
    private readonly repository: Repository<MatrixRoomCreationModel>,
  ) {}

  async create(creation: MatrixRoomCreation): Promise<void> {
    await this.repository.insert({ id: creation.getId(), workspaceId: creation.workspaceId, createdAt: creation.createdAt });
  }

  async countSince(workspaceId: string, since: Date): Promise<number> {
    return this.repository.countBy({ workspaceId, createdAt: MoreThanOrEqual(since) });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async deleteBefore(workspaceId: string, before: Date): Promise<void> {
    await this.repository.delete({ workspaceId, createdAt: LessThan(before) });
  }
}
