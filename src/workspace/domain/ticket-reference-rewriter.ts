import { TicketReferenceFormat } from '../../ticket/domain/ticket-reference';

/** Gives every ticket of a workspace the reference its number has in a format. */
export interface TicketReferenceRewriter {
  /** Returns how many tickets were rewritten, soft-deleted ones included. */
  rewriteAll(workspaceId: string, format: TicketReferenceFormat): Promise<number>;
}
