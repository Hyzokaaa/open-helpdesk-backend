import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../../domain/entities/organization';
import { OrganizationRepository } from '../../../domain/repositories/organization.repository';
import { OrganizationModel } from '../models/organization.model';

@Injectable()
export class TypeOrmOrganizationRepository implements OrganizationRepository {
  constructor(
    @InjectRepository(OrganizationModel)
    private readonly repository: Repository<OrganizationModel>,
  ) {}

  async create(org: Organization): Promise<void> {
    await this.repository.save(this.toModel(org));
  }

  async findById(id: string): Promise<Organization | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Organization[]> {
    const models = await this.repository.find({
      where: { workspaceId },
      order: { name: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async findByDomainAndWorkspace(domain: string, workspaceId: string): Promise<Organization | null> {
    const model = await this.repository
      .createQueryBuilder('org')
      .where('org.workspaceId = :workspaceId', { workspaceId })
      .andWhere('org.domains @> :domain', { domain: JSON.stringify([domain.toLowerCase()]) })
      .getOne();
    return model ? this.toDomain(model) : null;
  }

  async update(org: Organization): Promise<void> {
    await this.repository.save(this.toModel(org));
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  private toDomain(model: OrganizationModel): Organization {
    return new Organization({
      id: model.id,
      name: model.name,
      description: model.description,
      logo: model.logo,
      domains: model.domains,
      workspaceId: model.workspaceId,
    });
  }

  private toModel(org: Organization): OrganizationModel {
    const model = new OrganizationModel();
    model.id = org.getId();
    model.name = org.name;
    model.description = org.description;
    model.logo = org.logo;
    model.domains = org.domains;
    model.workspaceId = org.workspaceId;
    return model;
  }
}
