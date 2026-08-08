import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { NestEventPublisher } from '../../../../shared/infrastructure/nest-event-publisher';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { randomBytes } from 'crypto';
import { CreateUser } from '../../../../user/domain/services/user-create';
import { AddWorkspaceMember } from '../../../../workspace/domain/services/workspace-add-member';
import { WorkspaceRole } from '../../../../workspace/domain/enums/workspace-role.enum';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { ClaimStagedAttachments } from '../../../../attachment/domain/services/attachment-claim-staged';
import { TypeOrmAttachmentRepository } from '../../../../attachment/infrastructure/typeorm/repositories/typeorm-attachment.repository';
import { CreateTicket } from '../../../domain/services/ticket-create';
import { UpdateTicket } from '../../../domain/services/ticket-update';
import { ChangeTicketStatus } from '../../../domain/services/ticket-change-status';
import { AssignTicket } from '../../../domain/services/ticket-assign';
import { PickupTicket } from '../../../domain/services/ticket-pickup';
import { CreateTransferRequest } from '../../../domain/services/transfer-request-create';
import { AcceptTransferRequest } from '../../../domain/services/transfer-request-accept';
import { RejectTransferRequest } from '../../../domain/services/transfer-request-reject';
import { CancelTransferRequest } from '../../../domain/services/transfer-request-cancel';
import { TypeOrmTransferRequestRepository } from '../../typeorm/repositories/typeorm-transfer-request.repository';
import { TransferRequestCreatedEvent, TransferRequestResolvedEvent } from '../../../../email/domain/events';
import { DeleteTicket } from '../../../domain/services/ticket-delete';
import { CreateTicketCommand } from '../../../application/commands/create-ticket.command';
import { UpdateTicketCommand } from '../../../application/commands/update-ticket.command';
import { ChangeTicketStatusCommand } from '../../../application/commands/change-ticket-status.command';
import { AssignTicketCommand } from '../../../application/commands/assign-ticket.command';
import { DeleteTicketCommand } from '../../../application/commands/delete-ticket.command';
import { GetTicketQuery } from '../../../application/queries/get-ticket.query';
import { ListTicketsQuery } from '../../../application/queries/list-tickets.query';
import { TypeOrmTicketRepository } from '../../typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../../workspace/domain/permissions';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { TypeOrmCustomFieldDefinitionRepository } from '../../../../custom-field/infrastructure/typeorm/repositories/typeorm-custom-field-definition.repository';
import { ValidateCustomFieldValues } from '../../../../custom-field/domain/services/custom-field-validate-values';
import { BulkChangeStatusCommand } from '../../../application/commands/bulk-change-status.command';
import { AddTicketParticipant } from '../../../domain/services/ticket-add-participant';
import { EnsureTicketAccess } from '../../../domain/services/ticket-ensure-access';
import { TypeOrmTicketParticipantRepository } from '../../typeorm/repositories/typeorm-ticket-participant.repository';
import { ParticipantRole } from '../../../domain/enums/participant-role.enum';
import { BulkDeleteCommand } from '../../../application/commands/bulk-delete.command';
import { CreateTicketRequest } from '../dto/create-ticket.request';
import { UpdateTicketRequest } from '../dto/update-ticket.request';
import { ChangeTicketStatusRequest } from '../dto/change-ticket-status.request';
import { BulkChangeStatusRequest } from '../dto/bulk-change-status.request';
import { BulkDeleteRequest } from '../dto/bulk-delete.request';
import { AssignTicketRequest } from '../dto/assign-ticket.request';
import { TicketFilterDto } from '../dto/ticket-filter.dto';

@Controller('workspaces/:slug/tickets')
export class TicketController {
  constructor(
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly eventPublisher: NestEventPublisher,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly customFieldDefinitionRepository: TypeOrmCustomFieldDefinitionRepository,
    @Inject() private readonly attachmentRepository: TypeOrmAttachmentRepository,
    @Inject() private readonly participantRepository: TypeOrmTicketParticipantRepository,
    @Inject() private readonly transferRequestRepository: TypeOrmTransferRequestRepository,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateTicketRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateTicket(this.idGenerator, this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const validateCustomFields = new ValidateCustomFieldValues(this.customFieldDefinitionRepository);
    const claimAttachments = new ClaimStagedAttachments(this.attachmentRepository);

    let reporterId = user.userId;
    let reporterEmail = user.email;

    if (body.onBehalfOf) {
      const resolved = await this.resolveOnBehalfOf(body.onBehalfOf, workspace.getId());
      reporterId = resolved.userId;
      reporterEmail = resolved.email;
    }

    const command = new CreateTicketCommand(service, ensurePermission, this.userRepository, this.eventPublisher, auditLog, validateCustomFields, claimAttachments);
    return command.execute({
      name: body.name,
      description: body.description,
      priority: body.priority,
      category: body.category,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: reporterId,
      userEmail: reporterEmail,
      tagIds: body.tagIds,
      customFields: body.customFields,
      uploadTokens: body.uploadTokens,
      registeredById: body.onBehalfOf ? user.userId : null,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get()
  async list(
    @Param('slug') slug: string,
    @Query() filters: TicketFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new ListTicketsQuery(this.ticketRepository, ensurePermission);
    return query.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      filters: {
        search: filters.search,
        status: filters.status,
        excludeStatus: filters.excludeStatus,
        priority: filters.priority,
        tagIds: filters.tagIds,
        assigneeId: filters.assigneeId,
        reporterId: filters.reporterId,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      },
      page: filters.page,
      limit: filters.limit,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Patch('bulk/status')
  async bulkChangeStatus(
    @Param('slug') slug: string,
    @Body() body: BulkChangeStatusRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new ChangeTicketStatus(this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const changeStatusCommand = new ChangeTicketStatusCommand(service, this.ticketRepository, ensurePermission, this.eventPublisher, auditLog);
    const command = new BulkChangeStatusCommand(changeStatusCommand);
    return command.execute({
      ticketIds: body.ticketIds,
      status: body.status,
      discardReason: body.discardReason,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Post('bulk/delete')
  async bulkDelete(
    @Param('slug') slug: string,
    @Body() body: BulkDeleteRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new DeleteTicket(this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const deleteCommand = new DeleteTicketCommand(service, ensurePermission, this.ticketRepository, auditLog);
    const command = new BulkDeleteCommand(deleteCommand);
    return command.execute({
      ticketIds: body.ticketIds,
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get(':id')
  async get(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensureAccess = this.createEnsureTicketAccess();
    const query = new GetTicketQuery(this.ticketRepository, ensureAccess);
    return query.execute({ ticketId: id, workspaceId: workspace.getId(), userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Patch(':id')
  async update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: UpdateTicketRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    await this.createEnsureTicketAccess().ensureFull({ ticketId: id, userId: user.userId, workspaceId: workspace.getId(), isSystemAdmin: user.isSystemAdmin });
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new UpdateTicket(this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const validateCustomFields = new ValidateCustomFieldValues(this.customFieldDefinitionRepository);
    const command = new UpdateTicketCommand(service, this.ticketRepository, ensurePermission, auditLog, validateCustomFields);
    return command.execute({
      ticketId: id,
      workspaceId: workspace.getId(),
      userId: user.userId,
      name: body.name,
      description: body.description,
      priority: body.priority,
      category: body.category,
      tagIds: body.tagIds,
      customFields: body.customFields,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Patch(':id/status')
  async changeStatus(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: ChangeTicketStatusRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    await this.createEnsureTicketAccess().ensureFull({ ticketId: id, userId: user.userId, workspaceId: workspace.getId(), isSystemAdmin: user.isSystemAdmin });
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new ChangeTicketStatus(this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new ChangeTicketStatusCommand(service, this.ticketRepository, ensurePermission, this.eventPublisher, auditLog);
    return command.execute({
      ticketId: id,
      status: body.status,
      discardReason: body.discardReason,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Patch(':id/assign')
  async assign(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: AssignTicketRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    await this.createEnsureTicketAccess().ensureFull({ ticketId: id, userId: user.userId, workspaceId: workspace.getId(), isSystemAdmin: user.isSystemAdmin });
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new AssignTicket(this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket || ticket.workspaceId !== workspace.getId()) throw new EntityNotFoundError('Ticket not found');
    const assignee = body.assigneeId ? await this.userRepository.findById(body.assigneeId) : null;
    const prevAssignee = ticket.assigneeId ? await this.userRepository.findById(ticket.assigneeId) : null;
    const command = new AssignTicketCommand(service, this.ticketRepository, ensurePermission, this.eventPublisher, auditLog);
    return command.execute({
      ticketId: id,
      assigneeId: body.assigneeId,
      assigneeLabel: assignee ? `${assignee.firstName} ${assignee.lastName} (${assignee.email})` : null,
      previousAssigneeLabel: prevAssignee ? `${prevAssignee.firstName} ${prevAssignee.lastName} (${prevAssignee.email})` : null,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    await this.createEnsureTicketAccess().ensureFull({ ticketId: id, userId: user.userId, workspaceId: workspace.getId(), isSystemAdmin: user.isSystemAdmin });
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new DeleteTicket(this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new DeleteTicketCommand(service, ensurePermission, this.ticketRepository, auditLog);
    return command.execute({ ticketId: id, workspaceId: workspace.getId(), userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Post(':id/pickup')
  async pickup(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.TICKET_PICKUP,
      isSystemAdmin: user.isSystemAdmin,
    });
    const service = new PickupTicket(this.ticketRepository);
    const ticket = await service.execute({ ticketId: id, userId: user.userId });
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.TICKET_PICKED_UP,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { ticketName: ticket.name },
    });
    return { id: ticket.getId(), status: ticket.status, assigneeId: ticket.assigneeId };
  }

  @Patch(':id/transfer')
  async transfer(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: { assigneeId: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.TICKET_TRANSFER,
      isSystemAdmin: user.isSystemAdmin,
    });

    const service = new CreateTransferRequest(this.idGenerator, this.ticketRepository, this.transferRequestRepository);
    const request = await service.execute({ ticketId: id, requesterId: user.userId, targetUserId: body.assigneeId });

    const ticket = await this.ticketRepository.findById(id);
    const fromUser = await this.userRepository.findById(user.userId);
    const toUser = await this.userRepository.findById(body.assigneeId);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.TRANSFER_REQUEST_CREATED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: {
        ticketName: ticket?.name,
        requestId: request.getId(),
        from: fromUser ? `${fromUser.firstName} ${fromUser.lastName}` : user.userId,
        to: toUser ? `${toUser.firstName} ${toUser.lastName}` : body.assigneeId,
      },
    });

    const event: TransferRequestCreatedEvent = {
      requestId: request.getId(),
      ticketId: id,
      ticketName: ticket?.name ?? '',
      requesterId: user.userId,
      requesterName: fromUser ? `${fromUser.firstName} ${fromUser.lastName}` : user.userId,
      targetUserId: body.assigneeId,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      expiresAt: request.expiresAt,
    };
    this.eventPublisher.emit('transfer-request.created', event);

    // Add target as follower so they can access the ticket
    const addParticipant = new AddTicketParticipant(this.idGenerator, this.participantRepository);
    await addParticipant.execute({ ticketId: id, userId: body.assigneeId, role: ParticipantRole.FOLLOWER }).catch(() => {});

    return { id, transferRequestId: request.getId(), status: 'pending', expiresAt: request.expiresAt };
  }

  @Get(':id/transfer-requests/pending')
  async getPendingTransfer(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket || ticket.workspaceId !== workspace.getId()) throw new EntityNotFoundError('Ticket not found');

    const request = await this.transferRequestRepository.findPendingByTicketId(id);
    if (!request) return null;

    const requester = await this.userRepository.findById(request.requesterId);
    const target = await this.userRepository.findById(request.targetUserId);
    return {
      id: request.getId(),
      requesterId: request.requesterId,
      requesterName: requester ? `${requester.firstName} ${requester.lastName}` : request.requesterId,
      targetUserId: request.targetUserId,
      targetName: target ? `${target.firstName} ${target.lastName}` : request.targetUserId,
      expiresAt: request.expiresAt,
    };
  }

  @Post(':id/transfer-requests/:requestId/accept')
  async acceptTransfer(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.TRANSFER_REQUEST_RESPOND,
      isSystemAdmin: user.isSystemAdmin,
    });

    const service = new AcceptTransferRequest(this.transferRequestRepository, this.ticketRepository);
    const { request, ticket } = await service.execute({ requestId, userId: user.userId });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.TRANSFER_REQUEST_ACCEPTED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { ticketName: ticket.name, requestId },
    });

    const event: TransferRequestResolvedEvent = {
      requestId,
      ticketId: id,
      ticketName: ticket.name,
      requesterId: request.requesterId,
      targetUserId: request.targetUserId,
      resolution: 'accepted',
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    };
    this.eventPublisher.emit('transfer-request.resolved', event);

    return { id: ticket.getId(), assigneeId: ticket.assigneeId, status: 'accepted' };
  }

  @Post(':id/transfer-requests/:requestId/reject')
  async rejectTransfer(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.TRANSFER_REQUEST_RESPOND,
      isSystemAdmin: user.isSystemAdmin,
    });

    const service = new RejectTransferRequest(this.transferRequestRepository);
    const request = await service.execute({ requestId, userId: user.userId });

    const ticket = await this.ticketRepository.findById(id);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.TRANSFER_REQUEST_REJECTED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { ticketName: ticket?.name, requestId },
    });

    const event: TransferRequestResolvedEvent = {
      requestId,
      ticketId: id,
      ticketName: ticket?.name ?? '',
      requesterId: request.requesterId,
      targetUserId: request.targetUserId,
      resolution: 'rejected',
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    };
    this.eventPublisher.emit('transfer-request.resolved', event);

    return { id, status: 'rejected' };
  }

  @Post(':id/transfer-requests/:requestId/cancel')
  async cancelTransfer(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.TICKET_TRANSFER,
      isSystemAdmin: user.isSystemAdmin,
    });

    const service = new CancelTransferRequest(this.transferRequestRepository);
    const request = await service.execute({ requestId, userId: user.userId });

    const ticket = await this.ticketRepository.findById(id);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.TRANSFER_REQUEST_CANCELLED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { ticketName: ticket?.name, requestId },
    });

    const event: TransferRequestResolvedEvent = {
      requestId,
      ticketId: id,
      ticketName: ticket?.name ?? '',
      requesterId: request.requesterId,
      targetUserId: request.targetUserId,
      resolution: 'cancelled',
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    };
    this.eventPublisher.emit('transfer-request.resolved', event);

    return { id, status: 'cancelled' };
  }

  @Get(':id/participants')
  async listParticipants(
    @Param('slug') slug: string,
    @Param('id') id: string,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket || ticket.workspaceId !== workspace.getId()) throw new EntityNotFoundError('Ticket not found');

    const participants = await this.participantRepository.findByTicketId(id);
    const result = [];
    for (const p of participants) {
      const u = await this.userRepository.findById(p.userId);
      if (u) {
        result.push({
          id: p.getId(),
          userId: p.userId,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          role: p.role,
        });
      }
    }
    return result;
  }

  @Post(':id/participants')
  async addParticipant(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: { userId: string; role?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket || ticket.workspaceId !== workspace.getId()) throw new EntityNotFoundError('Ticket not found');

    const service = new AddTicketParticipant(this.idGenerator, this.participantRepository);
    const role = (body.role as ParticipantRole) ?? ParticipantRole.FOLLOWER;
    const participant = await service.execute({
      ticketId: id,
      userId: body.userId,
      role,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.PARTICIPANT_ADDED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { participantUserId: body.userId, role },
    });

    return participant ? { added: true } : { added: false, reason: 'already a participant' };
  }

  @Delete(':id/participants/:userId')
  async removeParticipant(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket || ticket.workspaceId !== workspace.getId()) throw new EntityNotFoundError('Ticket not found');

    await this.participantRepository.remove(id, userId);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.PARTICIPANT_REMOVED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: id,
      userId: user.userId,
      workspaceId: workspace.getId(),
      metadata: { participantUserId: userId },
    });

    return { removed: true };
  }

  @Patch(':id/ai-cache')
  async updateAiCache(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: { key: string; source: string; result: string } | { key: string; clear: true },
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket || ticket.workspaceId !== workspace.getId()) throw new EntityNotFoundError('Ticket not found');

    const cache = { ...ticket.aiCache };
    if ('clear' in body && body.clear) {
      delete cache[body.key];
    } else if ('result' in body) {
      cache[body.key] = { source: body.source, result: body.result };
    }
    ticket.aiCache = cache;
    await this.ticketRepository.update(ticket);
    return { ok: true };
  }

  private createEnsureTicketAccess() {
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    return new EnsureTicketAccess(this.ticketRepository, ensurePermission, this.participantRepository);
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }

  private async resolveOnBehalfOf(
    email: string,
    workspaceId: string,
  ): Promise<{ userId: string; email: string }> {
    let targetUser = await this.userRepository.findByEmail(email.toLowerCase());

    if (!targetUser) {
      const createUser = new CreateUser(this.idGenerator, this.userRepository, new BcryptPasswordHasher());
      targetUser = await createUser.execute({
        email: email.toLowerCase(),
        password: randomBytes(32).toString('hex'),
        firstName: email.split('@')[0],
        lastName: '',
        isEmailVerified: true,
        autoCreated: true,
      });
    }

    const existingMember = await this.memberRepository.findByWorkspaceAndUser(
      workspaceId,
      targetUser.getId(),
    );
    if (!existingMember) {
      const addMember = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
      await addMember.execute({
        workspaceId,
        userId: targetUser.getId(),
        role: WorkspaceRole.REPORTER,
      });
    }

    return { userId: targetUser.getId(), email: targetUser.email };
  }
}
