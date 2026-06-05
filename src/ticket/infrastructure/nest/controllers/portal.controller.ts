import { randomBytes } from 'crypto';
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { S3StorageService } from '../../../../shared/infrastructure/s3-storage.service';
import { NestEventPublisher } from '../../../../shared/infrastructure/nest-event-publisher';
import { CreateUser } from '../../../../user/domain/services/user-create';
import { AddWorkspaceMember } from '../../../../workspace/domain/services/workspace-add-member';
import { CreateTicket } from '../../../domain/services/ticket-create';
import { ClaimStagedAttachments } from '../../../../attachment/domain/services/attachment-claim-staged';
import { StageAttachment } from '../../../../attachment/domain/services/attachment-stage';
import { StageUploadCommand, StageUploadResponse } from '../../.././../attachment/application/commands/stage-upload.command';
import { TicketPriority } from '../../../domain/enums/ticket-priority.enum';
import { TicketCategory } from '../../../domain/enums/ticket-category.enum';
import { WorkspaceRole } from '../../../../workspace/domain/enums/workspace-role.enum';
import { TicketCreatedEvent } from '../../../../email/domain/events';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmTicketRepository } from '../../typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmAttachmentRepository } from '../../../../attachment/infrastructure/typeorm/repositories/typeorm-attachment.repository';
import { TypeOrmCustomFieldDefinitionRepository } from '../../../../custom-field/infrastructure/typeorm/repositories/typeorm-custom-field-definition.repository';
import { ValidateCustomFieldValues } from '../../../../custom-field/domain/services/custom-field-validate-values';
import { CreatePortalTicketRequest } from '../dto/create-portal-ticket.request';

@Public()
@Controller('portal')
export class PortalController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly attachmentRepository: TypeOrmAttachmentRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly eventPublisher: NestEventPublisher,
    @Inject() private readonly s3Storage: S3StorageService,
    @Inject() private readonly customFieldDefinitionRepository: TypeOrmCustomFieldDefinitionRepository,
  ) {}

  @Get(':slug')
  async getPortalInfo(@Param('slug') slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    return {
      name: workspace.name,
      slug: workspace.slug,
      palette: workspace.palette,
    };
  }

  @Get(':slug/custom-fields')
  async getCustomFields(@Param('slug') slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const definitions = await this.customFieldDefinitionRepository.findByWorkspaceId(workspace.getId());
    return definitions.map((def) => ({
      id: def.getId(),
      name: def.name,
      type: def.type,
      required: def.required,
      options: def.options,
    }));
  }

  @Post(':slug/tickets')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async createTicket(
    @Param('slug') slug: string,
    @Body() body: CreatePortalTicketRequest,
  ) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    // Validate custom fields
    const validateCustomFields = new ValidateCustomFieldValues(this.customFieldDefinitionRepository);
    const validatedCustomFields = await validateCustomFields.execute({
      workspaceId: workspace.getId(),
      customFields: body.customFields,
      isCreate: true,
    });

    // Find or create user
    let user = await this.userRepository.findByEmail(body.email);
    if (!user) {
      const createUser = new CreateUser(this.idGenerator, this.userRepository, this.passwordHasher);
      user = await createUser.execute({
        email: body.email,
        password: randomBytes(32).toString('hex'),
        firstName: body.name,
        lastName: '',
        isEmailVerified: false,
        autoCreated: true,
      });
    }

    // Ensure workspace membership
    const existingMember = await this.memberRepository.findByWorkspaceAndUser(
      workspace.getId(),
      user.getId(),
    );
    if (!existingMember) {
      const addMember = new AddWorkspaceMember(this.idGenerator, this.memberRepository);
      await addMember.execute({
        workspaceId: workspace.getId(),
        userId: user.getId(),
        role: WorkspaceRole.REPORTER,
      });
    }

    // Create ticket
    const createTicketService = new CreateTicket(this.idGenerator, this.ticketRepository);
    const ticket = await createTicketService.execute({
      name: body.subject,
      description: body.description,
      priority: TicketPriority.MEDIUM,
      category: TicketCategory.ISSUE,
      workspaceId: workspace.getId(),
      creatorId: user.getId(),
      tagIds: [],
      customFields: validatedCustomFields,
    });

    // Claim staged attachments
    if (body.uploadTokens?.length) {
      const claimAttachments = new ClaimStagedAttachments(this.attachmentRepository);
      await claimAttachments.execute({
        tokens: body.uploadTokens,
        ticketId: ticket.getId(),
      });
    }

    // Emit ticket created event
    const event: TicketCreatedEvent = {
      ticketId: ticket.getId(),
      ticketName: ticket.name,
      priority: ticket.priority,
      category: ticket.category,
      creatorId: user.getId(),
      creatorName: `${user.firstName} ${user.lastName}`.trim(),
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    };
    this.eventPublisher.emit('ticket.created', event);

    return {
      ticketNumber: ticket.ticketNumber,
      message: 'Ticket created',
    };
  }

  @Post(':slug/uploads')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file'))
  stageUpload(
    @Param('slug') slug: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StageUploadResponse> {
    const service = new StageAttachment(this.idGenerator, this.attachmentRepository, this.s3Storage);
    const command = new StageUploadCommand(service);
    return command.execute({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById: 'portal-anonymous',
    });
  }
}
