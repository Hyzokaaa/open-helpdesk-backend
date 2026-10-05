import { AccessDeniedError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { TicketDescriptionEdit } from '../../../../src/ticket/domain/entities/ticket-description-edit';
import { TicketParticipant } from '../../../../src/ticket/domain/entities/ticket-participant';
import { ParticipantRole } from '../../../../src/ticket/domain/enums/participant-role.enum';
import { GetTicketDescriptionHistoryQuery } from '../../../../src/ticket/application/queries/get-ticket-description-history.query';
import { UpdateTicketAiCacheCommand } from '../../../../src/ticket/application/commands/update-ticket-ai-cache.command';
import { MockTicketDescriptionEditRepository } from '../../../mocks/mock-ticket-description-edit.repository';
import { TicketWorld, WS_A, WS_B, makeTicket } from './ticket-security-fixtures';

describe('Description history and AI cache', () => {
  let w: TicketWorld;
  let edits: MockTicketDescriptionEditRepository;

  beforeEach(async () => {
    w = new TicketWorld();
    edits = new MockTicketDescriptionEditRepository();
    await w.tickets.create(makeTicket({ id: 'ticket-a', reporterId: 'reporter-a', status: TicketStatus.PENDING }));
    edits.seed(new TicketDescriptionEdit({ id: 'e-1', ticketId: 'ticket-a', content: 'the old, private wording', editedById: 'reporter-a' }));
    w.member('agent-a', WorkspaceRole.AGENT);
    w.member('supervisor-a', WorkspaceRole.SUPERVISOR);
    w.member('reporter-a', WorkspaceRole.USER);
    w.member('other-user-a', WorkspaceRole.USER);
    w.member('admin-b', WorkspaceRole.ADMIN, WS_B);
  });

  describe('description history', () => {
    const query = () => new GetTicketDescriptionHistoryQuery(edits, w.ensureTicketAccess());

    it('another user of the workspace cannot read earlier versions of a ticket they cannot see', async () => {
      await expect(query().execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'other-user-a', isSystemAdmin: false }))
        .rejects.toThrow(AccessDeniedError);
    });

    it('a member of workspace B cannot read it either', async () => {
      await expect(query().execute({ ticketId: 'ticket-a', workspaceId: WS_B, userId: 'admin-b', isSystemAdmin: false }))
        .rejects.toThrow(EntityNotFoundError);
    });

    it('the reporter reads the history of their own ticket', async () => {
      const result = await query().execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'reporter-a', isSystemAdmin: false });
      expect(result.map((e) => e.content)).toEqual(['the old, private wording']);
    });
  });

  describe('AI cache', () => {
    const command = () => new UpdateTicketAiCacheCommand(w.tickets, w.ensureTicketAccess(), w.ensurePermission());
    const write = (userId: string, workspaceId = WS_A) => command().execute({
      ticketId: 'ticket-a', workspaceId, userId, isSystemAdmin: false, key: 'improve', source: 'original', result: 'planted text',
    });

    it('a user who cannot see the ticket cannot plant text in it for agents to read', async () => {
      await expect(write('other-user-a')).rejects.toThrow(AccessDeniedError);
      expect((await w.tickets.findById('ticket-a'))!.aiCache).toEqual({});
    });

    it('a read-only follower cannot write it', async () => {
      w.participants.seed(new TicketParticipant({ id: 'p', ticketId: 'ticket-a', userId: 'other-user-a', role: ParticipantRole.FOLLOWER }));
      await expect(write('other-user-a')).rejects.toThrow(AccessDeniedError);
    });

    it('a member of workspace B cannot write it', async () => {
      await expect(write('admin-b', WS_B)).rejects.toThrow(EntityNotFoundError);
    });

    it('the reporter, who cannot edit the description, cannot write it either', async () => {
      await expect(write('reporter-a')).rejects.toThrow(AccessDeniedError);
    });

    it('a supervisor stores and then clears an entry', async () => {
      await write('supervisor-a');
      expect((await w.tickets.findById('ticket-a'))!.aiCache).toEqual({ improve: { source: 'original', result: 'planted text' } });
      await command().execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'supervisor-a', isSystemAdmin: false, key: 'improve', clear: true });
      expect((await w.tickets.findById('ticket-a'))!.aiCache).toEqual({});
    });
  });
});
