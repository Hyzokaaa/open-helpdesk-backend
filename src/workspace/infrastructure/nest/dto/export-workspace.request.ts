import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  EXPORT_PASSWORD_MAX_LENGTH,
  EXPORT_PASSWORD_MIN_LENGTH,
} from '../../export-file-codec';

export class ExportWorkspaceRequest {
  @IsString()
  @MinLength(EXPORT_PASSWORD_MIN_LENGTH)
  @MaxLength(EXPORT_PASSWORD_MAX_LENGTH)
  password!: string;
}
