import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketDescriptionEdit } from '../../../domain/entities/ticket-description-edit';
import { TicketDescriptionEditRepository } from '../../../domain/repositories/ticket-description-edit.repository';
import { TicketDescriptionEditModel } from '../models/ticket-description-edit.model';

@Injectable()
export class TypeOrmTicketDescriptionEditRepository implements TicketDescriptionEditRepository {
  constructor(
    @InjectRepository(TicketDescriptionEditModel)
    private readonly repository: Repository<TicketDescriptionEditModel>,
  ) {}

  async create(edit: TicketDescriptionEdit): Promise<void> {
    const model = new TicketDescriptionEditModel();
    model.id = edit.getId();
    model.content = edit.content;
    model.ticketId = edit.ticketId;
    model.editedById = edit.editedById;
    await this.repository.save(model);
  }

  async findByTicketId(ticketId: string): Promise<TicketDescriptionEdit[]> {
    const models = await this.repository.find({
      where: { ticketId },
      order: { createdAt: 'DESC' },
      relations: ['editedBy'],
    });

    return models.map(
      (m) =>
        new TicketDescriptionEdit({
          id: m.id,
          ticketId: m.ticketId,
          content: m.content,
          editedById: m.editedById,
          createdAt: m.createdAt,
        }),
    );
  }
}
