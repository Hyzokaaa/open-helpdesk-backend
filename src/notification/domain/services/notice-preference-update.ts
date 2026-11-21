import { IdGenerator } from '../../../shared/domain/id-generator';
import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { NoticePreference } from '../entities/notice-preference';
import { NoticeCatalog, isMandatory } from '../notice-catalog';
import { NOTICE_CHANNELS, NoticeChannel } from '../notice-kind';
import { NoticePreferenceRepository } from '../repositories/notice-preference.repository';

interface Props {
  userId: string;
  kind: string;
  channel: NoticeChannel;
  enabled: boolean;
}

/** Turns one kind of notice on or off on one channel, for one person; a mandatory channel stays on. */
export class UpdateNoticePreference {
  constructor(
    private readonly catalog: NoticeCatalog,
    private readonly idGenerator: IdGenerator,
    private readonly repository: NoticePreferenceRepository,
  ) {}

  async execute(props: Props): Promise<void> {
    const kind = this.catalog.get(props.kind);
    if (!kind) throw new EntityNotFoundError('Notice kind not found');
    if (!NOTICE_CHANNELS.includes(props.channel)) throw new DomainValidationError('Unknown channel');
    if (isMandatory(kind, props.channel)) throw new DomainValidationError('This notice cannot be turned off on this channel');

    const existing = (await this.repository.findByUserIds([props.userId])).find((p) => p.kind === kind.key && p.channel === props.channel);
    await this.repository.save(new NoticePreference({
      id: existing?.getId() ?? this.idGenerator.create(),
      userId: props.userId,
      kind: kind.key,
      channel: props.channel,
      enabled: props.enabled,
    }));
  }
}
