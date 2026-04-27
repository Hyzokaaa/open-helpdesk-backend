import { IdGenerator } from '../../../shared/domain/id-generator';
import { slugify } from '../../../shared/domain/slugify';
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
    const slug = await this.generateUniqueSlug(props.name);

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

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const maxAttempts = 5;

    for (let i = 0; i < maxAttempts; i++) {
      const slug = `${base}-${this.randomSuffix()}`;
      if (!(await this.repository.existsBySlug(slug))) return slug;
    }

    return `${base}-${this.randomSuffix()}${this.randomSuffix()}`;
  }

  private randomSuffix(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}
