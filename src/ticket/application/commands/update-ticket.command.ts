import { Command } from '../../../shared/domain/command';
import { TicketCategory } from '../../domain/enums/ticket-category.enum';
import { TicketPriority } from '../../domain/enums/ticket-priority.enum';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { UpdateTicket } from '../../domain/services/ticket-update';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { ValidateCustomFieldValues } from '../../../custom-field/domain/services/custom-field-validate-values';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  name?: string;
  description?: string;
  priority?: TicketPriority;
  category?: TicketCategory;
  tagIds?: string[];
  customFields?: Record<string, unknown>;
}

export interface UpdateTicketResponse {
  id: string;
  name: string;
  priority: string;
  category: string;
}

export class UpdateTicketCommand implements Command<Props, UpdateTicketResponse> {
  constructor(
    private readonly updateTicket: UpdateTicket,
    private readonly ticketRepository: TicketRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly validateCustomFields: ValidateCustomFieldValues,
  ) {}

  async execute(props: Props): Promise<UpdateTicketResponse> {
    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    const isClosed = ticket.status === 'closed';
    const isCreator = ticket.creatorId === props.userId;

    if (isClosed) {
      await this.ensurePermission.execute({
        workspaceId: props.workspaceId,
        userId: props.userId,
        permission: PERMISSIONS.TICKET_EDIT_CLOSED,
        isSystemAdmin: props.isSystemAdmin,
      });
    } else if (!isCreator) {
      await this.ensurePermission.execute({
        workspaceId: props.workspaceId,
        userId: props.userId,
        permission: PERMISSIONS.TICKET_EDIT_DESCRIPTION,
        isSystemAdmin: props.isSystemAdmin,
      });
    }

    const ctx = await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      anyOf: [PERMISSIONS.TICKET_VIEW, PERMISSIONS.TICKET_VIEW_OWN],
      isSystemAdmin: props.isSystemAdmin,
    });

    const canEditName = hasPermission(ctx.role, PERMISSIONS.TICKET_EDIT_NAME);
    const canEditPriority = hasPermission(ctx.role, PERMISSIONS.TICKET_EDIT_PRIORITY);
    const canEditCategory = hasPermission(ctx.role, PERMISSIONS.TICKET_EDIT_CATEGORY);
    const canEditTags = hasPermission(ctx.role, PERMISSIONS.TICKET_EDIT_TAGS);

    const before = { name: ticket.name, priority: ticket.priority, category: ticket.category };

    let validatedCustomFields: Record<string, unknown> | undefined;
    if (props.customFields) {
      validatedCustomFields = await this.validateCustomFields.execute({
        workspaceId: props.workspaceId,
        customFields: props.customFields,
        isCreate: false,
      });
    }

    const updated = await this.updateTicket.execute({
      ticketId: props.ticketId,
      name: canEditName ? props.name : undefined,
      description: props.description,
      priority: canEditPriority ? props.priority : undefined,
      category: canEditCategory ? props.category : undefined,
      tagIds: canEditTags ? props.tagIds : undefined,
      customFields: validatedCustomFields,
    });

    const after = { name: updated.name, priority: updated.priority, category: updated.category };
    await this.createAuditLog.execute({
      action: AuditAction.TICKET_UPDATED,
      entityType: 'ticket',
      entityId: updated.getId(),
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { ticketName: updated.name, before, after },
    });

    return {
      id: updated.getId(),
      name: updated.name,
      priority: updated.priority,
      category: updated.category,
    };
  }
}
