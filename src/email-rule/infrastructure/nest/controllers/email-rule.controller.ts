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
import { RuleCondition, RuleAction } from '../../../domain/entities/email-rule';

@Controller('workspaces/:slug/email-rules')
export class EmailRuleController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly emailRuleRepository: TypeOrmEmailRuleRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
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
    return command.execute({
      workspaceId,
      name: body.name,
      mailboxIds: body.mailboxIds ?? [],
      conditions: body.conditions,
      actions: body.actions,
    });
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
    const service = new UpdateEmailRule(this.emailRuleRepository);
    const command = new UpdateEmailRuleCommand(service);
    await command.execute({ id, ...body });
  }

  @Delete(':id')
  async delete(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await this.ensureAdmin(workspaceId, user);
    const service = new DeleteEmailRule(this.emailRuleRepository);
    const command = new DeleteEmailRuleCommand(service);
    await command.execute({ id });
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
  }
}
