import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { StorageService } from '../../../../shared/domain/storage-service';
import { STORAGE_SERVICE } from '../../../../shared/shared.module';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { TypeOrmTicketRepository } from '../../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmTicketParticipantRepository } from '../../../../ticket/infrastructure/typeorm/repositories/typeorm-ticket-participant.repository';
import { EnsureTicketAccess } from '../../../../ticket/domain/services/ticket-ensure-access';
import { TypeOrmCommentRepository } from '../../../../comment/infrastructure/typeorm/repositories/typeorm-comment.repository';
import { CreateAttachment } from '../../../domain/services/attachment-create';
import { DeleteAttachment } from '../../../domain/services/attachment-delete';
import { StageAttachment } from '../../../domain/services/attachment-stage';
import { EnsureAttachmentAccess } from '../../../domain/services/attachment-ensure-access';
import { UploadAttachmentCommand } from '../../../application/commands/upload-attachment.command';
import { DeleteAttachmentCommand } from '../../../application/commands/delete-attachment.command';
import { StageUploadCommand } from '../../../application/commands/stage-upload.command';
import { GetAttachmentQuery } from '../../../application/queries/get-attachment.query';
import { ListTicketAttachmentsQuery } from '../../../application/queries/list-ticket-attachments.query';
import { TypeOrmAttachmentRepository } from '../../typeorm/repositories/typeorm-attachment.repository';

@Controller()
export class AttachmentController {
  constructor(
    @Inject() private readonly attachmentRepository: TypeOrmAttachmentRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly participantRepository: TypeOrmTicketParticipantRepository,
    @Inject() private readonly commentRepository: TypeOrmCommentRepository,
  ) {}

  @Post('uploads')
  @UseInterceptors(FileInterceptor('file'))
  async stageUpload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new StageAttachment(this.idGenerator, this.attachmentRepository, this.storage);
    const command = new StageUploadCommand(service);
    const result = await command.execute({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById: user.userId,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.ATTACHMENT_UPLOADED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'attachment',
      entityId: result.token,
      userId: user?.userId ?? null,
      workspaceId: null,
      metadata: { originalName: file.originalname, mimeType: file.mimetype, size: file.size },
    });

    return result;
  }

  @Post('workspaces/:slug/tickets/:ticketId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async uploadToTicket(
    @Param('slug') slug: string,
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    return this.createUploadCommand().execute({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ticketId,
      commentId: null,
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get('workspaces/:slug/tickets/:ticketId/attachments')
  async listByTicket(
    @Param('slug') slug: string,
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new ListTicketAttachmentsQuery(
      this.attachmentRepository,
      this.storage,
      this.createEnsureTicketAccess(),
      ensurePermission,
    );
    return query.execute({
      ticketId,
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Post('workspaces/:slug/tickets/:ticketId/comments/:commentId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async uploadToComment(
    @Param('slug') slug: string,
    @Param('ticketId') ticketId: string,
    @Param('commentId') commentId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    return this.createUploadCommand().execute({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ticketId,
      commentId,
      workspaceId: workspace.getId(),
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get('attachments/:id')
  get(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const query = new GetAttachmentQuery(this.createEnsureAttachmentAccess(), this.storage);
    return query.execute({ attachmentId: id, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Delete('attachments/:id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new DeleteAttachment(this.attachmentRepository, this.storage);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    const command = new DeleteAttachmentCommand(service, this.createEnsureAttachmentAccess(), auditLog);
    return command.execute({ attachmentId: id, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  private createUploadCommand(): UploadAttachmentCommand {
    const service = new CreateAttachment(this.idGenerator, this.attachmentRepository, this.storage);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    return new UploadAttachmentCommand(
      service,
      this.createEnsureTicketAccess(),
      ensurePermission,
      this.commentRepository,
      auditLog,
    );
  }

  private createEnsureAttachmentAccess(): EnsureAttachmentAccess {
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    return new EnsureAttachmentAccess(
      this.attachmentRepository,
      this.ticketRepository,
      this.commentRepository,
      this.createEnsureTicketAccess(),
      ensurePermission,
    );
  }

  private createEnsureTicketAccess(): EnsureTicketAccess {
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    return new EnsureTicketAccess(this.ticketRepository, ensurePermission, this.participantRepository);
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
