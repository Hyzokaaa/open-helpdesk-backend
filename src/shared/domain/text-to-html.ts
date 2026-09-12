const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

/**
 * Turns plain text into the paragraph markup the rich text editor produces.
 *
 * Inbound email is flattened to plain text with newline separators, but tickets and
 * comments are rendered as HTML — so without this the line breaks collapse and the
 * editor reports a phantom edit the first time someone saves an imported ticket.
 *
 * Input that already carries markup is returned untouched.
 */
export function textToHtml(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  if (!text) return '';
  if (/<[a-z][^>]*>/i.test(text)) return text;

  return text
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split(/\n/)
        .map((line) => line.replace(/[&<>"']/g, (c) => ESCAPES[c]))
        .join('<br>'),
    )
    .map((block) => `<p>${block}</p>`)
    .join('');
}
