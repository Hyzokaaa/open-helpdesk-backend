import { Query } from '../../../shared/domain/query';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { CommentRepository } from '../../domain/repositories/comment.repository';
import { CommentEditRepository } from '../../domain/repositories/comment-edit.repository';
import { EnsureTicketAccess } from '../../../ticket/domain/services/ticket-ensure-access';

interface Props {
  commentId: string;
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CommentEditItem {
  id: string;
  content: string;
  editedById: string;
  createdAt: Date | null;
}

export class GetCommentHistoryQuery implements Query<Props, CommentEditItem[]> {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly commentEditRepository: CommentEditRepository,
  ) {}

  async execute(props: Props): Promise<CommentEditItem[]> {
    await this.ensureTicketAccess.execute({
      ticketId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      isSystemAdmin: props.isSystemAdmin,
    });

    const comment = await this.commentRepository.findById(props.commentId);
    if (!comment || comment.ticketId !== props.ticketId) {
      throw new EntityNotFoundError('Comment not found');
    }

    const edits = await this.commentEditRepository.findByCommentId(comment.getId());
    return edits.map((edit) => ({
      id: edit.getId(),
      content: edit.content,
      editedById: edit.editedById,
      createdAt: edit.createdAt,
    }));
  }
}
