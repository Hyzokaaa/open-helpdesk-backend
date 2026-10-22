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
    await repository.create(createTicket({ assigneeId: 'agent-1' }));

    const result = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.IN_PROGRESS, userId: 'user-1' });

    expect(result.status).toBe(TicketStatus.IN_PROGRESS);
  });

  it('should set resolvedAt when transitioning to resolved', async () => {
    await repository.create(createTicket());

    const result = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.RESOLVED, userId: 'user-1' });

    expect(result.resolvedAt).toBeInstanceOf(Date);
  });

  it('does not reopen: a closed ticket only moves between closed statuses', async () => {
    await repository.create(createTicket({ status: TicketStatus.RESOLVED, resolvedAt: new Date() }));

    for (const status of [TicketStatus.IN_PROGRESS, TicketStatus.PENDING, TicketStatus.OPEN]) {
      await expect(service.execute({ ticketId: 'ticket-1', status, userId: 'user-1', canMoveToOpen: true }))
        .rejects.toThrow(DomainValidationError);
    }
    const discarded = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.DISCARDED, discardReason: TicketDiscardReason.DUPLICATE, userId: 'user-1' });
    expect(discarded.status).toBe(TicketStatus.DISCARDED);
  });

  it('keeps the first resolution apart', async () => {
    await repository.create(createTicket({ status: TicketStatus.IN_PROGRESS }));
    const first = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.RESOLVED, userId: 'user-1' });
    expect(first.firstResolvedAt).toEqual(first.resolvedAt);
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

  it('work with nobody assigned takes whoever moved it, as a pickup would', async () => {
    await repository.create(createTicket({ status: TicketStatus.OPEN }));

    const result = await service.execute({
      ticketId: 'ticket-1',
      status: TicketStatus.IN_PROGRESS,
      userId: 'user-2',
      takerId: 'user-2',
    });

    expect(result.assigneeId).toBe('user-2');
  });

  it('work with nobody assigned and nobody to take it is refused', async () => {
    await repository.create(createTicket({ status: TicketStatus.OPEN }));

    await expect(service.execute({ ticketId: 'ticket-1', status: TicketStatus.PENDING, userId: 'user-2', takerId: null }))
      .rejects.toThrow(DomainValidationError);
  });

  it('keeps whoever had it, and the queue lets go of them', async () => {
    await repository.create(createTicket({ assigneeId: 'agent-1' }));
    const kept = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.IN_PROGRESS, userId: 'user-2', takerId: 'user-2' });
    expect(kept.assigneeId).toBe('agent-1');

    const queued = await service.execute({ ticketId: 'ticket-1', status: TicketStatus.OPEN, userId: 'user-2', canMoveToOpen: true });
    expect(queued.assigneeId).toBeNull();
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
