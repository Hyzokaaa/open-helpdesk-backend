import { EntityNotFoundError } from '../../../src/shared/domain/errors';
import { UpdateCannedResponse } from '../../../src/canned-response/domain/services/canned-response-update';
import { DeleteCannedResponse } from '../../../src/canned-response/domain/services/canned-response-delete';
import { UpdateCustomFieldDefinition } from '../../../src/custom-field/domain/services/custom-field-definition-update';
import { DeleteCustomFieldDefinition } from '../../../src/custom-field/domain/services/custom-field-definition-delete';
import { ReorderCustomFieldDefinitions } from '../../../src/custom-field/domain/services/custom-field-definition-reorder';
import { UpdateDepartment } from '../../../src/department/domain/services/department-update';
import { DeleteDepartment } from '../../../src/department/domain/services/department-delete';
import { AddDepartmentMember } from '../../../src/department/domain/services/department-member-add';
import { RemoveDepartmentMember } from '../../../src/department/domain/services/department-member-remove';
import { UpdateEmailRule } from '../../../src/email-rule/domain/services/email-rule-update';
import { DeleteEmailRule } from '../../../src/email-rule/domain/services/email-rule-delete';
import { UpdateKbCategory } from '../../../src/knowledge-base/domain/services/kb-category-update';
import { DeleteKbCategory } from '../../../src/knowledge-base/domain/services/kb-category-delete';
import { ReorderKbCategories } from '../../../src/knowledge-base/domain/services/kb-category-reorder';
import { CreateKbArticle } from '../../../src/knowledge-base/domain/services/kb-article-create';
import { UpdateKbArticle } from '../../../src/knowledge-base/domain/services/kb-article-update';
import { DeleteKbArticle } from '../../../src/knowledge-base/domain/services/kb-article-delete';
import { ReorderKbArticles } from '../../../src/knowledge-base/domain/services/kb-article-reorder';
import { UpdateOrganization } from '../../../src/organization/domain/services/organization-update';
import { DeleteOrganization } from '../../../src/organization/domain/services/organization-delete';
import { UpdateTicketCategory } from '../../../src/project/domain/services/ticket-category-update';
import { DeleteTicketCategory } from '../../../src/project/domain/services/ticket-category-delete';
import { DeleteTag } from '../../../src/tag/domain/services/tag-delete';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';

interface Item { getId(): string; workspaceId: string; [field: string]: unknown }

/** One in-memory store standing in for any of these workspace-scoped repositories. */
class Store {
  readonly items = new Map<string, Item>();
  readonly positions: Array<{ id: string; position: number }> = [];

  seed(id: string, workspaceId: string, fields: Record<string, unknown> = {}): void {
    this.items.set(id, { getId: () => id, workspaceId, ...fields });
  }
  async findById(id: string) { return this.items.get(id) ?? null; }
  async findByWorkspaceId(workspaceId: string) { return [...this.items.values()].filter((i) => i.workspaceId === workspaceId); }
  async findBySlugAndWorkspaceId() { return null; }
  async getMaxPosition() { return 0; }
  async create(item: Item) { this.items.set(item.getId(), item); }
  async update(item: Item) { this.items.set(item.getId(), item); }
  async delete(id: string) { this.items.delete(id); }
  async softDelete(id: string) { this.items.delete(id); }
  async updatePositions(list: Array<{ id: string; position: number }>) { this.positions.push(...list); }
}

const MINE = 'ws-1';
const THEIRS = 'ws-2';

describe('Writes by id stay inside the caller\'s workspace', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
    store.seed('own', MINE, { name: 'own' });
    store.seed('foreign', THEIRS, { name: 'foreign' });
  });

  const updates: Array<[string, (s: Store, id: string, workspaceId: string) => Promise<unknown>]> = [
    ['canned response', (s, id, workspaceId) => new UpdateCannedResponse(s as any).execute({ id, workspaceId, title: 'changed' })],
    ['custom field', (s, id, workspaceId) => new UpdateCustomFieldDefinition(s as any).execute({ id, workspaceId, name: 'changed' })],
    ['department', (s, id, workspaceId) => new UpdateDepartment(s as any).execute({ id, workspaceId, name: 'changed' })],
    ['email rule', (s, id, workspaceId) => new UpdateEmailRule(s as any).execute({ id, workspaceId, name: 'changed' })],
    ['knowledge base category', (s, id, workspaceId) => new UpdateKbCategory(s as any).execute({ id, workspaceId, name: 'changed' })],
    ['knowledge base article', (s, id, workspaceId) => new UpdateKbArticle(s as any, s as any).execute({ id, workspaceId, title: 'changed' })],
    ['organization', (s, id, workspaceId) => new UpdateOrganization(s as any).execute({ id, workspaceId, name: 'changed' })],
    ['ticket category', (s, id, workspaceId) => new UpdateTicketCategory(s as any).execute({ id, workspaceId, name: 'changed' })],
  ];

  it.each(updates)('does not edit a %s of another workspace', async (_, update) => {
    await expect(update(store, 'foreign', MINE)).rejects.toThrow(EntityNotFoundError);
    expect(store.items.get('foreign')!.name).toBe('foreign');

    await update(store, 'own', MINE);
    const own = store.items.get('own')!;
    expect([own.name, own.title]).toContain('changed');
  });

  const deletes: Array<[string, (s: Store, id: string, workspaceId: string) => Promise<unknown>]> = [
    ['canned response', (s, id, workspaceId) => new DeleteCannedResponse(s as any).execute({ id, workspaceId })],
    ['custom field', (s, id, workspaceId) => new DeleteCustomFieldDefinition(s as any).execute({ id, workspaceId })],
    ['department', (s, id, workspaceId) => new DeleteDepartment(s as any).execute({ id, workspaceId })],
    ['email rule', (s, id, workspaceId) => new DeleteEmailRule(s as any).execute(id, workspaceId)],
    ['knowledge base category', (s, id, workspaceId) => new DeleteKbCategory(s as any).execute(id, workspaceId)],
    ['knowledge base article', (s, id, workspaceId) => new DeleteKbArticle(s as any).execute(id, workspaceId)],
    ['organization', (s, id, workspaceId) => new DeleteOrganization(s as any).execute({ id, workspaceId })],
    ['ticket category', (s, id, workspaceId) => new DeleteTicketCategory(s as any).execute(id, workspaceId)],
    ['tag', (s, id, workspaceId) => new DeleteTag(s as any).execute({ id, workspaceId })],
  ];

  it.each(deletes)('does not delete a %s of another workspace', async (_, remove) => {
    await expect(remove(store, 'foreign', MINE)).rejects.toThrow(EntityNotFoundError);
    expect(store.items.has('foreign')).toBe(true);

    await remove(store, 'own', MINE);
    expect(store.items.has('own')).toBe(false);
  });

  describe('reordering', () => {
    const reorders: Array<[string, (s: Store, ids: string[]) => Promise<unknown>]> = [
      ['knowledge base categories', (s, ids) => new ReorderKbCategories(s as any).execute(ids, MINE)],
      ['knowledge base articles', (s, ids) => new ReorderKbArticles(s as any).execute(ids, MINE)],
      ['custom fields', (s, ids) => new ReorderCustomFieldDefinitions(s as any).execute(ids.map((id, position) => ({ id, position })), MINE)],
    ];

    it.each(reorders)('rejects the whole reorder of %s when any id is of another workspace', async (_, reorder) => {
      store.seed('own-2', MINE);
      await expect(reorder(store, ['own', 'foreign', 'own-2'])).rejects.toThrow(EntityNotFoundError);
      expect(store.positions).toEqual([]);

      await reorder(store, ['own-2', 'own']);
      expect(store.positions.map((p) => p.id)).toEqual(['own-2', 'own']);
    });
  });

  describe('knowledge base article category', () => {
    it('does not create or move an article into a category of another workspace', async () => {
      const articles = new Store();
      articles.seed('article', MINE, { title: 'a', categoryId: 'own' });

      const create = new CreateKbArticle(new FakeIdGenerator(), articles as any, store as any);
      await expect(
        create.execute({ title: 'x', content: '', categoryId: 'foreign', workspaceId: MINE, createdById: 'u' } as any),
      ).rejects.toThrow(EntityNotFoundError);

      const update = new UpdateKbArticle(articles as any, store as any);
      await expect(update.execute({ id: 'article', workspaceId: MINE, categoryId: 'foreign' })).rejects.toThrow(EntityNotFoundError);
      expect(articles.items.get('article')!.categoryId).toBe('own');
    });
  });

  describe('department members', () => {
    const departmentMembers = { created: [] as unknown[], removed: [] as unknown[],
      async create(m: unknown) { this.created.push(m); }, async delete(d: string, u: string) { this.removed.push([d, u]); } };
    const workspaceMembers = { async findByWorkspaceAndUser(workspaceId: string, userId: string) {
      return workspaceId === MINE && userId === 'member' ? { userId } : null; } };

    beforeEach(() => { departmentMembers.created = []; departmentMembers.removed = []; });

    it('adds only members of the workspace, to departments of the workspace', async () => {
      const add = new AddDepartmentMember(new FakeIdGenerator(), departmentMembers as any, store as any, workspaceMembers as any);

      await expect(add.execute({ departmentId: 'foreign', userId: 'member', workspaceId: MINE })).rejects.toThrow(EntityNotFoundError);
      await expect(add.execute({ departmentId: 'own', userId: 'stranger', workspaceId: MINE })).rejects.toThrow(EntityNotFoundError);
      expect(departmentMembers.created).toEqual([]);

      await add.execute({ departmentId: 'own', userId: 'member', workspaceId: MINE });
      expect(departmentMembers.created).toHaveLength(1);
    });

    it('removes members only from departments of the workspace', async () => {
      const remove = new RemoveDepartmentMember(departmentMembers as any, store as any);

      await expect(remove.execute({ departmentId: 'foreign', userId: 'member', workspaceId: MINE })).rejects.toThrow(EntityNotFoundError);
      expect(departmentMembers.removed).toEqual([]);
    });
  });
});
