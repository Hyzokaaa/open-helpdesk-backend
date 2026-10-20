import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EntityNotFoundError } from '../../../src/shared/domain/errors';
import { PasswordRequiredError } from '../../../src/shared/domain/stored-password';
import { Mailbox } from '../../../src/mailbox/domain/entities/mailbox';
import { MailboxType } from '../../../src/mailbox/domain/enums/mailbox-type.enum';
import { UpdateMailbox } from '../../../src/mailbox/domain/services/mailbox-update';
import { UpdateMailboxRequest } from '../../../src/mailbox/infrastructure/nest/dto/update-mailbox.request';
import { MockMailboxRepository } from '../../mocks/mock-mailbox.repository';

const MINE = 'ws-1';
const THEIRS = 'ws-2';

function imapMailbox(id: string, workspaceId: string | null, imapPass: string): Mailbox {
  return new Mailbox({
    id,
    address: `${id}@example.com`,
    workspaceId,
    isActive: true,
    type: MailboxType.IMAP,
    imapHost: 'imap.example.com',
    imapPort: 993,
    imapUser: `${id}@example.com`,
    imapPass,
  });
}

describe('UpdateMailbox stays inside the caller\'s workspace', () => {
  let repository: MockMailboxRepository;
  let service: UpdateMailbox;

  beforeEach(() => {
    repository = new MockMailboxRepository();
    repository.seed(imapMailbox('own', MINE, 'own-secret'));
    repository.seed(imapMailbox('foreign', THEIRS, 'their-secret'));
    repository.seed(imapMailbox('platform', null, 'platform-secret'));
    service = new UpdateMailbox(repository);
  });

  it('does not redirect the IMAP credentials of a mailbox of another workspace', async () => {
    await expect(
      service.execute({ id: 'foreign', workspaceId: MINE, imapHost: 'attacker.example', imapPass: 'stolen' }),
    ).rejects.toThrow(EntityNotFoundError);

    const foreign = (await repository.findById('foreign'))!;
    expect(foreign.imapHost).toBe('imap.example.com');
    expect(foreign.imapPass).toBe('their-secret');
  });

  it('does not let a workspace edit the platform mailbox', async () => {
    await expect(
      service.execute({ id: 'platform', workspaceId: MINE, isActive: false }),
    ).rejects.toThrow(EntityNotFoundError);

    expect((await repository.findById('platform'))!.isActive).toBe(true);
  });

  it('does not let the platform scope edit a workspace mailbox', async () => {
    await expect(
      service.execute({ id: 'own', workspaceId: null, isActive: false }),
    ).rejects.toThrow(EntityNotFoundError);

    expect((await repository.findById('own'))!.isActive).toBe(true);
  });

  it('edits a mailbox of the caller\'s own workspace', async () => {
    const updated = await service.execute({
      id: 'own',
      workspaceId: MINE,
      imapPort: 143,
      postProcessAction: 'move',
      postProcessFolder: 'Processed',
    });

    expect(updated.imapPort).toBe(143);
    expect(updated.postProcessAction).toBe('move');
    expect(updated.postProcessFolder).toBe('Processed');
    expect(updated.imapPass).toBe('own-secret');
  });

  it('edits the platform mailbox from the platform scope', async () => {
    const updated = await service.execute({ id: 'platform', workspaceId: null, isActive: false });
    expect(updated.isActive).toBe(false);
  });
});

describe('UpdateMailboxRequest', () => {
  it('drops a smuggled id and workspaceId the way the global whitelist pipe does', async () => {
    const dto = plainToInstance(UpdateMailboxRequest, {
      id: 'foreign',
      workspaceId: THEIRS,
      imapPass: 'stolen',
    });

    const errors = await validate(dto, { whitelist: true });

    expect(errors).toEqual([]);
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('workspaceId');
    expect(dto.imapPass).toBe('stolen');
  });

  it('accepts null to clear a nullable field and rejects a non-numeric port', async () => {
    const ok = plainToInstance(UpdateMailboxRequest, { imapFolder: null, imapPort: 143 });
    expect(await validate(ok, { whitelist: true })).toEqual([]);

    const bad = plainToInstance(UpdateMailboxRequest, { imapPort: 'abc' });
    const errors = await validate(bad, { whitelist: true });
    expect(errors.map((e) => e.property)).toEqual(['imapPort']);
  });
});

describe('UpdateMailbox keeps the saved password with its own server', () => {
  let repository: MockMailboxRepository;
  let service: UpdateMailbox;

  beforeEach(() => {
    repository = new MockMailboxRepository();
    repository.seed(imapMailbox('own', MINE, 'own-secret'));
    service = new UpdateMailbox(repository);
  });

  it('refuses a new server without a new password, and changes nothing', async () => {
    await expect(service.execute({ id: 'own', workspaceId: MINE, imapHost: 'attacker.example' })).rejects.toThrow(PasswordRequiredError);
    expect((await repository.findById('own'))!.imapHost).toBe('imap.example.com');
  });

  it('refuses a new user without a new password', async () => {
    await expect(service.execute({ id: 'own', workspaceId: MINE, imapUser: 'someone@example.com' })).rejects.toThrow(PasswordRequiredError);
  });

  it('takes a new server with its new password', async () => {
    const mailbox = await service.execute({ id: 'own', workspaceId: MINE, imapHost: 'imap.other.example', imapPass: 'new-secret' });
    expect(mailbox.imapHost).toBe('imap.other.example');
    expect(mailbox.imapPass).toBe('new-secret');
  });

  it('keeps the saved password for other changes', async () => {
    const mailbox = await service.execute({ id: 'own', workspaceId: MINE, imapHost: 'imap.example.com', imapPort: 143, isActive: false });
    expect(mailbox.imapPass).toBe('own-secret');
    expect(mailbox.isActive).toBe(false);
  });
});
