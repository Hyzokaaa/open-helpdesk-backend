import { Logger, OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage } from '@nestjs/websockets';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';

const FORWARDED_EVENTS = [
  'ticket.created',
  'ticket.statusChanged',
  'ticket.assigned',
  'comment.created',
] as const;

@WebSocketGateway({ cors: true })
export class EventsGateway implements OnModuleInit {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly eventEmitter: EventEmitter2) {}

  onModuleInit(): void {
    for (const event of FORWARDED_EVENTS) {
      this.eventEmitter.on(event, (data: Record<string, unknown>) => {
        const workspaceSlug = data.workspaceSlug as string | undefined;
        if (!workspaceSlug) return;
        this.server.to(`workspace:${workspaceSlug}`).emit(event, data);
      });
    }
    this.logger.log('WebSocket gateway initialized — forwarding events: ' + FORWARDED_EVENTS.join(', '));
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, workspaceSlug: string): void {
    client.join(`workspace:${workspaceSlug}`);
  }

  @SubscribeMessage('leave')
  handleLeave(client: Socket, workspaceSlug: string): void {
    client.leave(`workspace:${workspaceSlug}`);
  }
}
