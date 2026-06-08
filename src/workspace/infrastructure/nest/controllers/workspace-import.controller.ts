import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { BcryptPasswordHasher } from '../../../../shared/infrastructure/bcrypt-password-hasher';
import { JwtTokenService } from '../../../../shared/infrastructure/jwt-token-service';
import { EmailService } from '../../../../email/domain/email.service';
import { EMAIL_SERVICE } from '../../../../email/email.constants';
import { EntityNotFoundError } from '../../../../shared/domain/errors';
import { EnsureWorkspacePermission } from '../../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../domain/permissions';
import { ParseImportCsv } from '../../../domain/services/workspace-import-members-parse';
import { ConfirmImportMembers } from '../../../domain/services/workspace-import-members-confirm';
import { ImportMembersPreviewCommand } from '../../../application/commands/import-members-preview.command';
import { ImportMembersConfirmCommand } from '../../../application/commands/import-members-confirm.command';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmWorkspaceMemberRepository } from '../../typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { importWelcomeEmail } from '../../../../email/templates/import-welcome.template';

@Controller('workspaces')
export class WorkspaceImportController {
  private readonly frontendUrl: string;

  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly passwordHasher: BcryptPasswordHasher,
    @Inject() private readonly tokenService: JwtTokenService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @Get(':slug/members/import/template')
  async downloadTemplate(
    @Param('slug') slug: string,
    @Res() res: Response,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    await ensurePermission.execute({
      workspaceId: workspace.getId(),
      userId: user.userId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
      isSystemAdmin: user.isSystemAdmin,
    });

    const csv = 'email,firstName,lastName,role\njohn@example.com,John,Doe,agent\njane@example.com,Jane,Smith,reporter\n';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="import-members-template.csv"');
    res.send(csv);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post(':slug/members/import/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1024 * 1024 } }))
  async preview(
    @Param('slug') slug: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);
    const workspaceId = workspace.getId();

    if (!file) {
      return { valid: [], errors: [{ row: 0, email: '', firstName: '', lastName: '', role: '', error: 'No file uploaded' }], summary: { toCreate: 0, errors: 1, alreadyMembers: 0 } };
    }

    const csv = file.buffer.toString('utf-8');
    const parseService = new ParseImportCsv(this.userRepository, this.memberRepository);
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const command = new ImportMembersPreviewCommand(parseService, ensurePermission);

    return command.execute({
      workspaceId,
      csv,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post(':slug/members/import/confirm')
  async confirm(
    @Param('slug') slug: string,
    @Body() body: { rows: Array<{ email: string; firstName: string; lastName: string; role: string }>; skipVerification?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    const workspace = await this.resolveWorkspace(slug);

    const confirmService = new ConfirmImportMembers(
      this.idGenerator,
      this.userRepository,
      this.memberRepository,
      this.passwordHasher,
    );
    const ensurePermission = new EnsureWorkspacePermission(this.memberRepository);
    const command = new ImportMembersConfirmCommand(confirmService, ensurePermission);

    const result = await command.execute({
      workspaceId: workspace.getId(),
      rows: body.rows as any,
      skipVerification: body.skipVerification ?? false,
      requestingUserId: user.userId,
      isSystemAdmin: user.isSystemAdmin,
    });

    for (const created of result.createdUsers) {
      const token = this.tokenService.sign(
        { sub: created.userId, type: 'password-reset' },
        { expiresIn: '24h' },
      );
      const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
      try {
        await this.emailService.send(importWelcomeEmail({
          to: created.email,
          firstName: created.firstName,
          workspaceName: workspace.name,
          resetUrl,
          lang: 'en',
        }));
      } catch {
        // Email failure should not fail the import
      }
    }

    return { created: result.created, added: result.added, skipped: result.skipped };
  }

  private async resolveWorkspace(slug: string) {
    const workspace = await this.workspaceRepository.findBySlug(slug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    return workspace;
  }
}
