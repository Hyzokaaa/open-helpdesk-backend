import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { UpdateTicket } from '../../../../src/ticket/domain/services/ticket-update';
import { UpdateTicketCommand } from '../../../../src/ticket/application/commands/update-ticket.command';
import { ResolveTicketReferenceLabels } from '../../../../src/ticket/domain/services/ticket-resolve-reference-labels';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { ValidateCustomFieldValues } from '../../../../src/custom-field/domain/services/custom-field-validate-values';
import { CreateComment } from '../../../../src/comment/domain/services/comment-create';
import { CreateCommentCommand } from '../../../../src/comment/application/commands/create-comment.command';
import { commentPreview } from '../../../../src/comment/domain/comment-preview';
import { AuditAction } from '../../../../src/audit-log/domain/enums/audit-action.enum';
import { Tag } from '../../../../src/tag/domain/entities/tag';
import { MockTagRepository } from '../../../mocks/mock-tag.repository';
import { MockCommentRepository } from '../../../mocks/mock-comment.repository';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { FakeEventPublisher } from '../../../mocks/fake-event-publisher';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { AddTicketParticipant } from '../../../../src/ticket/domain/services/ticket-add-participant';
import { AddTicketParticipantCommand } from '../../../../src/ticket/application/commands/add-ticket-participant.command';
import { ParticipantRole } from '../../../../src/ticket/domain/enums/participant-role.enum';
import { TicketWorld, WS_A, WS_B, makeTicket } from './ticket-security-fixtures';

/** A lookup by id of named, workspace-scoped items, standing in for the category, department, project and organization repositories. */
class NamedStore {
  private readonly items = new Map<string, { getId(): string; workspaceId: string; name: string }>();
  seed(id: string, name: string, workspaceId = WS_A): void { this.items.set(id, { getId: () => id, workspaceId, name }); }
  async findById(id: string) { return this.items.get(id) ?? null; }
}

describe('comment preview for audit metadata', () => {
  it('turns HTML into plain text', () => {
    expect(commentPreview('<p>Primera versión</p><p>Segunda &amp; final</p>')).toBe('Primera versión\nSegunda & final');
  });

  it('shows mentions as @Name', () => {
    expect(commentPreview('<p>Hola @[Ana Pérez](01HZX5C3V9J8Q2W4E6R8T0Y1U3), mira esto</p>')).toBe('Hola @Ana Pérez, mira esto');
  });

  it('truncates long content without leaving a partial tag', () => {
    const preview = commentPreview(`<p>${'a'.repeat(400)}</p>`);
    expect(preview).toBe('a'.repeat(300) + '...');
    expect(preview).not.toContain('<');
  });
});

describe('readable audit metadata', () => {
  let w: TicketWorld;
  let categories: NamedStore;
  let departments: NamedStore;
  let projects: NamedStore;
  let organizations: NamedStore;
  let tags: MockTagRepository;

  const labels = () => new ResolveTicketReferenceLabels(categories as any, departments as any, projects as any, organizations as any, tags);
  const update = () => new UpdateTicketCommand(
    new UpdateTicket(w.tickets), w.tickets, w.ensurePermission(), w.auditLog(),
    new ValidateCustomFieldValues({ findByWorkspaceId: async () => [] } as any), undefined, labels(),
  );
  const base = { ticketId: 'ticket-a', workspaceId: WS_A, userId: 'admin-a', isSystemAdmin: false };
  const lastMetadata = () => w.audit.entries[w.audit.entries.length - 1].metadata as Record<string, any>;

  beforeEach(async () => {
    w = new TicketWorld();
    categories = new NamedStore();
    departments = new NamedStore();
    projects = new NamedStore();
    organizations = new NamedStore();
    tags = new MockTagRepository();
    categories.seed('cat-a', 'Hardware');
    categories.seed('cat-a2', 'Software');
    departments.seed('dep-a', 'Soporte');
    departments.seed('dep-b', 'Foreign', WS_B);
    projects.seed('proj-a', 'Migración');
    organizations.seed('org-a', 'Acme');
    await tags.create(new Tag({ id: 'tag-1', name: 'urgent', color: '#000', workspaceId: WS_A }));
    await tags.create(new Tag({ id: 'tag-2', name: 'vip', color: '#000', workspaceId: WS_A }));
    await w.tickets.create(makeTicket({ id: 'ticket-a' }));
    w.member('admin-a', WorkspaceRole.ADMIN);
  });

  it('labels only the references that changed, keeping the ids', async () => {
    await update().execute({ ...base, departmentId: 'dep-a', projectId: 'proj-a', organizationId: 'org-a', categoryId: 'cat-a' });

    const metadata = lastMetadata();
    expect(metadata.before).toMatchObject({ departmentId: null, projectId: null, organizationId: null, categoryId: 'cat-a' });
    expect(metadata.after).toMatchObject({ departmentId: 'dep-a', projectId: 'proj-a', organizationId: 'org-a', categoryId: 'cat-a' });
    expect(metadata.beforeLabels).toEqual({});
    expect(metadata.afterLabels).toEqual({ departmentId: 'Soporte', projectId: 'Migración', organizationId: 'Acme' });
  });

  it('labels both sides of a changed category', async () => {
    await update().execute({ ...base, categoryId: 'cat-a2' });

    const metadata = lastMetadata();
    expect(metadata.beforeLabels).toEqual({ categoryId: 'Hardware' });
    expect(metadata.afterLabels).toEqual({ categoryId: 'Software' });
  });

  it('records a changed tag set with its names', async () => {
    await update().execute({ ...base, tagIds: ['tag-1', 'tag-2'] });

    const metadata = lastMetadata();
    expect(metadata.before.tagIds).toEqual([]);
    expect(metadata.after.tagIds).toEqual(['tag-1', 'tag-2']);
    expect(metadata.afterLabels).toEqual({ tagIds: 'urgent, vip' });
    expect(metadata.beforeLabels).toEqual({});
  });

  it('adds no labels when no reference changed', async () => {
    await update().execute({ ...base, priority: TicketPriority.HIGH, tagIds: [] });

    const metadata = lastMetadata();
    expect(metadata.before.tagIds).toBeUndefined();
    expect(metadata.beforeLabels).toBeUndefined();
    expect(metadata.afterLabels).toBeUndefined();
  });

  it('never labels a reference with a name from another workspace', async () => {
    const resolved = await labels().execute({ workspaceId: WS_A, values: { departmentId: 'dep-b', projectId: 'missing' } });
    expect(resolved).toEqual({});
  });

  it('stores a comment as a plain-text preview, never raw HTML', async () => {
    const workspaces = new MockWorkspaceRepository();
    await workspaces.create(new Workspace({ id: WS_A, name: 'A', slug: 'a', description: '' }));
    const command = new CreateCommentCommand(
      new CreateComment(new FakeIdGenerator(), new MockCommentRepository()),
      w.ensureTicketAccess(), w.tickets, workspaces, w.users, new FakeEventPublisher(), w.auditLog(),
    );

    await command.execute({
      content: '<p>No puedo entrar, @[admin-a Test](admin-a)</p>',
      ticketId: 'ticket-a', authorId: 'admin-a', workspaceSlug: 'a', isSystemAdmin: false,
    });

    const entry = w.audit.entries.find((e) => e.action === AuditAction.COMMENT_CREATED)!;
    expect((entry.metadata as Record<string, unknown>).content).toBe('No puedo entrar, @admin-a Test');
  });

  it('names the participant who was added', async () => {
    w.member('agent-a', WorkspaceRole.AGENT);
    const command = new AddTicketParticipantCommand(
      new AddTicketParticipant(w.ids, w.participants), w.ensureTicketAccess(), w.ensurePermission(), w.members, w.auditLog(), w.users,
    );

    await command.execute({ ...base, targetUserId: 'agent-a', role: ParticipantRole.FOLLOWER });

    expect(lastMetadata()).toMatchObject({ participantUserId: 'agent-a', target: 'agent-a Test (agent-a@example.com)' });
  });
});
