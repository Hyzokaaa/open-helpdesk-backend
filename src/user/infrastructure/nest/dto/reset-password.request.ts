import { IsNotEmpty, IsString } from 'class-validator';
import { IsAcceptablePassword } from './is-acceptable-password';

export class ResetPasswordRequest {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsAcceptablePassword()
  newPassword!: string;
}
