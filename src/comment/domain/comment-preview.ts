import { htmlToPlainText } from '../../shared/domain/sanitize-plain-text';

/** The markup ExtractMentions reads: `@[Display Name](userId)`. */
const MENTION_MARKUP = /@\[([^\]]+)\]\([^)]+\)/g;

/** Longest preview kept in audit metadata. */
export const COMMENT_PREVIEW_LENGTH = 300;

/**
 * A short, readable plain-text preview of a comment for audit metadata: mentions read as
 * `@Name`, the HTML is reduced to text and the result is truncated. Raw HTML never reaches
 * the audit log.
 */
export function commentPreview(content: string, maxLength = COMMENT_PREVIEW_LENGTH): string {
  return htmlToPlainText(content.replace(MENTION_MARKUP, '@$1'), maxLength);
}
