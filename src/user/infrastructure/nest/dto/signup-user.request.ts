import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { USER_NAME_MAX_LENGTH } from '../../../domain/user-name';

export class SignupUserRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_NAME_MAX_LENGTH)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_NAME_MAX_LENGTH)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  invitationToken!: string;
}
