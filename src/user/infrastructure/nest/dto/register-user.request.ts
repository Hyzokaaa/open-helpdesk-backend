import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsAcceptablePassword } from './is-acceptable-password';
import { USER_NAME_MAX_LENGTH } from '../../../domain/user-name';

export class RegisterUserRequest {
  @IsEmail()
  email!: string;

  @IsAcceptablePassword()
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_NAME_MAX_LENGTH)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_NAME_MAX_LENGTH)
  lastName!: string;

  @IsBoolean()
  @IsOptional()
  isSystemAdmin?: boolean;

  @IsBoolean()
  @IsOptional()
  isEmailVerified?: boolean;
}
