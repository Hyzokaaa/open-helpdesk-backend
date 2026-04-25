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
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { S3StorageService } from '../../../../shared/infrastructure/s3-storage.service';
import { CreateAttachment } from '../../../domain/services/attachment-create';
import { DeleteAttachment } from '../../../domain/services/attachment-delete';
import { UploadAttachmentCommand } from '../../../application/commands/upload-attachment.command';
import { DeleteAttachmentCommand } from '../../../application/commands/delete-attachment.command';
import { GetAttachmentQuery } from '../../../application/queries/get-attachment.query';
import { ListTicketAttachmentsQuery } from '../../../application/queries/list-ticket-attachments.query';
import { TypeOrmAttachmentRepository } from '../../typeorm/repositories/typeorm-attachment.repository';

@Controller()
export class AttachmentController {
  constructor(
    @Inject() private readonly attachmentRepository: TypeOrmAttachmentRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly s3Storage: S3StorageService,
  ) {}

  @Post('workspaces/:slug/tickets/:ticketId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  uploadToTicket(
    @Param('ticketId') ticketId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const service = new CreateAttachment(this.idGenerator, this.attachmentRepository, this.s3Storage);
    const command = new UploadAttachmentCommand(service);
    return command.execute({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ticketId,
      commentId: null,
    });
  }

  @Get('workspaces/:slug/tickets/:ticketId/attachments')
  listByTicket(@Param('ticketId') ticketId: string) {
    const query = new ListTicketAttachmentsQuery(this.attachmentRepository, this.s3Storage);
    return query.execute({ ticketId });
  }

  @Post('workspaces/:slug/tickets/:ticketId/comments/:commentId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  uploadToComment(
    @Param('commentId') commentId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const service = new CreateAttachment(this.idGenerator, this.attachmentRepository, this.s3Storage);
    const command = new UploadAttachmentCommand(service);
    return command.execute({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ticketId: null,
      commentId,
    });
  }

  @Get('attachments/:id')
  get(@Param('id') id: string) {
    const query = new GetAttachmentQuery(this.attachmentRepository, this.s3Storage);
    return query.execute({ attachmentId: id });
  }

  @Delete('attachments/:id')
  remove(@Param('id') id: string) {
    const service = new DeleteAttachment(this.attachmentRepository, this.s3Storage);
    const command = new DeleteAttachmentCommand(service);
    return command.execute({ attachmentId: id });
  }
}
