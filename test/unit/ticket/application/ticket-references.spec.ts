import { EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { UpdateTicket } from '../../../../src/ticket/domain/services/ticket-update';
import { CreateTicket } from '../../../../src/ticket/domain/services/ticket-create';
import { EnsureTicketReferences } from '../../../../src/ticket/domain/services/ticket-ensure-references';
import { UpdateTicketCommand } from '../../../../src/ticket/application/commands/update-ticket.command';
import { CreateTicketCommand } from '../../../../src/ticket/application/commands/create-ticket.command';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { ValidateCustomFieldValues } from '../../../../src/custom-field/domain/services/custom-field-validate-values';
import { Tag } from '../../../../src/tag/domain/entities/tag';
import { MockTagRepository } from '../../../mocks/mock-tag.repository';
import { FakeEventPublisher } from '../../../mocks/fake-event-publisher';
import { TicketWorld, WS_A, WS_B, makeTicket } from './ticket-security-fixtures';

/** A workspace-scoped lookup by id standing in for the category, department, project and organization repositories. */
class ScopedStore {
  private readonly items = new Map<string, { getId(): string; workspaceId: string }>();
  seed(id: string, workspaceId: string): void { this.items.set(id, { getId: () => id, workspaceId }); }
  async findById(id: string) { return this.items.get(id) ?? null; }
}

describe('A ticket only points at things in its own workspace', () => {
  let w: TicketWorld;
  let categories: ScopedStore;
  let departments: ScopedStore;
  let projects: ScopedStore;
  let organizations: ScopedStore;
  let tags: MockTagRepository;

  const references = () => new EnsureTicketReferences(categories as any, departments as any, projects as any, organizations as any, tags);
  const validateCustomFields = () => new ValidateCustomFieldValues({ findByWorkspaceId: async () => [] } as any);
  const update = () => new UpdateTicketCommand(new UpdateTicket(w.tickets), w.tickets, w.ensurePermission(), w.auditLog(), validateCustomFields(), references());
  const create = () => new CreateTicketCommand(
    new CreateTicket(w.ids, w.tickets), w.ensurePermission(), w.users, new FakeEventPublisher(), w.auditLog(), validateCustomFields(), undefined, references(),
  );
  const base = { ticketId: 'ticket-a', workspaceId: WS_A, userId: 'admin-a', isSystemAdmin: false };

  beforeEach(async () => {
    w = new TicketWorld();
    categories = new ScopedStore();
    departments = new ScopedStore();
    projects = new ScopedStore();
    organizations = new ScopedStore();
    tags = new MockTagRepository();
    for (const [store, prefix] of [[categories, 'cat'], [departments, 'dep'], [projects, 'proj'], [organizations, 'org']] as const) {
      store.seed(`${prefix}-a`, WS_A);
      store.seed(`${prefix}-b`, WS_B);
    }
    await tags.create(new Tag({ id: 'tag-a', name: 'a', color: '#000', workspaceId: WS_A }));
    await tags.create(new Tag({ id: 'tag-b', name: 'b', color: '#000', workspaceId: WS_B }));
    await w.tickets.create(makeTicket({ id: 'ticket-a' }));
    w.member('admin-a', WorkspaceRole.ADMIN);
  });

  it.each([
    ['category', { categoryId: 'cat-b' }],
    ['department', { departmentId: 'dep-b' }],
    ['project', { projectId: 'proj-b' }],
    ['organization', { organizationId: 'org-b' }],
    ['tag', { tagIds: ['tag-a', 'tag-b'] }],
  ])('an edit cannot attach a %s of workspace B to a ticket of workspace A', async (_label, patch) => {
    await expect(update().execute({ ...base, ...patch })).rejects.toThrow(EntityNotFoundError);
    const ticket = await w.tickets.findById('ticket-a');
    expect(ticket!.categoryId).toBe('cat-a');
    expect(ticket!.departmentId).toBeNull();
    expect(ticket!.projectId).toBeNull();
    expect(ticket!.organizationId).toBeNull();
    expect(ticket!.tagIds).toEqual([]);
  });

  it('an edit with references of its own workspace, or clearing them, goes through', async () => {
    await update().execute({ ...base, categoryId: 'cat-a', departmentId: 'dep-a', projectId: 'proj-a', organizationId: 'org-a', tagIds: ['tag-a'] });
    await update().execute({ ...base, departmentId: null, projectId: null, organizationId: null });
    const ticket = await w.tickets.findById('ticket-a');
    expect(ticket!.categoryId).toBe('cat-a');
    expect(ticket!.tagIds).toEqual(['tag-a']);
    expect(ticket!.departmentId).toBeNull();
  });

  it('a new ticket cannot be filed under a category of workspace B', async () => {
    const before = w.tickets.getAll().length;
    await expect(create().execute({
      name: 'x', description: 'y', priority: TicketPriority.LOW, categoryId: 'cat-b', tagIds: [],
      workspaceId: WS_A, workspaceName: 'A', workspaceSlug: 'a', userId: 'admin-a', userEmail: 'admin-a@example.com', isSystemAdmin: false,
    })).rejects.toThrow(EntityNotFoundError);
    expect(w.tickets.getAll()).toHaveLength(before);
  });
});
