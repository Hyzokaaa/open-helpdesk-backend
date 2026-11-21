import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConflictError } from '../../../../shared/domain/errors';
import { isUniqueViolation } from '../../../../shared/infrastructure/typeorm/unique-violation';
import { MatrixIdentity } from '../../../domain/entities/matrix-identity';
import { MatrixIdentityRepository } from '../../../domain/repositories/matrix-identity.repository';
import { MatrixIdentityModel } from '../models/matrix-identity.model';

@Injectable()
export class TypeOrmMatrixIdentityRepository implements MatrixIdentityRepository {
  constructor(
    @InjectRepository(MatrixIdentityModel)
    private readonly repository: Repository<MatrixIdentityModel>,
  ) {}

  async findByUserId(userId: string): Promise<MatrixIdentity | null> {
    const model = await this.repository.findOneBy({ userId });
    return model ? this.toDomain(model) : null;
  }

  async findByUserIds(userIds: string[]): Promise<MatrixIdentity[]> {
    if (userIds.length === 0) return [];
    return (await this.repository.findBy({ userId: In(userIds) })).map((model) => this.toDomain(model));
  }

  async save(identity: MatrixIdentity): Promise<void> {
    try {
      await this.repository.save({
        id: identity.getId(),
        userId: identity.userId,
        matrixUserId: identity.matrixUserId,
        verifiedAt: identity.verifiedAt,
        codeHash: identity.codeHash,
        codeExpiresAt: identity.codeExpiresAt,
        codeAttempts: identity.codeAttempts,
        codeSentAt: identity.codeSentAt,
        codeSends: identity.codeSends,
        sendWindowStartedAt: identity.sendWindowStartedAt,
        pendingMatrixUserId: identity.pendingMatrixUserId,
        pendingBotId: identity.pendingBotId,
        pendingRoomId: identity.pendingRoomId,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('Another request is connecting your Matrix account: try again', 'matrix-busy');
      throw error;
    }
  }

  async claimCodeAttempt(id: string, max: number): Promise<number | null> {
    const result = await this.repository
      .createQueryBuilder()
      .update()
      .set({ codeAttempts: () => '"codeAttempts" + 1' })
      .where('id = :id AND "codeAttempts" < :max', { id, max })
      .returning(['codeAttempts'])
      .execute();
    const row = (result.raw as Array<{ codeAttempts: number }>)[0];
    return row ? row.codeAttempts : null;
  }

  private toDomain(model: MatrixIdentityModel): MatrixIdentity {
    return new MatrixIdentity({
      id: model.id,
      userId: model.userId,
      matrixUserId: model.matrixUserId,
      verifiedAt: model.verifiedAt,
      codeHash: model.codeHash,
      codeExpiresAt: model.codeExpiresAt,
      codeAttempts: model.codeAttempts,
      codeSentAt: model.codeSentAt,
      codeSends: model.codeSends,
      sendWindowStartedAt: model.sendWindowStartedAt,
      pendingMatrixUserId: model.pendingMatrixUserId,
      pendingBotId: model.pendingBotId,
      pendingRoomId: model.pendingRoomId,
    });
  }
}
