import { Query } from '../../../shared/domain/query';
import { FindNoticePreferences, NoticeSetting } from '../../domain/services/notice-preferences-find';

interface Props {
  userId: string;
}

export class GetNoticePreferencesQuery implements Query<Props, NoticeSetting[]> {
  constructor(private readonly findPreferences: FindNoticePreferences) {}

  execute(props: Props): Promise<NoticeSetting[]> {
    return this.findPreferences.execute(props.userId);
  }
}
