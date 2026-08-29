import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentEdit } from '../../../domain/entities/comment-edit';
import { CommentEditRepository } from '../../../domain/repositories/comment-edit.repository';
import { CommentEditModel } from '../models/comment-edit.model';

@Injectable()
export class TypeOrmCommentEditRepository implements CommentEditRepository {
  constructor(
    @InjectRepository(CommentEditModel)
    private readonly repository: Repository<CommentEditModel>,
  ) {}

  async create(edit: CommentEdit): Promise<void> {
    const model = new CommentEditModel();
    model.id = edit.getId();
    model.content = edit.content;
    model.commentId = edit.commentId;
    model.editedById = edit.editedById;
    await this.repository.save(model);
  }

  async findByCommentId(commentId: string): Promise<CommentEdit[]> {
    const models = await this.repository.find({
      where: { commentId },
      order: { createdAt: 'DESC' },
      relations: ['editedBy'],
    });

    return models.map(
      (m) =>
        new CommentEdit({
          id: m.id,
          commentId: m.commentId,
          content: m.content,
          editedById: m.editedById,
          createdAt: m.createdAt,
        }),
    );
  }
}
