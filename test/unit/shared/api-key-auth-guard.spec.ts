import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { ApiKeyAuthGuard } from '../../../src/shared/nest/guards/api-key-auth.guard';
import { ApiKeyAuth } from '../../../src/shared/nest/decorators/api-key-auth.decorator';

const KEY = 'ohd_test-key';

// A key created by "creator" for ws-1, allowed only to read tickets.
function storedKey(overrides: Partial<{ expiresAt: Date | null }> = {}) {
  return {
    getId: () => 'key-1',
    createdById: 'creator',
    workspaceId: 'ws-1',
    scopes: ['tickets:read'],
    expiresAt: overrides.expiresAt ?? null,
  };
}

class TicketController { list() {} }

@ApiKeyAuth()
class PublicApiController { listTickets() {} }

function requestTo(controller: object, handler: () => void, token = KEY) {
  const request: { headers: Record<string, string>; user?: any } = { headers: { authorization: `Bearer ${token}` } };
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
}

describe('ApiKeyAuthGuard', () => {
  let key: ReturnType<typeof storedKey>;
  let creatorActive: boolean;
  let guard: ApiKeyAuthGuard;

  beforeEach(() => {
    key = storedKey();
    creatorActive = true;
    const apiKeys = {
      findByHash: async (hash: string) => (hash === createHash('sha256').update(KEY).digest('hex') ? key : null),
      updateLastUsedAt: async () => {},
    };
    const users = { findById: async (id: string) => (id === 'creator' ? { isActive: creatorActive } : null) };
    guard = new ApiKeyAuthGuard(new Reflector(), apiKeys as any, users as any);
  });

  it('does not let an API key act as its creator on the app\'s own routes', async () => {
    const { request, context } = requestTo(TicketController, TicketController.prototype.list);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });

  it('accepts the key on the public API, bound to its workspace and scopes', async () => {
    const { request, context } = requestTo(PublicApiController, PublicApiController.prototype.listTickets);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ userId: 'creator', workspaceId: 'ws-1', apiKeyScopes: ['tickets:read'] });
  });

  it('stops accepting the key once its creator is deactivated', async () => {
    creatorActive = false;
    const { request, context } = requestTo(PublicApiController, PublicApiController.prototype.listTickets);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });

  it('refuses an expired key', async () => {
    key = storedKey({ expiresAt: new Date(Date.now() - 1000) });
    const { context } = requestTo(PublicApiController, PublicApiController.prototype.listTickets);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('leaves anything that is not an API key to the session guard', async () => {
    const { context } = requestTo(TicketController, TicketController.prototype.list, 'eyJhbGciOi.jwt.token');

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });
});
