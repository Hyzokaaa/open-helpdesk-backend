import { escapeHtml, sanitizeHtml } from '../../shared/domain/sanitize-html';

const MENTION_MARKUP = /@\[([^\]]+)\]\([^)]+\)/g;
/** Tags the editor writes; `<juan@x.com>` in a plain-text comment is not one. */
const EDITOR_TAG = /<\/?(p|br|ul|ol|li|strong|b|em|i|s|u|a|code|pre|blockquote|h[1-6]|span|div)(\s[^>]*)?\/?>/i;

/**
 * A comment as it goes in an email: the whole text with its formatting (paragraphs, lists,
 * bold, links), so whoever follows the ticket by email reads the full answer without opening it.
 *
 * Editor comments are HTML and go through the same sanitizer as when they are stored; older and
 * emailed ones may be plain text, which is escaped with its line breaks kept. Mentions read as
 * `@Name`.
 */
export function commentEmailBody(content: string): string {
  const isHtml = EDITOR_TAG.test(content);
  if (!isHtml) {
    return escapeHtml(content.replace(MENTION_MARKUP, '@$1')).replace(/\r?\n/g, '<br>');
  }
  const withMentions = content.replace(MENTION_MARKUP, (_m, name: string) => `@${escapeHtml(name)}`);
  return sanitizeHtml(withMentions);
}
