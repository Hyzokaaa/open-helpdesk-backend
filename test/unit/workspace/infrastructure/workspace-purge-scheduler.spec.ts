import { WorkspacePurgeScheduler } from '../../../../src/workspace/infrastructure/nest/services/workspace-purge.scheduler';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { AuditAction } from '../../../../src/audit-log/domain/enums/audit-action.enum';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';
import { MockAuditLogRepository } from '../../../mocks/mock-audit-log.repository';
import { FakeIdGenerator } from '../../../mocks/fake-id-generator';
import { FakeEventPublisher } from '../../../mocks/fake-event-publisher';
import { FakeS3Storage } from '../../../mocks/fake-s3-storage';

describe('WorkspacePurgeScheduler', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date('2026-10-07T04:00:00.000Z');
  let workspaces: MockWorkspaceRepository;
  let audit: MockAuditLogRepository;
  let events: FakeEventPublisher;
  let storage: FakeS3Storage;
  let scheduler: WorkspacePurgeScheduler;

  beforeEach(async () => {
    workspaces = new MockWorkspaceRepository();
    audit = new MockAuditLogRepository();
    events = new FakeEventPublisher();
    storage = new FakeS3Storage();
    // The only SQL it runs: the files of a workspace (none here) and its counts
    const dataSource = {
      query: async (sql: string) => (/COUNT/.test(sql) ? [{ memberCount: 2, ticketCount: 5 }] : [{ key: 'attachments/a1/file.pdf' }]),
    };
    scheduler = new WorkspacePurgeScheduler(
      workspaces as any, new FakeIdGenerator(), audit as any, events as any, storage, dataSource as any,
    );

    for (const id of ['due', 'soon', 'later', 'live']) {
      workspaces.seed(new Workspace({ id, name: id, slug: id, description: '', accountId: 'acc' }));
    }
    await workspaces.softDelete('due', 'owner', new Date(now.getTime() - day));
    await workspaces.softDelete('soon', 'owner', new Date(now.getTime() + 2 * day));
    await workspaces.softDelete('later', 'owner', new Date(now.getTime() + 20 * day));
  });

  it('purges what is due, with its files, and records it as done by the scheduler', async () => {
    await scheduler.run(now);

    expect(await workspaces.findDeletedById('due')).toBeNull();
    expect(await workspaces.findDeletedById('soon')).not.toBeNull();
    expect(await workspaces.findById('live')).not.toBeNull();
    expect(storage.deletedKeys).toEqual(['attachments/a1/file.pdf']);

    const purged = audit.entries.find((e) => e.action === AuditAction.WORKSPACE_PURGED);
    expect(purged?.userId).toBeNull();
    expect(purged?.metadata).toMatchObject({ trigger: 'scheduled', memberCount: 2, ticketCount: 5 });
  });

  it('reminds once, only for workspaces about to be purged', async () => {
    await scheduler.run(now);
    await scheduler.run(new Date(now.getTime() + 60 * 60 * 1000));

    const reminded = events.events.filter((e) => e.event === 'workspace.purge-reminder').map((e) => (e.data as { workspaceId: string }).workspaceId);
    // "due" is past its date: it is purged in the same run, a reminder would come too late
    expect(reminded).toEqual(['soon']);
  });
});
