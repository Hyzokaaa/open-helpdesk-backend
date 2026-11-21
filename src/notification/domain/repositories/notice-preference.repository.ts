import { NoticePreference } from '../entities/notice-preference';

export interface NoticePreferenceRepository {
  findByUserIds(userIds: string[]): Promise<NoticePreference[]>;
  /** Creates it, or changes the one with the same id. */
  save(preference: NoticePreference): Promise<void>;
}
