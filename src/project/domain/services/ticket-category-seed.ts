import { IdGenerator } from '../../../shared/domain/id-generator';
import { TicketCategory } from '../entities/ticket-category';
import { TicketCategoryRepository } from '../repositories/ticket-category.repository';

const DEFAULT_CATEGORIES = [
  { name: 'Bug', slug: 'bug', color: 'red' },
  { name: 'Feature Request', slug: 'feature-request', color: 'green' },
  { name: 'Issue', slug: 'issue', color: 'yellow' },
  { name: 'Task', slug: 'task', color: 'blue' },
];

export class SeedDefaultCategories {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: TicketCategoryRepository,
  ) {}

  async execute(workspaceId: string): Promise<void> {
    const categories = DEFAULT_CATEGORIES.map(
      (def) =>
        new TicketCategory({
          id: this.idGenerator.create(),
          name: def.name,
          slug: def.slug,
          color: def.color,
          workspaceId,
        }),
    );
    await this.repository.createMany(categories);
  }
}
