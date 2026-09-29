import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginUserRequest {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
