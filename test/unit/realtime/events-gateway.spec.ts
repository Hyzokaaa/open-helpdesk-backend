import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventsGateway } from '../../../src/realtime/infrastructure/ws/events.gateway';
import { AuthorizeWorkspaceChannel } from '../../../src/realtime/domain/services/realtime-authorize-workspace';
import { AccessTokenVerifier, VerifiedAccessToken } from '../../../src/shared/infrastructure/access-token-verifier';
import { Workspace } from '../../../src/workspace/domain/entities/workspace';
import { WorkspaceMember } from '../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { MockWorkspaceRepository } from '../../mocks/mock-workspace.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';

const MINUTE = 60 * 1000;

// Tokens are plain strings mapped to who they authenticate and for how long
class FakeVerifier {
  tokens = new Map<string, { userId: string; isSystemAdmin?: boolean; ttlMs: number }>();

  verify(token: unknown): VerifiedAccessToken | null {
    const entry = typeof token === 'string' ? this.tokens.get(token) : undefined;
    if (!entry) return null;
    return {
      user: { userId: entry.userId, email: '', isSystemAdmin: entry.isSystemAdmin ?? false, isEmailVerified: true },
      expiresAt: new Date(Date.now() + entry.ttlMs),
    };
  }
}

class FakeSocket {
  data: unknown = {};
  rooms = new Set<string>();
  emitted: string[] = [];
  disconnected = false;

  constructor(public handshake: { auth: Record<string, unknown> }) {}

  emit(event: string) { this.emitted.push(event); }
  disconnect() { this.disconnected = true; }
  async join(room: string) { this.rooms.add(room); }
  async leave(room: string) { this.rooms.delete(room); }
}

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let emitter: EventEmitter2;
  let verifier: FakeVerifier;
  let workspaces: MockWorkspaceRepository;
  let members: MockWorkspaceMemberRepository;
  let broadcasts: { room: string; event: string; payload: unknown }[];

  const connect = (token?: string) => {
    const socket = new FakeSocket({ auth: token ? { token } : {} });
    gateway.handleConnection(socket as any);
    return socket;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    emitter = new EventEmitter2();
    verifier = new FakeVerifier();
    workspaces = new MockWorkspaceRepository();
    members = new MockWorkspaceMemberRepository();
    workspaces.seed(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    workspaces.seed(new Workspace({ id: 'ws-2', name: 'Other', slug: 'other', description: '' }));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'agent-1', role: WorkspaceRole.AGENT }));
    verifier.tokens.set('agent-token', { userId: 'agent-1', ttlMs: 15 * MINUTE });
    verifier.tokens.set('agent-token-renewed', { userId: 'agent-1', ttlMs: 15 * MINUTE });
    verifier.tokens.set('stranger-token', { userId: 'stranger', ttlMs: 15 * MINUTE });
    verifier.tokens.set('root-token', { userId: 'root', isSystemAdmin: true, ttlMs: 15 * MINUTE });

    gateway = new EventsGateway(emitter, verifier as unknown as AccessTokenVerifier, workspaces as any, members as any);
    broadcasts = [];
    gateway.server = {
      to: (room: string) => ({ emit: (event: string, payload: unknown) => broadcasts.push({ room, event, payload }) }),
    } as any;
    gateway.onModuleInit();
  });

  afterEach(() => jest.useRealTimers());

  it('drops a connection without a valid access token', () => {
    const anonymous = connect();
    const forged = connect('not-a-token');

    expect(anonymous.disconnected).toBe(true);
    expect(forged.disconnected).toBe(true);
    expect(forged.emitted).toContain('auth:invalid');
  });

  it('lets a member join their workspace, keyed by id', async () => {
    const socket = connect('agent-token');

    await expect(gateway.handleJoin(socket as any, 'acme')).resolves.toEqual({ ok: true });

    expect(socket.rooms).toEqual(new Set(['workspace:ws-1']));
  });

  it('refuses a workspace the user does not belong to', async () => {
    const socket = connect('stranger-token');

    await expect(gateway.handleJoin(socket as any, 'acme')).resolves.toEqual({ ok: false });

    expect(socket.rooms.size).toBe(0);
  });

  it('lets a system admin join any workspace', async () => {
    const socket = connect('root-token');

    await expect(gateway.handleJoin(socket as any, 'other')).resolves.toEqual({ ok: true });
  });

  it('relays ids only, to the workspace room', () => {
    emitter.emit('ticket.created', {
      ticketId: 't-1', ticketName: 'Secret project', reporterName: 'Jane', workspaceId: 'ws-1', workspaceSlug: 'acme',
    });

    expect(broadcasts).toEqual([
      { room: 'workspace:ws-1', event: 'ticket.created', payload: { ticketId: 't-1', workspaceSlug: 'acme' } },
    ]);
  });

  it('disconnects a socket when its token expires', () => {
    const socket = connect('agent-token');

    jest.advanceTimersByTime(15 * MINUTE + 1);

    expect(socket.emitted).toContain('auth:expired');
    expect(socket.disconnected).toBe(true);
  });

  it('keeps a socket alive when the renewed token arrives in time', async () => {
    const socket = connect('agent-token');
    jest.advanceTimersByTime(14 * MINUTE);

    await expect(gateway.handleAuth(socket as any, 'agent-token-renewed')).resolves.toEqual({ ok: true });
    jest.advanceTimersByTime(10 * MINUTE);

    expect(socket.disconnected).toBe(false);
  });

  it('refuses a renewed token that belongs to someone else', async () => {
    const socket = connect('agent-token');

    await expect(gateway.handleAuth(socket as any, 'stranger-token')).resolves.toEqual({ ok: false });

    expect(socket.disconnected).toBe(true);
  });

  it('leaves workspaces the user was removed from when the token is renewed', async () => {
    const socket = connect('agent-token');
    await gateway.handleJoin(socket as any, 'acme');
    await members.delete('m-1');

    await gateway.handleAuth(socket as any, 'agent-token-renewed');

    expect(socket.rooms.size).toBe(0);
  });
});

describe('AuthorizeWorkspaceChannel', () => {
  it('finds the workspace by id as well as by slug', async () => {
    const workspaces = new MockWorkspaceRepository();
    const members = new MockWorkspaceMemberRepository();
    workspaces.seed(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    members.seed(new WorkspaceMember({ id: 'm-1', workspaceId: 'ws-1', userId: 'agent-1', role: WorkspaceRole.AGENT }));
    const authorize = new AuthorizeWorkspaceChannel(workspaces, members);

    await expect(authorize.execute({ workspaceId: 'ws-1', userId: 'agent-1', isSystemAdmin: false })).resolves.toBe('ws-1');
    await expect(authorize.execute({ workspaceSlug: 'acme', userId: 'agent-1', isSystemAdmin: false })).resolves.toBe('ws-1');
    await expect(authorize.execute({ workspaceSlug: 'nope', userId: 'agent-1', isSystemAdmin: true })).resolves.toBeNull();
  });
});
