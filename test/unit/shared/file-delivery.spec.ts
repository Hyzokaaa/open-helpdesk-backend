import { fileDelivery } from '../../../src/shared/infrastructure/file-delivery';

describe('fileDelivery', () => {
  it('displays images, videos and PDFs', () => {
    for (const name of ['a.png', 'a.JPG', 'a.webp', 'a.gif', 'a.mp4', 'a.webm', 'a.pdf']) {
      expect(fileDelivery(`attachments/x/${name}`)).toMatchObject({ inline: true, contentDisposition: 'inline' });
    }
  });

  it('downloads anything that could run script, keeping its real type for <img> and the like', () => {
    expect(fileDelivery('attachments/x/page.html')).toMatchObject({ inline: false, contentType: 'text/html' });
    expect(fileDelivery('logos/x/logo.svg')).toMatchObject({ inline: false, contentType: 'image/svg+xml' });
    expect(fileDelivery('attachments/x/page.html').contentDisposition).toMatch(/^attachment; /);
  });

  it('downloads unknown types as plain bytes', () => {
    expect(fileDelivery('attachments/x/archive.rar')).toMatchObject({ inline: false, contentType: 'application/octet-stream' });
  });

  it('names the download safely, with the full name for browsers that read it', () => {
    const { contentDisposition } = fileDelivery("attachments/x/Año 'final' (2).txt");
    expect(contentDisposition).toBe(
      'attachment; filename="A_o \'final\' (2).txt"; filename*=UTF-8\'\'A%C3%B1o%20%27final%27%20%282%29.txt',
    );
  });
});
