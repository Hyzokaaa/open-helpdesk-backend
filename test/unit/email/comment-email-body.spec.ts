import { commentEmailBody } from '../../../src/email/domain/comment-email-body';

describe('commentEmailBody', () => {
  it('keeps the whole comment with its formatting', () => {
    const long = '<p>Hola <strong>Carla</strong>,</p><ul><li>Servidor: imap.x.com</li></ul><p>' + 'a'.repeat(400) + ' FIN</p>';
    const html = commentEmailBody(long);
    expect(html).toContain('<strong>Carla</strong>');
    expect(html).toContain('<li>Servidor: imap.x.com</li>');
    expect(html).toContain('FIN');
  });

  it('drops anything the sanitizer does not allow', () => {
    const html = commentEmailBody('<p>Hola</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">x</a>');
    expect(html).not.toMatch(/script|onerror|javascript:/i);
    expect(html).toContain('<p>Hola</p>');
  });

  it('reads mentions as @Name, escaped', () => {
    expect(commentEmailBody('<p>Lo revisa @[Ana <b>](01HZX)</p>')).toBe('<p>Lo revisa @Ana &lt;b&gt;</p>');
  });

  it('escapes plain text and keeps its line breaks', () => {
    expect(commentEmailBody('Hola\n\n<juan@x.com> & co')).toBe('Hola<br><br>&lt;juan@x.com&gt; &amp; co');
  });
});
