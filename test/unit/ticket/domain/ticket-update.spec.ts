import { UpdateTicket } from '../../../../src/ticket/domain/services/ticket-update';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketCategory } from '../../../../src/ticket/domain/enums/ticket-category.enum';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('UpdateTicket', () => {
  let service: UpdateTicket;
  let repository: MockTicketRepository;

  const seedTicket = () => {
    const ticket = new Ticket({
      id: 'ticket-1',
      name: 'Original',
      description: 'Original desc',
      priority: TicketPriority.LOW,
      status: TicketStatus.PENDING,
      category: TicketCategory.BUG,
      workspaceId: 'ws-1',
      creatorId: 'user-1',
      assigneeId: null,
      resolvedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      tagIds: ['tag-1'],
    });
    repository.create(ticket);
  };

  beforeEach(() => {
    repository = new MockTicketRepository();
    service = new UpdateTicket(repository);
  });

  it('should update only provided fields', async () => {
    seedTicket();

    const result = await service.execute({ ticketId: 'ticket-1', name: 'New name' });

    expect(result.name).toBe('New name');
    expect(result.description).toBe('Original desc');
    expect(result.priority).toBe(TicketPriority.LOW);
  });

  it('should update multiple fields at once', async () => {
    seedTicket();

    const result = await service.execute({
      ticketId: 'ticket-1',
      priority: TicketPriority.CRITICAL,
      category: TicketCategory.TASK,
      tagIds: ['tag-2', 'tag-3'],
    });

    expect(result.priority).toBe(TicketPriority.CRITICAL);
    expect(result.category).toBe(TicketCategory.TASK);
    expect(result.tagIds).toEqual(['tag-2', 'tag-3']);
  });

  it('should throw EntityNotFoundError when ticket does not exist', async () => {
    await expect(
      service.execute({ ticketId: 'nonexistent', name: 'x' }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
