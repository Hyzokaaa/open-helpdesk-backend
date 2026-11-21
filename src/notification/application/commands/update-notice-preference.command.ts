import { Command } from '../../../shared/domain/command';
import { NoticeChannel } from '../../domain/notice-kind';
import { UpdateNoticePreference } from '../../domain/services/notice-preference-update';

interface Props {
  userId: string;
  kind: string;
  channel: NoticeChannel;
  enabled: boolean;
}

export class UpdateNoticePreferenceCommand implements Command<Props, void> {
  constructor(private readonly updatePreference: UpdateNoticePreference) {}

  execute(props: Props): Promise<void> {
    return this.updatePreference.execute(props);
  }
}
