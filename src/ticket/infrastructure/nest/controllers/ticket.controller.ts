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
  UseGuards,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../../../../shared/nest/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { CreateTicket } from '../../../domain/services/ticket-create';
import { UpdateTicket } from '../../../domain/services/ticket-update';
import { ChangeTicketStatus } from '../../../domain/services/ticket-change-status';
import { AssignTicket } from '../../../domain/services/ticket-assign';
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
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { CreateTicketRequest } from '../dto/create-ticket.request';
import { UpdateTicketRequest } from '../dto/update-ticket.request';
import { ChangeTicketStatusRequest } from '../dto/change-ticket-status.request';
import { AssignTicketRequest } from '../dto/assign-ticket.request';
import { TicketFilterDto } from '../dto/ticket-filter.dto';

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
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateTicket(this.idGenerator, this.ticketRepository);
    const command = new CreateTicketCommand(service, ensurePermission, this.userRepository, this.eventEmitter);
    return command.execute({
      name: body.name,
      description: body.description,
      priority: body.priority,
      category: body.category,
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      userId: user.userId,
      userEmail: user.email,
      tagIds: body.tagIds,
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
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new GetTicketQuery(this.ticketRepository, ensurePermission);
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
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new UpdateTicket(this.ticketRepository);
    const command = new UpdateTicketCommand(service, this.ticketRepository, ensurePermission);
    return command.execute({
      ticketId: id,
      workspaceId: workspace.getId(),
      userId: user.userId,
      name: body.name,
      description: body.description,
      priority: body.priority,
      category: body.category,
      tagIds: body.tagIds,
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
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new ChangeTicketStatus(this.ticketRepository);
    const command = new ChangeTicketStatusCommand(service, this.ticketRepository, ensurePermission, this.eventEmitter);
    return command.execute({
      ticketId: id,
      status: body.status,
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
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new AssignTicket(this.ticketRepository);
    const command = new AssignTicketCommand(service, this.ticketRepository, ensurePermission, this.eventEmitter);
    return command.execute({
      ticketId: id,
      assigneeId: body.assigneeId,
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
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new DeleteTicket(this.ticketRepository);
    const command = new DeleteTicketCommand(service, ensurePermission);
    return command.execute({ ticketId: id, workspaceId: workspace.getId(), userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
