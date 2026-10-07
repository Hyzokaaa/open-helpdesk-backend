import { UpdateTicketReferenceFormat } from '../../../../src/workspace/domain/services/workspace-ticket-reference-update';
import { WorkspaceTicketReference } from '../../../../src/workspace/domain/entities/workspace-ticket-reference';
import { WorkspaceTicketReferenceRepository } from '../../../../src/workspace/domain/repositories/workspace-ticket-reference.repository';
import { DomainValidationError } from '../../../../src/shared/domain/errors';

class InMemoryReferences implements WorkspaceTicketReferenceRepository {
  rows = new Map<string, WorkspaceTicketReference>();
  async findByWorkspaceId(workspaceId: string) { return this.rows.get(workspaceId) ?? null; }
  async save(reference: WorkspaceTicketReference) { this.rows.set(reference.workspaceId, reference); }
}

describe('UpdateTicketReferenceFormat', () => {
  let repository: InMemoryReferences;
  let update: UpdateTicketReferenceFormat;

  beforeEach(() => {
    repository = new InMemoryReferences();
    update = new UpdateTicketReferenceFormat(repository);
  });

  it('starts from the default format and records before and after', async () => {
    const { before, after } = await update.execute({ workspaceId: 'ws-1', prefix: 'acme' });
    expect(before).toEqual({ style: 'sequential', prefix: 'TK' });
    expect(after).toEqual({ style: 'sequential', prefix: 'ACME' });
    expect(repository.rows.get('ws-1')?.secret).toBeNull();
  });

  it('creates the key when random references are first turned on, and keeps it for good', async () => {
    await update.execute({ workspaceId: 'ws-1', style: 'random' });
    const secret = repository.rows.get('ws-1')?.secret;
    expect(secret).toMatch(/^[0-9a-f]{64}$/);

    await update.execute({ workspaceId: 'ws-1', style: 'sequential' });
    await update.execute({ workspaceId: 'ws-1', style: 'random' });
    expect(repository.rows.get('ws-1')?.secret).toBe(secret);
  });

  it('refuses an unknown style or an invalid prefix', async () => {
    await expect(update.execute({ workspaceId: 'ws-1', style: 'emoji' })).rejects.toThrow(DomainValidationError);
    await expect(update.execute({ workspaceId: 'ws-1', prefix: 'NOT VALID' })).rejects.toThrow(DomainValidationError);
  });
});
