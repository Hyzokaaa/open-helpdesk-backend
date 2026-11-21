import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatrixTicketThread } from '../../../domain/entities/matrix-ticket-thread';
import { MatrixTicketThreadRepository } from '../../../domain/repositories/matrix-ticket-thread.repository';
import { MatrixTicketThreadModel } from '../models/matrix-ticket-thread.model';

@Injectable()
export class TypeOrmMatrixTicketThreadRepository implements MatrixTicketThreadRepository {
  constructor(
    @InjectRepository(MatrixTicketThreadModel)
    private readonly repository: Repository<MatrixTicketThreadModel>,
  ) {}

  async find(ticketId: string, roomId: string): Promise<MatrixTicketThread | null> {
    const model = await this.repository.findOneBy({ ticketId, roomId });
    return model ? new MatrixTicketThread({ id: model.id, ticketId: model.ticketId, roomId: model.roomId, rootEventId: model.rootEventId }) : null;
  }

  async save(thread: MatrixTicketThread): Promise<void> {
    await this.repository.upsert(
      { id: thread.getId(), ticketId: thread.ticketId, roomId: thread.roomId, rootEventId: thread.rootEventId },
      { conflictPaths: ['ticketId', 'roomId'] },
    );
  }
}
