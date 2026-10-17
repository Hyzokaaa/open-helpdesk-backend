import { parseDocument } from 'htmlparser2';
import { ChildNode as Node, Element, isTag, isText } from 'domhandler';
import { findOne, removeElement, textContent } from 'domutils';

/** How a mail client wraps the quote of the message being answered. */
interface QuoteContainer {
  matches: (el: Element) => boolean;
  /**
   * Header containers (Outlook) only open the quote: the quoted message follows as siblings.
   * Quote containers (Gmail, Thunderbird, Apple) hold it: text after them is the sender's own.
   */
  opensQuote: boolean;
}

const hasClass = (name: string) => (el: Element) => ` ${el.attribs.class ?? ''} `.includes(` ${name} `);
const style = (el: Element) => (el.attribs.style ?? '').toLowerCase().replace(/\s+/g, '');
const isGmailQuote = (el: Element) => hasClass('gmail_quote_container')(el) || hasClass('gmail_quote')(el);

const CONTAINERS: QuoteContainer[] = [
  // Gmail (web and apps): the attribution and the quote
  { matches: isGmailQuote, opensQuote: false },
  // Thunderbird: "On … wrote:" in moz-cite-prefix, then the quote
  { matches: hasClass('moz-cite-prefix'), opensQuote: true },
  // Yahoo and Proton
  { matches: (el) => hasClass('yahoo_quoted')(el) || hasClass('protonmail_quote')(el), opensQuote: false },
  // Zimbra and Exchange
  { matches: (el) => el.attribs['data-marker'] === '__QUOTED_TEXT__' || el.attribs.name === 'messageReplySection', opensQuote: true },
  // Outlook desktop and web: the header block of the answered message
  { matches: (el) => el.attribs.id === 'divRplyFwdMsg' || el.attribs.id === 'appendonsend', opensQuote: true },
  { matches: (el) => el.name === 'div' && /border-top:solid#(e1e1e1|b5c4df)/.test(style(el)), opensQuote: true },
  // Apple Mail, iOS and Thunderbird without the prefix
  { matches: (el) => el.name === 'blockquote' && el.attribs.type === 'cite', opensQuote: false },
];

const SKIPPED = new Set(['head', 'style', 'script', 'title', 'img']);
const PARAGRAPHS = new Set(['p', 'blockquote', 'ul', 'ol', 'table', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr']);
const LINES = new Set(['div', 'li', 'tr', 'section', 'article', 'header', 'footer']);

function write(nodes: Node[], out: string[]): void {
  for (const node of nodes) {
    if (isText(node)) {
      out.push(node.data.replace(/ /g, ' ').replace(/[ \t\r\n]+/g, ' '));
      continue;
    }
    if (!isTag(node) || SKIPPED.has(node.name)) continue;
    if (node.name === 'br') {
      out.push('\n');
      continue;
    }
    const block = PARAGRAPHS.has(node.name) ? '\n\n' : LINES.has(node.name) ? '\n' : '';
    out.push(block);
    if (node.name === 'li') out.push('- ');
    write(node.children, out);
    out.push(block);
  }
}

/** Text of HTML nodes as a ticket keeps it: paragraphs and line breaks, no markup. */
export function nodesToText(nodes: Node[]): string {
  const out: string[] = [];
  write(nodes, out);
  return out.join('')
    .split('\n').map((line) => line.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Text of an HTML email as a ticket keeps it. */
export function htmlToText(html: string): string {
  return nodesToText(parseDocument(html, { decodeEntities: true }).children);
}

const hasWords = (nodes: Node[]) => nodes.some((n) => textContent(n).replace(/ /g, ' ').trim() !== '');

/** A real quote names who wrote it or when. */
const NAMES_SENDER_OR_DATE = /@|\d{1,4}[:/.-]\d{1,2}|\d{4}/;

/**
 * What the sender wrote above the quote, by the HTML structure, or null when the structure says
 * nothing safe. The quote is the first known container and, for Outlook's header block, what
 * follows it. A quote container with the sender's words after it, or between its quoted parts
 * (an answer written inline), cuts nothing.
 */
export function cutHtmlQuote(html: string): { reply: string; quoted: string } | null {
  const document = parseDocument(html, { decodeEntities: true });
  let container: QuoteContainer | undefined;
  const found = findOne((el) => {
    container = CONTAINERS.find((c) => c.matches(el));
    return !!container;
  }, document.children, true);
  if (!found || !container) return null;

  // Everything after the container, at its level and up to the document
  const after: Node[] = [];
  for (let node: Node | null = found; node && node.parent; node = node.parent as Node | null) {
    for (let next = node.next; next; next = next.next) after.push(next);
  }
  if (!container.opensQuote && hasWords(after)) return null;

  // Gmail keeps an inline answer inside the container, between its blockquotes
  if (isGmailQuote(found)) {
    const own = found.children.filter((c) => !(isTag(c) && (c.name === 'blockquote' || c.name === 'br' || hasClass('gmail_attr')(c) || isGmailQuote(c))));
    if (hasWords(own)) return null;
  }

  const quotedNodes: Node[] = [found, ...after];
  const quoted = nodesToText(quotedNodes);
  if (!NAMES_SENDER_OR_DATE.test(quoted)) return null;

  for (const node of quotedNodes) removeElement(node);
  const reply = nodesToText(document.children);
  return reply ? { reply, quoted } : null;
}
