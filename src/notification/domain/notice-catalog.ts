import { NoticePreference } from './entities/notice-preference';
import { NoticeChannel, NoticeKind } from './notice-kind';

/** The kinds of notice there are: the core's, then an extension's. A key used twice is a mistake caught at start. */
export class NoticeCatalog {
  private readonly kinds = new Map<string, NoticeKind>();

  constructor(kinds: NoticeKind[]) {
    for (const kind of kinds) {
      if (this.kinds.has(kind.key)) throw new Error(`Notice kind "${kind.key}" is declared twice`);
      this.kinds.set(kind.key, kind);
    }
  }

  get(key: string): NoticeKind | null {
    return this.kinds.get(key) ?? null;
  }

  all(): NoticeKind[] {
    return [...this.kinds.values()];
  }
}

export function isMandatory(kind: NoticeKind, channel: NoticeChannel): boolean {
  return kind.mandatory?.includes(channel) ?? false;
}

/**
 * Whether a person has this kind on for this channel, as far as the kind goes: a mandatory channel
 * always; else what they chose (`chosen` holds their own choices), or the kind's default. Sending
 * also needs the channel itself on; the settings show this alone.
 */
export function isNoticeChannelOn(kind: NoticeKind, channel: NoticeChannel, chosen: NoticePreference[]): boolean {
  if (isMandatory(kind, channel)) return true;
  return chosen.find((p) => p.kind === kind.key && p.channel === channel)?.enabled ?? kind.defaults[channel];
}
