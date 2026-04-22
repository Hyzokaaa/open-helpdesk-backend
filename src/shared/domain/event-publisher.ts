export interface EventPublisher {
  emit(event: string, data: unknown): void;
}
