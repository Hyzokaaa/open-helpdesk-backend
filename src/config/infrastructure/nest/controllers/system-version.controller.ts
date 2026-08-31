import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { AccessDeniedError } from '../../../../shared/domain/errors';
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

const backendVersion: string = require('../../../../../package.json').version;

let instance: VersionCheck | null = null;

function isNewer(latest: string, current: string): boolean {
  const [lMaj, lMin, lPat] = latest.split('.').map(Number);
  const [cMaj, cMin, cPat] = current.split('.').map(Number);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

@Controller('admin')
export class SystemVersionController {
  private readonly logger = new Logger(SystemVersionController.name);

  constructor(
    @Inject() private readonly userRepository: TypeOrmUserRepository,
    @Inject() private readonly notificationRepository: TypeOrmNotificationRepository,
    @Inject() private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    @Inject() private readonly notificationSettingsRepository: TypeOrmSystemNotificationSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
  ) {}

  @Get('version')
  async getVersion(@CurrentUser() user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');

    if (!instance) {
      instance = new VersionCheck(backendVersion);
    }

    const result = await instance.execute();

    // Try to dispatch upgrade notifications (best-effort)
    try {
      const latestProduct = result.latestRelease?.product;
      if (latestProduct && isNewer(latestProduct, backendVersion)) {
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

          // Send emails
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
        }
      }
    } catch (err) {
      this.logger.error(`Upgrade notification failed: ${(err as Error).message}`);
    }

    return result;
  }
}
