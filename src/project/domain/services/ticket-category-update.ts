import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketCategory } from '../entities/ticket-category';
import { TicketCategoryRepository } from '../repositories/ticket-category.repository';

interface UpdateTicketCategoryProps {
  id: string;
  name?: string;
  slug?: string;
  color?: string;
}

export class UpdateTicketCategory {
  constructor(private readonly repository: TicketCategoryRepository) {}

  async execute(props: UpdateTicketCategoryProps): Promise<TicketCategory> {
    const category = await this.repository.findById(props.id);
    if (!category) throw new EntityNotFoundError('Category not found');

    if (props.name !== undefined) category.name = props.name;
    if (props.slug !== undefined) category.slug = props.slug;
    if (props.color !== undefined) category.color = props.color;

    await this.repository.update(category);
    return category;
  }
}
