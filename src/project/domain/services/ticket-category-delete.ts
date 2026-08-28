import { EntityNotFoundError } from '../../../shared/domain/errors';
import { TicketCategoryRepository } from '../repositories/ticket-category.repository';

export class DeleteTicketCategory {
  constructor(private readonly repository: TicketCategoryRepository) {}

  async execute(id: string): Promise<void> {
    const category = await this.repository.findById(id);
    if (!category) throw new EntityNotFoundError('Category not found');
    await this.repository.delete(id);
  }
}
