import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { TransferRequest } from '../entities/transfer-request';
import { TransferRequestStatus } from '../enums/transfer-request-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { TransferRequestRepository } from '../repositories/transfer-request.repository';

interface CancelTransferRequestProps {
  requestId: string;
  /** The ticket the caller addressed; a request of another ticket is not found. */
  ticketId: string;
  workspaceId: string;
  userId: string;
  /** Someone who may reassign tickets in the workspace cancels any request, not only their own. */
  canCancelAny?: boolean;
}

export class CancelTransferRequest {
  constructor(
    private readonly transferRequestRepository: TransferRequestRepository,
    private readonly ticketRepository: TicketRepository,
  ) {}

  async execute(props: CancelTransferRequestProps): Promise<TransferRequest> {
    const request = await this.transferRequestRepository.findById(props.requestId);
    if (!request || request.ticketId !== props.ticketId) throw new EntityNotFoundError('Transfer request not found');

    const ticket = await this.ticketRepository.findById(request.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Ticket not found');

    if (request.requesterId !== props.userId && !props.canCancelAny) {
      throw new AccessDeniedError('Only the requester can cancel this transfer');
    }

    if (request.status !== TransferRequestStatus.PENDING) {
      throw new DomainValidationError('Transfer request is no longer pending');
    }

    request.status = TransferRequestStatus.CANCELLED;
    request.resolvedAt = new Date();
    await this.transferRequestRepository.update(request);

    return request;
  }
}
