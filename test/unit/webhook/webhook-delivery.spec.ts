import { createHmac } from 'crypto';
import { WebhookDeliveryService } from '../../../src/webhook/infrastructure/nest/services/webhook-delivery.service';
import { Webhook } from '../../../src/webhook/domain/entities/webhook';
import {
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMEOUT_MS,
  buildWebhookDeliveryExtension,
} from '../../../src/api/infrastructure/nest/openapi/api-docs.webhooks';

/** Checks the delivery facts the API document states against what the real service sends. */
describe('WebhookDeliveryService', () => {
  const SECRET = 's3cret';
  let webhooks: Webhook[];
  let calls: Array<{ url: string; init: RequestInit }>;
  let fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  const realFetch = global.fetch;

  const repository = {
    findActiveByWorkspaceAndEvent: async (workspaceId: string, event: string) =>
      webhooks.filter((h) => h.workspaceId === workspaceId && h.isActive && h.events.includes(event)),
  };
  const service = () => new WebhookDeliveryService(repository as any);
  const hook = (events: string[], overrides: Partial<{ id: string; isActive: boolean; workspaceId: string }> = {}) =>
    new Webhook({ id: overrides.id ?? 'wh-1', workspaceId: overrides.workspaceId ?? 'ws-1', url: 'https://hooks.example.com/in', events, secret: SECRET, isActive: overrides.isActive ?? true, createdAt: null });
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    calls = [];
    webhooks = [];
    fetchImpl = async () => new Response(null, { status: 204 });
    global.fetch = ((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return fetchImpl(url, init);
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  it('posts the { event, data, timestamp } envelope signed with HMAC-SHA256 of the raw body, as documented', async () => {
    webhooks = [hook(['ticket.created'])];
    const data = { workspaceId: 'ws-1', ticketId: 't-1' };
    await service().onTicketCreated(data);
    await flush();

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toBe('https://hooks.example.com/in');
    expect(init.method).toBe(buildWebhookDeliveryExtension().method);
    const body = init.body as string;
    const parsed = JSON.parse(body);
    expect(Object.keys(parsed)).toEqual(['event', 'data', 'timestamp']);
    expect(parsed).toMatchObject({ event: 'ticket.created', data });
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);

    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers).sort()).toEqual(
      (buildWebhookDeliveryExtension().headers as Array<{ name: string }>).map((h) => h.name).sort(),
    );
    expect(headers[WEBHOOK_EVENT_HEADER]).toBe('ticket.created');
    expect(headers[WEBHOOK_SIGNATURE_HEADER]).toBe(createHmac('sha256', SECRET).update(body).digest('hex'));
    expect(headers['Content-Type']).toBe('application/json');
  });

  it.each([
    ['onTicketCreated', 'ticket.created'],
    ['onTicketUpdated', 'ticket.updated'],
    ['onTicketStatusChanged', 'ticket.statusChanged'],
    ['onTicketAssigned', 'ticket.assigned'],
    ['onTicketDeleted', 'ticket.deleted'],
    ['onCommentCreated', 'comment.created'],
  ] as const)('%s delivers %s to the webhooks subscribed to it only', async (handler, event) => {
    webhooks = [hook([event], { id: 'a' }), hook(['other.event'], { id: 'b' }), hook([event], { id: 'c', isActive: false }), hook([event], { id: 'd', workspaceId: 'ws-2' })];
    await service()[handler]({ workspaceId: 'ws-1', ticketId: 't-1' });
    await flush();

    expect(calls).toHaveLength(1);
    expect((calls[0].init.headers as Record<string, string>)[WEBHOOK_EVENT_HEADER]).toBe(event);
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ event, data: { ticketId: 't-1' } });
  });

  it('makes a single attempt: a failed delivery is not retried', async () => {
    webhooks = [hook(['ticket.created'])];
    fetchImpl = async () => new Response(null, { status: 500 });
    await service().onTicketCreated({ workspaceId: 'ws-1' });
    await flush();
    fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
    await service().onTicketCreated({ workspaceId: 'ws-1' });
    await flush();

    expect(calls).toHaveLength(2);
    expect(buildWebhookDeliveryExtension()).toMatchObject({ attempts: 1, retries: 0 });
  });

  it('aborts the request after the documented timeout', async () => {
    jest.useFakeTimers();
    webhooks = [hook(['ticket.created'])];
    fetchImpl = () => new Promise<Response>(() => undefined);
    await service().onTicketCreated({ workspaceId: 'ws-1' });

    const signal = calls[0].init.signal as AbortSignal;
    jest.advanceTimersByTime(WEBHOOK_TIMEOUT_MS - 1);
    expect(signal.aborted).toBe(false);
    jest.advanceTimersByTime(1);
    expect(signal.aborted).toBe(true);
    expect(buildWebhookDeliveryExtension().timeoutMs).toBe(WEBHOOK_TIMEOUT_MS);
  });
});
