import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SortOptions } from '../../../../shared/domain/sort-options';
import { Workspace } from '../../../domain/entities/workspace';
import { WorkspaceRepository } from '../../../domain/repositories/workspace.repository';
import { WorkspaceModel } from '../models/workspace.model';

@Injectable()
export class TypeOrmWorkspaceRepository implements WorkspaceRepository {
  constructor(
    @InjectRepository(WorkspaceModel)
    private readonly repository: Repository<WorkspaceModel>,
  ) {}

  async create(workspace: Workspace): Promise<void> {
    const model = this.toModel(workspace);
    await this.repository.save(model);
  }

  async findById(id: string): Promise<Workspace | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const model = await this.repository.findOneBy({ slug });
    return model ? this.toDomain(model) : null;
  }

  async findByCustomDomain(domain: string): Promise<Workspace[]> {
    const models = await this.repository.findBy({ customDomain: domain });
    return models.map((m) => this.toDomain(m));
  }

  private static readonly VALID_SORT_FIELDS: Record<string, { col: string; lower: boolean }> = {
    name: { col: 'workspace.name', lower: true },
    slug: { col: 'workspace.slug', lower: true },
    description: { col: 'workspace.description', lower: true },
    ownerName: { col: 'owner.firstName', lower: true },
    createdAt: { col: 'workspace.createdAt', lower: false },
  };

  async findAll(sort?: SortOptions): Promise<Workspace[]> {
    const qb = this.repository.createQueryBuilder('workspace');

    if (sort?.sortBy === 'ownerName') {
      qb.leftJoin('accounts', 'account', 'account.id = workspace.accountId')
        .leftJoin('users', 'owner', 'owner.id = account.ownerId');
    }

    const field = TypeOrmWorkspaceRepository.VALID_SORT_FIELDS[sort?.sortBy ?? '']
      ?? { col: 'workspace.createdAt', lower: false };
    const sortOrder = sort?.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const expr = field.lower ? `LOWER(${field.col})` : field.col;
    qb.orderBy(expr, sortOrder);
    const models = await qb.getMany();
    return models.map((m) => this.toDomain(m));
  }

  async update(workspace: Workspace): Promise<void> {
    const model = this.toModel(workspace);
    await this.repository.save(model);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return await this.repository.existsBy({ slug });
  }

  async countByAccountId(accountId: string): Promise<number> {
    return this.repository.count({ where: { accountId } });
  }

  async findByAccountIdOrderByCreatedAt(accountId: string): Promise<Workspace[]> {
    const models = await this.repository.find({
      where: { accountId },
      order: { createdAt: 'ASC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  private toDomain(model: WorkspaceModel): Workspace {
    return new Workspace({
      id: model.id,
      name: model.name,
      slug: model.slug,
      description: model.description,
      accountId: model.accountId,
      palette: (model.metadata as any)?.palette ?? null,
      slaPolicy: model.slaPolicy as any ?? null,
      systemMailboxEnabled: model.systemMailboxEnabled ?? true,
      customDomain: model.customDomain ?? null,
      customDomainVerified: model.customDomainVerified ?? false,
      domainVerificationToken: model.domainVerificationToken ?? null,
      appName: model.appName ?? null,
      appSubtitle: model.appSubtitle ?? null,
      logo: model.logo ?? null,
    });
  }

  private toModel(workspace: Workspace): WorkspaceModel {
    const model = new WorkspaceModel();
    model.id = workspace.getId();
    model.name = workspace.name;
    model.slug = workspace.slug;
    model.description = workspace.description;
    model.accountId = workspace.accountId;
    model.metadata = { palette: workspace.palette };
    model.slaPolicy = workspace.slaPolicy as any;
    model.systemMailboxEnabled = workspace.systemMailboxEnabled;
    model.customDomain = workspace.customDomain;
    model.customDomainVerified = workspace.customDomainVerified;
    model.domainVerificationToken = workspace.domainVerificationToken;
    model.appName = workspace.appName;
    model.appSubtitle = workspace.appSubtitle;
    model.logo = workspace.logo;
    return model;
  }
}
