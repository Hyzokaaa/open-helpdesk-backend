import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { StorageService } from '../../../../shared/domain/storage-service';
import { STORAGE_SERVICE } from '../../../../shared/shared.module';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { CreateOrganization } from '../../../domain/services/organization-create';
import { UpdateOrganization } from '../../../domain/services/organization-update';
import { DeleteOrganization } from '../../../domain/services/organization-delete';
import { CreateOrganizationCommand } from '../../../application/commands/create-organization.command';
import { UpdateOrganizationCommand } from '../../../application/commands/update-organization.command';
import { DeleteOrganizationCommand } from '../../../application/commands/delete-organization.command';
import { ListOrganizationsQuery } from '../../../application/queries/list-organizations.query';
import { TypeOrmOrganizationRepository } from '../../typeorm/repositories/typeorm-organization.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../../workspace/domain/permissions';
import { CreateOrganizationRequest } from '../dto/create-organization.request';
import { UpdateOrganizationRequest } from '../dto/update-organization.request';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

@Controller('workspaces/:slug/organizations')
export class OrganizationController {
  constructor(
    @Inject() private readonly organizationRepository: TypeOrmOrganizationRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateOrganizationRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateOrganization(this.idGenerator, this.organizationRepository);
    const command = new CreateOrganizationCommand(service, ensurePermission);
    const result = await command.execute({
      name: body.name,
      description: body.description ?? null,
      domains: body.domains ?? [],
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.ORGANIZATION_CREATED,
      entityType: 'organization',
      entityId: result.id,
      userId: user.userId,
      workspaceId,
      metadata: { name: body.name, domains: body.domains },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Get()
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new ListOrganizationsQuery(this.organizationRepository, ensurePermission);
    const orgs = await query.execute({ workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });

    return Promise.all(orgs.map(async (org) => ({
      ...org,
      logo: org.logo ? await this.storage.getPresignedUrl(org.logo) : null,
    })));
  }

  @Get(':id')
  async get(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.ORGANIZATION_VIEW,
      isSystemAdmin: user.isSystemAdmin,
    });

    const org = await this.organizationRepository.findById(id);
    if (!org || org.workspaceId !== workspaceId) throw new EntityNotFoundError('Organization not found');

    return {
      id: org.getId(),
      name: org.name,
      description: org.description,
      domains: org.domains,
      logo: org.logo ? await this.storage.getPresignedUrl(org.logo) : null,
    };
  }

  @Patch(':id')
  async update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: UpdateOrganizationRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const existing = await this.organizationRepository.findById(id);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new UpdateOrganization(this.organizationRepository);
    const command = new UpdateOrganizationCommand(service, ensurePermission);
    const result = await command.execute({
      id,
      name: body.name,
      description: body.description,
      domains: body.domains,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.ORGANIZATION_UPDATED,
      entityType: 'organization',
      entityId: id,
      userId: user.userId,
      workspaceId,
      metadata: { name: result.name, previousName: existing?.name },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const existing = await this.organizationRepository.findById(id);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new DeleteOrganization(this.organizationRepository);
    const command = new DeleteOrganizationCommand(service, ensurePermission);
    await command.execute({ id, workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.ORGANIZATION_DELETED,
      entityType: 'organization',
      entityId: id,
      userId: user.userId,
      workspaceId,
      metadata: { name: existing?.name },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });
  }

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.ORGANIZATION_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > 1024 * 1024) throw new BadRequestException('Logo must be 1MB or less');

    const allowedMimes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Logo must be PNG, SVG, JPEG, or WebP');
    }

    const org = await this.organizationRepository.findById(id);
    if (!org || org.workspaceId !== workspaceId) throw new EntityNotFoundError('Organization not found');

    const ext = MIME_TO_EXT[file.mimetype] ?? '.png';
    const key = `organizations/${id}/logo${ext}`;

    if (org.logo && org.logo !== key) {
      await this.storage.delete(org.logo);
    }

    await this.storage.upload(file.buffer, key, file.mimetype);
    org.logo = key;
    await this.organizationRepository.update(org);

    return { logo: await this.storage.getPresignedUrl(key) };
  }

  @Delete(':id/logo')
  async deleteLogo(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.ORGANIZATION_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const org = await this.organizationRepository.findById(id);
    if (!org || org.workspaceId !== workspaceId) throw new EntityNotFoundError('Organization not found');

    if (org.logo) {
      await this.storage.delete(org.logo);
      org.logo = null;
      await this.organizationRepository.update(org);
    }

    return { logo: null };
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }
}
