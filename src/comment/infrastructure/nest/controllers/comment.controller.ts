import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../../../../shared/nest/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { PaginationDto } from '../../../../shared/nest/dto/pagination.dto';
import { CreateComment } from '../../../domain/services/comment-create';
import { CreateCommentCommand } from '../../../application/commands/create-comment.command';
import { ListTicketCommentsQuery } from '../../../application/queries/list-ticket-comments.query';
import { TypeOrmCommentRepository } from '../../typeorm/repositories/typeorm-comment.repository';
import { TypeOrmTicketRepository } from '../../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { CreateCommentRequest } from '../dto/create-comment.request';
import { NewCommentEvent } from '../../../../email/domain/events';

@Controller('workspaces/:slug/tickets/:ticketId/comments')
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(
    @Inject() private readonly commentRepository: TypeOrmCommentRepository,
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Param('ticketId') ticketId: string,
    @Body() body: CreateCommentRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new CreateComment(this.idGenerator, this.commentRepository);
    const command = new CreateCommentCommand(service);
    const result = await command.execute({
      content: body.content,
      ticketId,
      authorId: user.userId,
    });

    const ticket = await this.ticketRepository.findById(ticketId);
    const workspace = await this.workspaceRepository.findBySlug(slug);
    const author = await this.userRepository.findById(user.userId);

    if (ticket && workspace && author) {
      const mentionedUserIds = this.extractMentions(body.content);

      const event: NewCommentEvent = {
        ticketId,
        ticketName: ticket.name,
        authorId: user.userId,
        authorName: `${author.firstName} ${author.lastName}`,
        commentContent: body.content,
        assigneeId: ticket.assigneeId,
        mentionedUserIds,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
      };
      this.eventEmitter.emit('comment.created', event);
    }

    return result;
  }

  @Get()
  list(
    @Param('ticketId') ticketId: string,
    @Query() pagination: PaginationDto,
  ) {
    const query = new ListTicketCommentsQuery(this.commentRepository);
    return query.execute({
      ticketId,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  private extractMentions(content: string): string[] {
    const regex = /@\[[^\]]+\]\(([^)]+)\)/g;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      ids.push(match[1]);
    }
    return ids;
  }
}
