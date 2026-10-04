import { IsNotEmpty, IsString } from 'class-validator';
import { IsAcceptablePassword } from './is-acceptable-password';

export class ChangePasswordRequest {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsAcceptablePassword()
  newPassword!: string;
}
