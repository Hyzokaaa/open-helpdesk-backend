import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../../../shared/domain/paginated-result';
import { Comment } from '../../../domain/entities/comment';
import { CommentRepository } from '../../../domain/repositories/comment.repository';
import { CommentModel } from '../models/comment.model';

@Injectable()
export class TypeOrmCommentRepository implements CommentRepository {
  constructor(
    @InjectRepository(CommentModel)
    private readonly repository: Repository<CommentModel>,
  ) {}

  async create(comment: Comment): Promise<void> {
    const model = this.toModel(comment);
    await this.repository.save(model);
  }

  async findById(id: string): Promise<Comment | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByTicketId(
    ticketId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<Comment>> {
    const [models, total] = await this.repository.findAndCount({
      where: { ticketId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: models.map((m) => this.toDomain(m)),
      total,
      page,
      limit,
    };
  }

  private toDomain(model: CommentModel): Comment {
    return new Comment({
      id: model.id,
      content: model.content,
      ticketId: model.ticketId,
      authorId: model.authorId,
    });
  }

  private toModel(comment: Comment): CommentModel {
    const model = new CommentModel();
    model.id = comment.getId();
    model.content = comment.content;
    model.ticketId = comment.ticketId;
    model.authorId = comment.authorId;
    return model;
  }
}
