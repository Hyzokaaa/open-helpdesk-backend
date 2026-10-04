import { Query } from '../../../shared/domain/query';
import { TicketDescriptionEditRepository } from '../../domain/repositories/ticket-description-edit.repository';
import { EnsureTicketAccess } from '../../domain/services/ticket-ensure-access';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface TicketDescriptionEditResponse {
  id: string;
  content: string;
  editedById: string;
  createdAt: Date | null;
}

export class GetTicketDescriptionHistoryQuery implements Query<Props, TicketDescriptionEditResponse[]> {
  constructor(
    private readonly descriptionEditRepository: TicketDescriptionEditRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
  ) {}

  async execute(props: Props): Promise<TicketDescriptionEditResponse[]> {
    await this.ensureTicketAccess.execute(props);

    const edits = await this.descriptionEditRepository.findByTicketId(props.ticketId);
    return edits.map((edit) => ({
      id: edit.getId(),
      content: edit.content,
      editedById: edit.editedById,
      createdAt: edit.createdAt,
    }));
  }
}
