import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from '../../../domain/entities/attachment';
import { AttachmentRepository } from '../../../domain/repositories/attachment.repository';
import { AttachmentModel } from '../models/attachment.model';

@Injectable()
export class TypeOrmAttachmentRepository implements AttachmentRepository {
  constructor(
    @InjectRepository(AttachmentModel)
    private readonly repository: Repository<AttachmentModel>,
  ) {}

  async create(attachment: Attachment): Promise<void> {
    const model = this.toModel(attachment);
    await this.repository.save(model);
  }

  async findById(id: string): Promise<Attachment | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByTicketId(ticketId: string): Promise<Attachment[]> {
    const models = await this.repository.findBy({ ticketId });
    return models.map((m) => this.toDomain(m));
  }

  async findByCommentId(commentId: string): Promise<Attachment[]> {
    const models = await this.repository.findBy({ commentId });
    return models.map((m) => this.toDomain(m));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toDomain(model: AttachmentModel): Attachment {
    return new Attachment({
      id: model.id,
      fileName: model.fileName,
      originalName: model.originalName,
      mimeType: model.mimeType,
      size: model.size,
      s3Key: model.s3Key,
      ticketId: model.ticketId,
      commentId: model.commentId,
    });
  }

  private toModel(attachment: Attachment): AttachmentModel {
    const model = new AttachmentModel();
    model.id = attachment.getId();
    model.fileName = attachment.fileName;
    model.originalName = attachment.originalName;
    model.mimeType = attachment.mimeType;
    model.size = attachment.size;
    model.s3Key = attachment.s3Key;
    model.ticketId = attachment.ticketId;
    model.commentId = attachment.commentId;
    return model;
  }
}
