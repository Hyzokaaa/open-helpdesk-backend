import { EventPublisher } from '../../../shared/domain/event-publisher';
import { Command } from '../../../shared/domain/command';
import { CreateComment } from '../../domain/services/comment-create';
import { ExtractMentions } from '../../domain/services/comment-extract-mentions';
import { TicketRepository } from '../../../ticket/domain/repositories/ticket.repository';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { NewCommentEvent } from '../../../email/domain/events';

interface Props {
  content: string;
  ticketId: string;
  authorId: string;
  workspaceSlug: string;
}

export interface CreateCommentResponse {
  id: string;
  content: string;
  ticketId: string;
  authorId: string;
}

export class CreateCommentCommand implements Command<Props, CreateCommentResponse> {
  constructor(
    private readonly createComment: CreateComment,
    private readonly ticketRepository: TicketRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(props: Props): Promise<CreateCommentResponse> {
    const comment = await this.createComment.execute({
      content: props.content,
      ticketId: props.ticketId,
      authorId: props.authorId,
    });

    const ticket = await this.ticketRepository.findById(props.ticketId);
    const workspace = await this.workspaceRepository.findBySlug(props.workspaceSlug);
    const author = await this.userRepository.findById(props.authorId);

    if (ticket && workspace && author) {
      const extractMentions = new ExtractMentions();
      const mentionedUserIds = extractMentions.execute(props.content);

      const event: NewCommentEvent = {
        ticketId: props.ticketId,
        ticketName: ticket.name,
        authorId: props.authorId,
        authorName: `${author.firstName} ${author.lastName}`,
        commentContent: props.content,
        assigneeId: ticket.assigneeId,
        mentionedUserIds,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
      };
      this.eventPublisher.emit('comment.created', event);
    }

    return {
      id: comment.getId(),
      content: comment.content,
      ticketId: comment.ticketId,
      authorId: comment.authorId,
    };
  }
}
