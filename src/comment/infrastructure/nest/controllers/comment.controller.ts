import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { NestEventPublisher } from "../../../../shared/infrastructure/nest-event-publisher";
import { CurrentUser } from "../../../../shared/nest/decorators/current-user.decorator";
import { AuthUser } from "../../../../shared/nest/strategies/jwt.strategy";
import { UlidGenerator } from "../../../../shared/infrastructure/ulid-generator";
import { PaginationDto } from "../../../../shared/nest/dto/pagination.dto";
import { CreateComment } from "../../../domain/services/comment-create";
import { CreateCommentCommand } from "../../../application/commands/create-comment.command";
import { ListTicketCommentsQuery } from "../../../application/queries/list-ticket-comments.query";
import { TypeOrmCommentRepository } from "../../typeorm/repositories/typeorm-comment.repository";
import { TypeOrmTicketRepository } from "../../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository";
import { TypeOrmWorkspaceRepository } from "../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository";
import { TypeOrmUserRepository } from "../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository";
import { TypeOrmAuditLogRepository } from "../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository";
import { CreateAuditLogEntry } from "../../../../audit-log/domain/services/audit-log-create";
import { CreateCommentRequest } from "../dto/create-comment.request";

@Controller("workspaces/:slug/tickets/:ticketId/comments")
export class CommentController {
  constructor(
    @Inject() private readonly commentRepository: TypeOrmCommentRepository,
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly eventPublisher: NestEventPublisher,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Post()
  async create(
    @Param("slug") slug: string,
    @Param("ticketId") ticketId: string,
    @Body() body: CreateCommentRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new CreateComment(this.idGenerator, this.commentRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new CreateCommentCommand(
      service,
      this.ticketRepository,
      this.workspaceRepository,
      this.userRepository,
      this.eventPublisher,
      auditLog,
    );
    return command.execute({
      content: body.content,
      ticketId,
      authorId: user.userId,
      workspaceSlug: slug,
    });
  }

  @Get()
  list(
    @Param("ticketId") ticketId: string,
    @Query() pagination: PaginationDto,
  ) {
    const query = new ListTicketCommentsQuery(this.commentRepository);
    return query.execute({
      ticketId,
      page: pagination.page,
      limit: pagination.limit,
    });
  }
}
