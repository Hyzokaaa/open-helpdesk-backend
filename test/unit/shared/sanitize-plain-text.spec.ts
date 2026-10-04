import { sanitizePlainText } from '../../../src/shared/domain/sanitize-plain-text';

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
