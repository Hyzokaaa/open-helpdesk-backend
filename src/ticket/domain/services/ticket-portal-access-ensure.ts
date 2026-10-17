import { randomUUID } from 'crypto';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { TicketPortalAccess } from '../entities/ticket-portal-access';
import { TicketPortalAccessRepository } from '../repositories/ticket-portal-access.repository';

interface Props {
  ticketId: string;
  userId: string;
}

/**
 * The person's portal link to the ticket, created the first time it is needed: when the
 * ticket is opened for them, or when an email about it is first sent to them.
 */
export class EnsureTicketPortalAccess {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: TicketPortalAccessRepository,
  ) {}

  async execute(props: Props): Promise<TicketPortalAccess> {
    const existing = await this.repository.findByTicketAndUser(props.ticketId, props.userId);
    if (existing) return existing;

    const access = new TicketPortalAccess({
      id: this.idGenerator.create(),
      ticketId: props.ticketId,
      userId: props.userId,
      token: randomUUID(),
    });
    try {
      await this.repository.create(access);
      return access;
    } catch (error) {
      // Two emails to the same person at once: the other one created it first
      const created = await this.repository.findByTicketAndUser(props.ticketId, props.userId);
      if (created) return created;
      throw error;
    }
  }
}
