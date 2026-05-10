import { CsatResponse } from '../entities/csat-response';

export interface CsatResponseRepository {
  create(response: CsatResponse): Promise<void>;
  findByToken(token: string): Promise<CsatResponse | null>;
  findByTicketId(ticketId: string): Promise<CsatResponse | null>;
  update(response: CsatResponse): Promise<void>;
}
