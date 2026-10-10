import { textToHtml } from '../../../src/shared/domain/text-to-html';

describe('textToHtml', () => {
  it('wraps a single line in a paragraph', () => {
    expect(textToHtml('Hello')).toBe('<p>Hello</p>');
  });

  it('turns blank lines into paragraphs and single line breaks into <br>', () => {
    expect(textToHtml('Hi team,\n\nThe printer is down.\nIt shows error 42.\n\nThanks'))
      .toBe('<p>Hi team,</p><p>The printer is down.<br>It shows error 42.</p><p>Thanks</p>');
  });

  it('handles Windows line endings and whitespace-only separator lines', () => {
    expect(textToHtml('One\r\nTwo\r\n  \r\nThree')).toBe('<p>One<br>Two</p><p>Three</p>');
  });

  it('escapes text that looks like markup instead of passing it through', () => {
    expect(textToHtml('From: John <john@example.com>\nUse <b> & "quotes"'))
      .toBe('<p>From: John &lt;john@example.com&gt;<br>Use &lt;b&gt; &amp; &quot;quotes&quot;</p>');
  });

  it('escapes script tags', () => {
    expect(textToHtml('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  it('returns an empty string for empty input', () => {
    expect(textToHtml('')).toBe('');
    expect(textToHtml('   \n  ')).toBe('');
    expect(textToHtml(null)).toBe('');
    expect(textToHtml(undefined)).toBe('');
  });
});
