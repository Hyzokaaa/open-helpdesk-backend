import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { UserSession } from '../../../domain/entities/user-session';
import { SessionRotation, UserSessionRepository } from '../../../domain/repositories/user-session.repository';
import { UserSessionModel } from '../models/user-session.model';

@Injectable()
export class TypeOrmUserSessionRepository implements UserSessionRepository {
  constructor(
    @InjectRepository(UserSessionModel)
    private readonly repository: Repository<UserSessionModel>,
  ) {}

  async create(session: UserSession): Promise<void> {
    await this.repository.save(this.toModel(session));
  }

  async findByTokenHash(tokenHash: string): Promise<UserSession | null> {
    const model = await this.repository.findOneBy({ tokenHash });
    return model ? this.toDomain(model) : null;
  }

  async findByPreviousTokenHash(tokenHash: string): Promise<UserSession | null> {
    const model = await this.repository.findOneBy({ previousTokenHash: tokenHash });
    return model ? this.toDomain(model) : null;
  }

  async update(session: UserSession): Promise<void> {
    await this.repository.save(this.toModel(session));
  }

  async rotate(sessionId: string, expectedTokenHash: string, rotation: SessionRotation): Promise<boolean> {
    const result = await this.repository.update(
      { id: sessionId, tokenHash: expectedTokenHash, revokedAt: IsNull() },
      {
        previousTokenHash: expectedTokenHash,
        tokenHash: rotation.tokenHash,
        rotatedAt: rotation.rotatedAt,
        expiresAt: rotation.expiresAt,
      },
    );
    return result.affected === 1;
  }

  async revokeAllForUser(userId: string, revokedAt: Date, exceptId?: string): Promise<void> {
    await this.repository.update(
      { userId, revokedAt: IsNull(), ...(exceptId && { id: Not(exceptId) }) },
      { revokedAt },
    );
  }

  async deleteStale(before: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('"expiresAt" < :before OR "revokedAt" < :before', { before })
      .execute();
    return result.affected ?? 0;
  }

  private toDomain(model: UserSessionModel): UserSession {
    return new UserSession({
      id: model.id,
      userId: model.userId,
      tokenHash: model.tokenHash,
      previousTokenHash: model.previousTokenHash,
      rotatedAt: model.rotatedAt,
      rememberMe: model.rememberMe,
      expiresAt: model.expiresAt,
      createdAt: model.createdAt,
      revokedAt: model.revokedAt,
    });
  }

  private toModel(session: UserSession): UserSessionModel {
    const model = new UserSessionModel();
    model.id = session.getId();
    model.userId = session.userId;
    model.tokenHash = session.tokenHash;
    model.previousTokenHash = session.previousTokenHash;
    model.rotatedAt = session.rotatedAt;
    model.rememberMe = session.rememberMe;
    model.expiresAt = session.expiresAt;
    model.revokedAt = session.revokedAt;
    if (session.createdAt) model.createdAt = session.createdAt;
    return model;
  }
}
