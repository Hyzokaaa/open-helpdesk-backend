import { Command } from '../../../shared/domain/command';
import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { EnsureTicketAccess } from '../../domain/services/ticket-ensure-access';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  key: string;
  source?: string;
  result?: string;
  clear?: boolean;
}

export interface UpdateTicketAiCacheResponse {
  ok: true;
}

/**
 * The AI cache holds rewrites of the description, so writing it is treated like editing
 * the description: full access to the ticket and `ticket.edit.description`.
 */
export class UpdateTicketAiCacheCommand implements Command<Props, UpdateTicketAiCacheResponse> {
  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<UpdateTicketAiCacheResponse> {
    await this.ensureTicketAccess.ensureFull({
      ticketId: props.ticketId,
      workspaceId: props.workspaceId,
      userId: props.userId,
      isSystemAdmin: props.isSystemAdmin,
    });
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_EDIT_DESCRIPTION,
      isSystemAdmin: props.isSystemAdmin,
    });

    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Ticket not found');

    const cache = { ...ticket.aiCache };
    if (props.clear) {
      delete cache[props.key];
    } else {
      if (props.source === undefined || props.result === undefined) {
        throw new DomainValidationError('source and result are required unless clearing');
      }
      cache[props.key] = { source: props.source, result: props.result };
    }
    ticket.aiCache = cache;
    await this.ticketRepository.update(ticket);

    return { ok: true };
  }
}
