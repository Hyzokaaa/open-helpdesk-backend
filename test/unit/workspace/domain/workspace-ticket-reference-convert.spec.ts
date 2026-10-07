import { ConvertTicketReferences } from '../../../../src/workspace/domain/services/workspace-ticket-reference-convert';
import { TicketReferenceRewriter } from '../../../../src/workspace/domain/ticket-reference-rewriter';
import { Workspace } from '../../../../src/workspace/domain/entities/workspace';
import { WorkspaceTicketReference } from '../../../../src/workspace/domain/entities/workspace-ticket-reference';
import { WorkspaceTicketReferenceRepository } from '../../../../src/workspace/domain/repositories/workspace-ticket-reference.repository';
import { TicketReferenceFormat } from '../../../../src/ticket/domain/ticket-reference';
import { DomainValidationError, EntityNotFoundError } from '../../../../src/shared/domain/errors';
import { MockWorkspaceRepository } from '../../../mocks/mock-workspace.repository';

class InMemoryReferences implements WorkspaceTicketReferenceRepository {
  rows = new Map<string, WorkspaceTicketReference>();
  async findByWorkspaceId(workspaceId: string) { return this.rows.get(workspaceId) ?? null; }
  async save(reference: WorkspaceTicketReference) { this.rows.set(reference.workspaceId, reference); }
}

class RecordingRewriter implements TicketReferenceRewriter {
  calls: { workspaceId: string; format: TicketReferenceFormat }[] = [];
  async rewriteAll(workspaceId: string, format: TicketReferenceFormat) {
    this.calls.push({ workspaceId, format });
    return 7;
  }
}

describe('ConvertTicketReferences', () => {
  let workspaces: MockWorkspaceRepository;
  let references: InMemoryReferences;
  let rewriter: RecordingRewriter;
  let convert: ConvertTicketReferences;

  beforeEach(() => {
    workspaces = new MockWorkspaceRepository();
    workspaces.seed(new Workspace({ id: 'ws-1', name: 'Acme Support', slug: 'acme', description: '' }));
    references = new InMemoryReferences();
    rewriter = new RecordingRewriter();
    convert = new ConvertTicketReferences(workspaces, references, rewriter);
  });

  it('rewrites every ticket in the current format of the workspace', async () => {
    references.rows.set('ws-1', new WorkspaceTicketReference({ workspaceId: 'ws-1', style: 'random', prefix: 'ACME', secret: 'k' }));

    const result = await convert.execute({ workspaceId: 'ws-1', confirmName: '  acme   SUPPORT ' });

    expect(result.converted).toBe(7);
    expect(rewriter.calls).toEqual([{ workspaceId: 'ws-1', format: { style: 'random', prefix: 'ACME', secret: 'k' } }]);
  });

  it('uses the default format for a workspace that never changed it', async () => {
    await convert.execute({ workspaceId: 'ws-1', confirmName: 'Acme Support' });
    expect(rewriter.calls[0].format).toEqual({ style: 'sequential', prefix: 'TK', secret: null });
  });

  it('refuses without the workspace name, touching nothing', async () => {
    await expect(convert.execute({ workspaceId: 'ws-1', confirmName: 'Acme' })).rejects.toThrow(DomainValidationError);
    await expect(convert.execute({ workspaceId: 'ws-1', confirmName: '' })).rejects.toThrow(DomainValidationError);
    expect(rewriter.calls).toHaveLength(0);
  });

  it('fails for an unknown workspace', async () => {
    await expect(convert.execute({ workspaceId: 'nope', confirmName: 'x' })).rejects.toThrow(EntityNotFoundError);
  });
});
