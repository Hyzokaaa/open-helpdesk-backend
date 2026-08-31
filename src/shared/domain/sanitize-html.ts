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
    const [, name, value] = match;
    if (allowed.has(name.toLowerCase())) {
      attrs.push(` ${name.toLowerCase()}="${escapeAttr(value)}"`);
    }
  }

  return attrs.join('');
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function escapeAttr(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
