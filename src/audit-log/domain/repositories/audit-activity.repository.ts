/** Reads when something last happened to a record, from its audit entries. */
export interface AuditActivityRepository {
  /**
   * When a person last did something to the entity: edited it, commented, attached a file,
   * followed it... Entries the system writes on its own (an SLA breach) do not count.
   * Null when nothing is left, for instance once retention removed the entries.
   */
  findLastActivityAt(workspaceId: string, entityType: string, entityId: string): Promise<Date | null>;
}
