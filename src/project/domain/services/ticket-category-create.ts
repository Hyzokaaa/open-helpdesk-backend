import { IdGenerator } from '../../../shared/domain/id-generator';
import { TicketCategory } from '../entities/ticket-category';
import { TicketCategoryRepository } from '../repositories/ticket-category.repository';

interface CreateTicketCategoryProps {
  name: string;
  slug: string;
  color?: string;
  workspaceId: string;
}

export class CreateTicketCategory {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: TicketCategoryRepository,
  ) {}

  async execute(props: CreateTicketCategoryProps): Promise<TicketCategory> {
    const category = new TicketCategory({
      id: this.idGenerator.create(),
      name: props.name,
      slug: props.slug,
      color: props.color ?? 'blue',
      workspaceId: props.workspaceId,
    });
    await this.repository.create(category);
    return category;
  }
}
