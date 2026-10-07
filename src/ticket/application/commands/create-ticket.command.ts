import { EventPublisher } from '../../../shared/domain/event-publisher';
import { Command } from '../../../shared/domain/command';
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
import { EnsureTicketReferences } from '../../domain/services/ticket-ensure-references';

interface Props {
  name: string;
  description: string;
  priority: TicketPriority;
  categoryId: string;
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
  projectId?: string | null;
  source?: TicketSource;
  registeredById?: string | null;
  isSystemAdmin: boolean;
  /** Set when the action came through the public API, with the key that made it. */
  apiKeyId?: string;
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
    private readonly ensureReferences?: EnsureTicketReferences,
  ) {}

  async execute(props: Props): Promise<CreateTicketResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.TICKET_CREATE,
      isSystemAdmin: props.isSystemAdmin,
    });

    if (this.ensureReferences) {
      await this.ensureReferences.execute({
        workspaceId: props.workspaceId,
        categoryId: props.categoryId,
        departmentId: props.departmentId,
        organizationId: props.organizationId,
        projectId: props.projectId,
        tagIds: props.tagIds,
      });
    }

    const validatedCustomFields = await this.validateCustomFields.execute({
      workspaceId: props.workspaceId,
      customFields: props.customFields,
      isCreate: true,
    });

    const ticket = await this.createTicket.execute({
      name: props.name,
      description: props.description,
      priority: props.priority,
      categoryId: props.categoryId,
      workspaceId: props.workspaceId,
      reporterId: props.userId,
      tagIds: props.tagIds,
      customFields: validatedCustomFields,
      departmentId: props.departmentId,
      organizationId: props.organizationId,
      projectId: props.projectId,
      source: props.source,
      registeredById: props.registeredById,
    });

    if (props.uploadTokens?.length && this.claimStagedAttachments) {
      await this.claimStagedAttachments.execute({
        tokens: props.uploadTokens,
        ticketId: ticket.getId(),
        uploadedById: props.registeredById ?? props.userId,
      });
    }

    const creator = await this.userRepository.findById(props.userId);
    const event: TicketCreatedEvent = {
      ticketId: ticket.getId(),
      ticketName: props.name,
      priority: props.priority,
      categoryId: props.categoryId,
      reporterId: props.userId,
      reporterName: creator ? `${creator.firstName} ${creator.lastName}` : props.userEmail,
      workspaceId: props.workspaceId,
      workspaceName: props.workspaceName,
      workspaceSlug: props.workspaceSlug,
      // The channel the ticket came through, so integrations can tell API-created tickets apart
      source: props.source ?? TicketSource.UI,
    };
    this.eventPublisher.emit('ticket.created', event);

    await this.createAuditLog.execute({
      action: AuditAction.TICKET_CREATED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: props.source === TicketSource.API ? 'api' : 'ui',
      entityType: 'ticket',
      entityId: ticket.getId(),
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: {
        ...(props.apiKeyId ? { apiKeyId: props.apiKeyId } : {}),
        name: props.name,
        priority: props.priority,
        categoryId: props.categoryId,
        // Files uploaded before the ticket existed, claimed by it now
        ...(props.uploadTokens?.length ? { attachmentsClaimed: props.uploadTokens.length } : {}),
      },
    });

    return {
      id: ticket.getId(),
      name: ticket.name,
      status: ticket.status,
    };
  }
}
