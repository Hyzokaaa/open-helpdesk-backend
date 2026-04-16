import { NotFoundException } from '@nestjs/common';
import { Query } from '../../../shared/domain/query';
import { TicketRepository } from '../../domain/repositories/ticket.repository';

interface Props {
  ticketId: string;
}

export interface TicketDetailResponse {
  id: string;
  name: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  workspaceId: string;
  creatorId: string;
  assigneeId: string | null;
  resolvedAt: Date | null;
  tagIds: string[];
}

export class GetTicketQuery implements Query<Props, TicketDetailResponse> {
  constructor(private readonly repository: TicketRepository) {}

  async execute(props: Props): Promise<TicketDetailResponse> {
    const ticket = await this.repository.findById(props.ticketId);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return {
      id: ticket.getId(),
      name: ticket.name,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      category: ticket.category,
      workspaceId: ticket.workspaceId,
      creatorId: ticket.creatorId,
      assigneeId: ticket.assigneeId,
      resolvedAt: ticket.resolvedAt,
      tagIds: ticket.tagIds,
    };
  }
}
