import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { TransferRequest } from '../entities/transfer-request';
import { Ticket } from '../entities/ticket';
import { TransferRequestStatus } from '../enums/transfer-request-status.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { TransferRequestRepository } from '../repositories/transfer-request.repository';

interface AcceptTransferRequestProps {
  requestId: string;
  userId: string;
}

interface AcceptResult {
  request: TransferRequest;
  ticket: Ticket;
}

export class AcceptTransferRequest {
  constructor(
    private readonly transferRequestRepository: TransferRequestRepository,
    private readonly ticketRepository: TicketRepository,
  ) {}

  async execute(props: AcceptTransferRequestProps): Promise<AcceptResult> {
    const request = await this.transferRequestRepository.findById(props.requestId);
    if (!request) throw new EntityNotFoundError('Transfer request not found');

    if (request.targetUserId !== props.userId) {
      throw new AccessDeniedError('Only the target user can accept this transfer');
    }

    if (request.status !== TransferRequestStatus.PENDING) {
      throw new DomainValidationError('Transfer request is no longer pending');
    }

    if (request.expiresAt < new Date()) {
      request.status = TransferRequestStatus.EXPIRED;
      request.resolvedAt = new Date();
      await this.transferRequestRepository.update(request);
      throw new DomainValidationError('Transfer request has expired');
    }

    const ticket = await this.ticketRepository.findById(request.ticketId);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    ticket.assigneeId = request.targetUserId;
    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.PENDING;
    }
    await this.ticketRepository.update(ticket);

    request.status = TransferRequestStatus.ACCEPTED;
    request.resolvedAt = new Date();
    await this.transferRequestRepository.update(request);

    return { request, ticket };
  }
}
