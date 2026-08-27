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
import { AuditCategory as AuditCat } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { TypeOrmTicketCategoryRepository } from '../../typeorm/repositories/typeorm-ticket-category.repository';
import { CreateTicketCategory } from '../../../domain/services/ticket-category-create';
import { UpdateTicketCategory } from '../../../domain/services/ticket-category-update';
import { DeleteTicketCategory } from '../../../domain/services/ticket-category-delete';

@Controller('workspaces/:slug/categories')
export class TicketCategoryController {
  constructor(
    @Inject() private readonly categoryRepository: TypeOrmTicketCategoryRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Get()
  async list(
    @Param('slug') slug: string,
    @Query('projectId') projectId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_VIEW);

    const global = await this.categoryRepository.findGlobalByWorkspaceId(workspaceId);
    const projectCategories = projectId
      ? await this.categoryRepository.findByProjectId(projectId)
      : [];

    return [...global, ...projectCategories].map((c) => ({
      id: c.getId(),
      name: c.name,
      slug: c.slug,
      color: c.color,
      projectId: c.projectId,
    }));
  }

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: { name: string; slug: string; color?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_MANAGE);

    const service = new CreateTicketCategory(this.idGenerator, this.categoryRepository);
    const category = await service.execute({
      name: body.name,
      slug: body.slug,
      color: body.color,
      projectId: null,
      workspaceId,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.TICKET_CATEGORY_CREATED,
      entityType: 'ticket-category',
      entityId: category.getId(),
      userId: user.userId,
      workspaceId,
      metadata: { name: category.name },
      category: AuditCat.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { id: category.getId(), name: category.name, slug: category.slug, color: category.color };
  }

  @Patch(':categoryId')
  async update(
    @Param('slug') slug: string,
    @Param('categoryId') categoryId: string,
    @Body() body: { name?: string; slug?: string; color?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_MANAGE);

    const service = new UpdateTicketCategory(this.categoryRepository);
    const category = await service.execute({ id: categoryId, ...body });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.TICKET_CATEGORY_UPDATED,
      entityType: 'ticket-category',
      entityId: categoryId,
      userId: user.userId,
      workspaceId,
      metadata: { name: category.name },
      category: AuditCat.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { id: category.getId(), name: category.name, slug: category.slug, color: category.color };
  }

  @Delete(':categoryId')
  async remove(
    @Param('slug') slug: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensurePermission(workspaceId, user, PERMISSIONS.PROJECT_MANAGE);

    const existing = await this.categoryRepository.findById(categoryId);
    if (!existing) throw new EntityNotFoundError('Category not found');

    const service = new DeleteTicketCategory(this.categoryRepository);
    await service.execute(categoryId);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.TICKET_CATEGORY_DELETED,
      entityType: 'ticket-category',
      entityId: categoryId,
      userId: user.userId,
      workspaceId,
      metadata: { name: existing.name },
      category: AuditCat.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });
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
