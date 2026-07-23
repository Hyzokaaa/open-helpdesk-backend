import { TransferRequest } from '../entities/transfer-request';

export interface TransferRequestRepository {
  create(request: TransferRequest): Promise<void>;
  findById(id: string): Promise<TransferRequest | null>;
  findPendingByTicketId(ticketId: string): Promise<TransferRequest | null>;
  update(request: TransferRequest): Promise<void>;
  expirePendingBefore(date: Date): Promise<TransferRequest[]>;
}
