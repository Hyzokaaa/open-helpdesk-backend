import { IsArray, IsString } from 'class-validator';

export class BulkDeleteRequest {
  @IsArray()
  @IsString({ each: true })
  ticketIds!: string[];
}
