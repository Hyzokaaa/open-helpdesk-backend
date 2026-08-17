import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface SetBrandingProps {
  workspaceId: string;
  appName?: string | null;
  appSubtitle?: string | null;
}

const APP_NAME_MAX_LENGTH = 50;
const APP_SUBTITLE_MAX_LENGTH = 30;
const HTML_REGEX = /<[^>]*>/;

export class SetBranding {
  constructor(private readonly repository: WorkspaceRepository) {}

  async execute(props: SetBrandingProps): Promise<Workspace> {
    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    if (props.appName !== undefined) {
      workspace.appName = this.validateField(props.appName, 'App name', APP_NAME_MAX_LENGTH);
    }

    if (props.appSubtitle !== undefined) {
      workspace.appSubtitle = this.validateField(props.appSubtitle, 'Subtitle', APP_SUBTITLE_MAX_LENGTH);
    }

    await this.repository.update(workspace);
    return workspace;
  }

  private validateField(value: string | null, label: string, maxLength: number): string | null {
    if (value === null || value === undefined) return null;

    const trimmed = value.trim();
    if (trimmed === '') return null;

    if (trimmed.length > maxLength) {
      throw new DomainValidationError(`${label} must be ${maxLength} characters or less`);
    }

    if (HTML_REGEX.test(trimmed)) {
      throw new DomainValidationError(`${label} must not contain HTML`);
    }

    return trimmed;
  }
}
