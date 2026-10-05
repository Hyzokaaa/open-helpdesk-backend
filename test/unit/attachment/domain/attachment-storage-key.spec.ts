import { attachmentStorageKey, safeFileName } from '../../../../src/attachment/domain/attachment-storage-key';

describe('attachmentStorageKey', () => {
  it('keeps an ordinary name, accents and spaces included', () => {
    expect(attachmentStorageKey('att-1', 'Factura marzo ñandú.pdf')).toBe('attachments/att-1/Factura marzo ñandú.pdf');
  });

  it('never lets the name leave the attachment folder', () => {
    for (const name of ['../../../etc/passwd', '..\\..\\app\\main.js', '/etc/passwd', 'C:\\Windows\\win.ini']) {
      const key = attachmentStorageKey('att-1', name);
      const segments = key.split('/');
      expect(segments).toHaveLength(3);
      expect(segments.slice(0, 2)).toEqual(['attachments', 'att-1']);
      expect(segments[2]).not.toMatch(/^\.|[\\/:]/);
    }
  });

  it('replaces characters that would change a URL or a header', () => {
    expect(safeFileName('a?b#c%d"e<f>.png')).toBe('a_b_c_d_e_f_.png');
  });

  it('falls back to a placeholder when nothing usable is left', () => {
    expect(safeFileName('..')).toBe('file');
    expect(safeFileName('')).toBe('file');
  });

  it('keeps the extension of a very long name', () => {
    const name = safeFileName(`${'a'.repeat(500)}.docx`);
    expect(name.length).toBeLessThanOrEqual(200);
    expect(name.endsWith('.docx')).toBe(true);
  });
});
