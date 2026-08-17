import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TypeOrmAttachmentRepository } from '../../typeorm/repositories/typeorm-attachment.repository';
import { StorageService } from '../../../../shared/domain/storage-service';
import { STORAGE_SERVICE } from '../../../../shared/shared.module';

const ONE_HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class StagedUploadCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StagedUploadCleanupService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly attachmentRepository: TypeOrmAttachmentRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    this.intervalRef = setInterval(() => this.cleanup(), ONE_HOUR_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async cleanup(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
    const expired = await this.attachmentRepository.findExpiredStaged(oneHourAgo);

    if (expired.length === 0) return;

    this.logger.log(`Cleaning up ${expired.length} expired staged upload(s)`);

    for (const attachment of expired) {
      try {
        await this.storage.delete(attachment.s3Key);
      } catch (error) {
        this.logger.warn(`Failed to delete S3 object ${attachment.s3Key}: ${error}`);
      }
    }

    await this.attachmentRepository.deleteMany(expired.map((a) => a.getId()));
    this.logger.log(`Deleted ${expired.length} expired staged upload(s)`);
  }
}
