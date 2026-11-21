import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  /** The bot that opened the chat: each bot has its own with the user. */
  botId: string;
  userId: string;
  /** The Matrix ID the bot invited; a chat with an older ID of the user is not reused. */
  matrixUserId: string;
  /** The Matrix room ID (!…). */
  roomId: string;
  /**
   * When the user left or rejected this chat: this bot sends them nothing more until they ask to
   * reconnect it. The other bots' chats go on.
   */
  lostAt: Date | null;
}

/** The direct chat a bot opened with a helpdesk user, where it sends their personal notices. */
export class MatrixDirectRoom {
  readonly id: Id;
  botId: string;
  userId: string;
  matrixUserId: string;
  roomId: string;
  lostAt: Date | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.botId = props.botId;
    this.userId = props.userId;
    this.matrixUserId = props.matrixUserId;
    this.roomId = props.roomId;
    this.lostAt = props.lostAt;
  }

  getId(): string {
    return this.id.get();
  }
}
