import { IsIn } from 'class-validator';
import { EMAIL_LANGUAGES } from '../../../domain/services/workspace-update-default-language';

export class UpdateWorkspaceDefaultLanguageRequest {
  @IsIn(EMAIL_LANGUAGES as unknown as string[])
  language!: string;
}
