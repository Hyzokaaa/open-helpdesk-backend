import { EventPublisher } from '../../../shared/domain/event-publisher';
import { Command } from '../../../shared/domain/command';
import { TicketCategory } from '../../domain/enums/ticket-category.enum';
import { TicketPriority } from '../../domain/enums/ticket-priority.enum';
import { CreateTicket } from '../../domain/services/ticket-create';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { TicketCreatedEvent } from '../../../email/domain/events';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { ValidateCustomFieldValues } from '../../../custom-field/domain/services/custom-field-validate-values';
import { ClaimStagedAttachments } from '../../../attachment/domain/services/attachment-claim-staged';
import { TicketSource } from '../../domain/enums/ticket-source.enum';

interface Props {
  name: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  userEmail: string;
  tagIds: string[];
  customFields?: Record<string, unknown>;
  uploadTokens?: string[];
  departmentId?: string;
  organizationId?: string | null;
  source?: TicketSource;
  registeredById?: string | null;
  isSystemAdmin: boolean;
}

export interface CreateTicketResponse {
  id: string;
  name: string;
  status: string;
}

export class CreateTicketCommand implements Command<Props, CreateTicketResponse> {
  constructor(
    private readonly createTicket: CreateTicket,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly userRepository: UserRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly validateCustomFields: ValidateCustomFieldValues,
    private readonly claimStagedAttachments?: ClaimStagedAttachments,
  ) {}

  async execute(props: Props): Promise<CreateTicketResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_CREATE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const validatedCustomFields = await this.validateCustomFields.execute({
      workspaceId: props.workspaceId,
      customFields: props.customFields,
      isCreate: true,
    });

    const ticket = await this.createTicket.execute({
      name: props.name,
      description: props.description,
      priority: props.priority,
      category: props.category,
      workspaceId: props.workspaceId,
      reporterId: props.userId,
      tagIds: props.tagIds,
      customFields: validatedCustomFields,
      departmentId: props.departmentId,
      organizationId: props.organizationId,
      source: props.source,
      registeredById: props.registeredById,
    });

    if (props.uploadTokens?.length && this.claimStagedAttachments) {
      await this.claimStagedAttachments.execute({
        tokens: props.uploadTokens,
        ticketId: ticket.getId(),
      });
    }

    const creator = await this.userRepository.findById(props.userId);
    const event: TicketCreatedEvent = {
      ticketId: ticket.getId(),
      ticketName: props.name,
      priority: props.priority,
      category: props.category,
      reporterId: props.userId,
      reporterName: creator ? `${creator.firstName} ${creator.lastName}` : props.userEmail,
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
      source: 'ui',
    };
    this.eventPublisher.emit('ticket.created', event);

    await this.createAuditLog.execute({
      action: AuditAction.TICKET_CREATED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: ticket.getId(),
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { name: props.name, priority: props.priority, category: props.category },
    });

    return {
      id: ticket.getId(),
      name: ticket.name,
      status: ticket.status,
    };
  }
}
