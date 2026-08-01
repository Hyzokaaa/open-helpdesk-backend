import { Id } from '../../../shared/domain/id';
import { MailboxType } from '../enums/mailbox-type.enum';

interface Props {
  id: string;
  address: string;
  workspaceId: string;
  isActive: boolean;
  type?: MailboxType;
  imapHost?: string | null;
  imapPort?: number | null;
  imapUser?: string | null;
  imapPass?: string | null;
  imapTls?: boolean | null;
  imapFolder?: string | null;
  pollInterval?: number | null;
  lastSyncAt?: Date | null;
  lastSyncDuration?: number | null;
  lastError?: string | null;
}

export class Mailbox {
  readonly id: Id;
  address: string;
  workspaceId: string;
  isActive: boolean;
  type: MailboxType;
  imapHost: string | null;
  imapPort: number | null;
  imapUser: string | null;
  imapPass: string | null;
  imapTls: boolean | null;
  imapFolder: string | null;
  pollInterval: number | null;
  lastSyncAt: Date | null;
  lastSyncDuration: number | null;
  lastError: string | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.address = props.address;
    this.workspaceId = props.workspaceId;
    this.isActive = props.isActive;
    this.type = props.type ?? MailboxType.WEBHOOK;
    this.imapHost = props.imapHost ?? null;
    this.imapPort = props.imapPort ?? null;
    this.imapUser = props.imapUser ?? null;
    this.imapPass = props.imapPass ?? null;
    this.imapTls = props.imapTls ?? null;
    this.imapFolder = props.imapFolder ?? null;
    this.pollInterval = props.pollInterval ?? null;
    this.lastSyncAt = props.lastSyncAt ?? null;
    this.lastSyncDuration = props.lastSyncDuration ?? null;
    this.lastError = props.lastError ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
