import { Organization } from '../entities/organization';
import { OrganizationRepository } from '../repositories/organization.repository';

export class ResolveOrganizationByEmail {
  constructor(private readonly repository: OrganizationRepository) {}

  async execute(email: string, workspaceId: string): Promise<Organization | null> {
    const parts = email.split('@');
    if (parts.length !== 2) return null;
    const domain = parts[1].toLowerCase();
    return this.repository.findByDomainAndWorkspace(domain, workspaceId);
  }
}
