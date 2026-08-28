import { randomBytes, randomUUID } from 'crypto';
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
import { StorageService } from '../../../../shared/domain/storage-service';
import { STORAGE_SERVICE } from '../../../../shared/shared.module';
import { NestEventPublisher } from '../../../../shared/infrastructure/nest-event-publisher';
import { CreateUser } from '../../../../user/domain/services/user-create';
import { AddWorkspaceMember } from '../../../../workspace/domain/services/workspace-add-member';
import { CreateTicket } from '../../../domain/services/ticket-create';
import { CreateComment } from '../../../../comment/domain/services/comment-create';
import { ClaimStagedAttachments } from '../../../../attachment/domain/services/attachment-claim-staged';
import { StageAttachment } from '../../../../attachment/domain/services/attachment-stage';
import { StageUploadCommand, StageUploadResponse } from '../../.././../attachment/application/commands/stage-upload.command';
import { TicketPriority } from '../../../domain/enums/ticket-priority.enum';
import { TicketSource } from '../../../domain/enums/ticket-source.enum';
import { WorkspaceRole } from '../../../../workspace/domain/enums/workspace-role.enum';
import { TicketCreatedEvent } from '../../../../email/domain/events';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmTicketRepository } from '../../typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmCommentRepository } from '../../../../comment/infrastructure/typeorm/repositories/typeorm-comment.repository';
import { TypeOrmAttachmentRepository } from '../../../../attachment/infrastructure/typeorm/repositories/typeorm-attachment.repository';
import { TypeOrmCustomFieldDefinitionRepository } from '../../../../custom-field/infrastructure/typeorm/repositories/typeorm-custom-field-definition.repository';
import { ValidateCustomFieldValues } from '../../../../custom-field/domain/services/custom-field-validate-values';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { TypeOrmDepartmentRepository } from '../../../../department/infrastructure/typeorm/repositories/typeorm-department.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { CreatePortalTicketRequest } from '../dto/create-portal-ticket.request';
import { CreatePortalCommentRequest } from '../dto/create-portal-comment.request';
import { TypeOrmOrganizationRepository } from '../../../../organization/infrastructure/typeorm/repositories/typeorm-organization.repository';
import { TypeOrmTicketCategoryRepository } from '../../../../project/infrastructure/typeorm/repositories/typeorm-ticket-category.repository';
import { AutoEnrollOrganization } from '../../../../organization/domain/services/organization-auto-enroll';

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
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    @Inject() private readonly customFieldDefinitionRepository: TypeOrmCustomFieldDefinitionRepository,
    @Inject() private readonly commentRepository: TypeOrmCommentRepository,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly departmentRepository: TypeOrmDepartmentRepository,
    @Inject() private readonly organizationRepository: TypeOrmOrganizationRepository,
    @Inject() private readonly ticketCategoryRepository: TypeOrmTicketCategoryRepository,
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

  @Get(':slug/departments')
  async getDepartments(@Param('slug') slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    const departments = await this.departmentRepository.findByWorkspaceId(workspace.getId());
    return departments.map((d) => ({
      id: d.getId(),
      name: d.name,
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

    // Auto-enroll organization by reporter email domain
    const autoEnroll = new AutoEnrollOrganization(this.organizationRepository);
    const { organizationId } = await autoEnroll.execute(body.email, workspace.getId());

    if (organizationId) {
      const member = await this.memberRepository.findByWorkspaceAndUser(workspace.getId(), user.getId());
      if (member && !member.organizationId) {
        member.organizationId = organizationId;
        await this.memberRepository.update(member);
      }
    }

    // Create ticket
    const portalToken = randomUUID();
    const defaultCategory = await this.ticketCategoryRepository.findBySlugAndWorkspace('issue', workspace.getId());
    const allCategories = defaultCategory ? null : await this.ticketCategoryRepository.findByWorkspaceId(workspace.getId());
    const categoryId = defaultCategory?.getId() ?? allCategories?.[0]?.getId() ?? '';
    const createTicketService = new CreateTicket(this.idGenerator, this.ticketRepository);
    const ticket = await createTicketService.execute({
      name: body.subject,
      description: body.description,
      priority: TicketPriority.MEDIUM,
      categoryId,
      workspaceId: workspace.getId(),
      reporterId: user.getId(),
      tagIds: [],
      customFields: validatedCustomFields,
      departmentId: body.departmentId ?? null,
      organizationId,
      source: TicketSource.PORTAL,
      portalToken,
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
      categoryId: ticket.categoryId,
      reporterId: user.getId(),
      reporterName: `${user.firstName} ${user.lastName}`.trim(),
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      portalToken,
      source: 'portal',
    };
    this.eventPublisher.emit('ticket.created', event);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.PORTAL_TICKET_CREATED,
      entityType: 'ticket',
      entityId: ticket.getId(),
      userId: user.getId(),
      workspaceId: workspace.getId(),
      metadata: { ticketNumber: ticket.ticketNumber, email: body.email },
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'portal',
    });

    return {
      ticketNumber: ticket.ticketNumber,
      portalToken: ticket.portalToken,
      message: 'Ticket created',
    };
  }

  @Get('tickets/:portalToken')
  async getPortalTicket(@Param('portalToken') portalToken: string) {
    const ticket = await this.ticketRepository.findByPortalToken(portalToken);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    const creator = await this.userRepository.findById(ticket.reporterId);
    const workspace = await this.workspaceRepository.findById(ticket.workspaceId);

    // Fetch comments with author names and dates
    const comments = await this.commentRepository.findByTicketIdWithDates(ticket.getId());
    const authorIds = [...new Set(comments.map((c) => c.authorId))];
    const authors = new Map<string, string>();
    for (const authorId of authorIds) {
      const user = await this.userRepository.findById(authorId);
      if (user) {
        authors.set(authorId, `${user.firstName} ${user.lastName}`.trim());
      }
    }

    // Fetch attachments with presigned URLs
    const attachments = await this.attachmentRepository.findByTicketId(ticket.getId());
    const attachmentList = await Promise.all(
      attachments.map(async (a) => ({
        id: a.getId(),
        originalName: a.originalName,
        mimeType: a.mimeType,
        size: a.size,
        downloadUrl: await this.storage.getPresignedUrl(a.s3Key),
      })),
    );

    const category = ticket.categoryId
      ? await this.ticketCategoryRepository.findById(ticket.categoryId)
      : null;

    return {
      ticketNumber: ticket.ticketNumber,
      name: ticket.name,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      categoryName: category?.name ?? null,
      customFields: ticket.customFields,
      createdAt: ticket.createdAt,
      reporterName: creator ? `${creator.firstName} ${creator.lastName}`.trim() : '',
      workspaceName: workspace?.name ?? '',
      workspacePalette: workspace?.palette ?? null,
      attachments: attachmentList,
      comments: comments.map((c) => ({
        id: c.id,
        content: c.content,
        authorName: authors.get(c.authorId) ?? '',
        isReporter: c.authorId === ticket.reporterId,
        createdAt: c.createdAt,
      })),
    };
  }

  @Post('tickets/:portalToken/comments')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async addPortalComment(
    @Param('portalToken') portalToken: string,
    @Body() body: CreatePortalCommentRequest,
  ) {
    const ticket = await this.ticketRepository.findByPortalToken(portalToken);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    const createComment = new CreateComment(this.idGenerator, this.commentRepository);
    const comment = await createComment.execute({
      content: body.content,
      ticketId: ticket.getId(),
      authorId: ticket.reporterId,
    });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.PORTAL_COMMENT_CREATED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'portal',
      entityType: 'comment',
      entityId: comment.getId(),
      userId: ticket.reporterId,
      workspaceId: ticket.workspaceId,
      metadata: { ticketId: ticket.getId() },
    });

    return { message: 'Comment added' };
  }

  @Post(':slug/uploads')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file'))
  stageUpload(
    @Param('slug') slug: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StageUploadResponse> {
    const service = new StageAttachment(this.idGenerator, this.attachmentRepository, this.storage);
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
