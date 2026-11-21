import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { MatrixNoticeEvent } from '../../../domain/enums/matrix-notice-event.enum';
import { MatrixRoomScope } from '../../../domain/enums/matrix-room-scope.enum';

/** A room for the bot to create: private, invite only, without encryption. */
export class NewMatrixRoomRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  /** Matrix user IDs (@name:server), invited and made admins of the room. */
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  invite: string[] = [];
}

export class SaveMatrixRoomRequest {
  /** The room's ID (!…) or address (#name:server); left out when newRoom is given. */
  @ValidateIf((r: SaveMatrixRoomRequest) => !r.newRoom)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  room?: string;

  /** Instead of room: the bot creates the room. */
  @IsOptional()
  @ValidateNested()
  @Type(() => NewMatrixRoomRequest)
  newRoom?: NewMatrixRoomRequest;

  /** Which tickets the room hears of; the whole workspace when left out. */
  @IsOptional()
  @IsEnum(MatrixRoomScope)
  scope: MatrixRoomScope = MatrixRoomScope.WORKSPACE;

  /** The department, project or organization, for those scopes. */
  @ValidateIf((r: SaveMatrixRoomRequest) => r.scope !== MatrixRoomScope.WORKSPACE)
  @IsString()
  @IsNotEmpty()
  scopeId?: string | null;

  @IsArray()
  @IsEnum(MatrixNoticeEvent, { each: true })
  events!: MatrixNoticeEvent[];

  @IsBoolean()
  includeText!: boolean;

  /** Optional so a client from before it still saves; it then stays off. */
  @IsOptional()
  @IsBoolean()
  includeFiles: boolean = false;

  /** For the room of the whole workspace: leave out the tickets another room already tells of. */
  @IsOptional()
  @IsBoolean()
  onlyTicketsWithoutOtherRoom: boolean = false;
}
