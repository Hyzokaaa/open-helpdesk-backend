import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { EventsGateway } from './infrastructure/ws/events.gateway';

/** Live updates to the browser over websocket. */
@Module({
  imports: [SharedModule, WorkspaceModule],
  providers: [EventsGateway],
})
export class RealtimeModule {}
