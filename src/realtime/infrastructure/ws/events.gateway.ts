import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { AccessTokenVerifier } from '../../../shared/infrastructure/access-token-verifier';
import type { AuthUser } from '../../../shared/nest/strategies/jwt.strategy';
import { TypeOrmWorkspaceRepository } from '../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { AuthorizeWorkspaceChannel } from '../../domain/services/realtime-authorize-workspace';

const FORWARDED_EVENTS = [
  'ticket.created',
  'ticket.statusChanged',
  'ticket.assigned',
  'comment.created',
] as const;

// setTimeout overflows past ~24.8 days; no access token should live that long anyway
const MAX_TIMER_MS = 2 ** 31 - 1;

interface ClientState {
  user?: AuthUser;
  expiryTimer?: ReturnType<typeof setTimeout>;
  /** Joined workspaces, slug as the client knows it → id the room is keyed by. */
  workspaces: Map<string, string>;
}

const room = (workspaceId: string) => `workspace:${workspaceId}`;

/**
 * Relays domain events to the browsers of a workspace's members.
 *
 * Clients authenticate with their access token on connect and send the renewed one with 'auth'
 * whenever the session refreshes; a socket whose token lapses is disconnected. Events carry ids
 * only: clients fetch what changed through the API, which applies each user's permissions, so
 * the gateway never has to.
 */
@WebSocketGateway({ cors: true })
export class EventsGateway implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject() private readonly tokenVerifier: AccessTokenVerifier,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
  ) {}

  onModuleInit(): void {
    for (const event of FORWARDED_EVENTS) {
      this.eventEmitter.on(event, (data: Record<string, unknown>) => {
        const workspaceId = data.workspaceId as string | undefined;
        if (!workspaceId) return;
        this.server.to(room(workspaceId)).emit(event, {
          ticketId: data.ticketId,
          workspaceSlug: data.workspaceSlug,
        });
      });
    }
    this.logger.log('WebSocket gateway initialized — forwarding events: ' + FORWARDED_EVENTS.join(', '));
  }

  handleConnection(client: Socket): void {
    const state: ClientState = { workspaces: new Map() };
    client.data = state;
    if (!this.authenticate(client, client.handshake.auth?.token)) {
      client.emit('auth:invalid');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    clearTimeout(this.state(client).expiryTimer);
  }

  /** A renewed access token for the same user keeps the socket alive past the old one's expiry. */
  @SubscribeMessage('auth')
  async handleAuth(client: Socket, token: unknown): Promise<{ ok: boolean }> {
    const previous = this.state(client).user;
    if (!this.authenticate(client, token, previous?.userId)) {
      client.emit('auth:invalid');
      client.disconnect(true);
      return { ok: false };
    }
    await this.recheckWorkspaces(client);
    return { ok: true };
  }

  @SubscribeMessage('join')
  async handleJoin(client: Socket, workspaceSlug: unknown): Promise<{ ok: boolean }> {
    const state = this.state(client);
    if (!state.user || typeof workspaceSlug !== 'string') return { ok: false };

    const workspaceId = await this.authorize().execute({
      workspaceSlug,
      userId: state.user.userId,
      isSystemAdmin: state.user.isSystemAdmin,
    });
    if (!workspaceId) return { ok: false };

    await client.join(room(workspaceId));
    state.workspaces.set(workspaceSlug, workspaceId);
    return { ok: true };
  }

  @SubscribeMessage('leave')
  async handleLeave(client: Socket, workspaceSlug: unknown): Promise<void> {
    const state = this.state(client);
    if (typeof workspaceSlug !== 'string') return;
    const workspaceId = state.workspaces.get(workspaceSlug);
    if (!workspaceId) return;
    await client.leave(room(workspaceId));
    state.workspaces.delete(workspaceSlug);
  }

  private authenticate(client: Socket, token: unknown, expectedUserId?: string): boolean {
    const verified = this.tokenVerifier.verify(token);
    if (!verified || (expectedUserId && verified.user.userId !== expectedUserId)) return false;

    const state = this.state(client);
    state.user = verified.user;
    clearTimeout(state.expiryTimer);
    const delay = Math.min(Math.max(verified.expiresAt.getTime() - Date.now(), 0), MAX_TIMER_MS);
    state.expiryTimer = setTimeout(() => {
      client.emit('auth:expired');
      client.disconnect(true);
    }, delay);
    return true;
  }

  /** Membership can change while a socket is open; drop channels the user no longer belongs to. */
  private async recheckWorkspaces(client: Socket): Promise<void> {
    const state = this.state(client);
    if (!state.user) return;
    for (const [slug, workspaceId] of state.workspaces) {
      const allowed = await this.authorize().execute({
        workspaceId,
        userId: state.user.userId,
        isSystemAdmin: state.user.isSystemAdmin,
      });
      if (!allowed) {
        await client.leave(room(workspaceId));
        state.workspaces.delete(slug);
      }
    }
  }

  private authorize(): AuthorizeWorkspaceChannel {
    return new AuthorizeWorkspaceChannel(this.workspaceRepository, this.memberRepository);
  }

  private state(client: Socket): ClientState {
    return client.data as ClientState;
  }
}
