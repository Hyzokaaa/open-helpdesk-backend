import { Organization } from '../../src/organization/domain/entities/organization';
import { OrganizationRepository } from '../../src/organization/domain/repositories/organization.repository';

export class MockOrganizationRepository implements OrganizationRepository {
  organizations: Organization[] = [];

  async create(org: Organization): Promise<void> {
    this.organizations.push(org);
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.find((o) => o.getId() === id) ?? null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Organization[]> {
    return this.organizations.filter((o) => o.workspaceId === workspaceId);
  }

  async findByDomainAndWorkspace(domain: string, workspaceId: string): Promise<Organization | null> {
    return this.organizations.find((o) => o.workspaceId === workspaceId && o.domains.includes(domain)) ?? null;
  }

  async update(org: Organization): Promise<void> {
    const i = this.organizations.findIndex((o) => o.getId() === org.getId());
    if (i >= 0) this.organizations[i] = org;
  }

  async softDelete(id: string): Promise<void> {
    this.organizations = this.organizations.filter((o) => o.getId() !== id);
  }
}
