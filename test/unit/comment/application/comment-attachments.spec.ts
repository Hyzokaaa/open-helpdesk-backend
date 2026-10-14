import { CreateComment } from '../../../../src/comment/domain/services/comment-create';
import { CreateCommentCommand } from '../../../../src/comment/application/commands/create-comment.command';
import { CreateAuditLogEntry } from '../../../../src/audit-log/domain/services/audit-log-create';
import { Attachment } from '../../../../src/attachment/domain/entities/attachment';
import { ClaimStagedAttachments } from '../../../../src/attachment/domain/services/attachment-claim-staged';
import { Ticket } from '../../../../src/ticket/domain/entities/ticket';
import { EnsureTicketAccess } from '../../../../src/ticket/domain/services/ticket-ensure-access';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { WorkspaceMember } from '../../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { EnsureWorkspacePermission } from '../../../../src/workspace/domain/services/workspace-ensure-permission';
import { AccessDeniedError } from '../../../../src/shared/domain/errors';
import { MockCommentRepository } from '../../../mocks/mock-comment.repository';
import { MockTicketRepository } from '../../../mocks/mock-ticket.repository';
import { MockTicketParticipantRepository } from '../../../mocks/mock-ticket-participant.repository';
import { MockWorkspaceMemberRepository } from '../../../mocks/mock-workspace-member.repository';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockUserRepository } from '../../../mocks/mock-user.repository';
import { MockAttachmentRepository } from '../../../mocks/mock-attachment.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';

function staged(id: string, token: string, uploadedById: string) {
  return new Attachment({
    id, fileName: `${id}.png`, originalName: `${id}.png`, mimeType: 'image/png', size: 10, s3Key: `staged/${id}`,
    ticketId: null, commentId: null, uploadedById, token, stagedAt: new Date(),
  });
}

describe('Attachments on a new comment', () => {
  let comments: MockCommentRepository;
  let tickets: MockTicketRepository;
  let members: MockWorkspaceMemberRepository;
  let workspaces: MockWorkspaceRepository;
  let attachments: MockAttachmentRepository;
  let auditEntries: any[];

  beforeEach(async () => {
    comments = new MockCommentRepository();
    tickets = new MockTicketRepository();
    members = new MockWorkspaceMemberRepository();
    workspaces = new MockWorkspaceRepository();
    attachments = new MockAttachmentRepository();
    auditEntries = [];

    await workspaces.create(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'author', role: WorkspaceRole.ADMIN }));
    await tickets.create(new Ticket({
      id: 'ticket-1', name: 'Printer', description: '', priority: TicketPriority.MEDIUM, status: TicketStatus.PENDING,
      categoryId: 'cat', workspaceId: 'ws-1', reporterId: 'author', assigneeId: null, ticketNumber: 1,
      tagIds: [], customFields: {}, discardReason: null, resolvedAt: null, resolvedById: null, createdAt: null, deletedAt: null,
    }));
    await attachments.create(staged('a-1', 'tok-1', 'author'));
    await attachments.create(staged('a-2', 'tok-2', 'author'));
    await attachments.create(staged('a-other', 'tok-other', 'someone-else'));
  });

  const command = (ensurePermission = new EnsureWorkspacePermission(members)) => new CreateCommentCommand(
    new CreateComment(new FakeIdGenerator(), comments),
    new EnsureTicketAccess(tickets, new EnsureWorkspacePermission(members), new MockTicketParticipantRepository()),
    tickets,
    workspaces,
    new MockUserRepository(),
    { emit: jest.fn() },
    new CreateAuditLogEntry(new FakeIdGenerator(), { create: async (e: any) => { auditEntries.push(e); } } as any),
    undefined,
    { ensurePermission, claim: new ClaimStagedAttachments(attachments) },
  );
  const comment = (uploadTokens: string[], cmd = command()) =>
    cmd.execute({ content: 'see attached', ticketId: 'ticket-1', authorId: 'author', workspaceSlug: 'acme', isSystemAdmin: false, uploadTokens });

  it('attaches the files the author staged to the new comment', async () => {
    const created = await comment(['tok-1', 'tok-2']);

    for (const id of ['a-1', 'a-2']) {
      const file = await attachments.findById(id);
      expect(file).toMatchObject({ ticketId: 'ticket-1', commentId: created.id, token: null, stagedAt: null });
    }
    expect(auditEntries[0].metadata).toMatchObject({ commentId: created.id, attachmentsClaimed: 2 });
  });

  it('leaves files staged by someone else untouched', async () => {
    await comment(['tok-other']);
    expect(await attachments.findById('a-other')).toMatchObject({ ticketId: null, commentId: null, token: 'tok-other' });
  });

  it('creates no comment when the author may not upload files', async () => {
    const denying = { execute: async () => { throw new AccessDeniedError('attachment.upload'); } } as unknown as EnsureWorkspacePermission;

    await expect(comment(['tok-1'], command(denying))).rejects.toThrow(AccessDeniedError);
    expect(comments.getAll()).toHaveLength(0);
    expect(await attachments.findById('a-1')).toMatchObject({ commentId: null, token: 'tok-1' });
  });

  it('does not ask for the upload permission when there are no files', async () => {
    const denying = { execute: async () => { throw new AccessDeniedError('attachment.upload'); } } as unknown as EnsureWorkspacePermission;

    await expect(comment([], command(denying))).resolves.toMatchObject({ content: 'see attached' });
    expect(auditEntries[0].metadata.attachmentsClaimed).toBeUndefined();
  });
});
