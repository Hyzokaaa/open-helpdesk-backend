import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { WorkspaceRepository } from '../repositories/workspace.repository';

/** The languages emails are written in */
export const EMAIL_LANGUAGES = ['en', 'es'] as const;

interface Props {
  workspaceId: string;
  language: string;
}

/** Sets the language of emails to people without an account yet, such as a new invitee. */
export class UpdateWorkspaceDefaultLanguage {
  constructor(private readonly repository: WorkspaceRepository) {}

  async execute(props: Props): Promise<{ before: string | null; after: string }> {
    if (!(EMAIL_LANGUAGES as readonly string[]).includes(props.language)) {
      throw new DomainValidationError(`Unsupported language: ${props.language}`);
    }
    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const before = workspace.defaultLanguage;
    workspace.defaultLanguage = props.language;
    await this.repository.update(workspace);
    return { before, after: props.language };
  }
}
