import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CsatResponse } from '../../../domain/entities/csat-response';
import { CsatRating } from '../../../domain/enums/csat-rating.enum';
import { CsatResponseRepository } from '../../../domain/repositories/csat-response.repository';
import { CsatResponseModel } from '../models/csat-response.model';

@Injectable()
export class TypeOrmCsatResponseRepository implements CsatResponseRepository {
  constructor(
    @InjectRepository(CsatResponseModel)
    private readonly repository: Repository<CsatResponseModel>,
  ) {}

  async create(response: CsatResponse): Promise<void> {
    await this.repository.save(this.toModel(response));
  }

  async findByToken(token: string): Promise<CsatResponse | null> {
    const model = await this.repository.findOneBy({ token });
    return model ? this.toDomain(model) : null;
  }

  async findByTicketId(ticketId: string): Promise<CsatResponse | null> {
    const model = await this.repository.findOneBy({ ticketId });
    return model ? this.toDomain(model) : null;
  }

  async update(response: CsatResponse): Promise<void> {
    await this.repository.save(this.toModel(response));
  }

  private toDomain(model: CsatResponseModel): CsatResponse {
    return new CsatResponse({
      id: model.id,
      ticketId: model.ticketId,
      workspaceId: model.workspaceId,
      token: model.token,
      rating: model.rating as CsatRating | null,
      respondedAt: model.respondedAt,
    });
  }

  private toModel(response: CsatResponse): CsatResponseModel {
    const model = new CsatResponseModel();
    model.id = response.getId();
    model.ticketId = response.ticketId;
    model.workspaceId = response.workspaceId;
    model.token = response.token;
    model.rating = response.rating;
    model.respondedAt = response.respondedAt;
    return model;
  }
}
