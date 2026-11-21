import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatrixRoom } from '../../../domain/entities/matrix-room';
import { MatrixNoticeEvent } from '../../../domain/enums/matrix-notice-event.enum';
import { MatrixRoomRepository } from '../../../domain/repositories/matrix-room.repository';
import { MatrixRoomModel } from '../models/matrix-room.model';

@Injectable()
export class TypeOrmMatrixRoomRepository implements MatrixRoomRepository {
  constructor(
    @InjectRepository(MatrixRoomModel)
    private readonly repository: Repository<MatrixRoomModel>,
  ) {}

  async findById(id: string): Promise<MatrixRoom | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<MatrixRoom[]> {
    return (await this.repository.find({ where: { workspaceId }, order: { createdAt: 'ASC' } })).map((m) => this.toDomain(m));
  }

  async findForInstallationBot(): Promise<MatrixRoom[]> {
    const models = await this.repository.createQueryBuilder('room')
      .where('NOT EXISTS (SELECT 1 FROM matrix_bots bot WHERE bot."workspaceId" = room."workspaceId")')
      .orderBy('room.createdAt', 'ASC')
      .getMany();
    return models.map((m) => this.toDomain(m));
  }

  async findByRoomId(roomId: string): Promise<MatrixRoom[]> {
    return (await this.repository.findBy({ roomId })).map((m) => this.toDomain(m));
  }

  async save(room: MatrixRoom): Promise<void> {
    await this.repository.save({
      id: room.getId(),
      workspaceId: room.workspaceId,
      roomId: room.roomId,
      departmentId: room.departmentId,
      projectId: room.projectId,
      organizationId: room.organizationId,
      onlyTicketsWithoutOtherRoom: room.onlyTicketsWithoutOtherRoom,
      events: room.events,
      includeText: room.includeText,
      includeFiles: room.includeFiles,
      isActive: room.isActive,
      lastError: room.lastError,
      lastErrorAt: room.lastErrorAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  private toDomain(model: MatrixRoomModel): MatrixRoom {
    const known = new Set<string>(Object.values(MatrixNoticeEvent));
    return new MatrixRoom({
      id: model.id,
      workspaceId: model.workspaceId,
      roomId: model.roomId,
      departmentId: model.departmentId,
      projectId: model.projectId,
      organizationId: model.organizationId,
      onlyTicketsWithoutOtherRoom: model.onlyTicketsWithoutOtherRoom,
      events: model.events.filter((e): e is MatrixNoticeEvent => known.has(e)),
      includeText: model.includeText,
      includeFiles: model.includeFiles,
      isActive: model.isActive,
      lastError: model.lastError,
      lastErrorAt: model.lastErrorAt,
    });
  }
}
