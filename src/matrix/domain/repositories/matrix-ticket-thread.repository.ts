import { MatrixTicketThread } from '../entities/matrix-ticket-thread';

export interface MatrixTicketThreadRepository {
  find(ticketId: string, roomId: string): Promise<MatrixTicketThread | null>;
  /** Saves it, replacing the ticket's thread in that room if there was one. */
  save(thread: MatrixTicketThread): Promise<void>;
}
