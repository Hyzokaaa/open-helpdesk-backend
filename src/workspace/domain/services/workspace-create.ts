import { IdGenerator } from '../../../shared/domain/id-generator';
import { slugify } from '../../../shared/domain/slugify';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface CreateWorkspaceProps {
  name: string;
  description: string;
  dealerId: string | null;
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
      dealerId: props.dealerId,
    });

    await this.repository.create(workspace);
    return workspace;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    if (!(await this.repository.existsBySlug(base))) return base;

    let counter = 2;
    while (await this.repository.existsBySlug(`${base}-${counter}`)) {
      counter++;
    }
    return `${base}-${counter}`;
  }
}
