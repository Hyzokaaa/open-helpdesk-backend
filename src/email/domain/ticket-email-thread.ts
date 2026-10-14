/**
 * Every email about a ticket belongs to one thread, rooted at `<ticket-ID@domain>`. Outgoing
 * emails point at that root; a reply carries the ids of the thread in its In-Reply-To and
 * References headers, which is how an emailed reply finds its ticket again.
 */

export function ticketThreadRoot(ticketId: string, domain: string): string {
  return `<ticket-${ticketId}@${domain}>`;
}

export interface ThreadHeaders {
  messageId: string;
  inReplyTo: string;
  references: string;
}

/** Headers of one email of a ticket's thread; `messageKey` makes its own Message-ID unique. */
export function ticketThreadHeaders(ticketId: string, domain: string, messageKey: string): ThreadHeaders {
  const root = ticketThreadRoot(ticketId, domain);
  return { messageId: `<${messageKey}@${domain}>`, inReplyTo: root, references: root };
}

export interface ThreadIds {
  ticketIds: string[];
  commentIds: string[];
}

const THREAD_ID = /<(ticket|comment)-([0-9A-Za-z]+)@[^>\s]+>/g;

/**
 * The ticket and comment ids found in the In-Reply-To and References of a reply, most recent
 * first: mail clients append to References, so the closest message comes last.
 */
export function extractThreadIds(...headerValues: (string | string[] | null | undefined)[]): ThreadIds {
  const ids: ThreadIds = { ticketIds: [], commentIds: [] };
  const values = headerValues.flat().filter((v): v is string => typeof v === 'string');
  for (const value of values) {
    const matches = [...value.matchAll(THREAD_ID)].reverse();
    for (const [, kind, id] of matches) {
      const list = kind === 'ticket' ? ids.ticketIds : ids.commentIds;
      if (!list.includes(id)) list.push(id);
    }
  }
  return ids;
}
