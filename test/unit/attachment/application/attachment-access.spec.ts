import { Attachment } from '../../../../src/attachment/domain/entities/attachment';
import { EnsureAttachmentAccess } from '../../../../src/attachment/domain/services/attachment-ensure-access';
import { ClaimStagedAttachments } from '../../../../src/attachment/domain/services/attachment-claim-staged';
import { CreateAttachment } from '../../../../src/attachment/domain/services/attachment-create';
import { DeleteAttachment } from '../../../../src/attachment/domain/services/attachment-delete';
import { UploadAttachmentCommand } from '../../../../src/attachment/application/commands/upload-attachment.command';
import { DeleteAttachmentCommand } from '../../../../src/attachment/application/commands/delete-attachment.command';
import { GetAttachmentQuery } from '../../../../src/attachment/application/queries/get-attachment.query';
import { ListTicketAttachmentsQuery } from '../../../../src/attachment/application/queries/list-ticket-attachments.query';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { Comment } from '../../../../src/comment/domain/entities/comment';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { TicketParticipant } from '../../../../src/ticket/domain/entities/ticket-participant';
import { EnsureTicketAccess } from '../../../../src/ticket/domain/services/ticket-ensure-access';
import { ParticipantRole } from '../../../../src/ticket/domain/enums/participant-role.enum';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { AccessDeniedError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { MockAttachmentRepository } from '../../../mocks/mock-attachment.repository';
import { MockCommentRepository } from '../../../mocks/mock-comment.repository';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockTicketParticipantRepository } from '../../../mocks/mock-ticket-participant.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakeS3Storage } from '../../../mocks/fake-s3-storage';

// ws-1 holds ticket-1, opened by "reporter" and assigned to "agent". ws-2 holds ticket-2.
function makeTicket(id: string, workspaceId: string) {
  return new Ticket({
    id, name: 'Printer', description: '', priority: TicketPriority.MEDIUM, status: TicketStatus.PENDING,
    categoryId: 'cat', workspaceId, reporterId: 'reporter', assigneeId: 'agent', ticketNumber: 1,
    tagIds: [], customFields: {}, discardReason: null, resolvedAt: null, resolvedById: null,
    createdAt: null, deletedAt: null,
  });
}

function makeAttachment(id: string, overrides: Partial<{ ticketId: string | null; commentId: string | null; uploadedById: string | null; token: string | null }>) {
  return new Attachment({
    id, fileName: 'file.png', originalName: 'file.png', mimeType: 'image/png', size: 1,
    s3Key: `attachments/${id}/file.png`,
    ticketId: overrides.ticketId ?? null,
    commentId: overrides.commentId ?? null,
    uploadedById: overrides.uploadedById ?? null,
    token: overrides.token ?? null,
    stagedAt: overrides.token ? new Date() : null,
  });
}

describe('Attachment access', () => {
  let attachments: MockAttachmentRepository;
  let comments: MockCommentRepository;
  let tickets: MockTicketRepository;
  let participants: MockTicketParticipantRepository;
  let members: MockWorkspaceMemberRepository;
  let storage: FakeS3Storage;
  let audit: { create: jest.Mock };

  const ensurePermission = () => new EnsureWorkspacePermission(members);
  const ensureTicketAccess = () => new EnsureTicketAccess(tickets, ensurePermission(), participants);
  const ensureAttachmentAccess = () =>
    new EnsureAttachmentAccess(attachments, tickets, comments, ensureTicketAccess(), ensurePermission());
  const auditLog = () => new CreateAuditLogEntry(new FakeIdGenerator(), audit as any);
  const caller = (userId: string) => ({ userId, isSystemAdmin: false });

  beforeEach(async () => {
    attachments = new MockAttachmentRepository();
    comments = new MockCommentRepository();
    tickets = new MockTicketRepository();
    participants = new MockTicketParticipantRepository();
    members = new MockWorkspaceMemberRepository();
    storage = new FakeS3Storage();
    audit = { create: jest.fn() };

    await tickets.create(makeTicket('ticket-1', 'ws-1'));
    await tickets.create(makeTicket('ticket-2', 'ws-2'));
    for (const [userId, role] of [
      ['admin', WorkspaceRole.ADMIN], ['supervisor', WorkspaceRole.SUPERVISOR], ['agent', WorkspaceRole.AGENT],
      ['other-agent', WorkspaceRole.AGENT], ['reporter', WorkspaceRole.USER], ['follower', WorkspaceRole.USER],
    ] as const) {
      members.seed(new WorkspaceMember({ id: `m-${userId}`, workspaceId: 'ws-1', userId, role }));
    }
    members.seed(new WorkspaceMember({ id: 'm-outsider', workspaceId: 'ws-2', userId: 'outsider', role: WorkspaceRole.ADMIN }));
    participants.seed(new TicketParticipant({ id: 'p-1', ticketId: 'ticket-1', userId: 'follower', role: ParticipantRole.FOLLOWER }));
    await comments.create(new Comment({ id: 'comment-1', content: 'hi', ticketId: 'ticket-1', authorId: 'agent' }));

    attachments.seed(makeAttachment('by-reporter', { ticketId: 'ticket-1', uploadedById: 'reporter' }));
    attachments.seed(makeAttachment('by-agent', { ticketId: 'ticket-1', uploadedById: 'agent' }));
    attachments.seed(makeAttachment('by-email', { ticketId: 'ticket-1', uploadedById: null }));
    attachments.seed(makeAttachment('on-comment', { commentId: 'comment-1', uploadedById: 'agent' }));
    attachments.seed(makeAttachment('staged', { uploadedById: 'reporter', token: 'tok-reporter' }));
  });

  describe('seeing an attachment', () => {
    const get = (attachmentId: string, userId: string) =>
      new GetAttachmentQuery(ensureAttachmentAccess(), storage as any).execute({ attachmentId, ...caller(userId) });

    it('lets anyone who can see the ticket see its attachments, read-only followers included', async () => {
      await expect(get('by-agent', 'reporter')).resolves.toMatchObject({ id: 'by-agent' });
      await expect(get('by-agent', 'follower')).resolves.toMatchObject({ id: 'by-agent' });
    });

    it('finds the ticket of a file that only records its comment', async () => {
      await expect(get('on-comment', 'reporter')).resolves.toMatchObject({ id: 'on-comment' });
      await expect(get('on-comment', 'outsider')).rejects.toThrow(EntityNotFoundError);
    });

    it('hides attachments from members of other workspaces as if they did not exist', async () => {
      await expect(get('by-agent', 'outsider')).rejects.toThrow(EntityNotFoundError);
    });

    it('hides attachments from members of the workspace who cannot see the ticket', async () => {
      await expect(get('by-agent', 'other-agent')).rejects.toThrow(EntityNotFoundError);
    });

    it('shows a staged upload only to the person who uploaded it', async () => {
      await expect(get('staged', 'reporter')).resolves.toMatchObject({ id: 'staged' });
      await expect(get('staged', 'admin')).rejects.toThrow(EntityNotFoundError);
    });

    it('does not list the attachments of a ticket in another workspace', async () => {
      const list = new ListTicketAttachmentsQuery(attachments, storage as any, ensureTicketAccess(), ensurePermission());
      await expect(
        list.execute({ ticketId: 'ticket-2', workspaceId: 'ws-1', ...caller('admin') }),
      ).rejects.toThrow(EntityNotFoundError);
    });
  });

  describe('deleting an attachment', () => {
    const remove = (attachmentId: string, userId: string) =>
      new DeleteAttachmentCommand(new DeleteAttachment(attachments, storage as any), ensureAttachmentAccess(), auditLog())
        .execute({ attachmentId, ...caller(userId) });

    it('lets admins and supervisors delete attachments added by anyone', async () => {
      await expect(remove('by-reporter', 'admin')).resolves.toBeUndefined();
      await expect(remove('by-email', 'supervisor')).resolves.toBeUndefined();
    });

    it('lets everyone else delete only what they added, the ticket reporter included', async () => {
      await expect(remove('by-agent', 'reporter')).rejects.toThrow(AccessDeniedError);
      await expect(remove('by-email', 'reporter')).rejects.toThrow(AccessDeniedError);
      await expect(remove('by-reporter', 'agent')).rejects.toThrow(AccessDeniedError);

      await expect(remove('by-reporter', 'reporter')).resolves.toBeUndefined();
      await expect(remove('by-agent', 'agent')).resolves.toBeUndefined();
    });

    it('does not let read-only followers delete', async () => {
      attachments.seed(makeAttachment('by-follower', { ticketId: 'ticket-1', uploadedById: 'follower' }));
      await expect(remove('by-follower', 'follower')).rejects.toThrow(AccessDeniedError);
    });

    it('audits the deletion in the workspace of the ticket', async () => {
      await remove('by-email', 'admin');
      expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1' }));
    });

    it('tells the client which attachments the caller may delete, with the same rule', async () => {
      const list = new ListTicketAttachmentsQuery(attachments, storage as any, ensureTicketAccess(), ensurePermission());
      const items = await list.execute({ ticketId: 'ticket-1', workspaceId: 'ws-1', ...caller('reporter') });
      const deletable = items.filter((i) => i.canDelete).map((i) => i.id);
      expect(deletable).toEqual(['by-reporter']);
    });
  });

  describe('uploading', () => {
    const upload = (props: { ticketId: string; commentId?: string; workspaceId?: string; userId: string }) =>
      new UploadAttachmentCommand(
        new CreateAttachment(new FakeIdGenerator(), attachments, storage as any),
        ensureTicketAccess(),
        ensurePermission(),
        comments,
        auditLog(),
      ).execute({
        buffer: Buffer.from('x'), originalName: 'notes.txt', mimeType: 'text/plain', size: 1,
        ticketId: props.ticketId, commentId: props.commentId ?? null,
        workspaceId: props.workspaceId ?? 'ws-1', userId: props.userId, isSystemAdmin: false,
      });

    it('needs full access to the ticket', async () => {
      await expect(upload({ ticketId: 'ticket-1', userId: 'follower' })).rejects.toThrow(AccessDeniedError);
      await expect(upload({ ticketId: 'ticket-2', userId: 'admin' })).rejects.toThrow(EntityNotFoundError);
      await expect(upload({ ticketId: 'ticket-1', userId: 'reporter' })).resolves.toMatchObject({ originalName: 'notes.txt' });
    });

    it('accepts a comment only of the same ticket, and records the ticket so the file is listed', async () => {
      await comments.create(new Comment({ id: 'comment-2', content: 'x', ticketId: 'ticket-2', authorId: 'outsider' }));
      await expect(upload({ ticketId: 'ticket-1', commentId: 'comment-2', userId: 'agent' })).rejects.toThrow(EntityNotFoundError);

      const { id } = await upload({ ticketId: 'ticket-1', commentId: 'comment-1', userId: 'agent' });
      expect(await attachments.findById(id)).toMatchObject({ ticketId: 'ticket-1', commentId: 'comment-1', uploadedById: 'agent' });
    });

    it('claims only the staged uploads of whoever creates the ticket', async () => {
      attachments.seed(makeAttachment('staged-by-agent', { uploadedById: 'agent', token: 'tok-agent' }));
      await new ClaimStagedAttachments(attachments).execute({
        tokens: ['tok-reporter', 'tok-agent'], ticketId: 'ticket-1', uploadedById: 'agent',
      });

      expect((await attachments.findById('staged-by-agent'))?.ticketId).toBe('ticket-1');
      expect((await attachments.findById('staged'))?.ticketId).toBeNull();
    });
  });
});
