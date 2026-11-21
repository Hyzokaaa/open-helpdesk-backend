import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CheckMatrixRoomRequest {
  /** The room's ID (!…) or address (#name:server). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  room!: string;
}
