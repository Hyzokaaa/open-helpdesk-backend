import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { S3StorageService } from '../../../../shared/infrastructure/s3-storage.service';
import { AccessDeniedError, DomainValidationError } from '../../../../shared/domain/errors';
import { SystemBranding } from '../../../domain/entities/system-branding';
import { TypeOrmSystemBrandingRepository } from '../../typeorm/repositories/typeorm-system-branding.repository';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';

const APP_NAME_MAX_LENGTH = 50;
const APP_SUBTITLE_MAX_LENGTH = 30;
const HTML_REGEX = /<[^>]*>/;

@Controller('admin')
export class SystemBrandingController {
  constructor(
    @Inject() private readonly repository: TypeOrmSystemBrandingRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly s3Storage: S3StorageService,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  private ensureAdmin(user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');
  }

  private validateField(value: string | null | undefined, label: string, maxLength: number): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    if (trimmed === '') return null;
    if (trimmed.length > maxLength) throw new DomainValidationError(`${label} must be ${maxLength} characters or less`);
    if (HTML_REGEX.test(trimmed)) throw new DomainValidationError(`${label} must not contain HTML`);
    return trimmed;
  }

  @Get('branding')
  async get(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    const branding = await this.repository.find();
    return {
      appName: branding?.appName ?? null,
      appSubtitle: branding?.appSubtitle ?? null,
      logo: branding?.logo ? await this.s3Storage.getPresignedUrl(branding.logo) : null,
    };
  }

  @Patch('branding')
  async update(
    @Body() body: { appName?: string | null; appSubtitle?: string | null },
    @CurrentUser() user: AuthUser,
  ) {
    this.ensureAdmin(user);

    let branding = await this.repository.find();
    if (!branding) {
      branding = new SystemBranding({ id: this.idGenerator.create(), appName: null, appSubtitle: null, logo: null });
    }

    if (body.appName !== undefined) {
      branding.appName = this.validateField(body.appName, 'App name', APP_NAME_MAX_LENGTH);
    }
    if (body.appSubtitle !== undefined) {
      branding.appSubtitle = this.validateField(body.appSubtitle, 'Subtitle', APP_SUBTITLE_MAX_LENGTH);
    }

    await this.repository.save(branding);

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.SYSTEM_BRANDING_UPDATED,
      entityType: 'system',
      entityId: branding.id,
      userId: user.userId,
      workspaceId: null,
      metadata: { appName: branding.appName, appSubtitle: branding.appSubtitle },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return {
      appName: branding.appName,
      appSubtitle: branding.appSubtitle,
      logo: branding.logo ? await this.s3Storage.getPresignedUrl(branding.logo) : null,
    };
  }

  @Post('branding/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    this.ensureAdmin(user);
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > 1024 * 1024) throw new BadRequestException('Logo must be 1MB or less');

    const allowedMimes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Logo must be PNG, SVG, JPEG, or WebP');
    }

    let branding = await this.repository.find();
    if (!branding) {
      branding = new SystemBranding({ id: this.idGenerator.create(), appName: null, appSubtitle: null, logo: null });
    }

    const key = 'system/branding/logo';
    await this.s3Storage.upload(file.buffer, key, file.mimetype);
    branding.logo = key;
    await this.repository.save(branding);

    return { logo: await this.s3Storage.getPresignedUrl(key) };
  }

  @Delete('branding/logo')
  async deleteLogo(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);

    const branding = await this.repository.find();
    if (branding?.logo) {
      await this.s3Storage.delete(branding.logo);
      branding.logo = null;
      await this.repository.save(branding);
    }

    return { logo: null };
  }
}
