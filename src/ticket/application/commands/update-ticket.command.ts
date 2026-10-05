import { Command } from '../../../shared/domain/command';

import { TicketPriority } from '../../domain/enums/ticket-priority.enum';
import { TicketRepository } from '../../domain/repositories/ticket.repository';
import { UpdateTicket } from '../../domain/services/ticket-update';
import { EnsureTicketReferences } from '../../domain/services/ticket-ensure-references';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { ValidateCustomFieldValues } from '../../../custom-field/domain/services/custom-field-validate-values';
import { ResolveTicketReferenceLabels, TicketReferenceLabels, TicketReferenceValues } from '../../domain/services/ticket-resolve-reference-labels';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { TicketFieldChange, TicketUpdatedEvent } from '../../../email/domain/events';
import { formatTicketNumber } from '../../domain/ticket-number';

const REFERENCE_FIELDS = ['categoryId', 'departmentId', 'organizationId', 'projectId'] as const;

/** Order in which changed fields are listed in the ticket.updated event. */
const EVENT_FIELDS = ['name', 'description', 'priority', 'categoryId', 'departmentId', 'organizationId', 'projectId', 'tagIds', 'customFields'] as const;

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

interface Props {
  ticketId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  isSystemAdmin: boolean;
  name?: string;
  description?: string;
  priority?: TicketPriority;
  categoryId?: string;
  tagIds?: string[];
  departmentId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  customFields?: Record<string, unknown>;
}

export interface UpdateTicketResponse {
  id: string;
  name: string;
  priority: string;
  categoryId: string;
}

export class UpdateTicketCommand implements Command<Props, UpdateTicketResponse> {
  constructor(
    private readonly updateTicket: UpdateTicket,
    private readonly ticketRepository: TicketRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly validateCustomFields: ValidateCustomFieldValues,
    private readonly ensureReferences?: EnsureTicketReferences,
    private readonly resolveLabels?: ResolveTicketReferenceLabels,
    private readonly eventPublisher?: EventPublisher,
  ) {}

  async execute(props: Props): Promise<UpdateTicketResponse> {
    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket || ticket.workspaceId !== props.workspaceId) throw new EntityNotFoundError('Ticket not found');

    const isTerminal = ticket.status === 'discarded' || ticket.status === 'resolved';

    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: isTerminal ? PERMISSIONS.TICKET_EDIT_DISCARDED : PERMISSIONS.TICKET_EDIT_DESCRIPTION,
      isSystemAdmin: props.isSystemAdmin,
    });

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
    const canEditCustomFields = hasPermission(ctx.role, PERMISSIONS.TICKET_EDIT_DESCRIPTION);

    const before: Record<string, unknown> = { name: ticket.name, priority: ticket.priority, categoryId: ticket.categoryId, departmentId: ticket.departmentId, organizationId: ticket.organizationId, projectId: ticket.projectId };
    const tagIdsBefore = [...ticket.tagIds];
    const descriptionBefore = ticket.description;
    const customFieldsBefore = { ...(ticket.customFields ?? {}) };

    let validatedCustomFields: Record<string, unknown> | undefined;
    if (props.customFields && canEditCustomFields) {
      validatedCustomFields = await this.validateCustomFields.execute({
        workspaceId: props.workspaceId,
        customFields: props.customFields,
        isCreate: false,
      });
    }

    const categoryId = canEditCategory ? props.categoryId : undefined;
    const tagIds = canEditTags ? props.tagIds : undefined;

    if (this.ensureReferences) {
      await this.ensureReferences.execute({
        workspaceId: props.workspaceId,
        categoryId,
        departmentId: props.departmentId,
        organizationId: props.organizationId,
        projectId: props.projectId,
        tagIds,
      });
    }

    const updated = await this.updateTicket.execute({
      ticketId: props.ticketId,
      name: canEditName ? props.name : undefined,
      description: props.description,
      priority: canEditPriority ? props.priority : undefined,
      categoryId,
      tagIds,
      departmentId: props.departmentId,
      organizationId: props.organizationId,
      projectId: props.projectId,
      customFields: validatedCustomFields,
      editedById: props.userId,
    });

    const after: Record<string, unknown> = { name: updated.name, priority: updated.priority, categoryId: updated.categoryId, departmentId: updated.departmentId, organizationId: updated.organizationId, projectId: updated.projectId };

    // Changed references, by id, plus the tag set when it changed
    const changedBefore: TicketReferenceValues = {};
    const changedAfter: TicketReferenceValues = {};
    for (const field of REFERENCE_FIELDS) {
      if ((before[field] ?? null) !== (after[field] ?? null)) {
        changedBefore[field] = before[field] as string | null;
        changedAfter[field] = after[field] as string | null;
      }
    }
    if (!sameIds(tagIdsBefore, updated.tagIds)) {
      before.tagIds = tagIdsBefore;
      after.tagIds = [...updated.tagIds];
      changedBefore.tagIds = tagIdsBefore;
      changedAfter.tagIds = updated.tagIds;
    }

    // Names captured now, so the entry stays readable after a rename or delete
    const labels: { beforeLabels?: TicketReferenceLabels; afterLabels?: TicketReferenceLabels } = {};
    if (this.resolveLabels && Object.keys(changedAfter).length > 0) {
      const [beforeLabels, afterLabels] = await Promise.all([
        this.resolveLabels.execute({ workspaceId: props.workspaceId, values: changedBefore }),
        this.resolveLabels.execute({ workspaceId: props.workspaceId, values: changedAfter }),
      ]);
      labels.beforeLabels = beforeLabels;
      labels.afterLabels = afterLabels;
    }

    await this.createAuditLog.execute({
      action: AuditAction.TICKET_UPDATED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: updated.getId(),
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { ticketName: updated.name, before, after, ...labels },
    });

    if (this.eventPublisher) {
      const changes = this.changedFields(
        { ...before, description: descriptionBefore, customFields: customFieldsBefore },
        { ...after, description: updated.description, customFields: { ...(updated.customFields ?? {}) } },
        labels,
      );
      // An edit that changed nothing is not an update
      if (changes.length > 0) {
        const event: TicketUpdatedEvent = {
          ticketId: updated.getId(),
          ticketNumber: formatTicketNumber(updated.ticketNumber),
          ticketName: updated.name,
          updatedById: props.userId,
          changes,
          workspaceId: props.workspaceId,
          workspaceName: props.workspaceName,
          workspaceSlug: props.workspaceSlug,
        };
        this.eventPublisher.emit('ticket.updated', event);
      }
    }

    return {
      id: updated.getId(),
      name: updated.name,
      priority: updated.priority,
      categoryId: updated.categoryId,
    };
  }

  /** The fields whose value differs, before and after, with the reference names the audit entry resolved. */
  private changedFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    labels: { beforeLabels?: TicketReferenceLabels; afterLabels?: TicketReferenceLabels },
  ): TicketFieldChange[] {
    const changes: TicketFieldChange[] = [];
    for (const field of EVENT_FIELDS) {
      const was = field === 'tagIds' ? before.tagIds : before[field] ?? null;
      const now = field === 'tagIds' ? after.tagIds : after[field] ?? null;
      // tagIds is only present on both sides when the set changed
      if (field === 'tagIds' ? was === undefined : JSON.stringify(was) === JSON.stringify(now)) continue;
      const change: TicketFieldChange = { field, before: was, after: now };
      const beforeLabel = labels.beforeLabels?.[field as keyof TicketReferenceLabels];
      const afterLabel = labels.afterLabels?.[field as keyof TicketReferenceLabels];
      if (beforeLabel !== undefined) change.beforeLabel = beforeLabel;
      if (afterLabel !== undefined) change.afterLabel = afterLabel;
      changes.push(change);
    }
    return changes;
  }
}
