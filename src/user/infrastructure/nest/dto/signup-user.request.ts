import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignupUserRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  invitationToken!: string;
}
