import { Organization } from '../entities/organization';

export interface OrganizationRepository {
  create(org: Organization): Promise<void>;
  findById(id: string): Promise<Organization | null>;
  findByWorkspaceId(workspaceId: string): Promise<Organization[]>;
  findByDomainAndWorkspace(domain: string, workspaceId: string): Promise<Organization | null>;
  update(org: Organization): Promise<void>;
  softDelete(id: string): Promise<void>;
}
