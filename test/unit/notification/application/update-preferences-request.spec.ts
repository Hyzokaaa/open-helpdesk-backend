import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePreferencesRequest } from '../../../../src/notification/infrastructure/nest/dto/update-preferences.request';
import { UpdatePreferencesCommand } from '../../../../src/notification/application/commands/update-preferences.command';
import { UpdateNotificationPreference } from '../../../../src/notification/domain/services/notification-preference-update';
import { NotificationPreference } from '../../../../src/notification/domain/entities/notification-preference';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { MockNotificationPreferenceRepository } from '../../../mocks/mock-notification-preference.repository';

function preference(userId: string, emailEnabled: boolean): NotificationPreference {
  return new NotificationPreference({
    id: `pref-${userId}`, userId,
    emailEnabled, inAppEnabled: true,
    emailTicketCreated: true, emailTicketAssigned: true,
    emailStatusChanged: true, emailCommentCreated: true,
    emailCsatSurvey: true, emailTransferRequest: true,
    inAppTicketCreated: true, inAppTicketAssigned: true,
    inAppStatusChanged: true, inAppTicketUnassigned: true,
    inAppCommentCreated: true, inAppTransferRequest: true,
    emailUpgradeAvailable: true, inAppUpgradeAvailable: true,
    bellUnreadOnly: false,
  });
}

describe('PUT /notifications/preferences only edits the caller\'s preferences', () => {
  let repository: MockNotificationPreferenceRepository;

  beforeEach(() => {
    repository = new MockNotificationPreferenceRepository();
    repository.seed(preference('victim', true));
  });

  /** The controller's composition: the validated body, then the authenticated user last so it always wins. */
  async function updateAs(userId: string, rawBody: Record<string, unknown>) {
    const body = plainToInstance(UpdatePreferencesRequest, rawBody);
    const errors = await validate(body, { whitelist: true });
    expect(errors).toEqual([]);

    const service = new UpdateNotificationPreference(new FakeIdGenerator(), repository);
    return new UpdatePreferencesCommand(service).execute({ ...body, userId });
  }

  it('ignores a userId smuggled in the body', async () => {
    const body = plainToInstance(UpdatePreferencesRequest, { userId: 'victim', emailEnabled: false });
    await validate(body, { whitelist: true });
    expect(body).not.toHaveProperty('userId');

    await updateAs('attacker', { userId: 'victim', emailEnabled: false });

    expect((await repository.findByUserId('victim'))!.emailEnabled).toBe(true);
    expect((await repository.findByUserId('attacker'))!.emailEnabled).toBe(false);
  });

  it('rejects non-boolean flags', async () => {
    const body = plainToInstance(UpdatePreferencesRequest, { emailEnabled: 'yes' });
    const errors = await validate(body, { whitelist: true });
    expect(errors.map((e) => e.property)).toEqual(['emailEnabled']);
  });
});
