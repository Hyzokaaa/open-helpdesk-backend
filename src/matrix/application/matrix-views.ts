import { SecretCipher } from '../../shared/domain/secret-cipher';
import { MatrixBot } from '../domain/entities/matrix-bot';
import { MatrixRoom } from '../domain/entities/matrix-room';
import { MatrixRoomScope } from '../domain/enums/matrix-room-scope.enum';
import { matrixRoomScope } from '../domain/matrix-room-scope';

export interface MatrixBotView {
  userId: string;
  homeserverUrl: string;
  deviceId: string | null;
  /** False when the saved token can no longer be decrypted (the key changed): connect it again. */
  tokenReadable: boolean;
}

export interface MatrixRoomView {
  id: string;
  roomId: string;
  /** Which tickets the room hears of: the whole workspace, or one department, project or organization. */
  scope: MatrixRoomScope;
  scopeId: string | null;
  /** The department's, project's or organization's name; null for the whole workspace, or when it was deleted. */
  scopeName: string | null;
  onlyTicketsWithoutOtherRoom: boolean;
  events: string[];
  includeText: boolean;
  includeFiles: boolean;
  isActive: boolean;
  lastError: string | null;
  lastErrorAt: Date | null;
}

/** A bot as the settings show it: never its token. */
export function matrixBotView(bot: MatrixBot, cipher: SecretCipher): MatrixBotView {
  return { userId: bot.userId, homeserverUrl: bot.homeserverUrl, deviceId: bot.deviceId, tokenReadable: cipher.decrypt(bot.encryptedAccessToken) !== null };
}

export function matrixRoomView(room: MatrixRoom, scopeName: string | null = null): MatrixRoomView {
  return {
    id: room.getId(),
    roomId: room.roomId,
    ...matrixRoomScope(room),
    scopeName,
    onlyTicketsWithoutOtherRoom: room.onlyTicketsWithoutOtherRoom,
    events: room.events,
    includeText: room.includeText,
    includeFiles: room.includeFiles,
    isActive: room.isActive,
    lastError: room.lastError,
    lastErrorAt: room.lastErrorAt,
  };
}
