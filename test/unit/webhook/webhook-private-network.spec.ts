import { Webhook } from '../../../src/webhook/domain/entities/webhook';
import { WebhookRepository } from '../../../src/webhook/domain/repositories/webhook.repository';
import { CreateWebhook } from '../../../src/webhook/domain/services/webhook-create';
import { UpdateWebhook } from '../../../src/webhook/domain/services/webhook-update';
import { PrivateNetworkUrlError, ensurePublicUrl } from '../../../src/shared/infrastructure/private-network';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';

class MemoryWebhookRepository implements WebhookRepository {
  webhooks: Webhook[] = [];
  async create(webhook: Webhook) { this.webhooks.push(webhook); }
  async findById(id: string) { return this.webhooks.find((w) => w.getId() === id) ?? null; }
  async findByWorkspaceId(workspaceId: string) { return this.webhooks.filter((w) => w.workspaceId === workspaceId); }
  async findActiveByWorkspaceAndEvent(workspaceId: string, event: string) { return this.webhooks.filter((w) => w.workspaceId === workspaceId && w.isActive && w.events.includes(event)); }
  async update(webhook: Webhook) { this.webhooks = this.webhooks.map((w) => (w.getId() === webhook.getId() ? webhook : w)); }
  async delete(id: string) { this.webhooks = this.webhooks.filter((w) => w.getId() !== id); }
}

// The hosted installation's rule, with names resolved in memory
const hosted = (url: string) => ensurePublicUrl(url, async (host) => (host === 'internal.acme.test' ? ['10.0.0.5'] : ['93.184.216.34']));

describe('Webhooks on an installation that keeps workspaces off its private network', () => {
  let repository: MemoryWebhookRepository;
  beforeEach(() => { repository = new MemoryWebhookRepository(); });

  it('refuses a webhook to a private address or to a name that resolves to one, and saves nothing', async () => {
    const create = new CreateWebhook(new FakeIdGenerator('wh'), repository, hosted);
    await expect(create.execute({ workspaceId: 'ws-1', url: 'http://169.254.169.254/latest', events: ['ticket.created'] })).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    await expect(create.execute({ workspaceId: 'ws-1', url: 'https://internal.acme.test/hook', events: ['ticket.created'] })).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    expect(repository.webhooks).toEqual([]);

    await create.execute({ workspaceId: 'ws-1', url: 'https://hooks.example.com/in', events: ['ticket.created'] });
    expect(repository.webhooks).toHaveLength(1);
  });

  it('refuses to point a webhook at a private address, or to keep or turn back on an older one there', async () => {
    await repository.create(new Webhook({ id: 'old', workspaceId: 'ws-1', url: 'http://10.1.2.3/hook', events: ['ticket.created'], secret: 's', isActive: false, createdAt: null }));
    await repository.create(new Webhook({ id: 'ok', workspaceId: 'ws-1', url: 'https://hooks.example.com/in', events: ['ticket.created'], secret: 's', isActive: true, createdAt: null }));
    const update = new UpdateWebhook(repository, hosted);

    await expect(update.execute({ id: 'old', workspaceId: 'ws-1', isActive: true })).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    await expect(update.execute({ id: 'ok', workspaceId: 'ws-1', url: 'http://127.0.0.1:3000/' })).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    expect((await repository.findById('ok'))?.url).toBe('https://hooks.example.com/in');
    await expect(update.execute({ id: 'old', workspaceId: 'ws-1', url: 'https://hooks.example.com/new', isActive: true })).resolves.toMatchObject({ isActive: true });
  });

  it('changes nothing where private addresses are allowed (the default)', async () => {
    const create = new CreateWebhook(new FakeIdGenerator('wh'), repository);
    await expect(create.execute({ workspaceId: 'ws-1', url: 'http://10.0.0.5/hook', events: ['ticket.created'] })).resolves.toBeDefined();
  });
});
