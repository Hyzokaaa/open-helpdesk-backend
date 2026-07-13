export interface AiUsageRepository {
  increment(workspaceId: string, month: string): Promise<number>;
  getCount(workspaceId: string, month: string): Promise<number>;
}
