import { IsNotEmpty, IsString } from 'class-validator';

export class TransferTicketRequest {
  @IsString()
  @IsNotEmpty()
  assigneeId!: string;
}
