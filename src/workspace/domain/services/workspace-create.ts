import { IdGenerator } from '../../../shared/domain/id-generator';
import { slugify } from '../../../shared/domain/slugify';
import { DomainValidationError } from '../../../shared/domain/errors';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface CreateWorkspaceProps {
  name: string;
  description: string;
  accountId?: string;
}

export class CreateWorkspace {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: WorkspaceRepository,
  ) {}

  async execute(props: CreateWorkspaceProps): Promise<Workspace> {
    const slug = slugify(props.name);
    if (!slug) throw new DomainValidationError('Invalid workspace name');

    if (await this.repository.existsBySlug(slug)) {
      throw new DomainValidationError('This workspace URL is already taken. Choose a different name.');
    }

    const workspace = new Workspace({
      id: this.idGenerator.create(),
      name: props.name,
      slug,
      description: props.description,
      accountId: props.accountId,
    });

    await this.repository.create(workspace);
    return workspace;
  }
}
