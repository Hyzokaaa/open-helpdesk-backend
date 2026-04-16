import { IsOptional, IsString } from 'class-validator';

export class AssignTicketRequest {
  @IsString()
  @IsOptional()
  assigneeId: string | null = null;
}
