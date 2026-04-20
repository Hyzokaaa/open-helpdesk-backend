import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NotificationPreference } from '../../../domain/entities/notification-preference';
import { NotificationPreferenceRepository } from '../../../domain/repositories/notification-preference.repository';
import { NotificationPreferenceModel } from '../models/notification-preference.model';

@Injectable()
export class TypeOrmNotificationPreferenceRepository
  implements NotificationPreferenceRepository
{
  constructor(
    @InjectRepository(NotificationPreferenceModel)
    private readonly repository: Repository<NotificationPreferenceModel>,
  ) {}

  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    const model = await this.repository.findOneBy({ userId });
    return model ? this.toDomain(model) : null;
  }

  async findByUserIds(
    userIds: string[],
  ): Promise<Map<string, NotificationPreference>> {
    if (userIds.length === 0) return new Map();
    const models = await this.repository.findBy({ userId: In(userIds) });
    const map = new Map<string, NotificationPreference>();
    for (const m of models) {
      map.set(m.userId, this.toDomain(m));
    }
    return map;
  }

  async upsert(preference: NotificationPreference): Promise<void> {
    const model = this.toModel(preference);
    await this.repository.save(model);
  }

  private toDomain(model: NotificationPreferenceModel): NotificationPreference {
    return new NotificationPreference({
      id: model.id,
      userId: model.userId,
      emailEnabled: model.emailEnabled,
      inAppEnabled: model.inAppEnabled,
      emailTicketCreated: model.emailTicketCreated,
      emailTicketAssigned: model.emailTicketAssigned,
      emailStatusChanged: model.emailStatusChanged,
      emailCommentCreated: model.emailCommentCreated,
      inAppTicketCreated: model.inAppTicketCreated,
      inAppTicketAssigned: model.inAppTicketAssigned,
      inAppStatusChanged: model.inAppStatusChanged,
      inAppCommentCreated: model.inAppCommentCreated,
      bellUnreadOnly: model.bellUnreadOnly,
    });
  }

  private toModel(
    pref: NotificationPreference,
  ): NotificationPreferenceModel {
    const model = new NotificationPreferenceModel();
    model.id = pref.getId();
    model.userId = pref.userId;
    model.emailEnabled = pref.emailEnabled;
    model.inAppEnabled = pref.inAppEnabled;
    model.emailTicketCreated = pref.emailTicketCreated;
    model.emailTicketAssigned = pref.emailTicketAssigned;
    model.emailStatusChanged = pref.emailStatusChanged;
    model.emailCommentCreated = pref.emailCommentCreated;
    model.inAppTicketCreated = pref.inAppTicketCreated;
    model.inAppTicketAssigned = pref.inAppTicketAssigned;
    model.inAppStatusChanged = pref.inAppStatusChanged;
    model.inAppCommentCreated = pref.inAppCommentCreated;
    model.bellUnreadOnly = pref.bellUnreadOnly;
    return model;
  }
}
