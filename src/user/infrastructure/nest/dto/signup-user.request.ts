import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsAcceptablePassword } from './is-acceptable-password';
import { USER_NAME_MAX_LENGTH } from '../../../domain/user-name';
import { SignupSourceRequest } from './signup-source.request';

export class SignupUserRequest {
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

  @IsString()
  @IsNotEmpty()
  invitationToken!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SignupSourceRequest)
  signupSource?: SignupSourceRequest;
}
