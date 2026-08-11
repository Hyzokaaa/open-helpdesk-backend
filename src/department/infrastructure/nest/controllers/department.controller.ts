import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { CreateDepartment } from '../../../domain/services/department-create';
import { UpdateDepartment } from '../../../domain/services/department-update';
import { DeleteDepartment } from '../../../domain/services/department-delete';
import { AddDepartmentMember } from '../../../domain/services/department-member-add';
import { RemoveDepartmentMember } from '../../../domain/services/department-member-remove';
import { CreateDepartmentCommand } from '../../../application/commands/create-department.command';
import { UpdateDepartmentCommand } from '../../../application/commands/update-department.command';
import { DeleteDepartmentCommand } from '../../../application/commands/delete-department.command';
import { AddDepartmentMemberCommand } from '../../../application/commands/add-department-member.command';
import { RemoveDepartmentMemberCommand } from '../../../application/commands/remove-department-member.command';
import { ListDepartmentsQuery } from '../../../application/queries/list-departments.query';
import { GetDepartmentQuery } from '../../../application/queries/get-department.query';
import { TypeOrmDepartmentRepository } from '../../typeorm/repositories/typeorm-department.repository';
import { TypeOrmDepartmentMemberRepository } from '../../typeorm/repositories/typeorm-department-member.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { CreateDepartmentRequest } from '../dto/create-department.request';
import { UpdateDepartmentRequest } from '../dto/update-department.request';
import { AddDepartmentMemberRequest } from '../dto/add-department-member.request';

@Controller('workspaces/:slug/departments')
export class DepartmentController {
  constructor(
    @Inject() private readonly departmentRepository: TypeOrmDepartmentRepository,
    @Inject() private readonly departmentMemberRepository: TypeOrmDepartmentMemberRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateDepartmentRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateDepartment(this.idGenerator, this.departmentRepository);
    const command = new CreateDepartmentCommand(service, ensurePermission);
    const result = await command.execute({
      name: body.name,
      description: body.description ?? null,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.DEPARTMENT_CREATED,
      entityType: 'department',
      entityId: result.id,
      userId: user.userId,
      workspaceId,
      metadata: { name: body.name, description: body.description },
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
    const query = new ListDepartmentsQuery(this.departmentRepository, this.departmentMemberRepository, ensurePermission);
    return query.execute({ workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Get(':id')
  async get(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new GetDepartmentQuery(this.departmentRepository, this.departmentMemberRepository, this.userRepository, ensurePermission);
    return query.execute({ departmentId: id, workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Patch(':id')
  async update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: UpdateDepartmentRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const existing = await this.departmentRepository.findById(id);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new UpdateDepartment(this.departmentRepository);
    const command = new UpdateDepartmentCommand(service, ensurePermission);
    const result = await command.execute({
      id,
      name: body.name,
      description: body.description,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.DEPARTMENT_UPDATED,
      entityType: 'department',
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
    const existing = await this.departmentRepository.findById(id);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new DeleteDepartment(this.departmentRepository);
    const command = new DeleteDepartmentCommand(service, ensurePermission);
    await command.execute({ id, workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.DEPARTMENT_DELETED,
      entityType: 'department',
      entityId: id,
      userId: user.userId,
      workspaceId,
      metadata: { name: existing?.name },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });
  }

  @Post(':id/members')
  async addMember(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: AddDepartmentMemberRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new AddDepartmentMember(this.idGenerator, this.departmentMemberRepository);
    const command = new AddDepartmentMemberCommand(service, ensurePermission);
    const result = await command.execute({
      departmentId: id,
      userId: body.userId,
      workspaceId,
      currentUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.DEPARTMENT_MEMBER_ADDED,
      entityType: 'department',
      entityId: id,
      userId: user.userId,
      workspaceId,
      metadata: { memberUserId: body.userId },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new RemoveDepartmentMember(this.departmentMemberRepository);
    const command = new RemoveDepartmentMemberCommand(service, ensurePermission);
    await command.execute({
      departmentId: id,
      userId,
      workspaceId,
      currentUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.DEPARTMENT_MEMBER_REMOVED,
      entityType: 'department',
      entityId: id,
      userId: user.userId,
      workspaceId,
      metadata: { memberUserId: userId },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return { removed: true };
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }
}
