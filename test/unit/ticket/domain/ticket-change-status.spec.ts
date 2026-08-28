import { ChangeTicketStatus } from '../../../../src/ticket/domain/services/ticket-change-status';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';

import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { TicketDiscardReason } from '../../../../src/ticket/domain/enums/ticket-discard-reason.enum';
import { DomainValidationError, EntityNotFoundError } from '../../../../src/shared/domain/errors';

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
      categoryId: 'cat-bug',
      workspaceId: 'ws-1',
      reporterId: 'user-1',
      assigneeId: null,
      resolvedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      tagIds: [],
      resolvedById: null,
      customFields: {},
      discardReason: null,
      ...overrides,
    });

  beforeEach(() => {
    repository = new MockTicketRepository();
    service = new ChangeTicketStatus(repository);
  });

  it('should change status from pending to in-progress', async () => {
    await repository.create(createTicket());

    const result = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.IN_PROGRESS, userId: 'user-1' });

    expect(result.status).toBe(TicketStatus.IN_PROGRESS);
  });

  it('should set resolvedAt when transitioning to resolved', async () => {
    await repository.create(createTicket());

    const result = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.RESOLVED, userId: 'user-1' });

    expect(result.resolvedAt).toBeInstanceOf(Date);
  });

  it('should clear resolvedAt when moving back from resolved to in-progress', async () => {
    await repository.create(createTicket({ status: TicketStatus.RESOLVED, resolvedAt: new Date() }));

    const result = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.IN_PROGRESS, userId: 'user-1' });

    expect(result.resolvedAt).toBeNull();
  });

  it('should throw EntityNotFoundError when ticket does not exist', async () => {
    await expect(
      service.execute({ ticketId: 'nonexistent', status: TicketStatus.IN_PROGRESS, userId: 'user-1' }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('should reject transition from non-open to open without canMoveToOpen', async () => {
    await repository.create(createTicket({ status: TicketStatus.IN_PROGRESS }));

    await expect(
      service.execute({ ticketId: 'ticket-1', status: TicketStatus.OPEN, userId: 'user-1' }),
    ).rejects.toThrow(DomainValidationError);
  });

  it('should allow transition to open when canMoveToOpen is true', async () => {
    await repository.create(createTicket({ status: TicketStatus.IN_PROGRESS }));

    const result = await service.execute({
      ticketId: 'ticket-1',
      status: TicketStatus.OPEN,
      userId: 'user-1',
      canMoveToOpen: true,
    });

    expect(result.status).toBe(TicketStatus.OPEN);
    expect(result.assigneeId).toBeNull();
  });

  it('should not auto-assign when moving from open (pickup is explicit)', async () => {
    await repository.create(createTicket({ status: TicketStatus.OPEN }));

    const result = await service.execute({
      ticketId: 'ticket-1',
      status: TicketStatus.IN_PROGRESS,
      userId: 'user-2',
    });

    expect(result.assigneeId).toBeNull();
  });

  it('should require discard reason when discarding', async () => {
    await repository.create(createTicket());

    await expect(
      service.execute({ ticketId: 'ticket-1', status: TicketStatus.DISCARDED, userId: 'user-1' }),
    ).rejects.toThrow(DomainValidationError);
  });

  it('should set discard reason when discarding with reason', async () => {
    await repository.create(createTicket());

    const result = await service.execute({
      ticketId: 'ticket-1',
      status: TicketStatus.DISCARDED,
      userId: 'user-1',
      discardReason: TicketDiscardReason.SPAM,
    });

    expect(result.status).toBe(TicketStatus.DISCARDED);
    expect(result.discardReason).toBe(TicketDiscardReason.SPAM);
  });

  it('should set resolvedById when resolving', async () => {
    await repository.create(createTicket());

    const result = await service.execute({
      ticketId: 'ticket-1',
      status: TicketStatus.RESOLVED,
      userId: 'user-2',
    });

    expect(result.resolvedById).toBe('user-2');
  });
});
