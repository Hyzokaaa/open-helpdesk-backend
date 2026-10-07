import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Logger,
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
import { diskStorage } from "multer";
import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { JwtTokenService } from "../../../../shared/infrastructure/jwt-token-service";
import { WorkspaceFrontendResolver } from "../../../../shared/infrastructure/workspace-frontend-resolver";
import { EmailService } from "../../../../email/domain/email.service";
import { EMAIL_SERVICE } from "../../../../email/email.constants";
import { sendImportWelcomeEmails } from "../import-welcome-emails";
import { CurrentUser } from "../../../../shared/nest/decorators/current-user.decorator";
import { AuthUser } from "../../../../shared/nest/strategies/jwt.strategy";
import { UlidGenerator } from "../../../../shared/infrastructure/ulid-generator";
import { AccessDeniedError, DomainValidationError, EntityNotFoundError } from "../../../../shared/domain/errors";
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
import { RestoreWorkspace } from "../../../domain/services/workspace-restore";
import { RestoreWorkspaceCommand } from "../../../application/commands/restore-workspace.command";
import { PurgeWorkspace } from "../../../domain/services/workspace-purge";
import { PurgeWorkspaceCommand } from "../../../application/commands/purge-workspace.command";
import { EnsureWorkspaceOwner } from "../../../domain/services/workspace-ensure-owner";
import { UpdateTicketReferenceFormat } from "../../../domain/services/workspace-ticket-reference-update";
import { formatTicketReference, ticketReferenceFormatOf } from "../../../../ticket/domain/ticket-reference";
import { SqlWorkspaceFileKeys } from "../../typeorm/workspace-file-keys.sql";
import { SqlTicketReferenceRewriter } from "../../typeorm/ticket-reference-rewriter.sql";
import { ConvertTicketReferences } from "../../../domain/services/workspace-ticket-reference-convert";
import { Workspace } from "../../../domain/entities/workspace";
import { NestEventPublisher } from "../../../../shared/infrastructure/nest-event-publisher";
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
  ImportArchiveFiles,
  ImportPreview,
  ImportWorkspace,
  withCustomDomainConflict,
} from "../../../domain/services/workspace-import";
import { CURRENT_VERSION } from "../../../domain/services/workspace-export-transforms";
import {
  ExportSummary,
  exportSummaryOf,
  importFailureReason,
  importSourceOf,
  WorkspaceTransferAudit,
} from "../../../application/workspace-transfer-audit";
import { WorkspaceExportData } from "../../../domain/workspace-export";
import {
  createExportToken,
  validateExportToken,
} from "../../../domain/services/workspace-export-token";
import { Public } from "../../../../shared/nest/decorators/public.decorator";
import { ExportWorkspaceRequest } from "../dto/export-workspace.request";
import {
  downloadExportLink,
  exportLinkTimeoutFromEnv,
  forgetExportDownload,
  recallExportDownload,
  rememberExportDownload,
} from "../../export-link-download";
import {
  assertExportPassword,
  deriveExportKey,
  ExportKeyContext,
} from "../../export-file-codec";
import {
  createDecodeDirectory,
  decodeExportStream,
  DecodedExport,
  importLimitsFromEnv,
  removeDirectory,
  writeExportArchive,
} from "../../export-archive";
import { TypeOrmWorkspaceEmailSenderRepository } from "../../typeorm/repositories/typeorm-workspace-email-sender.repository";
import { WorkspaceEmailSender } from "../../../domain/entities/workspace-email-sender";
import * as nodemailer from "nodemailer";
import { TypeOrmTicketCategoryRepository } from "../../../../project/infrastructure/typeorm/repositories/typeorm-ticket-category.repository";
import { SeedDefaultCategories } from "../../../../project/domain/services/ticket-category-seed";
import { EnsureCanCreateWorkspace } from "../../../domain/services/workspace-ensure-can-create";
import { TypeOrmWorkspaceCreationSettingsRepository } from "../../typeorm/repositories/typeorm-workspace-creation-settings.repository";
import { workspaceCreationPolicy } from "../workspace-creation-policy";
import { imageUploadOptions, LOGO_IMAGE_MIMES } from "../../../../shared/infrastructure/nest/image-upload-options";
import { TypeOrmOrganizationRepository } from "../../../../organization/infrastructure/typeorm/repositories/typeorm-organization.repository";
import { OrganizationModel } from "../../../../organization/infrastructure/typeorm/models/organization.model";
import { TypeOrmWorkspaceTicketReferenceRepository } from "../../typeorm/repositories/typeorm-workspace-ticket-reference.repository";

const IMPORT_LIMITS = importLimitsFromEnv();

/**
 * Import uploads stream to a temp file (never whole into memory), capped at WORKSPACE_IMPORT_MAX_MB
 * while they arrive (413 past it). The handler always deletes the file.
 */
const IMPORT_UPLOAD_OPTIONS = {
  storage: diskStorage({
    destination: tmpdir(),
    filename: (_req, _file, callback) => callback(null, `ohd-upload-${randomBytes(12).toString("hex")}`),
  }),
  limits: { fileSize: IMPORT_LIMITS.maxTotalBytes, files: 1 },
};

/** A decoded import: the export JSON, plus the archive files written to a temp directory. */
interface ImportSource {
  data: WorkspaceExportData;
  source: "file" | "url" | "direct";
  decoded: DecodedExport | null;
}

@Controller("workspaces")
export class WorkspaceController {
  private readonly logger = new Logger(WorkspaceController.name);

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
    @Inject() private readonly eventPublisher: NestEventPublisher,
    @Inject() private readonly ticketReferenceRepository: TypeOrmWorkspaceTicketReferenceRepository,
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

  // ── Deleted workspaces (recoverable until purged) ──
  // Declared before ":slug" so that "deleted" is never taken for a workspace slug.

  /** The caller's own deleted workspaces; with scope=all, every one (system admins only). */
  @Get("deleted")
  async listDeleted(@Query("scope") scope: string | undefined, @CurrentUser() user: AuthUser) {
    let workspaces: Workspace[];
    if (scope === "all") {
      if (!user.isSystemAdmin) throw new AccessDeniedError("System admin required");
      workspaces = await this.workspaceRepository.findDeleted();
    } else {
      const account = await this.accountRepository.findByOwnerId(user.userId);
      workspaces = account ? await this.workspaceRepository.findDeleted(account.getId()) : [];
    }

    const userIds = [...new Set(workspaces.map((w) => w.deletedById).filter(Boolean))] as string[];
    const users = userIds.length > 0 ? await this.userRepository.findByIds(userIds) : [];
    const names = new Map(users.map((u) => [u.getId(), `${u.firstName} ${u.lastName}`.trim() || u.email]));
    return workspaces.map((w) => ({
      id: w.getId(),
      name: w.name,
      slug: w.slug,
      deletedAt: w.deletedAt,
      purgeAt: w.purgeAt,
      deletedBy: w.deletedById ? names.get(w.deletedById) ?? null : null,
    }));
  }

  @Post("deleted/:id/restore")
  async restoreDeleted(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const command = new RestoreWorkspaceCommand(
      new RestoreWorkspace(this.workspaceRepository, new EnsureWorkspaceOwner(this.accountRepository)),
      new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository),
      this.eventPublisher,
    );
    return command.execute({ workspaceId: id, userId: user.userId, isSystemAdmin: user.isSystemAdmin });
  }

  /** Erases a deleted workspace now instead of on its purge date (system admins only). */
  @Delete("deleted/:id")
  async purgeDeleted(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError("Only system administrators can erase a workspace before its purge date");
    const stats = await this.workspaceStats(id);
    const command = new PurgeWorkspaceCommand(
      new PurgeWorkspace(this.workspaceRepository, new SqlWorkspaceFileKeys(this.dataSource), this.storage),
      new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository),
    );
    return command.execute({ workspaceId: id, userId: user.userId, isSystemAdmin: true, stats });
  }

  /** A copy of a deleted workspace before it is purged (system admins only). */
  @Post("deleted/:id/export")
  @HttpCode(200)
  async exportDeleted(
    @Param("id") id: string,
    @Body() body: ExportWorkspaceRequest,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    if (!user.isSystemAdmin) throw new AccessDeniedError("System admin required");
    const workspace = await this.workspaceRepository.findDeletedById(id);
    if (!workspace) throw new EntityNotFoundError("Deleted workspace not found");
    assertExportPassword(body.password);
    const { summary, completed } = await this.streamExportFile(res, workspace.slug, id, await deriveExportKey(body.password), body.includeCredentials === true);
    await this.transferAudit().exported({ workspaceId: id, userId: user.userId, summary, completed });
  }

  @Get(":slug")
  async get(@Param("slug") slug: string, @CurrentUser() user: AuthUser) {
    const query = new GetWorkspaceQuery(
      this.workspaceRepository,
      new EnsureWorkspacePermission(this.memberRepository),
      this.mailboxRepository,
      this.accountRepository,
      this.ticketReferenceRepository,
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
    const current = await this.workspaceRepository.findById(workspaceId);
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
      previous: current ? { name: current.name, description: current.description } : undefined,
    });
  }

  /**
   * Deletes the workspace, recoverably: it is off until it is restored or, after the recovery
   * period, purged. Its owner or a system admin, typing its name to confirm.
   */
  @Delete(":slug")
  async remove(
    @Param("slug") slug: string,
    @Body() body: { confirmName?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    const service = new DeleteWorkspace(this.workspaceRepository, new EnsureWorkspaceOwner(this.accountRepository));
    const auditLog = new CreateAuditLogEntry(
      this.idGenerator,
      this.auditLogRepository,
    );
    const command = new DeleteWorkspaceCommand(service, auditLog, this.eventPublisher);
    return command.execute({
      workspaceId,
      isSystemAdmin: user.isSystemAdmin,
      userId: user.userId,
      confirmName: body?.confirmName ?? "",
      stats: await this.workspaceStats(workspaceId),
    });
  }

  /** The logo and icon are shown to customers on the portal and in emails. */
  private async auditBrandingImage(action: AuditAction, workspaceId: string, user: AuthUser, metadata: Record<string, unknown>): Promise<void> {
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action,
      entityType: "workspace",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata,
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: "ui",
    });
  }

  private async workspaceStats(workspaceId: string): Promise<{ memberCount: number; ticketCount: number }> {
    const [row] = await this.dataSource.query(
      `SELECT (SELECT COUNT(*) FROM workspace_members WHERE "workspaceId" = $1)::int AS "memberCount",
              (SELECT COUNT(*) FROM tickets WHERE "workspaceId" = $1 AND "deletedAt" IS NULL)::int AS "ticketCount"`,
      [workspaceId],
    );
    return { memberCount: row?.memberCount ?? 0, ticketCount: row?.ticketCount ?? 0 };
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
    const targetMember = await this.memberRepository.findByWorkspaceAndUser(workspaceId, userId);
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
      previousRole: targetMember?.role,
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

    // A contact is a global user: renaming it here renames it in every workspace it belongs to.
    const memberships = await this.memberRepository.findByUserId(userId);
    if (!memberships.some((m) => m.workspaceId === workspaceId))
      throw new EntityNotFoundError("User not found");

    const targetUser = await this.userRepository.findById(userId);
    if (!targetUser) throw new EntityNotFoundError("User not found");
    if (!targetUser.autoCreated)
      throw new BadRequestException("Only auto-created contacts can be edited");
    if (memberships.length > 1)
      throw new BadRequestException(
        "This contact also belongs to another workspace and cannot be renamed from here",
      );

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

    // OrganizationModule imports WorkspaceModule, so the repository is built here instead of injected.
    const organizationRepository = new TypeOrmOrganizationRepository(
      this.dataSource.getRepository(OrganizationModel),
    );
    let organizationName: string | null = null;
    if (body.organizationId) {
      const organization = await organizationRepository.findById(
        body.organizationId,
      );
      if (!organization || organization.workspaceId !== workspaceId)
        throw new EntityNotFoundError("Organization not found");
      organizationName = organization.name;
    }

    const previousOrganizationId = member.organizationId;
    member.organizationId = body.organizationId ?? null;
    await this.memberRepository.update(member);

    if (previousOrganizationId !== member.organizationId) {
      const previous = previousOrganizationId
        ? await organizationRepository.findById(previousOrganizationId)
        : null;
      const target = await this.userRepository.findById(userId);
      await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
        action: AuditAction.MEMBER_ORGANIZATION_CHANGED,
        entityType: "workspace-member",
        entityId: member.getId(),
        userId: user.userId,
        workspaceId,
        metadata: {
          target: target?.email ?? userId,
          before: { organizationId: previousOrganizationId },
          after: { organizationId: member.organizationId },
          beforeLabels: { organizationId: previous?.name ?? null },
          afterLabels: { organizationId: organizationName },
        },
        category: AuditCategory.WORKSPACE,
        level: AuditLevel.INFO,
        source: "ui",
      });
    }

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

  /**
   * How the workspace shows its ticket references: sequential (TK-000042) or random
   * (TK-7QX4M2K), and with which prefix. The response carries a sample so the change can be
   * seen before anyone looks for a ticket.
   */
  @Get(":slug/ticket-reference")
  async getTicketReference(@Param("slug") slug: string, @CurrentUser() user: AuthUser) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await new EnsureWorkspacePermission(this.memberRepository).execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const settings = await this.ticketReferenceRepository.findByWorkspaceId(workspaceId);
    return {
      style: settings?.style ?? "sequential",
      prefix: settings?.prefix ?? "TK",
      example: formatTicketReference(42, ticketReferenceFormatOf(settings)),
    };
  }

  @Patch(":slug/ticket-reference")
  async updateTicketReference(
    @Param("slug") slug: string,
    @Body() body: { style?: string; prefix?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await new EnsureWorkspacePermission(this.memberRepository).execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const { settings, before, after } = await new UpdateTicketReferenceFormat(this.ticketReferenceRepository)
      .execute({ workspaceId, style: body?.style, prefix: body?.prefix });

    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.WORKSPACE_TICKET_REFERENCE_UPDATED,
      entityType: "workspace",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { before, after },
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: "ui",
    });

    return {
      style: settings.style,
      prefix: settings.prefix,
      example: formatTicketReference(42, ticketReferenceFormatOf(settings)),
    };
  }

  /**
   * Gives every existing ticket a reference in the current format. A format change otherwise
   * only applies to new tickets; this one is on purpose, confirmed with the workspace's name,
   * since the old references stop finding their tickets.
   */
  @Post(":slug/ticket-reference/convert")
  async convertTicketReferences(
    @Param("slug") slug: string,
    @Body() body: { confirmName?: string },
    @CurrentUser() user: AuthUser,
  ) {
    const workspaceId = await this.resolveWorkspaceId(slug);
    await new EnsureWorkspacePermission(this.memberRepository).execute({
      workspaceId,
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });
    const { converted, format } = await new ConvertTicketReferences(
      this.workspaceRepository,
      this.ticketReferenceRepository,
      new SqlTicketReferenceRewriter(this.dataSource),
    ).execute({ workspaceId, confirmName: body?.confirmName ?? "" });

    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.WORKSPACE_TICKET_REFERENCES_CONVERTED,
      entityType: "workspace",
      entityId: workspaceId,
      userId: user.userId,
      workspaceId,
      metadata: { converted, style: format.style, prefix: format.prefix },
      category: AuditCategory.CONFIG,
      level: AuditLevel.WARNING,
      source: "ui",
    });

    return { converted };
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
    const previousPolicy = (await this.workspaceRepository.findById(workspaceId))?.slaPolicy ?? null;
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
      // What was stored, not the raw request body
      metadata: {
        before: { slaPolicy: previousPolicy },
        after: { slaPolicy: (await this.workspaceRepository.findById(workspaceId))?.slaPolicy ?? null },
      },
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
    const { summary, completed } = await this.streamExportFile(res, slug, workspaceId, await deriveExportKey(body.password), body.includeCredentials === true);
    await this.transferAudit().exported({ workspaceId, userId: user.userId, summary, completed });
  }

  private transferAudit(): WorkspaceTransferAudit {
    return new WorkspaceTransferAudit(new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository));
  }

  /**
   * Streams the .ohd file (format 2, with attachments and logos) as a download named after the
   * workspace and the day. Errors before the first byte go through the usual exception filter;
   * after it, the response can only be cut short, which the client sees as a failed download.
   * Returns what the file carried, and whether it was written to the end.
   */
  private async streamExportFile(
    res: Response,
    slug: string,
    workspaceId: string,
    context: ExportKeyContext,
    includeCredentials: boolean,
  ): Promise<{ summary: ExportSummary; completed: boolean }> {
    const bundle = await new ExportWorkspace(this.dataSource, this.storage).prepare(workspaceId, { includeCredentials });
    const summary = exportSummaryOf(bundle, includeCredentials);
    const files = bundle.files.map((file) => ({
      path: file.path,
      size: file.size,
      open: () => this.storage.getStream(file.storageKey),
    }));
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${slug}-${day}.ohd"`,
    );
    try {
      await writeExportArchive(res, bundle.data, files, context);
      return { summary, completed: true };
    } catch (error) {
      this.logger.error(`Export of workspace ${workspaceId} failed midway: ${(error as Error)?.message}`);
      res.destroy();
      return { summary, completed: false };
    }
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
    try {
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
      // The whole file is decoded (and so verified) to count its files; the temp copy is dropped
      const preview = await this.withImportSource(req, file, body, `${workspaceId}:${user.userId}`, async ({ data, decoded }) =>
        buildImportPreview(data, { files: decoded?.files.size ?? 0, bytes: decoded?.filesBytes ?? 0 }),
      );
      return await withCustomDomainConflict(this.dataSource, preview, workspaceId);
    } finally {
      await this.discardUpload(file);
    }
  }

  @Post(":slug/import")
  @UseInterceptors(FileInterceptor("file", IMPORT_UPLOAD_OPTIONS))
  async importWorkspace(
    @Param("slug") slug: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    // Comma list of target settings to overwrite: palette, sla, description, branding, name, emailSender, customDomain, analytics
    @Query("overwrite") overwrite?: string | string[],
    // "true" completes tickets the workspace already has, adding only what they lack
    @Query("completeExisting") completeExisting?: string,
  ) {
    try {
      return await this.runImport(slug, file, body, user, req, overwrite, completeExisting === "true");
    } finally {
      await this.discardUpload(file);
    }
  }

  private async runImport(
    slug: string,
    file: Express.Multer.File | undefined,
    body: any,
    user: AuthUser,
    req: Request,
    overwrite?: string | string[],
    completeExisting = false,
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

    // From here on every outcome is audited: completed, or failed with the reason the user is shown
    const startedAt = Date.now();
    const sourceInfo = importSourceOf(
      file?.originalname,
      body && typeof body === "object" && typeof body.url === "string" ? body.url.trim() : null,
    );
    let outcome: Awaited<ReturnType<WorkspaceController["executeImport"]>>;
    try {
      outcome = await this.executeImport(workspaceId, file, body, user, req, overwrite, completeExisting);
    } catch (error) {
      try {
        await this.transferAudit().importFailed({
          workspaceId,
          userId: user.userId,
          source: sourceInfo,
          reason: importFailureReason(error),
          durationMs: Date.now() - startedAt,
        });
      } catch (auditError) {
        this.logger.error(`Could not audit a failed import of workspace ${workspaceId}: ${(auditError as Error)?.message}`);
      }
      throw error;
    }
    const durationMs = Date.now() - startedAt;
    const { formatVersion, result, newMembers, overwriteKeys } = outcome;

    // The import is committed: what follows cannot make it a failed one
    const workspace = await this.workspaceRepository.findById(workspaceId);
    await sendImportWelcomeEmails(
      { tokenService: this.tokenService, emailService: this.emailService },
      newMembers,
      { name: workspace?.name ?? slug, frontendUrl: await this.frontendResolver.resolve(workspaceId) },
    );

    await this.transferAudit().importCompleted({
      workspaceId,
      userId: user.userId,
      source: sourceInfo,
      formatVersion,
      completeExisting,
      overwrite: overwriteKeys,
      result,
      durationMs,
    });

    return result;
  }

  /** Decodes the export and imports it in one transaction; nothing after the commit happens here. */
  private async executeImport(
    workspaceId: string,
    file: Express.Multer.File | undefined,
    body: any,
    user: AuthUser,
    req: Request,
    overwrite: string | string[] | undefined,
    completeExisting: boolean,
  ) {
    const downloadKey = `${workspaceId}:${user.userId}`;
    const overwriteKeys = [overwrite ?? []].flat()
      .flatMap((value) => String(value).split(","))
      .map((key) => key.trim())
      .filter(Boolean);
    // A custom domain carried by the file may not be the platform's own hostname, as when set by hand
    let primaryHost = "";
    try {
      primaryHost = new URL(this.config.get<string>("FRONTEND_URL", "")).hostname;
    } catch {}
    const service = new ImportWorkspace(this.dataSource, this.storage, (key, error) =>
      this.logger.warn(`Could not delete storage object ${key} after a workspace import: ${(error as Error)?.message}`),
    );
    // Nothing is written until the whole file has been decoded and verified into the temp directory
    const { formatVersion, result, newMembers } = await this.withImportSource(req, file, body, downloadKey, async ({ data, decoded }) => {
      // Read before the import upgrades the data to the current version
      const rawVersion = data && typeof data === "object" ? (data as { version?: unknown }).version : undefined;
      const formatVersion = typeof rawVersion === "string" ? rawVersion : null;
      const files: ImportArchiveFiles | undefined = decoded
        ? {
          size: (path) => decoded.files.get(path)?.size ?? null,
          open: (path) => {
            const entry = decoded.files.get(path);
            if (!entry) throw new Error(`Not in the archive: ${path}`);
            return createReadStream(entry.diskPath);
          },
        }
        : undefined;
      return {
        formatVersion,
        ...(await service.execute(workspaceId, data, {
          overwrite: overwriteKeys,
          files,
          completeExisting,
          primaryHost,
          importer: { userId: user.userId, isSystemAdmin: user.isSystemAdmin === true },
        })),
      };
    });
    forgetExportDownload(downloadKey);
    return { formatVersion, result, newMembers, overwriteKeys };
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
    const includeCredentials = body.includeCredentials === true;
    const { token, expiresAt } = createExportToken(
      workspaceId,
      await deriveExportKey(body.password),
      includeCredentials,
    );
    const baseUrl = process.env.API_URL || process.env.BACKEND_URL || "";

    await this.transferAudit().exportLinkCreated({
      workspaceId,
      userId: user.userId,
      formatVersion: CURRENT_VERSION,
      includeCredentials,
      expiresAt,
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
    @Req() req: Request,
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
    const { summary, completed } = await this.streamExportFile(res, slug, entry.workspaceId, entry.encryption, entry.includeCredentials);
    await this.transferAudit().exportLinkDownloaded({
      workspaceId: entry.workspaceId,
      summary,
      completed,
      expiresAt: entry.expiresAt,
      ip: req.ip ?? null,
    });
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
    // Where the workspace's mail goes out from, before the change; the password is never kept
    const senderBefore = existing
      ? { smtpHost: existing.smtpHost, smtpPort: existing.smtpPort, smtpUser: existing.smtpUser, smtpFrom: existing.smtpFrom, encryption: existing.encryption, fromName: existing.fromName, fromEmail: existing.fromEmail }
      : null;
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
      metadata: {
        smtpHost: body.smtpHost,
        smtpFrom: body.smtpFrom,
        before: senderBefore,
        after: { smtpHost: body.smtpHost, smtpPort: body.smtpPort, smtpUser: body.smtpUser, smtpFrom: body.smtpFrom, encryption: body.encryption ?? senderBefore?.encryption ?? null, fromName: body.fromName ?? senderBefore?.fromName ?? null, fromEmail: body.fromEmail ?? senderBefore?.fromEmail ?? null },
        passwordChanged: !!body.smtpPass,
      },
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
    const previousDomain = (await this.workspaceRepository.findById(workspaceId))?.customDomain ?? null;
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
      // The domain it replaced or removed, and whether a system admin skipped the DNS check
      metadata: {
        domain: body.domain,
        previousDomain,
        ...(!isRemoval && workspace.customDomainVerified ? { verifiedWithoutDns: true } : {}),
      },
      category: AuditCategory.WORKSPACE,
      level: !isRemoval && workspace.customDomainVerified ? AuditLevel.WARNING : AuditLevel.INFO,
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

    if (!result.verified) {
      await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
        action: AuditAction.WORKSPACE_CUSTOM_DOMAIN_VERIFICATION_FAILED,
        entityType: "workspace",
        entityId: workspaceId,
        userId: user.userId,
        workspaceId,
        metadata: {
          domain: (await this.workspaceRepository.findById(workspaceId))?.customDomain ?? null,
          dnsValid: result.dnsValid,
          txtValid: result.txtValid,
        },
        category: AuditCategory.WORKSPACE,
        level: AuditLevel.INFO,
        source: "ui",
      });
    }

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
    await this.auditBrandingImage(AuditAction.WORKSPACE_LOGO_UPDATED, workspace.getId(), user, { kind: "logo", mimeType: file.mimetype, size: file.size });

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
      await this.auditBrandingImage(AuditAction.WORKSPACE_LOGO_REMOVED, workspace.getId(), user, { kind: "logo" });
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
    await this.auditBrandingImage(AuditAction.WORKSPACE_LOGO_UPDATED, workspace.getId(), user, { kind: "icon", mimeType: file.mimetype, size: file.size });

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
      await this.auditBrandingImage(AuditAction.WORKSPACE_LOGO_REMOVED, workspace.getId(), user, { kind: "icon" });
    }

    return { icon: null };
  }

  /**
   * The export an import or preview reads: a multipart `file` or `url` (exactly one, with an
   * optional `password`), or, for JSON requests, the export object itself or `{ url, password? }`.
   * The file is decoded into a fresh temp directory, which is removed once `use` settles.
   */
  private async withImportSource<T>(
    req: Request,
    file: Express.Multer.File | undefined,
    body: any,
    cacheKey: string,
    use: (source: ImportSource) => Promise<T>,
  ): Promise<T> {
    const fields = body && typeof body === "object" ? body : {};
    const password = typeof fields.password === "string" ? fields.password : undefined;
    const url = typeof fields.url === "string" && fields.url.trim() ? fields.url.trim() : undefined;
    const multipart = req.is("multipart/form-data") === "multipart/form-data";

    if (multipart) {
      if (file && url) throw new DomainValidationError("Send either a file or a URL, not both");
      if (!file && !url) throw new DomainValidationError("Send an export file or a URL");
    }
    if (!file && !url) return use({ data: fields as WorkspaceExportData, source: "direct", decoded: null });

    const path = file ? file.path : await this.fetchExportFile(url!, cacheKey);
    const dir = await createDecodeDirectory();
    try {
      const decoded = await decodeExportStream(createReadStream(path), password, dir, IMPORT_LIMITS);
      return await use({ data: decoded.data as WorkspaceExportData, source: file ? "file" : "url", decoded });
    } finally {
      await removeDirectory(dir);
    }
  }

  /** Multer wrote the upload to a temp file; it is never kept past the request. */
  private async discardUpload(file: Express.Multer.File | undefined) {
    if (file?.path) await unlink(file.path).catch(() => undefined);
  }

  /** An export link downloaded to a temp file, reusing the one a preview already fetched (links are single use). */
  private async fetchExportFile(url: string, cacheKey: string): Promise<string> {
    const remembered = recallExportDownload(cacheKey, url);
    if (remembered) return remembered;
    const filePath = join(tmpdir(), `ohd-download-${randomBytes(12).toString("hex")}`);
    await downloadExportLink(url, filePath, {
      maxBytes: IMPORT_LIMITS.maxTotalBytes,
      timeoutMs: exportLinkTimeoutFromEnv(),
    });
    rememberExportDownload(cacheKey, url, filePath);
    return filePath;
  }

  private async resolveWorkspaceId(slug: string): Promise<string> {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError("Workspace not found");
    return workspace.getId();
  }
}
