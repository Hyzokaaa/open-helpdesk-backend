import { randomBytes } from 'crypto';
import { DomainValidationError } from '../../../shared/domain/errors';
import { WorkspaceTicketReference } from '../entities/workspace-ticket-reference';
import { WorkspaceTicketReferenceRepository } from '../repositories/workspace-ticket-reference.repository';
import {
  TicketReferenceStyle,
  normalizeTicketReferencePrefix,
} from '../../../ticket/domain/ticket-reference';

interface Props {
  workspaceId: string;
  style?: string;
  prefix?: string;
}

interface Snapshot {
  style: string;
  prefix: string;
}

/**
 * Sets how the workspace shows its ticket references. The key of the random references is
 * created the first time they are turned on and kept from then on, also if the workspace goes
 * back to sequential: turning random on again brings back the very same references.
 */
export class UpdateTicketReferenceFormat {
  constructor(private readonly repository: WorkspaceTicketReferenceRepository) {}

  async execute(props: Props): Promise<{ settings: WorkspaceTicketReference; before: Snapshot; after: Snapshot }> {
    const settings = (await this.repository.findByWorkspaceId(props.workspaceId)) ?? new WorkspaceTicketReference({ workspaceId: props.workspaceId });
    const before = { style: settings.style, prefix: settings.prefix };

    if (props.style !== undefined) {
      if (!Object.values(TicketReferenceStyle).includes(props.style as TicketReferenceStyle)) {
        throw new DomainValidationError('Ticket reference style must be sequential or random');
      }
      settings.style = props.style;
      if (props.style === TicketReferenceStyle.RANDOM && !settings.secret) {
        settings.secret = randomBytes(32).toString('hex');
      }
    }

    if (props.prefix !== undefined) {
      const prefix = normalizeTicketReferencePrefix(props.prefix);
      if (!prefix) throw new DomainValidationError('The prefix must be 1 to 10 letters or digits');
      settings.prefix = prefix;
    }

    await this.repository.save(settings);
    return { settings, before, after: { style: settings.style, prefix: settings.prefix } };
  }
}
