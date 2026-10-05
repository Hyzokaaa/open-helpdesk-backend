import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { TransferRequest } from '../entities/transfer-request';
import { TransferRequestStatus } from '../enums/transfer-request-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { TransferRequestRepository } from '../repositories/transfer-request.repository';

interface RejectTransferRequestProps {
  requestId: string;
  /** The ticket the caller addressed; a request of another ticket is not found. */
  ticketId: string;
  workspaceId: string;
  userId: string;
}

export class RejectTransferRequest {
  constructor(
    private readonly transferRequestRepository: TransferRequestRepository,
    private readonly ticketRepository: TicketRepository,
  ) {}

  async execute(props: RejectTransferRequestProps): Promise<TransferRequest> {
    const request = await this.transferRequestRepository.findById(props.requestId);
    if (!request || request.ticketId !== props.ticketId) throw new EntityNotFoundError('Transfer request not found');

    const ticket = await this.ticketRepository.findById(request.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Ticket not found');

    if (request.targetUserId !== props.userId) {
      throw new AccessDeniedError('Only the target user can reject this transfer');
    }

    if (request.status !== TransferRequestStatus.PENDING) {
      throw new DomainValidationError('Transfer request is no longer pending');
    }

    request.status = TransferRequestStatus.REJECTED;
    request.resolvedAt = new Date();
    await this.transferRequestRepository.update(request);

    return request;
  }
}
