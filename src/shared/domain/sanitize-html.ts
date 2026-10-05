import { INVISIBLE_CHARS_AND_SPACE } from './sanitize-plain-text';

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
  'code', 'pre', 'blockquote',
  'ul', 'ol', 'li',
  'a', 'span',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  span: new Set(['class', 'data-type', 'data-id', 'data-label']),
};

const SELF_CLOSING = new Set(['br']);

/** Attributes whose value is a URL and must pass the scheme check. */
const URL_ATTRS = new Set(['href', 'src']);

/** Schemes a link may point to. Anything else (javascript:, data:, vbscript:, ...) is dropped. */
const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

/** Schemes an image may load from. `data:` is allowed only for raster image payloads. */
const IMAGE_SCHEMES = new Set(['http', 'https']);
const DATA_IMAGE_URL = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]*$/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  colon: ':', sol: '/', tab: '\t', newline: '\n', nbsp: String.fromCharCode(0xa0),
};

interface SanitizeOptions {
  extraTags?: string[];
  extraAttrs?: Record<string, string[]>;
  extraSelfClosing?: string[];
}

/**
 * Sanitizes HTML content, allowing only safe tags and attributes.
 * Strips all tags not in the allowlist. Escapes content outside of tags.
 */
export function sanitizeHtml(input: string, options?: SanitizeOptions): string {
  // If input has no HTML tags, treat as plain text — escape it
  if (!/<[a-z][\s\S]*>/i.test(input)) {
    return escapeHtml(input);
  }

  const tags = options?.extraTags ? new Set([...ALLOWED_TAGS, ...options.extraTags]) : ALLOWED_TAGS;
  const attrs = options?.extraAttrs
    ? { ...ALLOWED_ATTRS, ...Object.fromEntries(Object.entries(options.extraAttrs).map(([k, v]) => [k, new Set([...(ALLOWED_ATTRS[k] ?? []), ...v])])) }
    : ALLOWED_ATTRS;
  const selfClosing = options?.extraSelfClosing ? new Set([...SELF_CLOSING, ...options.extraSelfClosing]) : SELF_CLOSING;

  let result = '';
  let i = 0;

  while (i < input.length) {
    if (input[i] === '<') {
      const tagEnd = input.indexOf('>', i);
      if (tagEnd === -1) {
        result += escapeHtml(input.substring(i));
        break;
      }

      const tagContent = input.substring(i + 1, tagEnd);
      const isClosing = tagContent.startsWith('/');
      const tagPart = isClosing ? tagContent.substring(1).trim() : tagContent.trim();
      const tagName = tagPart.split(/[\s/]/)[0].toLowerCase();

      if (tags.has(tagName)) {
        if (isClosing) {
          result += `</${tagName}>`;
        } else {
          const tagAttrs = extractAllowedAttrs(tagPart, tagName, attrs);
          const selfClose = selfClosing.has(tagName) ? ' /' : '';
          result += `<${tagName}${tagAttrs}${selfClose}>`;
        }
      }
      // else: strip the tag entirely

      i = tagEnd + 1;
    } else {
      const nextTag = input.indexOf('<', i);
      const text = nextTag === -1 ? input.substring(i) : input.substring(i, nextTag);
      result += text; // Content between tags is already in the HTML context
      i = nextTag === -1 ? input.length : nextTag;
    }
  }

  return result;
}

function extractAllowedAttrs(tagContent: string, tagName: string, attrsMap: Record<string, Set<string>>): string {
  const allowed = attrsMap[tagName];
  if (!allowed) return '';

  const attrs: string[] = [];
  const attrRegex = /([a-z-]+)\s*=\s*"([^"]*)"/gi;
  let match;

  while ((match = attrRegex.exec(tagContent)) !== null) {
    const [, rawName, rawValue] = match;
    const name = rawName.toLowerCase();
    if (!allowed.has(name)) continue;

    if (URL_ATTRS.has(name)) {
      const url = sanitizeUrl(rawValue, name === 'src' ? 'image' : 'link');
      if (url === null) continue; // unsafe scheme: drop the attribute, keep the tag
      attrs.push(` ${name}="${escapeAttr(url)}"`);
    } else {
      attrs.push(` ${name}="${escapeAttr(rawValue)}"`);
    }
  }

  return attrs.join('');
}

/**
 * Returns the URL a browser would actually resolve, or null when its scheme is not allowed.
 * Entities are decoded and control characters removed first, because browsers do the same before
 * reading the scheme: `java&#x73;cript:` and `java\tscript:` both run as `javascript:`.
 */
export function sanitizeUrl(value: string, kind: 'link' | 'image'): string | null {
  // Browsers ignore whitespace, control and zero-width characters while reading a URL, so they
  // must not be allowed to hide a scheme.
  const decoded = decodeEntities(value).replace(INVISIBLE_CHARS_AND_SPACE, '');

  if (decoded === '') return null;

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(decoded);
  if (!schemeMatch) {
    // Relative URL (/path, #anchor, ./x, ?query, plain path): resolves against our own origin
    return decoded;
  }

  const scheme = schemeMatch[1].toLowerCase();
  if (kind === 'link') {
    return LINK_SCHEMES.has(scheme) ? decoded : null;
  }
  if (IMAGE_SCHEMES.has(scheme)) return decoded;
  if (scheme === 'data' && DATA_IMAGE_URL.test(decoded)) return decoded;
  return null;
}

/** Decodes named and numeric HTML entities (repeatedly, as a browser effectively would). */
export function decodeEntities(input: string): string {
  // Decode repeatedly: `&amp;#106;` becomes `&#106;` and then `j`, which is what a browser ends up with
  let current = input;
  for (let pass = 0; pass < 3; pass++) {
    const next = current.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);?/gi, (whole, body: string) => {
      if (body[0] === '#') {
        const codePoint = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        if (!Number.isFinite(codePoint) || codePoint > 0x10ffff) return '';
        return String.fromCodePoint(codePoint);
      }
      const named = NAMED_ENTITIES[body.toLowerCase()];
      return named ?? whole;
    });
    if (next === current) break;
    current = next;
  }
  return current;
}

/** Escapes text for an HTML text node or a quoted attribute (& < > " '). */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Escapes a value for a double-quoted HTML attribute. */
export function escapeAttr(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
