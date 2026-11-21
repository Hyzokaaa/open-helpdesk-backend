import { IsNotEmpty, IsString } from 'class-validator';

/** Accepting or rejecting an invitation: the token from its link. */
export class InvitationTokenRequest {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
