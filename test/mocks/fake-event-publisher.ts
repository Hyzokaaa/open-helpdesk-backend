import { EventPublisher } from '../../src/shared/domain/event-publisher';

export class FakeEventPublisher implements EventPublisher {
  readonly events: { event: string; data: unknown }[] = [];

  emit(event: string, data: unknown): void {
    this.events.push({ event, data });
  }
}
