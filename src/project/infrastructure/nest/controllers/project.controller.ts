import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../../workspace/domain/permissions';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { TypeOrmProjectRepository } from '../../typeorm/repositories/typeorm-project.repository';
import { TypeOrmTicketCategoryRepository } from '../../typeorm/repositories/typeorm-ticket-category.repository';
import { CreateProject } from '../../../domain/services/project-create';
import { UpdateProject } from '../../../domain/services/project-update';
import { DeleteProject } from '../../../domain/services/project-delete';
import { CreateProjectRequest } from '../dto/create-project.request';
import { UpdateProjectRequest } from '../dto/update-project.request';

@Controller('workspaces/:slug/projects')
export class ProjectController {
  constructor(
    @Inject() private readonly projectRepository: TypeOrmProjectRepository,
    @Inject() private readonly categoryRepository: TypeOrmTicketCategoryRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateProjectRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_MANAGE);

    const service = new CreateProject(this.idGenerator, this.projectRepository);
    const project = await service.execute({
      name: body.name,
      description: body.description,
      workspaceId,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.PROJECT_CREATED,
      entityType: 'project',
      entityId: project.getId(),
      userId: user.userId,
      workspaceId,
      metadata: { name: project.name },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { id: project.getId(), name: project.name, description: project.description };
  }

  @Get()
  async list(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_VIEW);

    const projects = await this.projectRepository.findByWorkspaceId(workspaceId);

    const result = [];
    for (const p of projects) {
      const categoryIds = await this.categoryRepository.findProjectCategoryIds(p.getId());
      result.push({
        id: p.getId(),
        name: p.name,
        description: p.description,
        categoryCount: categoryIds.length,
      });
    }
    return result;
  }

  @Get(':id')
  async get(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_VIEW);

    const project = await this.projectRepository.findById(id);
    if (!project || project.workspaceId !== workspaceId) {
      throw new EntityNotFoundError('Project not found');
    }

    const categories = await this.categoryRepository.findByProjectId(id);

    return {
      id: project.getId(),
      name: project.name,
      description: project.description,
      categories: categories.map((c) => ({
        id: c.getId(),
        name: c.name,
        slug: c.slug,
        color: c.color,
      })),
    };
  }

  @Patch(':id')
  async update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_MANAGE);

    const existing = await this.projectRepository.findById(id);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new EntityNotFoundError('Project not found');
    }

    const service = new UpdateProject(this.projectRepository);
    const project = await service.execute({ id, ...body });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.PROJECT_UPDATED,
      entityType: 'project',
      entityId: project.getId(),
      userId: user.userId,
      workspaceId,
      metadata: { name: project.name },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { id: project.getId(), name: project.name, description: project.description };
  }

  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_MANAGE);

    const existing = await this.projectRepository.findById(id);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new EntityNotFoundError('Project not found');
    }

    const service = new DeleteProject(this.projectRepository);
    await service.execute(id);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.PROJECT_DELETED,
      entityType: 'project',
      entityId: id,
      userId: user.userId,
      workspaceId,
      metadata: { name: existing.name },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });
  }

  // ── Project Categories (join table) ──

  @Post(':id/categories')
  async addCategory(
    @Param('slug') slug: string,
    @Param('id') projectId: string,
    @Body() body: { categoryId: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_MANAGE);

    const project = await this.projectRepository.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new EntityNotFoundError('Project not found');
    }

    await this.categoryRepository.addToProject(projectId, body.categoryId);
    return { projectId, categoryId: body.categoryId };
  }

  @Delete(':id/categories/:categoryId')
  async removeCategory(
    @Param('slug') slug: string,
    @Param('id') projectId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_MANAGE);

    await this.categoryRepository.removeFromProject(projectId, categoryId);
  }

  @Get(':id/categories')
  async listProjectCategories(
    @Param('slug') slug: string,
    @Param('id') projectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_VIEW);

    const categories = await this.categoryRepository.findByProjectId(projectId);
    return categories.map((c) => ({
      id: c.getId(),
      name: c.name,
      slug: c.slug,
      color: c.color,
    }));
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }

  private async ensurePermission(workspaceId: string, user: AuthUser, permission: typeof PERMISSIONS[keyof typeof PERMISSIONS]) {
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission,
      isSystemAdmin: user.isSystemAdmin,
    });
  }
}
