import { sanitizeHtml, sanitizeUrl } from '../../../src/shared/domain/sanitize-html';

const KB_OPTIONS = {
  extraTags: ['h2', 'h3', 'img'],
  extraAttrs: { img: ['src', 'alt'] },
  extraSelfClosing: ['img'],
};

describe('sanitizeHtml URL schemes', () => {
  describe('links', () => {
    it('keeps http, https, mailto and tel links', () => {
      expect(sanitizeHtml('<a href="https://example.com/x?y=1#z">x</a>')).toBe('<a href="https://example.com/x?y=1#z">x</a>');
      expect(sanitizeHtml('<a href="http://example.com">x</a>')).toBe('<a href="http://example.com">x</a>');
      expect(sanitizeHtml('<a href="mailto:a@b.co">x</a>')).toBe('<a href="mailto:a@b.co">x</a>');
      expect(sanitizeHtml('<a href="tel:+34600000000">x</a>')).toBe('<a href="tel:+34600000000">x</a>');
    });

    it('keeps relative links', () => {
      expect(sanitizeHtml('<a href="/tickets/1">x</a>')).toBe('<a href="/tickets/1">x</a>');
      expect(sanitizeHtml('<a href="#section">x</a>')).toBe('<a href="#section">x</a>');
      expect(sanitizeHtml('<a href="./doc">x</a>')).toBe('<a href="./doc">x</a>');
    });

    it('drops javascript: links but keeps the anchor text', () => {
      expect(sanitizeHtml('<a href="javascript:alert(1)">click</a>')).toBe('<a>click</a>');
    });

    it('drops javascript: regardless of case, whitespace and control characters', () => {
      expect(sanitizeHtml('<a href="JaVaScRiPt:alert(1)">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="  javascript:alert(1)">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="java\tscript:alert(1)">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="java\nscript:alert(1)">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="\u0001javascript:alert(1)">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="java' + String.fromCodePoint(0x200b) + 'script:alert(1)">x</a>')).toBe('<a>x</a>');
    });

    it('drops entity-encoded schemes', () => {
      expect(sanitizeHtml('<a href="java&#x73;cript:alert(1)">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="java&#115;cript:alert(1)">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="javascript&colon;alert(1)">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="java&amp;#x73;cript:alert(1)">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="java&Tab;script:alert(1)">x</a>')).toBe('<a>x</a>');
    });

    it('drops data: and vbscript: links', () => {
      expect(sanitizeHtml('<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="data:image/png;base64,iVBOR=">x</a>')).toBe('<a>x</a>');
      expect(sanitizeHtml('<a href="vbscript:msgbox(1)">x</a>')).toBe('<a>x</a>');
    });

    it('keeps the other attributes when the href is dropped', () => {
      expect(sanitizeHtml('<a href="javascript:x" target="_blank" rel="noopener">x</a>')).toBe('<a target="_blank" rel="noopener">x</a>');
    });

    it('re-escapes a kept URL so the output stays well-formed', () => {
      expect(sanitizeHtml('<a href="https://e.com/?a=1&amp;b=2">x</a>')).toBe('<a href="https://e.com/?a=1&amp;b=2">x</a>');
    });
  });

  describe('images', () => {
    it('keeps http(s) and relative image sources', () => {
      expect(sanitizeHtml('<img src="https://cdn.example.com/a.png" alt="a">', KB_OPTIONS)).toBe('<img src="https://cdn.example.com/a.png" alt="a" />');
      expect(sanitizeHtml('<img src="/storage/files/a.png">', KB_OPTIONS)).toBe('<img src="/storage/files/a.png" />');
    });

    it('keeps base64 raster images pasted by the knowledge-base editor', () => {
      const png = 'data:image/png;base64,iVBORw0KGgo=';
      expect(sanitizeHtml(`<img src="${png}">`, KB_OPTIONS)).toBe(`<img src="${png}" />`);
      const jpeg = 'data:image/jpeg;base64,/9j/4AAQ';
      expect(sanitizeHtml(`<img src="${jpeg}">`, KB_OPTIONS)).toBe(`<img src="${jpeg}" />`);
    });

    it('drops data: images that are not raster payloads', () => {
      expect(sanitizeHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=">', KB_OPTIONS)).toBe('<img />');
      expect(sanitizeHtml('<img src="data:text/html,hello">', KB_OPTIONS)).toBe('<img />');
    });

    it('drops javascript: and mailto: image sources', () => {
      expect(sanitizeHtml('<img src="javascript:alert(1)">', KB_OPTIONS)).toBe('<img />');
      expect(sanitizeHtml('<img src="mailto:a@b.co">', KB_OPTIONS)).toBe('<img />');
    });
  });

  describe('sanitizeUrl', () => {
    it('returns null for empty or control-only values', () => {
      expect(sanitizeUrl('', 'link')).toBeNull();
      expect(sanitizeUrl('\t\n', 'link')).toBeNull();
    });

    it('returns the decoded URL, which is what the browser would use', () => {
      expect(sanitizeUrl('https://e.com/?a=1&amp;b=2', 'link')).toBe('https://e.com/?a=1&b=2');
    });
  });
});
