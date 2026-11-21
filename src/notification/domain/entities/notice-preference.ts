import { Id } from '../../../shared/domain/id';
import { NoticeChannel } from '../notice-kind';

interface Props {
  id: string;
  userId: string;
  /** A NoticeKind's key; kept when the kind is gone, and then ignored. */
  kind: string;
  channel: NoticeChannel;
  enabled: boolean;
}

/** What one person chose for one kind of notice on one channel; without it the kind's default applies. */
export class NoticePreference {
  readonly id: Id;
  userId: string;
  kind: string;
  channel: NoticeChannel;
  enabled: boolean;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.userId = props.userId;
    this.kind = props.kind;
    this.channel = props.channel;
    this.enabled = props.enabled;
  }

  getId(): string {
    return this.id.get();
  }
}
