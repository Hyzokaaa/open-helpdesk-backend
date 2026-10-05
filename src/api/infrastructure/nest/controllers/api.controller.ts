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
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyScope } from '../../../../api-key/domain/enums/api-key-scope.enum';
import { Throttle } from '@nestjs/throttler';
import { PUBLIC_API_THROTTLE } from '../../../../shared/nest/throttling/throttle.constants';
import { ConfigService } from '@nestjs/config';
import { tokenExchangeTtlFromConfig } from '../token-exchange-ttl';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { ApiKeyAuth } from '../../../../shared/nest/decorators/api-key-auth.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { NestEventPublisher } from '../../../../shared/infrastructure/nest-event-publisher';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { CreateTicket } from '../../../../ticket/domain/services/ticket-create';
import { TicketSource } from '../../../../ticket/domain/enums/ticket-source.enum';
import { TicketStatus } from '../../../../ticket/domain/enums/ticket-status.enum';
import { TicketPriority } from '../../../../ticket/domain/enums/ticket-priority.enum';
import { UpdateTicket } from '../../../../ticket/domain/services/ticket-update';
import { ChangeTicketStatus } from '../../../../ticket/domain/services/ticket-change-status';
import { AssignTicket } from '../../../../ticket/domain/services/ticket-assign';
import { DeleteTicket } from '../../../../ticket/domain/services/ticket-delete';
import { CreateComment } from '../../../../comment/domain/services/comment-create';
import { CreateTicketCommand } from '../../../../ticket/application/commands/create-ticket.command';
import { UpdateTicketCommand } from '../../../../ticket/application/commands/update-ticket.command';
import { ChangeTicketStatusCommand } from '../../../../ticket/application/commands/change-ticket-status.command';
import { AssignTicketCommand } from '../../../../ticket/application/commands/assign-ticket.command';
import { DeleteTicketCommand } from '../../../../ticket/application/commands/delete-ticket.command';
import { CreateCommentCommand } from '../../../../comment/application/commands/create-comment.command';
import { GetTicketQuery } from '../../../../ticket/application/queries/get-ticket.query';
import { ListTicketsQuery } from '../../../../ticket/application/queries/list-tickets.query';
import { ListTicketCommentsQuery } from '../../../../comment/application/queries/list-ticket-comments.query';
import { TypeOrmTicketRepository } from '../../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmCommentRepository } from '../../../../comment/infrastructure/typeorm/repositories/typeorm-comment.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmCustomFieldDefinitionRepository } from '../../../../custom-field/infrastructure/typeorm/repositories/typeorm-custom-field-definition.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { EnsureTicketAccess } from '../../../../ticket/domain/services/ticket-ensure-access';
import { TypeOrmTicketParticipantRepository } from '../../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket-participant.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { ValidateCustomFieldValues } from '../../../../custom-field/domain/services/custom-field-validate-values';
import { PaginationDto } from '../../../../shared/nest/dto/pagination.dto';
import { TicketFilterDto } from '../../../../ticket/infrastructure/nest/dto/ticket-filter.dto';
import { CreateApiTicketRequest } from '../dto/create-api-ticket.request';
import { UpdateApiTicketRequest } from '../dto/update-api-ticket.request';
import { CreateApiCommentRequest } from '../dto/create-api-comment.request';
import { ExchangeTokenRequest } from '../dto/exchange-token.request';
import {
  API_RESPONSE_EXTRA_MODELS,
  ApiCommentPage,
  ApiCreatedComment,
  ApiCreatedTicket,
  ApiExchangedToken,
  ApiMember,
  ApiTicketDetail,
  ApiTicketPage,
  ApiUpdatedTicket,
} from '../dto/api-responses';
import { ApiScopedOperation } from '../openapi/api-operation.decorators';
import { API_KEY_SECURITY_SCHEME } from '../openapi/api-docs.constants';
import { ExchangeToken } from '../../../../user/domain/services/user-exchange-token';
import { ExchangeTokenCommand } from '../../../../user/application/commands/exchange-token.command';
import { AddWorkspaceMember } from '../../../../workspace/domain/services/workspace-add-member';
import { WorkspaceRole } from '../../../../workspace/domain/enums/workspace-role.enum';
import { JwtTokenService } from '../../../../shared/infrastructure/jwt-token-service';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { EnsureTicketReferences } from '../../../../ticket/domain/services/ticket-ensure-references';
import { ResolveTicketReferenceLabels } from '../../../../ticket/domain/services/ticket-resolve-reference-labels';
import { EnsureTicketAssignee } from '../../../../ticket/domain/services/ticket-ensure-assignee';
import { TypeOrmTicketCategoryRepository } from '../../../../project/infrastructure/typeorm/repositories/typeorm-ticket-category.repository';
import { TypeOrmTagRepository } from '../../../../tag/infrastructure/typeorm/repositories/typeorm-tag.repository';

const TICKET_ID_PARAM = ApiParam({ name: 'id', description: 'Ticket id (ULID), not the TK- number.', example: '01JABCDEF0123456789ABCDEFG' });
const PAGE_QUERY = ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number, from 1.', example: 1 });
const LIMIT_QUERY = ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page, 1 to 100. Default 20.', example: 20 });

@Controller('api/v1')
@ApiKeyAuth()
@ApiBearerAuth(API_KEY_SECURITY_SCHEME)
@ApiExtraModels(...API_RESPONSE_EXTRA_MODELS)
@Throttle({ default: PUBLIC_API_THROTTLE })
export class ApiController {
  private readonly tokenExchangeTtl: string;

  constructor(
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly commentRepository: TypeOrmCommentRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly eventPublisher: NestEventPublisher,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly customFieldDefinitionRepository: TypeOrmCustomFieldDefinitionRepository,
    @Inject() private readonly tokenService: JwtTokenService,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly participantRepository: TypeOrmTicketParticipantRepository,
    @Inject() private readonly ticketCategoryRepository: TypeOrmTicketCategoryRepository,
    @Inject() private readonly tagRepository: TypeOrmTagRepository,
    config: ConfigService,
  ) {
    this.tokenExchangeTtl = tokenExchangeTtlFromConfig(config);
  }

  // --- Tickets ---

  @Get('tickets')
  @ApiTags('Tickets')
  @ApiScopedOperation({
    scope: ApiKeyScope.TICKETS_READ,
    summary: 'List tickets',
    description: "Paginated tickets of the key's workspace, newest first unless `sortBy` says otherwise. If the key creator's role only lets them see their own tickets, only those are returned.",
    validates: true,
  })
  @ApiOkResponse({ type: ApiTicketPage })
  @PAGE_QUERY
  @LIMIT_QUERY
  @ApiQuery({ name: 'search', required: false, description: 'Text searched in title and body. A ticket number (`TK-000042`, `42`) also matches that ticket.' })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus, enumName: 'TicketStatus' })
  @ApiQuery({ name: 'excludeStatus', required: false, description: 'Comma-separated statuses to leave out.', example: 'resolved,discarded' })
  @ApiQuery({ name: 'priority', required: false, enum: TicketPriority, enumName: 'TicketPriority' })
  @ApiQuery({ name: 'tagIds', required: false, description: 'Comma-separated tag ids; tickets with any of them match.' })
  @ApiQuery({ name: 'assigneeId', required: false, description: 'User id of the assignee.' })
  @ApiQuery({ name: 'reporterId', required: false, description: 'User id of who opened the ticket.' })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'ticketNumber', 'name', 'priority', 'status', 'categoryId', 'departmentId', 'organizationId'],
    description: 'Sort field. Unknown values fall back to `createdAt`.',
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Default `DESC`.' })
  async listTickets(
    @Query() filters: TicketFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.requireScope(user, ApiKeyScope.TICKETS_READ);
    const workspaceId = this.resolveWorkspaceId(user);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new ListTicketsQuery(this.ticketRepository, ensurePermission);
    return query.execute({
      workspaceId,
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

  @Get('tickets/:id')
  @ApiTags('Tickets')
  @ApiScopedOperation({ scope: ApiKeyScope.TICKETS_READ, summary: 'Get a ticket', addressesTicket: true })
  @TICKET_ID_PARAM
  @ApiOkResponse({ type: ApiTicketDetail })
  async getTicket(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.requireScope(user, ApiKeyScope.TICKETS_READ);
    const workspaceId = this.resolveWorkspaceId(user);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const ensureAccess = new EnsureTicketAccess(this.ticketRepository, ensurePermission, this.participantRepository);
    const query = new GetTicketQuery(this.ticketRepository, ensureAccess);
    return query.execute({
      ticketId: id,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Post('tickets')
  @ApiTags('Tickets')
  @ApiScopedOperation({
    scope: ApiKeyScope.TICKETS_WRITE,
    summary: 'Create a ticket',
    description: "Opens a ticket in the key's workspace with source `api`, reported by the key creator. Category and tags must belong to the workspace, and required custom fields must be sent.",
    validates: true,
  })
  @ApiCreatedResponse({ type: ApiCreatedTicket })
  async createTicket(
    @Body() body: CreateApiTicketRequest,
    @CurrentUser() user: AuthUser,
  ) {
    this.requireScope(user, ApiKeyScope.TICKETS_WRITE);
    const workspaceId = this.resolveWorkspaceId(user);
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateTicket(this.idGenerator, this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const validateCustomFields = new ValidateCustomFieldValues(this.customFieldDefinitionRepository);
    const command = new CreateTicketCommand(service, ensurePermission, this.userRepository, this.eventPublisher, auditLog, validateCustomFields, undefined, this.createEnsureReferences());
    return command.execute({
      name: body.name,
      description: body.description ?? '',
      priority: body.priority,
      categoryId: body.categoryId,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      userEmail: user.email,
      tagIds: body.tagIds,
      customFields: body.customFields,
      source: TicketSource.API,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Patch('tickets/:id')
  @ApiTags('Tickets')
  @ApiScopedOperation({
    scope: ApiKeyScope.TICKETS_WRITE,
    summary: 'Update a ticket',
    description: 'Send only the fields to change. They are applied in this order, each as its own step: `status`, then `assigneeId`, then the remaining fields. A step that fails stops the request but does not undo the steps before it.\n\nThe response holds the updated fields when any field other than `status` or `assigneeId` was sent, and only the `id` otherwise.',
    validates: true,
    addressesTicket: true,
  })
  @TICKET_ID_PARAM
  @ApiOkResponse({ type: ApiUpdatedTicket })
  async updateTicket(
    @Param('id') id: string,
    @Body() body: UpdateApiTicketRequest,
    @CurrentUser() user: AuthUser,
  ) {
    this.requireScope(user, ApiKeyScope.TICKETS_WRITE);
    const workspaceId = this.resolveWorkspaceId(user);
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);

    // Handle status change
    if (body.status) {
      const statusService = new ChangeTicketStatus(this.ticketRepository);
      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      const statusCommand = new ChangeTicketStatusCommand(statusService, this.ticketRepository, ensurePermission, this.eventPublisher, auditLog);
      await statusCommand.execute({
        ticketId: id,
        status: body.status,
        workspaceId: workspace.getId(),
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        userId: user.userId,
        isSystemAdmin: user.isSystemAdmin,
      });
    }

    // Handle assignee change
    if (body.assigneeId !== undefined) {
      const assignService = new AssignTicket(this.ticketRepository);
      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      const ticket = await this.ticketRepository.findById(id);
      if (!ticket || ticket.workspaceId !== workspace.getId()) throw new EntityNotFoundError('Ticket not found');
      const assignee = body.assigneeId ? await this.userRepository.findById(body.assigneeId) : null;
      const prevAssignee = ticket.assigneeId ? await this.userRepository.findById(ticket.assigneeId) : null;
      const assignCommand = new AssignTicketCommand(assignService, this.ticketRepository, ensurePermission, this.eventPublisher, auditLog, new EnsureTicketAssignee(this.memberRepository));
      await assignCommand.execute({
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

    // Handle field updates
    const hasFieldUpdates = body.name !== undefined || body.description !== undefined ||
      body.priority !== undefined || body.categoryId !== undefined ||
      body.tagIds !== undefined || body.customFields !== undefined;

    if (hasFieldUpdates) {
      const updateService = new UpdateTicket(this.ticketRepository);
      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      const validateCustomFields = new ValidateCustomFieldValues(this.customFieldDefinitionRepository);
      const updateCommand = new UpdateTicketCommand(updateService, this.ticketRepository, ensurePermission, auditLog, validateCustomFields, this.createEnsureReferences(), this.createResolveLabels(), this.eventPublisher);
      return updateCommand.execute({
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
        customFields: body.customFields,
        isSystemAdmin: user.isSystemAdmin,
      });
    }

    return { id };
  }

  @Delete('tickets/:id')
  @ApiTags('Tickets')
  @ApiScopedOperation({
    scope: ApiKeyScope.TICKETS_WRITE,
    summary: 'Delete a ticket',
    description: "The key creator's role must allow deleting tickets.",
    addressesTicket: true,
  })
  @TICKET_ID_PARAM
  @ApiOkResponse({ description: 'Deleted. The body is empty.' })
  async deleteTicket(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.requireScope(user, ApiKeyScope.TICKETS_WRITE);
    const workspaceId = this.resolveWorkspaceId(user);
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new DeleteTicket(this.ticketRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new DeleteTicketCommand(service, ensurePermission, this.ticketRepository, auditLog, this.eventPublisher);
    return command.execute({
      ticketId: id,
      workspaceId,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  // --- Comments ---

  @Get('tickets/:id/comments')
  @ApiTags('Comments')
  @ApiScopedOperation({ scope: ApiKeyScope.COMMENTS_READ, summary: 'List the comments of a ticket', validates: true, addressesTicket: true })
  @TICKET_ID_PARAM
  @PAGE_QUERY
  @LIMIT_QUERY
  @ApiOkResponse({ type: ApiCommentPage })
  async listComments(
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.requireScope(user, ApiKeyScope.COMMENTS_READ);
    const workspaceId = this.resolveWorkspaceId(user);
    const query = new ListTicketCommentsQuery(this.commentRepository, this.createEnsureTicketAccess());
    return query.execute({
      ticketId: id,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  @Post('tickets/:id/comments')
  @ApiTags('Comments')
  @ApiScopedOperation({
    scope: ApiKeyScope.COMMENTS_WRITE,
    summary: 'Add a comment',
    description: 'Adds a comment authored by the key creator, who must be able to contribute to the ticket.',
    validates: true,
    addressesTicket: true,
  })
  @TICKET_ID_PARAM
  @ApiCreatedResponse({ type: ApiCreatedComment })
  async createComment(
    @Param('id') id: string,
    @Body() body: CreateApiCommentRequest,
    @CurrentUser() user: AuthUser,
  ) {
    this.requireScope(user, ApiKeyScope.COMMENTS_WRITE);
    const workspaceId = this.resolveWorkspaceId(user);
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const service = new CreateComment(this.idGenerator, this.commentRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new CreateCommentCommand(
      service,
      this.createEnsureTicketAccess(),
      this.ticketRepository,
      this.workspaceRepository,
      this.userRepository,
      this.eventPublisher,
      auditLog,
    );
    return command.execute({
      content: body.content,
      ticketId: id,
      authorId: user.userId,
      workspaceSlug: workspace.slug,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  // --- Members ---

  @Get('members')
  @ApiTags('Members')
  @ApiScopedOperation({ scope: ApiKeyScope.MEMBERS_READ, summary: 'List workspace members', description: "Every member of the key's workspace, not paginated." })
  @ApiOkResponse({ type: [ApiMember] })
  async listMembers(
    @CurrentUser() user: AuthUser,
  ) {
    this.requireScope(user, ApiKeyScope.MEMBERS_READ);
    const workspaceId = this.resolveWorkspaceId(user);
    const members = await this.memberRepository.findByWorkspaceId(workspaceId);
    const result = [];
    for (const member of members) {
      const u = await this.userRepository.findById(member.userId);
      if (u) {
        result.push({
          id: member.getId(),
          userId: member.userId,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: member.role,
        });
      }
    }
    return result;
  }

  // --- Auth Exchange ---

  @Post('auth/exchange')
  @ApiTags('Authentication')
  @ApiScopedOperation({
    scope: ApiKeyScope.AUTH_EXCHANGE,
    summary: 'Sign in a user (delegated sign-in)',
    description: "Creates the user if no account has this email, adds them to the key's workspace and returns a session token for them. An existing account must already be a member of the workspace. Supervisors and admins, existing or new, also require scope `auth:exchange:admin`. System administrators and deactivated users are never signed in. See *Delegated sign-in* in the guide.",
    validates: true,
  })
  @ApiCreatedResponse({ type: ApiExchangedToken })
  async exchangeToken(
    @Body() body: ExchangeTokenRequest,
    @CurrentUser() user: AuthUser,
  ) {
    this.requireScope(user, ApiKeyScope.AUTH_EXCHANGE);
    const workspaceId = this.resolveWorkspaceId(user);

    const service = new ExchangeToken(this.idGenerator, this.userRepository, this.passwordHasher, this.memberRepository);
    const addMember = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
    const command = new ExchangeTokenCommand(service, addMember, this.tokenService, this.tokenExchangeTtl);

    return command.execute({
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role ?? WorkspaceRole.AGENT,
      workspaceId,
      allowElevatedRoles: user.apiKeyScopes?.includes(ApiKeyScope.AUTH_EXCHANGE_ADMIN) ?? false,
    });
  }

  private createEnsureTicketAccess(): EnsureTicketAccess {
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    return new EnsureTicketAccess(this.ticketRepository, ensurePermission, this.participantRepository);
  }

  private resolveWorkspaceId(user: AuthUser): string {
    if (user.workspaceId) return user.workspaceId;
    throw new ForbiddenException('API key authentication required for this endpoint, or use workspace-scoped endpoints');
  }

  /** Category and tag ids sent by an integration must belong to the key's own workspace. */
  private createEnsureReferences(): EnsureTicketReferences {
    return new EnsureTicketReferences(this.ticketCategoryRepository, undefined, undefined, undefined, this.tagRepository);
  }

  private createResolveLabels(): ResolveTicketReferenceLabels {
    return new ResolveTicketReferenceLabels(this.ticketCategoryRepository, undefined, undefined, undefined, this.tagRepository);
  }

  private requireScope(user: AuthUser, scope: ApiKeyScope): void {
    if (!user.apiKeyScopes) return; // JWT user, no scope restriction
    if (!user.apiKeyScopes.includes(scope)) {
      throw new ForbiddenException('Insufficient API key permissions');
    }
  }
}
