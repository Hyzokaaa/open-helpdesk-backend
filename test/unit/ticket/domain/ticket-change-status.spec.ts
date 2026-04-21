import { ChangeTicketStatus } from '../../../../src/ticket/domain/services/ticket-change-status';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketCategory } from '../../../../src/ticket/domain/enums/ticket-category.enum';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { EntityNotFoundError } from '../../../../src/shared/domain/errors';

describe('ChangeTicketStatus', () => {
  let service: ChangeTicketStatus;
  let repository: MockTicketRepository;

  const createTicket = (overrides = {}) =>
    new Ticket({
      id: 'ticket-1',
      name: 'Test',
      description: 'desc',
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.PENDING,
      category: TicketCategory.BUG,
      workspaceId: 'ws-1',
      creatorId: 'user-1',
      assigneeId: null,
      resolvedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      tagIds: [],
      ...overrides,
    });

  beforeEach(() => {
    repository = new MockTicketRepository();
    service = new ChangeTicketStatus(repository);
  });

  it('should change status from pending to in-progress', async () => {
    await repository.create(createTicket());

    const result = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.IN_PROGRESS });

    expect(result.status).toBe(TicketStatus.IN_PROGRESS);
  });

  it('should set resolvedAt when transitioning to resolved', async () => {
    await repository.create(createTicket());

    const result = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.RESOLVED });

    expect(result.resolvedAt).toBeInstanceOf(Date);
  });

  it('should clear resolvedAt when moving back from resolved to in-progress', async () => {
    await repository.create(createTicket({ status: TicketStatus.RESOLVED, resolvedAt: new Date() }));

    const result = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.IN_PROGRESS });

    expect(result.resolvedAt).toBeNull();
  });

  it('should throw EntityNotFoundError when ticket does not exist', async () => {
    await expect(
      service.execute({ ticketId: 'nonexistent', status: TicketStatus.IN_PROGRESS }),
    ).rejects.toThrow(EntityNotFoundError);
  });
});
