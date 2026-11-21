import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class StartMatrixIdentityRequest {
  /** @name:server */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  matrixUserId!: string;
}

export class VerifyMatrixIdentityRequest {
  @IsString()
  @Matches(/^\s*\d{6}\s*$/, { message: 'The code has six digits' })
  code!: string;
}
