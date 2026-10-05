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
import { CreateUser } from '../../../../user/domain/services/user-create';
import { SummarizeUsers } from '../../../../user/domain/services/user-summarize';
import { AddWorkspaceMember } from '../../../../workspace/domain/services/workspace-add-member';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { TicketSource } from '../../../domain/enums/ticket-source.enum';
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
import { DeleteTicket } from '../../../domain/services/ticket-delete';
import { CreateTicketCommand } from '../../../application/commands/create-ticket.command';
import { UpdateTicketCommand } from '../../../application/commands/update-ticket.command';
import { ChangeTicketStatusCommand } from '../../../application/commands/change-ticket-status.command';
import { AssignTicketCommand } from '../../../application/commands/assign-ticket.command';
import { DeleteTicketCommand } from '../../../application/commands/delete-ticket.command';
import { PickupTicketCommand } from '../../../application/commands/pickup-ticket.command';
import { CreateTransferRequestCommand } from '../../../application/commands/create-transfer-request.command';
import { AcceptTransferRequestCommand } from '../../../application/commands/accept-transfer-request.command';
import { RejectTransferRequestCommand } from '../../../application/commands/reject-transfer-request.command';
import { CancelTransferRequestCommand } from '../../../application/commands/cancel-transfer-request.command';
import { AddTicketParticipantCommand } from '../../../application/commands/add-ticket-participant.command';
import { RemoveTicketParticipantCommand } from '../../../application/commands/remove-ticket-participant.command';
import { UpdateTicketAiCacheCommand } from '../../../application/commands/update-ticket-ai-cache.command';
import { ResolveOnBehalfOfCommand } from '../../../application/commands/resolve-on-behalf-of.command';
import { GetTicketQuery } from '../../../application/queries/get-ticket.query';
import { ListTicketsQuery } from '../../../application/queries/list-tickets.query';
import { GetPendingTransferRequestQuery } from '../../../application/queries/get-pending-transfer-request.query';
import { ListTicketParticipantsQuery } from '../../../application/queries/list-ticket-participants.query';
import { GetTicketDescriptionHistoryQuery } from '../../../application/queries/get-ticket-description-history.query';
import { TypeOrmTicketRepository } from '../../typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { TypeOrmCustomFieldDefinitionRepository } from '../../../../custom-field/infrastructure/typeorm/repositories/typeorm-custom-field-definition.repository';
import { ValidateCustomFieldValues } from '../../../../custom-field/domain/services/custom-field-validate-values';
import { BulkChangeStatusCommand } from '../../../application/commands/bulk-change-status.command';
import { AddTicketParticipant } from '../../../domain/services/ticket-add-participant';
import { EnsureTicketAccess } from '../../../domain/services/ticket-ensure-access';
import { EnsureTicketAssignee } from '../../../domain/services/ticket-ensure-assignee';
import { EnsureTicketReferences } from '../../../domain/services/ticket-ensure-references';
import { ResolveTicketReferenceLabels } from '../../../domain/services/ticket-resolve-reference-labels';
import { TypeOrmTicketParticipantRepository } from '../../typeorm/repositories/typeorm-ticket-participant.repository';
import { ParticipantRole } from '../../../domain/enums/participant-role.enum';
import { BulkDeleteCommand } from '../../../application/commands/bulk-delete.command';
import { CreateTicketRequest } from '../dto/create-ticket.request';
import { UpdateTicketRequest } from '../dto/update-ticket.request';
import { ChangeTicketStatusRequest } from '../dto/change-ticket-status.request';
import { BulkChangeStatusRequest } from '../dto/bulk-change-status.request';
import { BulkDeleteRequest } from '../dto/bulk-delete.request';
import { AssignTicketRequest } from '../dto/assign-ticket.request';
import { PickupTicketRequest } from '../dto/pickup-ticket.request';
import { TransferTicketRequest } from '../dto/transfer-ticket.request';
import { AddTicketParticipantRequest } from '../dto/add-ticket-participant.request';
import { UpdateTicketAiCacheRequest } from '../dto/update-ticket-ai-cache.request';
import { TicketFilterDto } from '../dto/ticket-filter.dto';
import { TypeOrmOrganizationRepository } from '../../../../organization/infrastructure/typeorm/repositories/typeorm-organization.repository';
import { TypeOrmDepartmentRepository } from '../../../../department/infrastructure/typeorm/repositories/typeorm-department.repository';
import { TypeOrmProjectRepository } from '../../../../project/infrastructure/typeorm/repositories/typeorm-project.repository';
import { TypeOrmTicketCategoryRepository } from '../../../../project/infrastructure/typeorm/repositories/typeorm-ticket-category.repository';
import { TypeOrmTagRepository } from '../../../../tag/infrastructure/typeorm/repositories/typeorm-tag.repository';
import { AutoEnrollOrganization } from '../../../../organization/domain/services/organization-auto-enroll';
import { EditTicketDescription } from '../../../domain/services/ticket-edit-description';
import { TypeOrmTicketDescriptionEditRepository } from '../../typeorm/repositories/typeorm-ticket-description-edit.repository';

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
    @Inject() private readonly organizationRepository: TypeOrmOrganizationRepository,
    @Inject() private readonly ticketDescriptionEditRepository: TypeOrmTicketDescriptionEditRepository,
    @Inject() private readonly departmentRepository: TypeOrmDepartmentRepository,
    @Inject() private readonly projectRepository: TypeOrmProjectRepository,
    @Inject() private readonly ticketCategoryRepository: TypeOrmTicketCategoryRepository,
    @Inject() private readonly tagRepository: TypeOrmTagRepository,
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
      const resolveOnBehalfOf = new ResolveOnBehalfOfCommand(
        ensurePermission,
        this.userRepository,
        this.memberRepository,
        new CreateUser(this.idGenerator, this.userRepository, new BcryptPasswordHasher()),
        new AddWorkspaceMember(this.idGenerator, this.memberRepository),
      );
      const resolved = await resolveOnBehalfOf.execute({
        email: body.onBehalfOf,
        workspaceId: workspace.getId(),
        userId: user.userId,
        isSystemAdmin: user.isSystemAdmin,
      });
      reporterId = resolved.userId;
      reporterEmail = resolved.email;
    }

    // Auto-enroll organization by reporter email domain
    const autoEnroll = new AutoEnrollOrganization(this.organizationRepository);
    const { organizationId } = await autoEnroll.execute(reporterEmail, workspace.getId());

    const command = new CreateTicketCommand(
      service,
      ensurePermission,
      this.userRepository,
      this.eventPublisher,
      auditLog,
      validateCustomFields,
      claimAttachments,
      this.createEnsureReferences(),
    );
    const result = await command.execute({
      name: body.name,
      description: body.description,
      priority: body.priority,
      categoryId: body.categoryId,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: reporterId,
      userEmail: reporterEmail,
      tagIds: body.tagIds,
      customFields: body.customFields,
      uploadTokens: body.uploadTokens,
      departmentId: body.departmentId,
      organizationId,
      projectId: body.projectId,
      source: TicketSource.UI,
      registeredById: body.onBehalfOf ? user.userId : null,
      isSystemAdmin: user.isSystemAdmin,
    });

    // Update contact's organizationId if auto-enrolled
    if (organizationId) {
      const member = await this.memberRepository.findByWorkspaceAndUser(workspace.getId(), reporterId);
      if (member && !member.organizationId) {
        member.organizationId = organizationId;
        await this.memberRepository.update(member);
      }
    }

    return result;
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
        departmentId: filters.departmentId,
        organizationId: filters.organizationId,
        projectId: filters.projectId,
        categoryId: filters.categoryId,
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
    const deleteCommand = new DeleteTicketCommand(service, ensurePermission, this.ticketRepository, auditLog, this.eventPublisher);
    const command = new BulkDeleteCommand(deleteCommand);
    return command.execute({
      ticketIds: body.ticketIds,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
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
    const query = new GetTicketQuery(this.ticketRepository, ensureAccess, new SummarizeUsers(this.userRepository));
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
    const editDescription = new EditTicketDescription(this.idGenerator, this.ticketDescriptionEditRepository);
    const service = new UpdateTicket(this.ticketRepository, editDescription);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const validateCustomFields = new ValidateCustomFieldValues(this.customFieldDefinitionRepository);
    const command = new UpdateTicketCommand(service, this.ticketRepository, ensurePermission, auditLog, validateCustomFields, this.createEnsureReferences(), this.createResolveLabels(), this.eventPublisher);
    return command.execute({
      ticketId: id,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      name: body.name,
      description: body.description,
      priority: body.priority,
      categoryId: body.categoryId,
      tagIds: body.tagIds,
      departmentId: body.departmentId,
      organizationId: body.organizationId,
      projectId: body.projectId,
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
    const command = new AssignTicketCommand(
      service,
      this.ticketRepository,
      ensurePermission,
      this.eventPublisher,
      auditLog,
      new EnsureTicketAssignee(this.memberRepository),
    );
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
    const command = new DeleteTicketCommand(service, ensurePermission, this.ticketRepository, auditLog, this.eventPublisher);
    return command.execute({
      ticketId: id,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Post(':id/pickup')
  async pickup(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: PickupTicketRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new PickupTicket(this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new PickupTicketCommand(service, ensurePermission, auditLog);
    return command.execute({
      ticketId: id,
      workspaceId: workspace.getId(),
      userId: user.userId,
      status: body.status,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Patch(':id/transfer')
  async transfer(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: TransferTicketRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateTransferRequest(this.idGenerator, this.ticketRepository, this.transferRequestRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const addParticipant = new AddTicketParticipant(this.idGenerator, this.participantRepository);
    const command = new CreateTransferRequestCommand(
      service,
      ensurePermission,
      this.createEnsureTicketAccess(),
      new EnsureTicketAssignee(this.memberRepository),
      this.ticketRepository,
      this.userRepository,
      this.eventPublisher,
      auditLog,
      addParticipant,
    );
    return command.execute({
      ticketId: id,
      targetUserId: body.assigneeId,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get(':id/transfer-requests/pending')
  async getPendingTransfer(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const query = new GetPendingTransferRequestQuery(this.transferRequestRepository, this.userRepository, this.createEnsureTicketAccess());
    return query.execute({ ticketId: id, workspaceId: workspace.getId(), userId: user.userId, isSystemAdmin: user.isSystemAdmin });
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
    const service = new AcceptTransferRequest(this.transferRequestRepository, this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new AcceptTransferRequestCommand(service, ensurePermission, this.eventPublisher, auditLog);
    return command.execute({
      ticketId: id,
      requestId,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
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
    const service = new RejectTransferRequest(this.transferRequestRepository, this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new RejectTransferRequestCommand(service, ensurePermission, this.ticketRepository, this.eventPublisher, auditLog);
    return command.execute({
      ticketId: id,
      requestId,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
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
    const service = new CancelTransferRequest(this.transferRequestRepository, this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new CancelTransferRequestCommand(service, ensurePermission, this.ticketRepository, this.eventPublisher, auditLog);
    return command.execute({
      ticketId: id,
      requestId,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get(':id/participants')
  async listParticipants(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const query = new ListTicketParticipantsQuery(this.participantRepository, this.userRepository, this.createEnsureTicketAccess());
    return query.execute({ ticketId: id, workspaceId: workspace.getId(), userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Post(':id/participants')
  async addParticipant(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: AddTicketParticipantRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new AddTicketParticipant(this.idGenerator, this.participantRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new AddTicketParticipantCommand(service, this.createEnsureTicketAccess(), ensurePermission, this.memberRepository, auditLog, this.userRepository);
    return command.execute({
      ticketId: id,
      workspaceId: workspace.getId(),
      userId: user.userId,
      targetUserId: body.userId,
      role: body.role ?? ParticipantRole.FOLLOWER,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Delete(':id/participants/:userId')
  async removeParticipant(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new RemoveTicketParticipantCommand(this.participantRepository, this.createEnsureTicketAccess(), ensurePermission, auditLog, this.userRepository);
    return command.execute({
      ticketId: id,
      workspaceId: workspace.getId(),
      userId: user.userId,
      targetUserId: userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get(':id/description/history')
  async descriptionHistory(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const query = new GetTicketDescriptionHistoryQuery(this.ticketDescriptionEditRepository, this.createEnsureTicketAccess());
    return query.execute({ ticketId: id, workspaceId: workspace.getId(), userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Patch(':id/ai-cache')
  async updateAiCache(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: UpdateTicketAiCacheRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const command = new UpdateTicketAiCacheCommand(this.ticketRepository, this.createEnsureTicketAccess(), ensurePermission);
    return command.execute({
      ticketId: id,
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      key: body.key,
      source: body.source,
      result: body.result,
      clear: body.clear,
    });
  }

  private createEnsureTicketAccess() {
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    return new EnsureTicketAccess(this.ticketRepository, ensurePermission, this.participantRepository);
  }

  private createEnsureReferences() {
    return new EnsureTicketReferences(
      this.ticketCategoryRepository,
      this.departmentRepository,
      this.projectRepository,
      this.organizationRepository,
      this.tagRepository,
    );
  }

  private createResolveLabels() {
    return new ResolveTicketReferenceLabels(
      this.ticketCategoryRepository,
      this.departmentRepository,
      this.projectRepository,
      this.organizationRepository,
      this.tagRepository,
    );
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
