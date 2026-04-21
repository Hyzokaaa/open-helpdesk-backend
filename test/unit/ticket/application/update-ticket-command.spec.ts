import { UpdateTicketCommand } from '../../../../src/ticket/application/commands/update-ticket.command';
import { UpdateTicket } from '../../../../src/ticket/domain/services/ticket-update';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketCategory } from '../../../../src/ticket/domain/enums/ticket-category.enum';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';

describe('UpdateTicketCommand', () => {
  let command: UpdateTicketCommand;
  let ticketRepository: MockTicketRepository;
  let memberRepository: MockWorkspaceMemberRepository;

  const seedTicket = () => {
    const ticket = new Ticket({
      id: 'ticket-1',
      name: 'Original',
      description: 'Original desc',
      priority: TicketPriority.LOW,
      status: TicketStatus.PENDING,
      category: TicketCategory.BUG,
      workspaceId: 'ws-1',
      creatorId: 'creator-1',
      assigneeId: null,
      resolvedAt: null,
      createdAt: new Date(),
      deletedAt: null,
      tagIds: [],
    });
    ticketRepository.create(ticket);
    return ticket;
  };

  beforeEach(() => {
    ticketRepository = new MockTicketRepository();
    memberRepository = new MockWorkspaceMemberRepository();
    const updateService = new UpdateTicket(ticketRepository);
    const ensurePermission = new EnsureWorkspacePermission(memberRepository);
    command = new UpdateTicketCommand(updateService, ticketRepository, ensurePermission);
  });

  it('should allow admin to update name', async () => {
    seedTicket();
    memberRepository.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'admin-1', role: WorkspaceRole.ADMIN }));

    const result = await command.execute({
      ticketId: 'ticket-1',
      workspaceId: 'ws-1',
      userId: 'admin-1',
      isSystemAdmin: false,
      name: 'Updated name',
    });

    expect(result.name).toBe('Updated name');
  });

  it('should ignore name update for reporter (no TICKET_EDIT_NAME permission)', async () => {
    seedTicket();
    memberRepository.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'creator-1', role: WorkspaceRole.REPORTER }));

    const result = await command.execute({
      ticketId: 'ticket-1',
      workspaceId: 'ws-1',
      userId: 'creator-1',
      isSystemAdmin: false,
      name: 'Should be ignored',
      description: 'New desc',
    });

    expect(result.name).toBe('Original');
  });

  it('should throw AccessDeniedError for non-creator reporter editing other tickets', async () => {
    seedTicket();
    memberRepository.seed(new WorkspaceMember({ id: 'm-3', workspaceId: 'ws-1', userId: 'other-reporter', role: WorkspaceRole.REPORTER }));

    await expect(
      command.execute({
        ticketId: 'ticket-1',
        workspaceId: 'ws-1',
        userId: 'other-reporter',
        isSystemAdmin: false,
        description: 'hack',
      }),
    ).rejects.toThrow(AccessDeniedError);
  });
});
