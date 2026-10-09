import {
  DEFAULT_RETENTION_DAYS,
  effectiveRetention,
  normalizeInstallationRetention,
  normalizeWorkspaceRetention,
} from '../../../src/audit-log/domain/audit-retention';
import { AuditRetentionSettings } from '../../../src/audit-log/domain/entities/audit-retention-settings';
import { PruneAuditLog } from '../../../src/audit-log/domain/services/audit-log-prune';
import { UpdateAuditRetentionSettings } from '../../../src/audit-log/domain/services/audit-retention-update';
import { AuditRetentionSettingsRepository } from '../../../src/audit-log/domain/repositories/audit-retention-settings.repository';
import { AuditLogPruner } from '../../../src/audit-log/domain/audit-log-pruner';
import { DomainValidationError } from '../../../src/shared/domain/errors';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { WorkspaceAuditRetention } from '../../../src/audit-log/domain/entities/workspace-audit-retention';
import { WorkspaceAuditRetentionRepository } from '../../../src/audit-log/domain/repositories/workspace-audit-retention.repository';
import { UpdateWorkspaceAuditRetention } from '../../../src/audit-log/domain/services/workspace-audit-retention-update';
import { nextAuditRetentionRun } from '../../../src/audit-log/infrastructure/nest/audit-retention.scheduler';

class InMemorySettings implements AuditRetentionSettingsRepository {
  settings: AuditRetentionSettings | null = null;
  async find() { return this.settings; }
  async save(settings: AuditRetentionSettings) { this.settings = settings; }
}

describe('Audit retention', () => {
  describe('defaults', () => {
    it('keeps mail a month, access events a quarter, everything else a year', () => {
      expect(DEFAULT_RETENTION_DAYS.email).toBe(30);
      expect(DEFAULT_RETENTION_DAYS.security).toBe(90);
      expect(DEFAULT_RETENTION_DAYS.ticket).toBe(365);
      expect(DEFAULT_RETENTION_DAYS.billing).toBe(365);
    });

    it('starts off, so an upgraded installation loses nothing until an admin turns it on', () => {
      expect(new AuditRetentionSettings({ id: 's' }).enabled).toBe(false);
    });
  });

  describe('installation settings', () => {
    it('accepts days within bounds or forever, and keeps unchanged categories', () => {
      const days = normalizeInstallationRetention({ email: 14, billing: null });
      expect(days.email).toBe(14);
      expect(days.billing).toBeNull();
      expect(days.ticket).toBe(365);
    });

    it('refuses fewer than 7 days, more than ten years or a non-integer', () => {
      expect(() => normalizeInstallationRetention({ email: 3 })).toThrow(DomainValidationError);
      expect(() => normalizeInstallationRetention({ email: 4000 })).toThrow(DomainValidationError);
      expect(() => normalizeInstallationRetention({ email: 30.5 })).toThrow(DomainValidationError);
    });

    it('records the change as before and after', async () => {
      const repository = new InMemorySettings();
      const { before, after } = await new UpdateAuditRetentionSettings(repository, new FakeIdGenerator())
        .execute({ enabled: true, days: { security: 180 } });
      expect(before.enabled).toBe(false);
      expect(after).toMatchObject({ enabled: true, days: { security: 180 } });
      expect(repository.settings?.enabled).toBe(true);
    });
  });

  describe('workspace settings', () => {
    const installation = { ...DEFAULT_RETENTION_DAYS };

    it('lets a workspace keep a category longer or forever', () => {
      expect(normalizeWorkspaceRetention({ ticket: 800, config: null }, installation)).toEqual({ ticket: 800, config: null });
    });

    it('never lets a workspace keep less than the installation', () => {
      expect(() => normalizeWorkspaceRetention({ security: 30 }, installation)).toThrow(DomainValidationError);
    });

    it('ignores categories the installation already keeps forever', () => {
      const forever = { ...installation, billing: null };
      expect(normalizeWorkspaceRetention({ billing: 900 }, forever)).toEqual({});
    });

    it('keeps a value equal to the installation, so lowering the installation later does not shorten it', () => {
      const own = normalizeWorkspaceRetention({ ticket: 365 }, installation);
      expect(own).toEqual({ ticket: 365 });
      expect(effectiveRetention({ ...installation, ticket: 100 }, own).ticket).toBe(365);
    });

    it('merges a save into what the workspace had, leaving untouched categories as they were', async () => {
      const store: { saved: WorkspaceAuditRetention | null } = { saved: new WorkspaceAuditRetention({ workspaceId: 'w1', days: { ticket: 800 } }) };
      const repository: WorkspaceAuditRetentionRepository = {
        findByWorkspaceId: async () => store.saved,
        save: async (retention) => { store.saved = retention; },
      };
      const settings = new AuditRetentionSettings({ id: 's1' });
      const { retention } = await new UpdateWorkspaceAuditRetention(repository).execute({ workspaceId: 'w1', days: { email: 30 }, installation: settings });
      expect(retention.days).toEqual({ ticket: 800, email: 30 });
    });

    it('applies the longer of the two, and forever wins', () => {
      const effective = effectiveRetention({ ...installation, email: 60 }, { ticket: 800, config: null, email: 40 });
      expect(effective.ticket).toBe(800);
      expect(effective.config).toBeNull();
      expect(effective.email).toBe(60);
      expect(effective.security).toBe(90);
    });
  });

  describe('pruning', () => {
    const calls: { category: string; days: number }[] = [];
    const pruner: AuditLogPruner = {
      // Two full batches of "email", then a partial one; one partial batch elsewhere
      pruneBatch: async (category, days, _now, batchSize) => {
        calls.push({ category, days });
        if (category === 'email') return calls.filter((c) => c.category === 'email').length <= 2 ? batchSize : 7;
        return category === 'ticket' ? 3 : 0;
      },
    };

    beforeEach(() => calls.splice(0));

    it('does nothing while retention is off', async () => {
      const repository = new InMemorySettings();
      repository.settings = new AuditRetentionSettings({ id: 's', enabled: false });
      expect(await new PruneAuditLog(repository, pruner).execute()).toEqual({});
      expect(calls).toHaveLength(0);
    });

    it('works in batches per category and skips categories kept forever', async () => {
      const repository = new InMemorySettings();
      repository.settings = new AuditRetentionSettings({ id: 's', enabled: true, days: { billing: null } });

      const deleted = await new PruneAuditLog(repository, pruner).execute();

      expect(deleted).toEqual({ email: 5000 * 2 + 7, ticket: 3 });
      expect(calls.filter((c) => c.category === 'email')).toHaveLength(3);
      expect(calls.some((c) => c.category === 'billing')).toBe(false);
      expect(calls.find((c) => c.category === 'security')?.days).toBe(90);
    });
  });

  describe('schedule', () => {
    it('runs next at 02:00 server time, today if it is still before, otherwise tomorrow', () => {
      const before = nextAuditRetentionRun(new Date(2026, 9, 8, 1, 30));
      expect([before.getDate(), before.getHours(), before.getMinutes()]).toEqual([8, 2, 0]);
      const after = nextAuditRetentionRun(new Date(2026, 9, 8, 2, 0));
      expect([after.getDate(), after.getHours()]).toEqual([9, 2]);
    });
  });
});
