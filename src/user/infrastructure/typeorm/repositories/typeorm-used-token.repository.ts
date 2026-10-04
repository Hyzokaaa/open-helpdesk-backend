import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { UsedTokenRepository } from '../../../domain/repositories/used-token.repository';
import { UsedTokenModel } from '../models/used-token.model';

@Injectable()
export class TypeOrmUsedTokenRepository implements UsedTokenRepository {
  constructor(
    @InjectRepository(UsedTokenModel)
    private readonly repository: Repository<UsedTokenModel>,
  ) {}

  async markUsed(tokenId: string, expiresAt: Date): Promise<boolean> {
    // ON CONFLICT DO NOTHING returns no row when the id is already there: the primary key decides
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values({ id: tokenId, expiresAt })
      .orIgnore()
      .returning('id')
      .execute();
    return Array.isArray(result.raw) && result.raw.length === 1;
  }

  async deleteExpired(before: Date): Promise<number> {
    const result = await this.repository.delete({ expiresAt: LessThan(before) });
    return result.affected ?? 0;
  }
}
