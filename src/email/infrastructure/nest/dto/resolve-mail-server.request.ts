import { IsString, MaxLength } from 'class-validator';

export class ResolveMailServerRequest {
  @IsString()
  @MaxLength(253)
  domain!: string;
}
