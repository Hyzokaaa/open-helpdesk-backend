import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { TransferRequest } from '../../../domain/entities/transfer-request';
import { TransferRequestStatus } from '../../../domain/enums/transfer-request-status.enum';
import { TransferRequestRepository } from '../../../domain/repositories/transfer-request.repository';
import { TransferRequestModel } from '../models/transfer-request.model';

@Injectable()
export class TypeOrmTransferRequestRepository implements TransferRequestRepository {
  constructor(
    @InjectRepository(TransferRequestModel)
    private readonly repository: Repository<TransferRequestModel>,
  ) {}

  async create(request: TransferRequest): Promise<void> {
    await this.repository.save({
      id: request.getId(),
      ticketId: request.ticketId,
      requesterId: request.requesterId,
      targetUserId: request.targetUserId,
      status: request.status,
      expiresAt: request.expiresAt,
      resolvedAt: request.resolvedAt,
    });
  }

  async findById(id: string): Promise<TransferRequest | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? this.toDomain(row) : null;
  }

  async findPendingByTicketId(ticketId: string): Promise<TransferRequest | null> {
    const row = await this.repository.findOneBy({
      ticketId,
      status: TransferRequestStatus.PENDING,
    });
    return row ? this.toDomain(row) : null;
  }

  async update(request: TransferRequest): Promise<void> {
    await this.repository.update(request.getId(), {
      status: request.status,
      resolvedAt: request.resolvedAt,
    });
  }

  async expirePendingBefore(date: Date): Promise<TransferRequest[]> {
    const rows = await this.repository.find({
      where: {
        status: TransferRequestStatus.PENDING,
        expiresAt: LessThan(date),
      },
    });

    if (rows.length > 0) {
      await this.repository.update(
        rows.map((r) => r.id),
        { status: TransferRequestStatus.EXPIRED, resolvedAt: new Date() },
      );
    }

    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: TransferRequestModel): TransferRequest {
    return new TransferRequest({
      id: row.id,
      ticketId: row.ticketId,
      requesterId: row.requesterId,
      targetUserId: row.targetUserId,
      status: row.status as TransferRequestStatus,
      expiresAt: row.expiresAt,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
    });
  }
}
