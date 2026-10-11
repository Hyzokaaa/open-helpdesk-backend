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
 * The input is always treated as text: anything that looks like a tag, such as
 * `<john@example.com>`, is escaped and shown as written.
 */
export function textToHtml(value: string | null | undefined): string {
  const text = (value ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '';

  return text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .trim()
        .split('\n')
        .map((line) => line.replace(/[&<>"']/g, (c) => ESCAPES[c]))
        .join('<br>'),
    )
    .map((block) => `<p>${block}</p>`)
    .join('');
}
