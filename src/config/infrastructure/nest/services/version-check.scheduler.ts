import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { VersionCheck } from '../../../domain/services/version-check';
import { NotifyVersionUpdate } from '../../../domain/services/version-notify';
import { DispatchNotifications } from '../../../../notification/domain/services/notification-dispatch';
import { TypeOrmUserRepository } from '../../../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmNotificationRepository } from '../../../../notification/infrastructure/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../../../notification/infrastructure/typeorm/repositories/typeorm-notification-preference.repository';
import { TypeOrmSystemNotificationSettingsRepository } from '../../typeorm/repositories/typeorm-system-notification-settings.repository';
import { SystemNotificationSettings } from '../../../domain/entities/system-notification-settings';
import { EmailService } from '../../../../email/domain/email.service';
import { EMAIL_SERVICE } from '../../../../email/email.constants';
import { UpgradeAvailableTemplate } from '../../../../email/templates/upgrade-available.template';
import { resolveBackendVersion } from '../resolve-backend-version';

const backendVersion: string = resolveBackendVersion();

function isNewer(latest: string, current: string): boolean {
  const [lMaj, lMin, lPat] = latest.split('.').map(Number);
  const [cMaj, cMin, cPat] = current.split('.').map(Number);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

@Injectable()
export class VersionCheckScheduler {
  private readonly logger = new Logger(VersionCheckScheduler.name);
  private versionCheck: VersionCheck;

  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly notificationRepository: TypeOrmNotificationRepository,
    @Inject() private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    @Inject() private readonly notificationSettingsRepository: TypeOrmSystemNotificationSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
  ) {
    this.versionCheck = new VersionCheck(backendVersion);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkForUpdates(): Promise<void> {
    try {
      const result = await this.versionCheck.execute();
      const latestProduct = result.latestRelease?.product;
      if (!latestProduct || !isNewer(latestProduct, backendVersion)) return;

      let settings = await this.notificationSettingsRepository.find();
      if (!settings) {
        settings = new SystemNotificationSettings({
          id: this.idGenerator.create(),
          upgradeEnabled: true,
          upgradeEmail: true,
          upgradeInApp: true,
          lastNotifiedVersion: null,
        });
      }

      const allUsers = await this.userRepository.findAll();
      const admins = allUsers.filter((u) => u.isSystemAdmin && u.isActive);

      const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
      const notify = new NotifyVersionUpdate(settings, admins, dispatch);
      const notifyResult = await notify.execute(latestProduct, result.latestRelease!.url);

      if (notifyResult?.dispatched) {
        settings.lastNotifiedVersion = notifyResult.lastNotifiedVersion;
        await this.notificationSettingsRepository.save(settings);

        if (settings.upgradeEmail) {
          const template = new UpgradeAvailableTemplate();
          for (const [lang, emails] of notifyResult.emailRecipients) {
            const data = { version: latestProduct, releaseUrl: result.latestRelease!.url, lang };
            await this.emailService.send({
              to: emails,
              subject: template.subject(data),
              html: template.html(data),
            }).catch((err) => this.logger.error(`Failed to send upgrade email: ${err.message}`));
          }
        }

        this.logger.log(`Upgrade notification dispatched for v${latestProduct}`);
      }
    } catch (err) {
      this.logger.error(`Version check failed: ${(err as Error).message}`);
    }
  }
}
