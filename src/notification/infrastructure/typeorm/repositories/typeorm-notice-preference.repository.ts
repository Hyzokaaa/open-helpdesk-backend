import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NoticePreference } from '../../../domain/entities/notice-preference';
import { NoticePreferenceRepository } from '../../../domain/repositories/notice-preference.repository';
import { NoticeChannel } from '../../../domain/notice-kind';
import { NoticePreferenceModel } from '../models/notice-preference.model';

@Injectable()
export class TypeOrmNoticePreferenceRepository implements NoticePreferenceRepository {
  constructor(
    @InjectRepository(NoticePreferenceModel)
    private readonly repository: Repository<NoticePreferenceModel>,
  ) {}

  async findByUserIds(userIds: string[]): Promise<NoticePreference[]> {
    if (userIds.length === 0) return [];
    const models = await this.repository.findBy({ userId: In(userIds) });
    return models.map((m) => new NoticePreference({
      id: m.id,
      userId: m.userId,
      kind: m.kind,
      channel: m.channel as NoticeChannel,
      enabled: m.enabled,
    }));
  }

  async save(preference: NoticePreference): Promise<void> {
    await this.repository.save({
      id: preference.getId(),
      userId: preference.userId,
      kind: preference.kind,
      channel: preference.channel,
      enabled: preference.enabled,
    });
  }
}
