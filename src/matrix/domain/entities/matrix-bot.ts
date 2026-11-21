import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  /** Null for the installation's bot, which every workspace without one of its own uses. */
  workspaceId: string | null;
  homeserverUrl: string;
  /** The bot's Matrix ID, e.g. @helpdesk:example.org */
  userId: string;
  deviceId: string | null;
  /** The access token, encrypted (see SecretCipher); never the password. */
  encryptedAccessToken: string;
}

/** A Matrix account the helpdesk writes its notices with. */
export class MatrixBot {
  readonly id: Id;
  workspaceId: string | null;
  homeserverUrl: string;
  userId: string;
  deviceId: string | null;
  encryptedAccessToken: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.homeserverUrl = props.homeserverUrl;
    this.userId = props.userId;
    this.deviceId = props.deviceId;
    this.encryptedAccessToken = props.encryptedAccessToken;
  }

  getId(): string {
    return this.id.get();
  }
}
