import {
  downloadExportLink,
  FetchLike,
  forgetExportDownload,
  MSG_EXPORT_TOO_LARGE,
  MSG_NOT_AN_EXPORT_LINK,
  parseExportLink,
  recallExportDownload,
  rememberExportDownload,
} from '../../../../src/workspace/infrastructure/export-link-download';
import { DomainValidationError } from '../../../../src/shared/domain/errors';

const TOKEN = 'a'.repeat(64);
const LINK = `https://help.example.com/workspaces/acme-support/export/${TOKEN}`;

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected a rejection');
}

describe('parseExportLink', () => {
  it.each([
    LINK,
    `http://localhost:3100/workspaces/acme/export/${TOKEN}`,
    `https://example.com/api/workspaces/acme/export/${TOKEN}`,
    `https://example.com/workspaces/acme/export/${TOKEN}?x=1`,
  ])('accepts %s', (url) => {
    expect(parseExportLink(url).toString()).toBe(url);
  });

  it.each([
    'not a url',
    `ftp://example.com/workspaces/acme/export/${TOKEN}`,
    `file:///workspaces/acme/export/${TOKEN}`,
    `https://user:pass@example.com/workspaces/acme/export/${TOKEN}`,
    `https://user@example.com/workspaces/acme/export/${TOKEN}`,
    'https://example.com/',
    'http://169.254.169.254/latest/meta-data/',
    `https://example.com/workspaces/acme/export/${TOKEN}/extra`,
    `https://example.com/workspaces/Acme/export/${TOKEN}`,
    `https://example.com/other/workspaces/acme/export/${TOKEN}`,
    'https://example.com/workspaces/acme/export',
    `https://example.com/workspaces/acme/export/a.b`,
  ])('rejects %s', (url) => {
    expect(() => parseExportLink(url)).toThrow(new DomainValidationError(MSG_NOT_AN_EXPORT_LINK));
  });
});

describe('downloadExportLink', () => {
  it('downloads the body and asks fetch not to follow redirects', async () => {
    const calls: RequestInit[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      calls.push(init);
      return new Response(streamOf([Buffer.from('OHDX'), Buffer.from('rest')]), { status: 200 });
    };
    const bytes = await downloadExportLink(LINK, { fetchImpl });
    expect(bytes.toString()).toBe('OHDXrest');
    expect(calls[0].redirect).toBe('manual');
    expect(calls[0].signal).toBeDefined();
  });

  it('never fetches a URL outside the export route', async () => {
    let called = false;
    const fetchImpl: FetchLike = async () => {
      called = true;
      return new Response('{}');
    };
    await expect(downloadExportLink('https://example.com/admin', { fetchImpl })).rejects.toThrow(MSG_NOT_AN_EXPORT_LINK);
    expect(called).toBe(false);
  });

  it('refuses a redirect', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } });
    const error = await rejection(downloadExportLink(LINK, { fetchImpl }));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toMatch(/redirects/);
  });

  it('reports a non-2xx status', async () => {
    const fetchImpl: FetchLike = async () => new Response('{"message":"x"}', { status: 401 });
    const error = await rejection(downloadExportLink(LINK, { fetchImpl }));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toMatch(/HTTP 401/);
  });

  it('stops a body that streams past the size cap', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(streamOf([new Uint8Array(6), new Uint8Array(6)]), { status: 200 });
    const error = await rejection(downloadExportLink(LINK, { fetchImpl, maxBytes: 10 }));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toBe(MSG_EXPORT_TOO_LARGE);
  });

  it('refuses a declared length past the size cap before reading', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response('tiny', { status: 200, headers: { 'content-length': '999' } });
    await expect(downloadExportLink(LINK, { fetchImpl, maxBytes: 10 })).rejects.toThrow(MSG_EXPORT_TOO_LARGE);
  });

  it('times out a server that never answers', async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const error = await rejection(downloadExportLink(LINK, { fetchImpl, timeoutMs: 20 }));
    expect(error).toBeInstanceOf(DomainValidationError);
    expect(error.message).toMatch(/Timed out/);
  });

  it('reports an unreachable host', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(downloadExportLink(LINK, { fetchImpl })).rejects.toThrow('Could not reach the export link');
  });
});

describe('recent export downloads', () => {
  it('returns the bytes remembered for the same key and link until forgotten', () => {
    const bytes = Buffer.from('x');
    rememberExportDownload('ws:user', LINK, bytes);
    expect(recallExportDownload('ws:user', LINK)).toBe(bytes);
    expect(recallExportDownload('ws:user', `${LINK}b`)).toBeNull();
    expect(recallExportDownload('ws:other', LINK)).toBeNull();
    forgetExportDownload('ws:user');
    expect(recallExportDownload('ws:user', LINK)).toBeNull();
  });
});
