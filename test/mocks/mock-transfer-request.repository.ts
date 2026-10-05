import { TransferRequest } from '../../src/ticket/domain/entities/transfer-request';
import { TransferRequestStatus } from '../../src/ticket/domain/enums/transfer-request-status.enum';
import { TransferRequestRepository } from '../../src/ticket/domain/repositories/transfer-request.repository';

export class MockTransferRequestRepository implements TransferRequestRepository {
  private requests: TransferRequest[] = [];

  async create(request: TransferRequest): Promise<void> {
    this.requests.push(request);
  }

  async findById(id: string): Promise<TransferRequest | null> {
    return this.requests.find((r) => r.getId() === id) ?? null;
  }

  async findPendingByTicketId(ticketId: string): Promise<TransferRequest | null> {
    return this.requests.find((r) => r.ticketId === ticketId && r.status === TransferRequestStatus.PENDING) ?? null;
  }

  async update(request: TransferRequest): Promise<void> {
    const index = this.requests.findIndex((r) => r.getId() === request.getId());
    if (index >= 0) this.requests[index] = request;
  }

  async expirePendingBefore(date: Date): Promise<TransferRequest[]> {
    const expired = this.requests.filter((r) => r.status === TransferRequestStatus.PENDING && r.expiresAt < date);
    for (const r of expired) {
      r.status = TransferRequestStatus.EXPIRED;
      r.resolvedAt = new Date();
    }
    return expired;
  }

  seed(request: TransferRequest): void {
    this.requests.push(request);
  }

  getAll(): TransferRequest[] {
    return this.requests;
  }
}
