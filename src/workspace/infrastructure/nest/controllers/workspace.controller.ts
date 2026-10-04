import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
import { DataSource } from "typeorm";
import { JwtTokenService } from "../../../../shared/infrastructure/jwt-token-service";
import { WorkspaceFrontendResolver } from "../../../../shared/infrastructure/workspace-frontend-resolver";
import { EmailService } from "../../../../email/domain/email.service";
import { EMAIL_SERVICE } from "../../../../email/email.constants";
import { sendImportWelcomeEmails } from "../import-welcome-emails";
import { CurrentUser } from "../../../../shared/nest/decorators/current-user.decorator";
import { AuthUser } from "../../../../shared/nest/strategies/jwt.strategy";
import { UlidGenerator } from "../../../../shared/infrastructure/ulid-generator";
import { DomainValidationError, EntityNotFoundError } from "../../../../shared/domain/errors";
import { slugify } from "../../../../shared/domain/slugify";
import { CreateWorkspace } from "../../../domain/services/workspace-create";
import { AddWorkspaceMember } from "../../../domain/services/workspace-add-member";
import { RemoveWorkspaceMember } from "../../../domain/services/workspace-remove-member";
import { EnsureWorkspacePermission } from "../../../domain/services/workspace-ensure-permission";
import { CreateWorkspaceCommand } from "../../../application/commands/create-workspace.command";
import { AddMemberCommand } from "../../../application/commands/add-member.command";
import { RemoveMemberCommand } from "../../../application/commands/remove-member.command";
import { ChangeWorkspaceMemberRole } from "../../../domain/services/workspace-change-member-role";
import { ChangeMemberRoleCommand } from "../../../application/commands/change-member-role.command";
import { UpdateWorkspace } from "../../../domain/services/workspace-update";
import { UpdateWorkspaceCommand } from "../../../application/commands/update-workspace.command";
import { UpdateWorkspacePalette } from "../../../domain/services/workspace-update-palette";
import { SetCustomDomain } from "../../../domain/services/workspace-set-custom-domain";
import { VerifyCustomDomain } from "../../../domain/services/workspace-verify-custom-domain";
import { SetBranding } from "../../../domain/services/workspace-set-branding";
import { SetBrandingCommand } from "../../../application/commands/set-branding.command";
import { StorageService } from "../../../../shared/domain/storage-service";
import { STORAGE_SERVICE } from "../../../../shared/shared.module";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};
import { UpdateWorkspacePaletteCommand } from "../../../application/commands/update-workspace-palette.command";
import { UpdateWorkspaceSlaPolicy } from "../../../domain/services/workspace-update-sla-policy";
import { UpdateSlaPolicyCommand } from "../../../application/commands/update-sla-policy.command";
import { PERMISSIONS } from "../../../domain/permissions";
import { DeleteWorkspace } from "../../../domain/services/workspace-delete";
import { DeleteWorkspaceCommand } from "../../../application/commands/delete-workspace.command";
import { GetWorkspaceQuery } from "../../../application/queries/get-workspace.query";
import { ListWorkspacesQuery } from "../../../application/queries/list-workspaces.query";
import { ListWorkspaceMembersQuery } from "../../../application/queries/list-workspace-members.query";
import { GetMyPermissionsQuery } from "../../../application/queries/get-my-permissions.query";
import { TypeOrmUserRepository } from "../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository";
import { TypeOrmWorkspaceRepository } from "../../typeorm/repositories/typeorm-workspace.repository";
import { TypeOrmWorkspaceMemberRepository } from "../../typeorm/repositories/typeorm-workspace-member.repository";
import { TypeOrmAccountRepository } from "../../../../account/infrastructure/typeorm/repositories/typeorm-account.repository";
import { TypeOrmAuditLogRepository } from "../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository";
import { TypeOrmMailboxRepository } from "../../../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository";
import { CreateAuditLogEntry } from "../../../../audit-log/domain/services/audit-log-create";
import { AuditAction } from "../../../../audit-log/domain/enums/audit-action.enum";
import { AuditCategory } from "../../../../audit-log/domain/enums/audit-category.enum";
import { AuditLevel } from "../../../../audit-log/domain/enums/audit-level.enum";
import { CreateMailbox } from "../../../../mailbox/domain/services/mailbox-create";
import { CreateWorkspaceRequest } from "../dto/create-workspace.request";
import { AddMemberRequest } from "../dto/add-member.request";
import { SortDto } from "../../../../shared/nest/dto/sort.dto";
import { ConfigService } from "@nestjs/config";
import { ExportWorkspace } from "../../../domain/services/workspace-export";
import {
  buildImportPreview,
  ImportPreview,
  ImportWorkspace,
} from "../../../domain/services/workspace-import";
import { WorkspaceExportData } from "../../../domain/workspace-export";
import {
  createExportToken,
  validateExportToken,
} from "../../../domain/services/workspace-export-token";
import { Public } from "../../../../shared/nest/decorators/public.decorator";
import { ExportWorkspaceRequest } from "../dto/export-workspace.request";
import {
  downloadExportLink,
  forgetExportDownload,
  recallExportDownload,
  rememberExportDownload,
} from "../../export-link-download";
import {
  assertExportPassword,
  decodeExport,
  deriveExportKey,
  encodeExport,
  encodeExportWithKey,
} from "../../export-file-codec";
import { TypeOrmWorkspaceEmailSenderRepository } from "../../typeorm/repositories/typeorm-workspace-email-sender.repository";
import { WorkspaceEmailSender } from "../../../domain/entities/workspace-email-sender";
import * as nodemailer from "nodemailer";
import { TypeOrmTicketCategoryRepository } from "../../../../project/infrastructure/typeorm/repositories/typeorm-ticket-category.repository";
import { SeedDefaultCategories } from "../../../../project/domain/services/ticket-category-seed";
import { EnsureCanCreateWorkspace } from "../../../domain/services/workspace-ensure-can-create";
import { TypeOrmWorkspaceCreationSettingsRepository } from "../../typeorm/repositories/typeorm-workspace-creation-settings.repository";
import { workspaceCreationPolicy } from "../workspace-creation-policy";
import { imageUploadOptions, LOGO_IMAGE_MIMES } from "../../../../shared/infrastructure/nest/image-upload-options";

/** Import uploads are held in memory (Multer's default storage), capped while they stream in. */
const IMPORT_UPLOAD_OPTIONS = { limits: { fileSize: 100 * 1024 * 1024, files: 1 } };

@Controller("workspaces")
export class WorkspaceController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject()
    private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly accountRepository: TypeOrmAccountRepository,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
    @Inject() private readonly mailboxRepository: TypeOrmMailboxRepository,
    @Inject() private readonly config: ConfigService,
    @Inject()
    private readonly emailSenderRepository: TypeOrmWorkspaceEmailSenderRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly dataSource: DataSource,
    @Inject() private readonly ticketCategoryRepository: TypeOrmTicketCategoryRepository,
    @Inject() private readonly creationSettingsRepository: TypeOrmWorkspaceCreationSettingsRepository,
    @Inject() private readonly tokenService: JwtTokenService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    @Inject() private readonly frontendResolver: WorkspaceFrontendResolver,
  ) {}

  @Post()
  async create(
    @Body() body: CreateWorkspaceRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const account = await this.accountRepository.findByOwnerId(user.userId);
    const createService = new CreateWorkspace(
      this.idGenerator,
      this.workspaceRepository,
    );
    const addMemberService = new AddWorkspaceMember(
      this.idGenerator,
      this.memberRepository,
    );
    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    const systemMailbox = await this.mailboxRepository.findSystemMailbox();
    const supportEmailDomain = systemMailbox
      ? systemMailbox.address.split("@")[1]
      : this.config.get<string>("SUPPORT_EMAIL_DOMAIN");
    const createMailbox = supportEmailDomain
      ? new CreateMailbox(this.idGenerator, this.mailboxRepository)
      : undefined;
    const seedCategories = new SeedDefaultCategories(
      this.idGenerator,
      this.ticketCategoryRepository,
    );
    const ensureCanCreate = new EnsureCanCreateWorkspace(
      workspaceCreationPolicy(this.creationSettingsRepository, this.config),
    );
    const command = new CreateWorkspaceCommand(
      createService,
      ensureCanCreate,
      addMemberService,
      auditLog,
      seedCategories,
      createMailbox,
    );
    return command.execute({
      name: body.name,
      description: body.description,
      creatorUserId: user.userId,
      creatorIsSystemAdmin: user.isSystemAdmin,
      accountId: account?.getId(),
      supportEmailDomain,
    });
  }

  @Get('check-slug')
  async checkSlug(@Query('name') name: string) {
    if (!name?.trim()) return { slug: '', available: false, suggestions: [] };

    const base = slugify(name.trim());
    if (!base) return { slug: '', available: false, suggestions: [] };

    const available = !(await this.workspaceRepository.existsBySlug(base));
    let suggestions: string[] = [];

    if (!available) {
      const candidates = [
        `${base}-team`, `${base}-hq`, `${base}-hub`,
        `${base}-1`, `${base}-2`, `${base}-3`,
      ];
      for (const candidate of candidates) {
        if (!(await this.workspaceRepository.existsBySlug(candidate))) {
          suggestions.push(candidate);
          if (suggestions.length >= 3) break;
        }
      }
    }

    return { slug: base, available, suggestions };
  }

  @Get()
  list(@Query() sort: SortDto, @CurrentUser() user: AuthUser) {
    const query = new ListWorkspacesQuery(
      this.memberRepository,
      this.workspaceRepository,
      this.accountRepository,
      this.userRepository,
    );
    return query.execute({
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      sort,
    });
  }

  @Get(":slug")
  async get(@Param("slug") slug: string, @CurrentUser() user: AuthUser) {
    const query = new GetWorkspaceQuery(
      this.workspaceRepository,
      new EnsureWorkspacePermission(this.memberRepository),
      this.mailboxRepository,
    );
    const result = await query.execute({
      slug,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
    return {
      ...result,
      logo: result.logo
        ? await this.storage.getPresignedUrl(result.logo)
        : null,
      icon: result.icon
        ? await this.storage.getPresignedUrl(result.icon)
        : null,
      cnameTarget: this.config.get<string>(
        "CUSTOM_DOMAIN_CNAME_TARGET",
        "proxy.example.com",
      ),
    };
  }

  @Patch(":slug")
  async update(
    @Param("slug") slug: string,
    @Body() body: { name?: string; description?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const service = new UpdateWorkspace(this.workspaceRepository);
    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    const command = new UpdateWorkspaceCommand(service, auditLog);
    return command.execute({
      workspaceId,
      name: body.name,
      description: body.description,
      isSystemAdmin: user.isSystemAdmin,
      userId: user.userId,
    });
  }

  @Delete(":slug")
  async remove(@Param("slug") slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const service = new DeleteWorkspace(this.workspaceRepository);
    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    const command = new DeleteWorkspaceCommand(service, auditLog);
    return command.execute({
      workspaceId,
      isSystemAdmin: user.isSystemAdmin,
      userId: user.userId,
    });
  }

  @Post(":slug/members")
  async addMember(
    @Param("slug") slug: string,
    @Body() body: AddMemberRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    const service = new AddWorkspaceMember(
      this.idGenerator,
      this.memberRepository,
    );
    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    const targetUser = await this.userRepository.findById(body.userId);
    const command = new AddMemberCommand(service, ensurePermission, auditLog);
    return command.execute({
      workspaceId,
      userId: body.userId,
      role: body.role,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      targetLabel: targetUser
        ? `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})`
        : body.userId,
    });
  }

  @Get(":slug/permissions")
  async myPermissions(
    @Param("slug") slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const query = new GetMyPermissionsQuery(this.memberRepository);
    return query.execute({
      workspaceId,
      userId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Get(":slug/members")
  async listMembers(
    @Param("slug") slug: string,
    @Query("autoCreated") autoCreated: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_VIEW,
      isSystemAdmin: user.isSystemAdmin,
    });
    const query = new ListWorkspaceMembersQuery(
      this.memberRepository,
      this.userRepository,
      this.storage,
    );
    return query.execute({
      workspaceId,
      autoCreated:
        autoCreated === "true"
          ? true
          : autoCreated === "false"
            ? false
            : undefined,
    });
  }

  @Patch(":slug/members/:userId/role")
  async changeMemberRole(
    @Param("slug") slug: string,
    @Param("userId") userId: string,
    @Body() body: { role: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const targetUser = await this.userRepository.findById(userId);
    const service = new ChangeWorkspaceMemberRole(this.memberRepository);
    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    const command = new ChangeMemberRoleCommand(service, auditLog);
    const result = await command.execute({
      workspaceId,
      targetUserId: userId,
      newRole: body.role as any,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      targetLabel: targetUser
        ? `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})`
        : userId,
    });

    if (targetUser?.autoCreated && body.role !== "user") {
      targetUser.autoCreated = false;
      await this.userRepository.update(targetUser);
    }

    return result;
  }

  @Patch(":slug/members/:userId/name")
  async updateContactName(
    @Param("slug") slug: string,
    @Param("userId") userId: string,
    @Body() body: { firstName: string; lastName: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);

    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const targetUser = await this.userRepository.findById(userId);
    if (!targetUser) throw new EntityNotFoundError("User not found");
    if (!targetUser.autoCreated)
      throw new BadRequestException("Only auto-created contacts can be edited");

    const before = {
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
    };
    targetUser.firstName = body.firstName.substring(0, 40);
    targetUser.lastName = body.lastName.substring(0, 40);
    await this.userRepository.update(targetUser);

    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    await auditLog.execute({
      action: AuditAction.USER_NAME_UPDATED,
      entityType: "user",
      entityId: userId,
      userId: user.userId,
      workspaceId,
      metadata: {
        before,
        after: {
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
        },
      },
      category: AuditCategory.USER,
      level: AuditLevel.INFO,
      source: "ui",
    });

    return { firstName: targetUser.firstName, lastName: targetUser.lastName };
  }

  @Patch(":slug/members/:userId/organization")
  async updateMemberOrganization(
    @Param("slug") slug: string,
    @Param("userId") userId: string,
    @Body() body: { organizationId: string | null },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const member = await this.memberRepository.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!member) throw new EntityNotFoundError("Member not found");

    member.organizationId = body.organizationId;
    await this.memberRepository.update(member);

    return { organizationId: member.organizationId };
  }

  @Delete(":slug/members/:userId")
  async removeMember(
    @Param("slug") slug: string,
    @Param("userId") userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    const service = new RemoveWorkspaceMember(this.memberRepository);
    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    const targetUser = await this.userRepository.findById(userId);
    const command = new RemoveMemberCommand(
      service,
      ensurePermission,
      auditLog,
    );
    return command.execute({
      workspaceId,
      userId,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
      targetLabel: targetUser
        ? `${targetUser.firstName} ${targetUser.lastName} (${targetUser.email})`
        : userId,
    });
  }

  @Patch(":slug/palette")
  async updatePalette(
    @Param("slug") slug: string,
    @Body() body: { palette: string | null },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const service = new UpdateWorkspacePalette(this.workspaceRepository);
    const command = new UpdateWorkspacePaletteCommand(service);
    const result = await command.execute({
      workspaceId,
      palette: body.palette,
    });

    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    await auditLog.execute({
      action: AuditAction.WORKSPACE_PALETTE_UPDATED,
      entityType: "workspace",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { palette: body.palette },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: "ui",
    });

    return result;
  }

  @Get(":slug/sla")
  async getSla(@Param("slug") slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const workspace = await this.workspaceRepository.findById(workspaceId);
    return { slaPolicy: workspace?.slaPolicy ?? null };
  }

  @Patch(":slug/sla")
  async updateSla(
    @Param("slug") slug: string,
    @Body() body: { slaPolicy: any },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const service = new UpdateWorkspaceSlaPolicy(this.workspaceRepository);
    const command = new UpdateSlaPolicyCommand(service);
    const result = await command.execute({
      workspaceId,
      slaPolicy: body.slaPolicy,
    });

    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    await auditLog.execute({
      action: AuditAction.WORKSPACE_SLA_UPDATED,
      entityType: "workspace",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { slaPolicy: body.slaPolicy },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: "ui",
    });

    return result;
  }

  @Patch(":slug/system-mailbox")
  async toggleSystemMailbox(
    @Param("slug") slug: string,
    @Body() body: { enabled: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) throw new EntityNotFoundError("Workspace not found");

    workspace.systemMailboxEnabled = body.enabled;
    await this.workspaceRepository.update(workspace);

    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    await auditLog.execute({
      action: AuditAction.WORKSPACE_SYSTEM_MAILBOX_TOGGLED,
      entityType: "workspace",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { systemMailboxEnabled: body.enabled },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: "ui",
    });

    return { systemMailboxEnabled: workspace.systemMailboxEnabled };
  }

  @Post(":slug/export")
  @HttpCode(200)
  async exportWorkspace(
    @Param("slug") slug: string,
    @Body() body: ExportWorkspaceRequest,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    assertExportPassword(body.password);
    const service = new ExportWorkspace(this.dataSource);
    const data = await service.execute(workspaceId);
    this.sendExportFile(res, slug, await encodeExport(data, body.password));
  }

  /** The .ohd file as a download, named after the workspace and the day it was made. */
  private sendExportFile(res: Response, slug: string, bytes: Buffer) {
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${slug}-${day}.ohd"`,
    );
    res.send(bytes);
  }

  @Post(":slug/import/preview")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", IMPORT_UPLOAD_OPTIONS))
  async previewImport(
    @Param("slug") slug: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ): Promise<ImportPreview> {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const { data } = await this.readImportSource(req, file, body, `${workspaceId}:${user.userId}`);
    return buildImportPreview(data);
  }

  @Post(":slug/import")
  @UseInterceptors(FileInterceptor("file", IMPORT_UPLOAD_OPTIONS))
  async importWorkspace(
    @Param("slug") slug: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    // Comma list of target settings to overwrite: palette, sla, description, branding
    @Query("overwrite") overwrite?: string | string[],
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const downloadKey = `${workspaceId}:${user.userId}`;
    const { data, source } = await this.readImportSource(req, file, body, downloadKey);

    const service = new ImportWorkspace(this.dataSource);
    const overwriteKeys = [overwrite ?? []].flat()
      .flatMap((value) => String(value).split(","))
      .map((key) => key.trim())
      .filter(Boolean);
    const { result, newMembers } = await service.execute(workspaceId, data, { overwrite: overwriteKeys });
    forgetExportDownload(downloadKey);

    const workspace = await this.workspaceRepository.findById(workspaceId);
    await sendImportWelcomeEmails(
      { tokenService: this.tokenService, emailService: this.emailService },
      newMembers,
      { name: workspace?.name ?? slug, frontendUrl: await this.frontendResolver.resolve(workspaceId) },
    );

    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    await auditLog.execute({
      action: AuditAction.WORKSPACE_IMPORT_STARTED,
      entityType: "workspace",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { source, imported: result },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: "ui",
    });

    return result;
  }

  @Post(":slug/export/token")
  async createExportTokenEndpoint(
    @Param("slug") slug: string,
    @Body() body: ExportWorkspaceRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    assertExportPassword(body.password);
    // Keep the derived key, not the password: the file is built and encrypted when it is downloaded
    const { token, expiresAt } = createExportToken(
      workspaceId,
      await deriveExportKey(body.password),
    );
    const baseUrl = process.env.API_URL || process.env.BACKEND_URL || "";

    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    await auditLog.execute({
      action: AuditAction.WORKSPACE_EXPORT_CREATED,
      entityType: "workspace",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: {},
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: "ui",
    });

    return {
      url: `${baseUrl}/workspaces/${slug}/export/${token}`,
      expiresAt,
    };
  }

  @Public()
  @Get(":slug/export/:token")
  async exportByToken(
    @Param("slug") slug: string,
    @Param("token") token: string,
    @Res() res: Response,
  ) {
    const entry = validateExportToken(token);
    if (!entry) {
      res.status(401).json({ message: "Invalid or expired export token" });
      return;
    }
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace || workspace.getId() !== entry.workspaceId) {
      res.status(404).json({ message: "Workspace not found" });
      return;
    }
    const service = new ExportWorkspace(this.dataSource);
    const data = await service.execute(entry.workspaceId);
    this.sendExportFile(res, slug, await encodeExportWithKey(data, entry.encryption));
  }

  @Get(":slug/email-sender")
  async getEmailSender(
    @Param("slug") slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const sender =
      await this.emailSenderRepository.findByWorkspaceId(workspaceId);
    if (!sender) return null;
    return {
      id: sender.getId(),
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      smtpUser: sender.smtpUser,
      hasPassword: true,
      smtpFrom: sender.smtpFrom,
      encryption: sender.encryption,
      fromName: sender.fromName,
      fromEmail: sender.fromEmail,
    };
  }

  @Post(":slug/email-sender")
  async createEmailSender(
    @Param("slug") slug: string,
    @Body()
    body: {
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
      smtpFrom: string;
      encryption?: string;
      fromName?: string | null;
      fromEmail?: string | null;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    let resultId: string;
    const existing =
      await this.emailSenderRepository.findByWorkspaceId(workspaceId);
    if (existing) {
      existing.smtpHost = body.smtpHost;
      existing.smtpPort = body.smtpPort;
      existing.smtpUser = body.smtpUser;
      if (body.smtpPass) existing.smtpPass = body.smtpPass;
      existing.smtpFrom = body.smtpFrom;
      if (body.encryption) existing.encryption = body.encryption;
      if (body.fromName !== undefined)
        existing.fromName = body.fromName || null;
      if (body.fromEmail !== undefined)
        existing.fromEmail = body.fromEmail || null;
      await this.emailSenderRepository.update(existing);
      resultId = existing.getId();
    } else {
      const sender = new WorkspaceEmailSender({
        id: this.idGenerator.create(),
        workspaceId,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpUser: body.smtpUser,
        smtpPass: body.smtpPass,
        smtpFrom: body.smtpFrom,
        encryption: body.encryption,
        fromName: body.fromName,
        fromEmail: body.fromEmail,
      });
      await this.emailSenderRepository.create(sender);
      resultId = sender.getId();
    }

    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    await auditLog.execute({
      action: AuditAction.EMAIL_SENDER_CONFIGURED,
      entityType: "email-sender",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { smtpHost: body.smtpHost, smtpFrom: body.smtpFrom },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: "ui",
    });

    return { id: resultId };
  }

  @Delete(":slug/email-sender")
  async deleteEmailSender(
    @Param("slug") slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const existing =
      await this.emailSenderRepository.findByWorkspaceId(workspaceId);
    await this.emailSenderRepository.delete(workspaceId);

    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    await auditLog.execute({
      action: AuditAction.EMAIL_SENDER_DELETED,
      entityType: "email-sender",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { smtpHost: existing?.smtpHost, smtpFrom: existing?.smtpFrom },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: "ui",
    });
  }

  @Post(":slug/email-sender/test")
  async testEmailSender(
    @Param("slug") slug: string,
    @Body()
    body: {
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
      encryption?: string;
    },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );

    try {
      const encryption = body.encryption ?? "tls";
      const tls =
        encryption === "tls-insecure"
          ? { rejectUnauthorized: false }
          : encryption === "none"
            ? { rejectUnauthorized: false }
            : { rejectUnauthorized: true };
      const transporter = nodemailer.createTransport({
        host: body.smtpHost,
        port: body.smtpPort,
        secure: body.smtpPort === 465,
        auth: { user: body.smtpUser, pass: body.smtpPass },
        tls,
        ...(encryption === "none" && { ignoreTLS: true }),
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      } as any);
      await transporter.verify();

      await auditLog.execute({
        action: AuditAction.EMAIL_SENDER_TEST_CONNECTION,
        entityType: "email-sender",
        entityId: workspaceId,
        userId: user.userId,
        workspaceId,
        metadata: { success: true, smtpHost: body.smtpHost },
        category: AuditCategory.CONFIG,
        level: AuditLevel.INFO,
        source: "ui",
      });

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";

      await auditLog.execute({
        action: AuditAction.EMAIL_SENDER_TEST_CONNECTION,
        entityType: "email-sender",
        entityId: workspaceId,
        userId: user.userId,
        workspaceId,
        metadata: { success: false, error: msg, smtpHost: body.smtpHost },
        category: AuditCategory.CONFIG,
        level: AuditLevel.WARNING,
        source: "ui",
      });

      return { success: false, error: msg };
    }
  }

  @Post(":slug/resolve-mail-server")
  async resolveMailServer(
    @Param("slug") slug: string,
    @Body() body: { domain: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    if (!body.domain) throw new BadRequestException("Domain is required");

    const dns = require("dns").promises;
    const result: {
      smtp?: { host: string; port: number };
      imap?: { host: string; port: number };
    } = {};

    // 1. Try SRV records (RFC 6186)
    try {
      const records = await dns.resolveSrv(`_submission._tcp.${body.domain}`);
      if (records.length > 0)
        result.smtp = { host: records[0].name, port: records[0].port };
    } catch {}

    try {
      const records = await dns.resolveSrv(`_imaps._tcp.${body.domain}`);
      if (records.length > 0)
        result.imap = { host: records[0].name, port: records[0].port };
    } catch {}

    if (!result.imap) {
      try {
        const records = await dns.resolveSrv(`_imap._tcp.${body.domain}`);
        if (records.length > 0)
          result.imap = { host: records[0].name, port: records[0].port };
      } catch {}
    }

    // 2. Fallback: try MX record (most reliable — almost every mail domain has one)
    if (!result.smtp || !result.imap) {
      try {
        const mxRecords = await dns.resolveMx(body.domain);
        if (mxRecords.length > 0) {
          const mxHost = mxRecords.sort(
            (a: any, b: any) => a.priority - b.priority,
          )[0].exchange;
          if (!result.smtp) result.smtp = { host: mxHost, port: 587 };
          if (!result.imap) result.imap = { host: mxHost, port: 993 };
        }
      } catch {}
    }

    // 3. Fallback: try common hostnames via DNS A/AAAA resolution
    const tryResolve = async (hostname: string): Promise<boolean> => {
      try {
        await dns.resolve(hostname);
        return true;
      } catch {
        return false;
      }
    };

    if (!result.smtp) {
      for (const prefix of ["mail", "smtp"]) {
        const candidate = `${prefix}.${body.domain}`;
        if (await tryResolve(candidate)) {
          result.smtp = { host: candidate, port: 587 };
          break;
        }
      }
    }

    if (!result.imap) {
      for (const prefix of ["mail", "imap"]) {
        const candidate = `${prefix}.${body.domain}`;
        if (await tryResolve(candidate)) {
          result.imap = { host: candidate, port: 993 };
          break;
        }
      }
    }
    return result;
  }

  @Patch(":slug/custom-domain")
  async setCustomDomain(
    @Param("slug") slug: string,
    @Body() body: { domain: string | null; autoVerify?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const frontendUrl = this.config.get<string>("FRONTEND_URL", "");
    let primaryHost = "";
    try {
      primaryHost = new URL(frontendUrl).hostname;
    } catch {}
    const service = new SetCustomDomain(this.workspaceRepository, primaryHost);
    const workspace = await service.execute({
      workspaceId,
      domain: body.domain,
      autoVerify: body.autoVerify,
      isSystemAdmin: user.isSystemAdmin,
    });

    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    const isRemoval = body.domain === null;
    await auditLog.execute({
      action: isRemoval
        ? AuditAction.WORKSPACE_CUSTOM_DOMAIN_REMOVED
        : AuditAction.WORKSPACE_CUSTOM_DOMAIN_SET,
      entityType: "workspace",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { domain: body.domain },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: "ui",
    });

    return {
      customDomain: workspace.customDomain,
      customDomainVerified: workspace.customDomainVerified,
      domainVerificationToken: workspace.domainVerificationToken,
      cnameTarget: this.config.get<string>(
        "CUSTOM_DOMAIN_CNAME_TARGET",
        "proxy.example.com",
      ),
    };
  }

  @Post(":slug/custom-domain/verify")
  async verifyCustomDomain(
    @Param("slug") slug: string,
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const cnameTarget = this.config.get<string>(
      "CUSTOM_DOMAIN_CNAME_TARGET",
      "proxy.example.com",
    );
    const service = new VerifyCustomDomain(
      this.workspaceRepository,
      cnameTarget,
    );
    const result = await service.execute({ workspaceId });

    if (result.verified) {
      const auditLog = new CreateAuditLogEntry(
        this.idGenerator,
        this.auditLogRepository,
      );
      await auditLog.execute({
        action: AuditAction.WORKSPACE_CUSTOM_DOMAIN_VERIFIED,
        entityType: "workspace",
        entityId: workspaceId,
        userId: user.userId,
        workspaceId,
        metadata: {
          domain: (await this.workspaceRepository.findById(workspaceId))
            ?.customDomain,
        },
        category: AuditCategory.WORKSPACE,
        level: AuditLevel.INFO,
        source: "ui",
      });
    }

    return result;
  }

  @Patch(":slug/branding")
  async setBranding(
    @Param("slug") slug: string,
    @Body() body: { appName?: string | null; appSubtitle?: string | null },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const service = new SetBranding(this.workspaceRepository);
    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    const command = new SetBrandingCommand(service, auditLog);
    return command.execute({
      workspaceId,
      userId: user.userId,
      appName: body.appName,
      appSubtitle: body.appSubtitle,
    });
  }

  @Post(":slug/branding/logo")
  @UseInterceptors(FileInterceptor("file", imageUploadOptions(1024 * 1024, LOGO_IMAGE_MIMES)))
  async uploadLogo(
    @Param("slug") slug: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    if (file.size > 1024 * 1024)
      throw new BadRequestException("Logo must be 1MB or less");

    const allowedMimes = [
      "image/png",
      "image/svg+xml",
      "image/jpeg",
      "image/webp",
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException("Logo must be PNG, SVG, JPEG, or WebP");
    }

    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const ext = MIME_TO_EXT[file.mimetype] ?? ".png";
    const key = `workspaces/${workspaceId}/logo${ext}`;

    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) throw new EntityNotFoundError("Workspace not found");

    if (workspace.logo && workspace.logo !== key) {
      await this.storage.delete(workspace.logo);
    }

    await this.storage.upload(file.buffer, key, file.mimetype);
    workspace.logo = key;
    await this.workspaceRepository.update(workspace);

    const logoUrl = await this.storage.getPresignedUrl(key);
    return { logo: logoUrl };
  }

  @Delete(":slug/branding/logo")
  async deleteLogo(@Param("slug") slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) throw new EntityNotFoundError("Workspace not found");

    if (workspace.logo) {
      await this.storage.delete(workspace.logo);
      workspace.logo = null;
      await this.workspaceRepository.update(workspace);
    }

    return { logo: null };
  }

  @Post(":slug/branding/icon")
  @UseInterceptors(FileInterceptor("file", imageUploadOptions(512 * 1024, LOGO_IMAGE_MIMES)))
  async uploadIcon(
    @Param("slug") slug: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    if (file.size > 512 * 1024)
      throw new BadRequestException("Icon must be 512KB or less");

    const allowedMimes = [
      "image/png",
      "image/svg+xml",
      "image/jpeg",
      "image/webp",
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException("Icon must be PNG, SVG, JPEG, or WebP");
    }

    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const ext = MIME_TO_EXT[file.mimetype] ?? ".png";
    const key = `workspaces/${workspaceId}/icon${ext}`;

    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) throw new EntityNotFoundError("Workspace not found");

    if (workspace.icon && workspace.icon !== key) {
      await this.storage.delete(workspace.icon);
    }

    await this.storage.upload(file.buffer, key, file.mimetype);
    workspace.icon = key;
    await this.workspaceRepository.update(workspace);

    const iconUrl = await this.storage.getPresignedUrl(key);
    return { icon: iconUrl };
  }

  @Delete(":slug/branding/icon")
  async deleteIcon(@Param("slug") slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const ensurePermission = new EnsureWorkspacePermission(
      this.memberRepository,
    );
    await ensurePermission.execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) throw new EntityNotFoundError("Workspace not found");

    if (workspace.icon) {
      await this.storage.delete(workspace.icon);
      workspace.icon = null;
      await this.workspaceRepository.update(workspace);
    }

    return { icon: null };
  }

  /**
   * The export an import or preview reads: a multipart `file` or `url` (exactly one, with an
   * optional `password`), or, for JSON requests, the export object itself or `{ url, password? }`.
   */
  private async readImportSource(
    req: Request,
    file: Express.Multer.File | undefined,
    body: any,
    cacheKey: string,
  ): Promise<{ data: WorkspaceExportData; source: "file" | "url" | "direct" }> {
    const fields = body && typeof body === "object" ? body : {};
    const password = typeof fields.password === "string" ? fields.password : undefined;
    const url = typeof fields.url === "string" && fields.url.trim() ? fields.url.trim() : undefined;
    const multipart = req.is("multipart/form-data") === "multipart/form-data";

    if (multipart) {
      if (file && url) throw new DomainValidationError("Send either a file or a URL, not both");
      if (!file && !url) throw new DomainValidationError("Send an export file or a URL");
    }
    if (file) {
      return { data: (await decodeExport(file.buffer, password)) as WorkspaceExportData, source: "file" };
    }
    if (url) {
      const bytes = await this.fetchExportBytes(url, cacheKey);
      return { data: (await decodeExport(bytes, password)) as WorkspaceExportData, source: "url" };
    }
    return { data: fields as WorkspaceExportData, source: "direct" };
  }

  /** An export link's bytes, reusing the ones a preview already downloaded (links are single use). */
  private async fetchExportBytes(url: string, cacheKey: string): Promise<Buffer> {
    const remembered = recallExportDownload(cacheKey, url);
    if (remembered) return remembered;
    const bytes = await downloadExportLink(url);
    rememberExportDownload(cacheKey, url, bytes);
    return bytes;
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError("Workspace not found");
    return workspace.getId();
  }
}
