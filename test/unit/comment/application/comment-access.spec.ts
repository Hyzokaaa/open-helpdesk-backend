import { Comment } from '../../../../src/comment/domain/entities/comment';
import { CommentEdit } from '../../../../src/comment/domain/entities/comment-edit';
import { CommentEditRepository } from '../../../../src/comment/domain/repositories/comment-edit.repository';
import { CreateComment } from '../../../../src/comment/domain/services/comment-create';
import { EditComment } from '../../../../src/comment/domain/services/comment-edit';
import { CreateCommentCommand } from '../../../../src/comment/application/commands/create-comment.command';
import { EditCommentCommand } from '../../../../src/comment/application/commands/edit-comment.command';
import { ListTicketCommentsQuery } from '../../../../src/comment/application/queries/list-ticket-comments.query';
import { GetCommentHistoryQuery } from '../../../../src/comment/application/queries/get-comment-history.query';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketParticipant } from '../../../../src/ticket/domain/entities/ticket-participant';
import { ParticipantRole } from '../../../../src/ticket/domain/enums/participant-role.enum';
import { EnsureTicketAccess } from '../../../../src/ticket/domain/services/ticket-ensure-access';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { AccessDeniedError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { MockCommentRepository } from '../../../mocks/mock-comment.repository';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockTicketParticipantRepository } from '../../../mocks/mock-ticket-participant.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

class InMemoryCommentEditRepository implements CommentEditRepository {
  readonly edits: CommentEdit[] = [];
  async create(edit: CommentEdit): Promise<void> { this.edits.push(edit); }
  async findByCommentId(commentId: string): Promise<CommentEdit[]> { return this.edits.filter((e) => e.commentId === commentId); }
}

function makeTicket(id: string, workspaceId: string) {
  return new Ticket({
    id, name: 'Printer', description: '', priority: TicketPriority.MEDIUM, status: TicketStatus.PENDING,
    categoryId: 'cat', workspaceId, reporterId: 'reporter', assigneeId: null, ticketNumber: 1,
    tagIds: [], customFields: {}, discardReason: null, resolvedAt: null, resolvedById: null,
    createdAt: null, deletedAt: null,
  });
}

// "admin" administers ws-1 (slug "acme"); ticket-2 and its comment belong to ws-2.
describe('Comment access', () => {
  let comments: MockCommentRepository;
  let edits: InMemoryCommentEditRepository;
  let tickets: MockTicketRepository;
  let members: MockWorkspaceMemberRepository;
  let workspaces: MockWorkspaceRepository;
  let participants: MockTicketParticipantRepository;

  const ensureTicketAccess = () =>
    new EnsureTicketAccess(tickets, new EnsureWorkspacePermission(members), participants);
  const auditLog = () => new CreateAuditLogEntry(new FakeIdGenerator(), { create: async () => {} } as any);
  const admin = { userId: 'admin', isSystemAdmin: false };

  beforeEach(async () => {
    comments = new MockCommentRepository();
    edits = new InMemoryCommentEditRepository();
    tickets = new MockTicketRepository();
    members = new MockWorkspaceMemberRepository();
    workspaces = new MockWorkspaceRepository();
    participants = new MockTicketParticipantRepository();

    await workspaces.create(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'admin', role: WorkspaceRole.ADMIN }));
    members.seed(new WorkspaceMember({ id: 'm-2', workspaceId: 'ws-1', userId: 'follower', role: WorkspaceRole.AGENT }));
    members.seed(new WorkspaceMember({ id: 'm-3', workspaceId: 'ws-1', userId: 'other-agent', role: WorkspaceRole.AGENT }));
    participants.seed(new TicketParticipant({ id: 'p-1', ticketId: 'ticket-1', userId: 'follower', role: ParticipantRole.FOLLOWER }));
    await tickets.create(makeTicket('ticket-1', 'ws-1'));
    await tickets.create(makeTicket('ticket-2', 'ws-2'));
    await comments.create(new Comment({ id: 'comment-1', content: 'ours', ticketId: 'ticket-1', authorId: 'admin' }));
    await comments.create(new Comment({ id: 'comment-2', content: 'theirs', ticketId: 'ticket-2', authorId: 'admin' }));
    await edits.create(new CommentEdit({ id: 'edit-2', commentId: 'comment-2', content: 'older', editedById: 'admin' }));
  });

  it('does not list the comments of a ticket in another workspace', async () => {
    const query = new ListTicketCommentsQuery(comments, ensureTicketAccess());
    await expect(
      query.execute({ ticketId: 'ticket-2', workspaceId: 'ws-1', ...admin, page: 1, limit: 20 }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('shows the edit history only of a comment of the ticket the caller can see', async () => {
    const query = new GetCommentHistoryQuery(comments, ensureTicketAccess(), edits);
    await expect(
      query.execute({ commentId: 'comment-2', ticketId: 'ticket-1', workspaceId: 'ws-1', ...admin }),
    ).rejects.toThrow(EntityNotFoundError);
    await expect(
      query.execute({ commentId: 'comment-1', ticketId: 'ticket-1', workspaceId: 'ws-1', ...admin }),
    ).resolves.toEqual([]);
  });

  it('does not comment on a ticket of another workspace, and stores nothing', async () => {
    const command = new CreateCommentCommand(
      new CreateComment(new FakeIdGenerator(), comments),
      ensureTicketAccess(),
      tickets,
      workspaces,
      new MockUserRepository(),
      { emit: jest.fn() },
      auditLog(),
    );

    await expect(
      command.execute({ content: 'hello', ticketId: 'ticket-2', authorId: 'admin', workspaceSlug: 'acme', isSystemAdmin: false }),
    ).rejects.toThrow(EntityNotFoundError);
    expect(comments.getAll().map((c) => c.getId())).toEqual(['comment-1', 'comment-2']);
  });

  it('edits only comments of the ticket the caller has access to', async () => {
    const command = new EditCommentCommand(
      new EditComment(new FakeIdGenerator(), comments, edits),
      ensureTicketAccess(),
      auditLog(),
    );
    const edit = (commentId: string) =>
      command.execute({ commentId, ticketId: 'ticket-1', content: 'changed', userId: 'admin', isSystemAdmin: false, workspaceId: 'ws-1' });

    await expect(edit('comment-2')).rejects.toThrow(EntityNotFoundError);
    expect((await comments.findById('comment-2'))?.content).toBe('theirs');
    await expect(edit('comment-1')).resolves.toMatchObject({ content: 'changed' });
  });

  describe('taking part in a ticket', () => {
    const createComment = () => new CreateCommentCommand(
      new CreateComment(new FakeIdGenerator(), comments),
      ensureTicketAccess(),
      tickets,
      workspaces,
      new MockUserRepository(),
      { emit: jest.fn() },
      auditLog(),
    );
    const comment = (authorId: string) =>
      createComment().execute({ content: 'hello', ticketId: 'ticket-1', authorId, workspaceSlug: 'acme', isSystemAdmin: false });
    const editComment = (commentId: string, userId: string, isSystemAdmin = false) =>
      new EditCommentCommand(new EditComment(new FakeIdGenerator(), comments, edits), ensureTicketAccess(), auditLog())
        .execute({ commentId, ticketId: 'ticket-1', content: 'changed', userId, isSystemAdmin, workspaceId: 'ws-1' });

    it('lets followers comment and edit their own comments', async () => {
      const { id } = await comment('follower');
      await expect(editComment(id, 'follower')).resolves.toMatchObject({ content: 'changed' });
    });

    it('does not let an agent without access to the ticket comment', async () => {
      await expect(comment('other-agent')).rejects.toThrow(AccessDeniedError);
    });

    it('lets nobody but the author edit a comment, system admins included', async () => {
      const { id } = await comment('follower');
      await expect(editComment(id, 'admin')).rejects.toThrow(AccessDeniedError);
      await expect(editComment(id, 'sysadmin', true)).rejects.toThrow(AccessDeniedError);
      expect((await comments.findById(id))?.content).toBe('hello');
    });
  });
});
