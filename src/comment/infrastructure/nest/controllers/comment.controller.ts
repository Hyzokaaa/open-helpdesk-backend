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
import { JwtAuthGuard } from '../../../../shared/nest/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { PaginationDto } from '../../../../shared/nest/dto/pagination.dto';
import { CreateComment } from '../../../domain/services/comment-create';
import { CreateCommentCommand } from '../../../application/commands/create-comment.command';
import { ListTicketCommentsQuery } from '../../../application/queries/list-ticket-comments.query';
import { TypeOrmCommentRepository } from '../../typeorm/repositories/typeorm-comment.repository';
import { CreateCommentRequest } from '../dto/create-comment.request';

@Controller('workspaces/:slug/tickets/:ticketId/comments')
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(
    @Inject() private readonly commentRepository: TypeOrmCommentRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  @Post()
  create(
    @Param('ticketId') ticketId: string,
    @Body() body: CreateCommentRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new CreateComment(this.idGenerator, this.commentRepository);
    const command = new CreateCommentCommand(service);
    return command.execute({
      content: body.content,
      ticketId,
      authorId: user.userId,
    });
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
}
