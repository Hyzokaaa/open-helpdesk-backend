import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { CreateCustomFieldDefinition } from '../../../domain/services/custom-field-definition-create';
import { UpdateCustomFieldDefinition } from '../../../domain/services/custom-field-definition-update';
import { DeleteCustomFieldDefinition } from '../../../domain/services/custom-field-definition-delete';
import { ReorderCustomFieldDefinitions } from '../../../domain/services/custom-field-definition-reorder';
import { CreateCustomFieldDefinitionCommand } from '../../../application/commands/create-custom-field-definition.command';
import { UpdateCustomFieldDefinitionCommand } from '../../../application/commands/update-custom-field-definition.command';
import { DeleteCustomFieldDefinitionCommand } from '../../../application/commands/delete-custom-field-definition.command';
import { ReorderCustomFieldDefinitionsCommand } from '../../../application/commands/reorder-custom-field-definitions.command';
import { ListCustomFieldDefinitionsQuery } from '../../../application/queries/list-custom-field-definitions.query';
import { TypeOrmCustomFieldDefinitionRepository } from '../../typeorm/repositories/typeorm-custom-field-definition.repository';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { EnsureWorkspacePermission } from '../../../../workspace/domain/services/workspace-ensure-permission';
import { CreateCustomFieldDefinitionRequest } from '../dto/create-custom-field-definition.request';
import { UpdateCustomFieldDefinitionRequest } from '../dto/update-custom-field-definition.request';
import { ReorderCustomFieldDefinitionsRequest } from '../dto/reorder-custom-field-definitions.request';

@Controller('workspaces/:slug/custom-fields')
export class CustomFieldDefinitionController {
  constructor(
    @Inject() private readonly definitionRepository: TypeOrmCustomFieldDefinitionRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() body: CreateCustomFieldDefinitionRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new CreateCustomFieldDefinition(this.idGenerator, this.definitionRepository);
    const command = new CreateCustomFieldDefinitionCommand(service, ensurePermission);
    return command.execute({
      name: body.name,
      type: body.type,
      options: body.options ?? null,
      required: body.required ?? false,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get()
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const query = new ListCustomFieldDefinitionsQuery(this.definitionRepository, ensurePermission);
    return query.execute({ workspaceId, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  @Put('reorder')
  async reorder(
    @Param('slug') slug: string,
    @Body() body: ReorderCustomFieldDefinitionsRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new ReorderCustomFieldDefinitions(this.definitionRepository);
    const command = new ReorderCustomFieldDefinitionsCommand(service, ensurePermission);
    return command.execute({
      items: body.items,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Put(':id')
  async update(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() body: UpdateCustomFieldDefinitionRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new UpdateCustomFieldDefinition(this.definitionRepository);
    const command = new UpdateCustomFieldDefinitionCommand(service, ensurePermission);
    return command.execute({
      id,
      name: body.name,
      options: body.options,
      required: body.required,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const service = new DeleteCustomFieldDefinition(this.definitionRepository);
    const command = new DeleteCustomFieldDefinitionCommand(service, ensurePermission);
    return command.execute({
      id,
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace.getId();
  }
}
