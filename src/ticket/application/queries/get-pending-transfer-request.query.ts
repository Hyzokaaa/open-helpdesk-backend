import { Query } from '../../../shared/domain/query';
import { TransferRequestRepository } from '../../domain/repositories/transfer-request.repository';
import { EnsureTicketAccess } from '../../domain/services/ticket-ensure-access';
import { UserRepository } from '../../../user/domain/repositories/user.repository';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface PendingTransferRequestResponse {
  id: string;
  requesterId: string;
  requesterName: string;
  targetUserId: string;
  targetName: string;
  expiresAt: Date;
}

export class GetPendingTransferRequestQuery implements Query<Props, PendingTransferRequestResponse | null> {
  constructor(
    private readonly transferRequestRepository: TransferRequestRepository,
    private readonly userRepository: UserRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
  ) {}

  async execute(props: Props): Promise<PendingTransferRequestResponse | null> {
    await this.ensureTicketAccess.execute(props);

    const request = await this.transferRequestRepository.findPendingByTicketId(props.ticketId);
    if (!request) return null;

    const [requester, target] = await Promise.all([
      this.userRepository.findById(request.requesterId),
      this.userRepository.findById(request.targetUserId),
    ]);

    return {
      id: request.getId(),
      requesterId: request.requesterId,
      requesterName: requester ? `${requester.firstName} ${requester.lastName}` : request.requesterId,
      targetUserId: request.targetUserId,
      targetName: target ? `${target.firstName} ${target.lastName}` : request.targetUserId,
      expiresAt: request.expiresAt,
    };
  }
}
