import { Command } from '../../../shared/domain/command';
import { EditComment } from '../../domain/services/comment-edit';
import { EnsureTicketAccess } from '../../../ticket/domain/services/ticket-ensure-access';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  commentId: string;
  content: string;
  userId: string;
  isSystemAdmin: boolean;
  workspaceId: string;
  ticketId: string;
}

export interface EditCommentResponse {
  id: string;
  content: string;
  editedAt: Date | null;
}

export class EditCommentCommand implements Command<Props, EditCommentResponse> {
  constructor(
    private readonly editComment: EditComment,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<EditCommentResponse> {
    await this.ensureTicketAccess.ensureCanContribute({
      ticketId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      isSystemAdmin: props.isSystemAdmin,
    });

    const comment = await this.editComment.execute({
      commentId: props.commentId,
      ticketId: props.ticketId,
      content: props.content,
      userId: props.userId,
    });

    await this.createAuditLog.execute({
      action: AuditAction.COMMENT_EDITED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { commentId: comment.getId() },
    });

    return {
      id: comment.getId(),
      content: comment.content,
      editedAt: comment.editedAt,
    };
  }
}
