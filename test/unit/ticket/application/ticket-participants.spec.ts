import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { ParticipantRole } from '../../../../src/ticket/domain/enums/participant-role.enum';
import { TicketParticipant } from '../../../../src/ticket/domain/entities/ticket-participant';
import { AddTicketParticipant } from '../../../../src/ticket/domain/services/ticket-add-participant';
import { AddTicketParticipantCommand } from '../../../../src/ticket/application/commands/add-ticket-participant.command';
import { RemoveTicketParticipantCommand } from '../../../../src/ticket/application/commands/remove-ticket-participant.command';
import { ListTicketParticipantsQuery } from '../../../../src/ticket/application/queries/list-ticket-participants.query';
import { TicketWorld, WS_A, WS_B, makeTicket } from './ticket-security-fixtures';

describe('Ticket followers', () => {
  let w: TicketWorld;

  const add = () => new AddTicketParticipantCommand(
    new AddTicketParticipant(w.ids, w.participants), w.ensureTicketAccess(), w.ensurePermission(), w.members, w.auditLog(),
  );
  const remove = () => new RemoveTicketParticipantCommand(w.participants, w.ensureTicketAccess(), w.ensurePermission(), w.auditLog());
  const list = () => new ListTicketParticipantsQuery(w.participants, w.users, w.ensureTicketAccess());

  beforeEach(async () => {
    w = new TicketWorld();
    await w.tickets.create(makeTicket({ id: 'ticket-a', reporterId: 'reporter-a' }));
    await w.tickets.create(makeTicket({ id: 'ticket-b', workspaceId: WS_B, reporterId: 'reporter-b' }));
    w.member('admin-a', WorkspaceRole.ADMIN);
    w.member('agent-a', WorkspaceRole.AGENT);
    w.member('reporter-a', WorkspaceRole.USER);
    w.member('other-user-a', WorkspaceRole.USER);
    w.member('admin-b', WorkspaceRole.ADMIN, WS_B);
    w.member('reporter-b', WorkspaceRole.USER, WS_B);
    w.participants.seed(new TicketParticipant({ id: 'p-1', ticketId: 'ticket-a', userId: 'agent-a', role: ParticipantRole.FOLLOWER }));
  });

  describe('listing', () => {
    it('a user who cannot see the ticket does not learn who follows it', async () => {
      await expect(list().execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'other-user-a', isSystemAdmin: false }))
        .rejects.toThrow(AccessDeniedError);
    });

    it('a member of workspace B cannot list the followers of a ticket of workspace A', async () => {
      await expect(list().execute({ ticketId: 'ticket-a', workspaceId: WS_B, userId: 'admin-b', isSystemAdmin: false }))
        .rejects.toThrow(EntityNotFoundError);
    });

    it('the reporter still sees the followers of their own ticket, names resolved in one lookup', async () => {
      const findByIds = jest.spyOn(w.users, 'findByIds');
      const findById = jest.spyOn(w.users, 'findById');
      const result = await list().execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'reporter-a', isSystemAdmin: false });
      expect(result).toEqual([{ id: 'p-1', userId: 'agent-a', firstName: 'agent-a', lastName: 'Test', email: 'agent-a@example.com', role: 'follower' }]);
      expect(findByIds).toHaveBeenCalledTimes(1);
      expect(findById).not.toHaveBeenCalled();
    });
  });

  describe('adding', () => {
    it('a member of workspace B cannot be made a follower of a ticket of workspace A, so they never gain read access to it', async () => {
      await expect(add().execute({
        ticketId: 'ticket-a', workspaceId: WS_A, userId: 'admin-a', targetUserId: 'admin-b', role: ParticipantRole.FOLLOWER, isSystemAdmin: false,
      })).rejects.toThrow(DomainValidationError);
      expect(await w.participants.exists('ticket-a', 'admin-b')).toBe(false);
    });

    it('an admin of workspace B cannot add followers to a ticket of workspace A by addressing it through their own workspace', async () => {
      await expect(add().execute({
        ticketId: 'ticket-a', workspaceId: WS_B, userId: 'admin-b', targetUserId: 'reporter-b', role: ParticipantRole.FOLLOWER, isSystemAdmin: false,
      })).rejects.toThrow(EntityNotFoundError);
      expect(await w.participants.exists('ticket-a', 'reporter-b')).toBe(false);
    });

    it('a user who cannot see a ticket cannot follow it to gain access', async () => {
      await expect(add().execute({
        ticketId: 'ticket-a', workspaceId: WS_A, userId: 'other-user-a', targetUserId: 'other-user-a', role: ParticipantRole.FOLLOWER, isSystemAdmin: false,
      })).rejects.toThrow(AccessDeniedError);
      expect(await w.participants.exists('ticket-a', 'other-user-a')).toBe(false);
    });

    it('a reporter cannot add someone else as follower of their ticket', async () => {
      await expect(add().execute({
        ticketId: 'ticket-a', workspaceId: WS_A, userId: 'reporter-a', targetUserId: 'other-user-a', role: ParticipantRole.FOLLOWER, isSystemAdmin: false,
      })).rejects.toThrow(AccessDeniedError);
      expect(await w.participants.exists('ticket-a', 'other-user-a')).toBe(false);
    });

    it('an admin adds a member of the workspace as follower', async () => {
      const result = await add().execute({
        ticketId: 'ticket-a', workspaceId: WS_A, userId: 'admin-a', targetUserId: 'other-user-a', role: ParticipantRole.FOLLOWER, isSystemAdmin: false,
      });
      expect(result).toEqual({ added: true });
      expect(await w.participants.exists('ticket-a', 'other-user-a')).toBe(true);
      expect(w.audit.entries).toHaveLength(1);
    });

    it('the reporter may follow their own ticket', async () => {
      const result = await add().execute({
        ticketId: 'ticket-a', workspaceId: WS_A, userId: 'reporter-a', targetUserId: 'reporter-a', role: ParticipantRole.FOLLOWER, isSystemAdmin: false,
      });
      expect(result).toEqual({ added: true });
    });
  });

  describe('removing', () => {
    it('a reporter cannot remove the agent following their ticket', async () => {
      await expect(remove().execute({
        ticketId: 'ticket-a', workspaceId: WS_A, userId: 'reporter-a', targetUserId: 'agent-a', isSystemAdmin: false,
      })).rejects.toThrow(AccessDeniedError);
      expect(await w.participants.exists('ticket-a', 'agent-a')).toBe(true);
    });

    it('a member of workspace B cannot remove followers from a ticket of workspace A', async () => {
      await expect(remove().execute({
        ticketId: 'ticket-a', workspaceId: WS_B, userId: 'admin-b', targetUserId: 'agent-a', isSystemAdmin: false,
      })).rejects.toThrow(EntityNotFoundError);
      expect(await w.participants.exists('ticket-a', 'agent-a')).toBe(true);
    });

    it('a follower may unfollow themselves even with read-only access', async () => {
      w.participants.seed(new TicketParticipant({ id: 'p-2', ticketId: 'ticket-a', userId: 'other-user-a', role: ParticipantRole.FOLLOWER }));
      await remove().execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'other-user-a', targetUserId: 'other-user-a', isSystemAdmin: false });
      expect(await w.participants.exists('ticket-a', 'other-user-a')).toBe(false);
    });

    it('an admin removes another follower', async () => {
      await remove().execute({ ticketId: 'ticket-a', workspaceId: WS_A, userId: 'admin-a', targetUserId: 'agent-a', isSystemAdmin: false });
      expect(await w.participants.exists('ticket-a', 'agent-a')).toBe(false);
    });
  });
});
