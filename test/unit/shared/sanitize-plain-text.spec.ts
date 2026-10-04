import { htmlToPlainText, sanitizePlainText } from '../../../src/shared/domain/sanitize-plain-text';

describe('sanitizePlainText', () => {
  it('leaves ordinary names alone', () => {
    expect(sanitizePlainText('María José')).toBe('María José');
    expect(sanitizePlainText("O'Brien-Smith")).toBe("O'Brien-Smith");
    expect(sanitizePlainText('李小龍')).toBe('李小龍');
  });

  it('strips HTML tags and their attributes', () => {
    expect(sanitizePlainText('<img src=x onerror=alert(1)>Eve')).toBe('Eve');
    expect(sanitizePlainText('<script>alert(1)</script>Eve')).toBe('alert(1)Eve');
    expect(sanitizePlainText('<b>Bold</b> name')).toBe('Bold name');
  });

  it('removes stray angle brackets so nothing can reopen a tag later', () => {
    expect(sanitizePlainText('Eve <')).toBe('Eve');
    expect(sanitizePlainText('a > b')).toBe('a b');
    expect(sanitizePlainText('Eve <img src=x onerror=alert(1)')).toBe('Eve');
  });

  it('removes control, zero-width and bidi characters', () => {
    const nul = String.fromCharCode(0);
    const zeroWidth = String.fromCodePoint(0x200b);
    const rtlOverride = String.fromCodePoint(0x202e);
    const bom = String.fromCodePoint(0xfeff);
    expect(sanitizePlainText(`Eve${nul}lyn`)).toBe('Eve lyn');
    expect(sanitizePlainText(`Eve${zeroWidth}lyn`)).toBe('Eve lyn');
    expect(sanitizePlainText(`${rtlOverride}nimda`)).toBe('nimda');
    expect(sanitizePlainText(`${bom}Eve`)).toBe('Eve');
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizePlainText('  Eve \t\n  Lyn  ')).toBe('Eve Lyn');
  });

  it('truncates to the given length', () => {
    expect(sanitizePlainText('a'.repeat(150), 100)).toHaveLength(100);
    expect(sanitizePlainText('Eve Lyn', 100)).toBe('Eve Lyn');
  });

  it('returns an empty string when nothing is left', () => {
    expect(sanitizePlainText('<script></script>')).toBe('');
    expect(sanitizePlainText('<>')).toBe('');
  });
});

describe('htmlToPlainText', () => {
  it('strips tags and keeps block boundaries as line breaks', () => {
    expect(htmlToPlainText('<p>Hello <strong>world</strong></p><p>Second</p>')).toBe('Hello world\nSecond');
    expect(htmlToPlainText('one<br>two<br/>three')).toBe('one\ntwo\nthree');
    expect(htmlToPlainText('<ul><li>a</li><li>b</li></ul>')).toBe('a\nb');
  });

  it('removes links, scripts and styles entirely, keeping only readable text', () => {
    const out = htmlToPlainText('<a href="https://evil.example" style="x">Verify</a><script>alert(1)</script><style>p{}</style>');
    expect(out).toBe('Verify');
  });

  it('decodes the basic entities after stripping, so encoded markup stays literal text', () => {
    expect(htmlToPlainText('a &amp; b &lt;b&gt; &quot;q&quot; &#39;s&#39;&nbsp;end')).toBe('a & b <b> "q" \'s\' end');
  });

  it('drops an unterminated tag at the end', () => {
    expect(htmlToPlainText('text <a href="https://evil.example"')).toBe('text');
  });

  it('collapses excessive blank lines and whitespace', () => {
    expect(htmlToPlainText('<p>a</p><p></p><p></p><p></p><p>b</p>')).toBe('a\n\nb');
    expect(htmlToPlainText('a    \t b')).toBe('a b');
  });

  it('truncates after stripping, so the cut never leaves a partial tag', () => {
    const long = '<p>' + 'x'.repeat(10) + '</p><a href="https://evil.example">' + 'y'.repeat(300) + '</a>';
    const out = htmlToPlainText(long, 200);
    expect(out.length).toBe(203);
    expect(out.endsWith('...')).toBe(true);
    expect(out).not.toContain('<');
    expect(out).not.toContain('evil');
  });

  it('does not truncate text within the limit', () => {
    expect(htmlToPlainText('<p>short</p>', 200)).toBe('short');
  });
});
