import { CannedResponse } from '../entities/canned-response';

export interface CannedResponseRepository {
  create(cannedResponse: CannedResponse): Promise<void>;
  findById(id: string): Promise<CannedResponse | null>;
  findByWorkspaceId(workspaceId: string): Promise<CannedResponse[]>;
  update(cannedResponse: CannedResponse): Promise<void>;
  delete(id: string): Promise<void>;
}
