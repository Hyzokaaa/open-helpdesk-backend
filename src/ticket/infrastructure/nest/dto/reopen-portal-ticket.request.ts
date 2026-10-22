import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReopenPortalTicketRequest {
  /** What is still wrong; published as the requester's reply and kept as the reason. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content!: string;
}
