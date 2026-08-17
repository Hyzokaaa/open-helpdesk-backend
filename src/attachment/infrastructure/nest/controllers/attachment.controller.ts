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
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { CreateAttachment } from '../../../domain/services/attachment-create';
import { DeleteAttachment } from '../../../domain/services/attachment-delete';
import { StageAttachment } from '../../../domain/services/attachment-stage';
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
  uploadToTicket(
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new CreateAttachment(this.idGenerator, this.attachmentRepository, this.storage);
    const command = new UploadAttachmentCommand(service);
    return command.execute({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ticketId,
      commentId: null,
      uploadedById: user.userId,
    });
  }

  @Get('workspaces/:slug/tickets/:ticketId/attachments')
  listByTicket(@Param('ticketId') ticketId: string) {
    const query = new ListTicketAttachmentsQuery(this.attachmentRepository, this.storage);
    return query.execute({ ticketId });
  }

  @Post('workspaces/:slug/tickets/:ticketId/comments/:commentId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  uploadToComment(
    @Param('commentId') commentId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new CreateAttachment(this.idGenerator, this.attachmentRepository, this.storage);
    const command = new UploadAttachmentCommand(service);
    return command.execute({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ticketId: null,
      commentId,
      uploadedById: user.userId,
    });
  }

  @Get('attachments/:id')
  get(@Param('id') id: string) {
    const query = new GetAttachmentQuery(this.attachmentRepository, this.storage);
    return query.execute({ attachmentId: id });
  }

  @Delete('attachments/:id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const attachment = await this.attachmentRepository.findById(id);
    if (attachment && attachment.uploadedById && attachment.uploadedById !== user.userId && !user.isSystemAdmin) {
      throw new AccessDeniedError('You can only delete your own attachments');
    }

    const service = new DeleteAttachment(this.attachmentRepository, this.storage);
    const command = new DeleteAttachmentCommand(service);
    const result = await command.execute({ attachmentId: id });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.ATTACHMENT_DELETED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'attachment',
      entityId: id,
      userId: user.userId,
      workspaceId: null,
      metadata: { originalName: attachment?.originalName ?? null },
    });

    return result;
  }
}
