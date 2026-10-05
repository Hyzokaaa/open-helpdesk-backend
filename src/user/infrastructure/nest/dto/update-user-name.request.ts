import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { USER_NAME_MAX_LENGTH } from '../../../domain/user-name';

export class UpdateUserNameRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_NAME_MAX_LENGTH)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_NAME_MAX_LENGTH)
  lastName!: string;
}
