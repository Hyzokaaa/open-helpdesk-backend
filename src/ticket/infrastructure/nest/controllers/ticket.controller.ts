import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../../../../shared/nest/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { CreateTicket } from '../../../domain/services/ticket-create';
import { UpdateTicket } from '../../../domain/services/ticket-update';
import { ChangeTicketStatus } from '../../../domain/services/ticket-change-status';
import { AssignTicket } from '../../../domain/services/ticket-assign';
import { CreateTicketCommand } from '../../../application/commands/create-ticket.command';
import { UpdateTicketCommand } from '../../../application/commands/update-ticket.command';
import { ChangeTicketStatusCommand } from '../../../application/commands/change-ticket-status.command';
import { AssignTicketCommand } from '../../../application/commands/assign-ticket.command';
import { DeleteTicket } from '../../../domain/services/ticket-delete';
import { DeleteTicketCommand } from '../../../application/commands/delete-ticket.command';
import { GetTicketQuery } from '../../../application/queries/get-ticket.query';
import { ListTicketsQuery } from '../../../application/queries/list-tickets.query';
import { TypeOrmTicketRepository } from '../../typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS, Permission, hasPermission } from '../../../../workspace/domain/permissions';
import { CreateTicketRequest } from '../dto/create-ticket.request';
import { UpdateTicketRequest } from '../dto/update-ticket.request';
import { ChangeTicketStatusRequest } from '../dto/change-ticket-status.request';
import { AssignTicketRequest } from '../dto/assign-ticket.request';
import { TicketFilterDto } from '../dto/ticket-filter.dto';
import {
  TicketCreatedEvent,
  TicketAssignedEvent,
  StatusChangedEvent,
} from '../../../../email/domain/events';

@Controller('workspaces/:slug/tickets')
@UseGuards(JwtAuthGuard)
export class TicketController {
  constructor(
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateTicketRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    await this.ensure(workspace.getId(), user.userId, PERMISSIONS.TICKET_CREATE);

    const service = new CreateTicket(this.idGenerator, this.ticketRepository);
    const command = new CreateTicketCommand(service);
    const result = await command.execute({
      name: body.name,
      description: body.description,
      priority: body.priority,
      category: body.category,
      workspaceId: workspace.getId(),
      creatorId: user.userId,
      tagIds: body.tagIds,
    });

    const creator = await this.userRepository.findById(user.userId);
    const event: TicketCreatedEvent = {
      ticketId: result.id,
      ticketName: body.name,
      priority: body.priority,
      category: body.category,
      creatorName: creator ? `${creator.firstName} ${creator.lastName}` : user.email,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    };
    this.eventEmitter.emit('ticket.created', event);

    return result;
  }

  @Get()
  async list(
    @Param('slug') slug: string,
    @Query() filters: TicketFilterDto,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    await this.ensure(workspace.getId(), user.userId, PERMISSIONS.TICKET_VIEW);

    const query = new ListTicketsQuery(this.ticketRepository);
    return query.execute({
      workspaceId: workspace.getId(),
      filters: {
        status: filters.status,
        excludeStatus: filters.excludeStatus,
        priority: filters.priority,
        tagIds: filters.tagIds,
        assigneeId: filters.assigneeId,
        creatorId: filters.creatorId,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      },
      page: filters.page,
      limit: filters.limit,
    });
  }

  @Get(':id')
  async get(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    await this.ensure(workspace.getId(), user.userId, PERMISSIONS.TICKET_VIEW);

    const query = new GetTicketQuery(this.ticketRepository);
    return query.execute({ ticketId: id });
  }

  @Patch(':id')
  async update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: UpdateTicketRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Closed tickets require special permission
    if (ticket.status === 'closed') {
      await this.ensure(workspace.getId(), user.userId, PERMISSIONS.TICKET_EDIT_CLOSED);
    } else {
      // For open tickets: check specific field permissions or creator
      const isCreator = ticket.creatorId === user.userId;
      if (!isCreator) {
        await this.ensure(workspace.getId(), user.userId, PERMISSIONS.TICKET_EDIT_DESCRIPTION);
      }
    }

    // Name requires specific permission
    const ctx = await this.ensureAndGetContext(workspace.getId(), user.userId, PERMISSIONS.TICKET_VIEW);
    const canEditName = ctx && hasPermission(ctx.role, PERMISSIONS.TICKET_EDIT_NAME);

    const service = new UpdateTicket(this.ticketRepository);
    const command = new UpdateTicketCommand(service);
    return command.execute({
      ticketId: id,
      name: canEditName ? body.name : undefined,
      description: body.description,
      priority: body.priority,
      category: body.category,
      tagIds: body.tagIds,
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
    const ticket = await this.ticketRepository.findById(id);
    if (!ticket) throw new NotFoundException('Ticket not found');

    const permission = ticket.status === 'closed'
      ? PERMISSIONS.TICKET_CHANGE_STATUS_CLOSED
      : PERMISSIONS.TICKET_CHANGE_STATUS;

    await this.ensure(workspace.getId(), user.userId, permission);

    const oldStatus = ticket.status;

    const service = new ChangeTicketStatus(this.ticketRepository);
    const command = new ChangeTicketStatusCommand(service);
    const result = await command.execute({ ticketId: id, status: body.status });

    const event: StatusChangedEvent = {
      ticketId: id,
      ticketName: ticket.name,
      oldStatus,
      newStatus: body.status,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    };
    this.eventEmitter.emit('ticket.statusChanged', event);

    return result;
  }

  @Patch(':id/assign')
  async assign(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: AssignTicketRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    await this.ensure(workspace.getId(), user.userId, PERMISSIONS.TICKET_ASSIGN);

    const ticket = await this.ticketRepository.findById(id);
    if (!ticket) throw new NotFoundException('Ticket not found');

    const previousAssigneeId = ticket.assigneeId;

    const service = new AssignTicket(this.ticketRepository);
    const command = new AssignTicketCommand(service);
    const result = await command.execute({ ticketId: id, assigneeId: body.assigneeId });

    const event: TicketAssignedEvent = {
      ticketId: id,
      ticketName: ticket.name,
      newAssigneeId: body.assigneeId,
      previousAssigneeId,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    };
    this.eventEmitter.emit('ticket.assigned', event);

    return result;
  }

  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    await this.ensure(workspace.getId(), user.userId, PERMISSIONS.TICKET_DELETE);

    const service = new DeleteTicket(this.ticketRepository);
    const command = new DeleteTicketCommand(service);
    return command.execute({ ticketId: id });
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  private async ensure(workspaceId: string, userId: string, permission: Permission) {
    const service = new EnsureWorkspacePermission(this.memberRepository);
    return service.execute({ workspaceId, userId, permission });
  }

  private async ensureAndGetContext(workspaceId: string, userId: string, permission: Permission) {
    const service = new EnsureWorkspacePermission(this.memberRepository);
    return service.execute({ workspaceId, userId, permission });
  }
}
