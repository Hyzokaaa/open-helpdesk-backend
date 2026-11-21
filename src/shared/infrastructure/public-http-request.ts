import { LookupAddress, lookup as dnsLookup } from 'dns';
import { IncomingHttpHeaders, request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { LookupFunction, isIP } from 'net';
import { PrivateNetworkUrlError, isPrivateAddress } from './private-network';

export interface PublicHttpOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  timeoutMs: number;
  /** Largest response kept; a longer one fails rather than fill the memory. */
  maxBytes?: number;
}

export interface PublicHttpResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Resolves a name for a connection, refusing it if any of its addresses is private. The check
 * happens on the address the connection then uses, so a name cannot point at a public address
 * when checked and at a private one when connected (DNS rebinding).
 */
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true, family: options.family, hints: options.hints }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, '', 0);
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) return callback(new PrivateNetworkUrlError(), '', 0);
    if (options.all) return (callback as unknown as (err: null, all: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

/**
 * An HTTP(S) request that can only reach public addresses, for URLs someone other than the
 * installation's administrator typed (webhooks, a workspace's own chat server). Redirects are
 * never followed: a 3xx comes back as it is.
 */
export function publicHttpRequest(url: string, options: PublicHttpOptions): Promise<PublicHttpResponse> {
  return new Promise((resolve, reject) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return reject(new Error(`Not a valid URL: ${url}`));
    }
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return reject(new Error(`Only http and https can be called, not ${target.protocol}`));
    // A literal address never goes through the lookup, so it is checked here
    const host = target.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && isPrivateAddress(host)) return reject(new PrivateNetworkUrlError());

    const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const req = send(target, { method: options.method, headers: options.headers, lookup: publicLookup }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy(new Error(`The answer is larger than ${maxBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        clearTimeout(timer);
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) });
      });
      res.on('error', fail);
    });
    // The whole exchange, not only a quiet socket, has to fit in the time allowed
    const timer = setTimeout(() => req.destroy(new Error(`No answer within ${options.timeoutMs} ms`)), options.timeoutMs);
    function fail(error: Error) {
      clearTimeout(timer);
      reject(error);
    }
    req.on('error', fail);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}
