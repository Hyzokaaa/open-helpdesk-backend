import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { TransferRequest } from '../entities/transfer-request';
import { TransferRequestStatus } from '../enums/transfer-request-status.enum';
import { TransferRequestRepository } from '../repositories/transfer-request.repository';

interface CancelTransferRequestProps {
  requestId: string;
  userId: string;
}

export class CancelTransferRequest {
  constructor(
    private readonly transferRequestRepository: TransferRequestRepository,
  ) {}

  async execute(props: CancelTransferRequestProps): Promise<TransferRequest> {
    const request = await this.transferRequestRepository.findById(props.requestId);
    if (!request) throw new EntityNotFoundError('Transfer request not found');

    if (request.requesterId !== props.userId) {
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
