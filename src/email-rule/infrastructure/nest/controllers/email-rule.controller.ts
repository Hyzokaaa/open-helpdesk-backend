import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../../workspace/domain/permissions';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmEmailRuleRepository } from '../../typeorm/repositories/typeorm-email-rule.repository';
import { CreateEmailRule } from '../../../domain/services/email-rule-create';
import { UpdateEmailRule } from '../../../domain/services/email-rule-update';
import { DeleteEmailRule } from '../../../domain/services/email-rule-delete';
import { ReorderEmailRules } from '../../../domain/services/email-rule-reorder';
import { CreateEmailRuleCommand } from '../../../application/commands/create-email-rule.command';
import { UpdateEmailRuleCommand } from '../../../application/commands/update-email-rule.command';
import { DeleteEmailRuleCommand } from '../../../application/commands/delete-email-rule.command';
import { ReorderEmailRulesCommand } from '../../../application/commands/reorder-email-rules.command';
import { ListEmailRulesQuery } from '../../../application/queries/list-email-rules.query';
import { EmailRule, RuleCondition, RuleAction } from '../../../domain/entities/email-rule';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';

/** What a rule does, for before/after in the audit log. */
function ruleSnapshot(rule: EmailRule) {
  return { name: rule.name, isActive: rule.isActive, mailboxIds: rule.mailboxIds, conditions: rule.conditions, actions: rule.actions };
}

@Controller('workspaces/:slug/email-rules')
export class EmailRuleController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly emailRuleRepository: TypeOrmEmailRuleRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }

  private async ensureAdmin(workspaceId: string, user: AuthUser): Promise<void> {
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get()
  async list(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensureAdmin(workspaceId, user);
    const query = new ListEmailRulesQuery(this.emailRuleRepository);
    return query.execute({ workspaceId });
  }

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: { name: string; mailboxIds?: string[]; conditions: RuleCondition[]; actions: RuleAction[] },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensureAdmin(workspaceId, user);
    const service = new CreateEmailRule(this.idGenerator, this.emailRuleRepository);
    const command = new CreateEmailRuleCommand(service);
    const result = await command.execute({
      workspaceId,
      name: body.name,
      mailboxIds: body.mailboxIds ?? [],
      conditions: body.conditions,
      actions: body.actions,
    });
    await this.audit(AuditAction.EMAIL_RULE_CREATED, result.id, workspaceId, user, {
      name: body.name,
      after: { conditions: body.conditions, actions: body.actions, mailboxIds: body.mailboxIds ?? [] },
    });
    return result;
  }

  @Patch(':id')
  async update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean; mailboxIds?: string[]; conditions?: RuleCondition[]; actions?: RuleAction[] },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensureAdmin(workspaceId, user);
    const previous = await this.emailRuleRepository.findById(id);
    const service = new UpdateEmailRule(this.emailRuleRepository);
    const command = new UpdateEmailRuleCommand(service);
    await command.execute({
      id,
      workspaceId,
      name: body.name,
      isActive: body.isActive,
      mailboxIds: body.mailboxIds,
      conditions: body.conditions,
      actions: body.actions,
    });
    const after = await this.emailRuleRepository.findById(id);
    await this.audit(AuditAction.EMAIL_RULE_UPDATED, id, workspaceId, user, {
      name: after?.name ?? previous?.name ?? null,
      before: previous ? ruleSnapshot(previous) : null,
      after: after ? ruleSnapshot(after) : null,
    });
  }

  @Delete(':id')
  async delete(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensureAdmin(workspaceId, user);
    const previous = await this.emailRuleRepository.findById(id);
    const service = new DeleteEmailRule(this.emailRuleRepository);
    const command = new DeleteEmailRuleCommand(service);
    await command.execute({ id, workspaceId });
    await this.audit(AuditAction.EMAIL_RULE_DELETED, id, workspaceId, user, {
      name: previous?.name ?? null,
      before: previous ? ruleSnapshot(previous) : null,
    });
  }

  @Put('reorder')
  async reorder(
    @Param('slug') slug: string,
    @Body() body: { orderedIds: string[] },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensureAdmin(workspaceId, user);
    const service = new ReorderEmailRules(this.emailRuleRepository);
    const command = new ReorderEmailRulesCommand(service);
    await command.execute({ workspaceId, orderedIds: body.orderedIds });
    // Rules apply in order, so a new order can change which one decides
    await this.audit(AuditAction.EMAIL_RULE_REORDERED, workspaceId, workspaceId, user, { orderedIds: body.orderedIds });
  }

  /** Email rules decide which mail is rejected or where it lands, so every change is kept. */
  private async audit(action: AuditAction, entityId: string, workspaceId: string, user: AuthUser, metadata: Record<string, unknown>): Promise<void> {
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action,
      entityType: 'email-rule',
      entityId,
      userId: user.userId,
      workspaceId,
      metadata,
      category: AuditCategory.EMAIL,
      level: AuditLevel.INFO,
      source: 'ui',
    });
  }
}
