import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { TicketReopenReason } from '../../../domain/enums/ticket-reopen-reason.enum';
import { TicketStatus } from '../../../domain/enums/ticket-status.enum';
import { REOPEN_TARGETS } from '../../../domain/services/ticket-reopen';

/** The reasons the team can give; "requester" is only set by the portal. */
export const TEAM_REOPEN_REASONS = Object.values(TicketReopenReason).filter((r) => r !== TicketReopenReason.REQUESTER);

export class ReopenTicketRequest {
  @ApiProperty({ enum: TEAM_REOPEN_REASONS, description: 'Why it is reopened.', example: TicketReopenReason.ISSUE_PERSISTS })
  @IsIn(TEAM_REOPEN_REASONS)
  reason!: TicketReopenReason;

  @ApiProperty({ description: 'What is still wrong, at least 20 characters. Seen by the team only, never sent to the requester.', example: 'The printer still prints blank pages after the fix.' })
  @IsString()
  @MaxLength(5000)
  note!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Who takes it (needs the assign permission); `null` sends it to the queue. Left out, whoever had it.' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsOptional()
  assigneeId?: string | null;

  @ApiPropertyOptional({
    enum: REOPEN_TARGETS,
    description: 'Where it goes back to; left out, `in-progress`. `open` is the queue, with nobody assigned (needs the assign permission, and cannot go with an `assigneeId`). `pending` and `in-progress` go to `open` when nobody on the team can take it.',
    example: TicketStatus.IN_PROGRESS,
  })
  @IsIn(REOPEN_TARGETS)
  @IsOptional()
  status?: TicketStatus;
}
