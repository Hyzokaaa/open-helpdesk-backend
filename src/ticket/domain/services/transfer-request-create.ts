import { ConflictError, DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { TransferRequest } from '../entities/transfer-request';
import { TransferRequestStatus } from '../enums/transfer-request-status.enum';
import { TicketRepository } from '../repositories/ticket.repository';
import { TransferRequestRepository } from '../repositories/transfer-request.repository';

const TRANSFER_TTL = 48 * 60 * 60 * 1000; // 48 hours

interface CreateTransferRequestProps {
  ticketId: string;
  requesterId: string;
  targetUserId: string;
}

export class CreateTransferRequest {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly ticketRepository: TicketRepository,
    private readonly transferRequestRepository: TransferRequestRepository,
  ) {}

  async execute(props: CreateTransferRequestProps): Promise<TransferRequest> {
    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    if (ticket.assigneeId !== props.requesterId && ticket.creatorId !== props.requesterId) {
      throw new DomainValidationError('You can only transfer tickets assigned to you or created by you');
    }

    if (props.targetUserId === props.requesterId) {
      throw new DomainValidationError('Cannot transfer a ticket to yourself');
    }

    const existing = await this.transferRequestRepository.findPendingByTicketId(props.ticketId);
    if (existing) {
      throw new ConflictError('A pending transfer request already exists for this ticket');
    }

    const request = new TransferRequest({
      id: this.idGenerator.create(),
      ticketId: props.ticketId,
      requesterId: props.requesterId,
      targetUserId: props.targetUserId,
      status: TransferRequestStatus.PENDING,
      expiresAt: new Date(Date.now() + TRANSFER_TTL),
      resolvedAt: null,
      createdAt: null,
    });

    await this.transferRequestRepository.create(request);
    return request;
  }
}
