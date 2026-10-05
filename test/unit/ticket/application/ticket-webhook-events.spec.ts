import { WorkspaceRole } from '../../../../src/workspace/domain/enums/workspace-role.enum';
import { UpdateTicket } from '../../../../src/ticket/domain/services/ticket-update';
import { DeleteTicket } from '../../../../src/ticket/domain/services/ticket-delete';
import { UpdateTicketCommand } from '../../../../src/ticket/application/commands/update-ticket.command';
import { DeleteTicketCommand } from '../../../../src/ticket/application/commands/delete-ticket.command';
import { BulkDeleteCommand } from '../../../../src/ticket/application/commands/bulk-delete.command';
import { ResolveTicketReferenceLabels } from '../../../../src/ticket/domain/services/ticket-resolve-reference-labels';
import { ValidateCustomFieldValues } from '../../../../src/custom-field/domain/services/custom-field-validate-values';
import { TicketPriority } from '../../../../src/ticket/domain/enums/ticket-priority.enum';
import { TicketDeletedEvent, TicketUpdatedEvent } from '../../../../src/email/domain/events';
import { EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { Tag } from '../../../../src/tag/domain/entities/tag';
import { MockTagRepository } from '../../../mocks/mock-tag.repository';
import { FakeEventPublisher } from '../../../mocks/fake-event-publisher';
import { TicketWorld, WS_A, WS_B, makeTicket } from './ticket-security-fixtures';

class NamedStore {
  private readonly items = new Map<string, { getId(): string; workspaceId: string; name: string }>();
  seed(id: string, name: string): void { this.items.set(id, { getId: () => id, workspaceId: WS_A, name }); }
  async findById(id: string) { return this.items.get(id) ?? null; }
}

const WORKSPACE = { workspaceId: WS_A, workspaceName: 'Workspace A', workspaceSlug: 'ws-a' };

describe('ticket.updated and ticket.deleted events', () => {
  let w: TicketWorld;
  let events: FakeEventPublisher;
  let categories: NamedStore;
  let tags: MockTagRepository;

  const update = (publisher: FakeEventPublisher | undefined = events) => new UpdateTicketCommand(
    new UpdateTicket(w.tickets), w.tickets, w.ensurePermission(), w.auditLog(),
    new ValidateCustomFieldValues({ findByWorkspaceId: async () => [] } as any),
    undefined,
    new ResolveTicketReferenceLabels(categories as any, undefined, undefined, undefined, tags),
    publisher,
  );
  const remove = () => new DeleteTicketCommand(new DeleteTicket(w.tickets), w.ensurePermission(), w.tickets, w.auditLog(), events);
  const base = { ticketId: 'ticket-a', ...WORKSPACE, userId: 'admin-a', isSystemAdmin: false };

  beforeEach(async () => {
    w = new TicketWorld();
    events = new FakeEventPublisher();
    categories = new NamedStore();
    categories.seed('cat-a', 'Hardware');
    categories.seed('cat-b', 'Software');
    tags = new MockTagRepository();
    await tags.create(new Tag({ id: 'tag-1', name: 'urgent', color: '#000', workspaceId: WS_A }));
    await w.tickets.create(makeTicket({ id: 'ticket-a' }));
    w.member('admin-a', WorkspaceRole.ADMIN);
  });

  it('emits ticket.updated with each changed field, before and after, and the reference names', async () => {
    await update().execute({ ...base, name: 'Printer fixed', categoryId: 'cat-b', tagIds: ['tag-1'], priority: TicketPriority.MEDIUM });

    expect(events.events.map((e) => e.event)).toEqual(['ticket.updated']);
    const event = events.events[0].data as TicketUpdatedEvent;
    expect(event).toEqual({
      ticketId: 'ticket-a',
      ticketNumber: 'TK-000001',
      ticketName: 'Printer fixed',
      updatedById: 'admin-a',
      ...WORKSPACE,
      changes: [
        { field: 'name', before: 'Printer on fire', after: 'Printer fixed' },
        { field: 'categoryId', before: 'cat-a', after: 'cat-b', beforeLabel: 'Hardware', afterLabel: 'Software' },
        { field: 'tagIds', before: [], after: ['tag-1'], afterLabel: 'urgent' },
      ],
    });
  });

  it('reports description and custom field changes, which the audit entry leaves out', async () => {
    await update().execute({ ...base, description: '<p>new</p>' });

    const event = events.events[0].data as TicketUpdatedEvent;
    expect(event.changes).toEqual([{ field: 'description', before: 'original', after: '<p>new</p>' }]);
  });

  it('emits nothing when the edit changed nothing', async () => {
    await update().execute({ ...base, name: 'Printer on fire', priority: TicketPriority.MEDIUM, tagIds: [], description: 'original' });

    expect(events.events).toEqual([]);
  });

  it('emits nothing for a ticket of another workspace, which it refuses', async () => {
    await w.tickets.create(makeTicket({ id: 'ticket-b', workspaceId: WS_B }));
    await expect(update().execute({ ...base, ticketId: 'ticket-b', name: 'x' })).rejects.toThrow(EntityNotFoundError);
    expect(events.events).toEqual([]);
  });

  it('still updates without a publisher', async () => {
    const result = await update(undefined).execute({ ...base, name: 'Renamed' });
    expect(result.name).toBe('Renamed');
  });

  it('emits ticket.deleted with the number, the name and who deleted it', async () => {
    await remove().execute(base);

    expect(events.events).toEqual([{
      event: 'ticket.deleted',
      data: {
        ticketId: 'ticket-a',
        ticketNumber: 'TK-000001',
        ticketName: 'Printer on fire',
        deletedById: 'admin-a',
        ...WORKSPACE,
      } satisfies TicketDeletedEvent,
    }]);
  });

  it('emits ticket.deleted once per ticket deleted in bulk, and none for a failed one', async () => {
    await w.tickets.create(makeTicket({ id: 'ticket-a2' }));
    await new BulkDeleteCommand(remove()).execute({ ticketIds: ['ticket-a', 'missing', 'ticket-a2'], ...WORKSPACE, userId: 'admin-a', isSystemAdmin: false });

    expect(events.events.map((e) => (e.data as TicketDeletedEvent).ticketId)).toEqual(['ticket-a', 'ticket-a2']);
  });
});
