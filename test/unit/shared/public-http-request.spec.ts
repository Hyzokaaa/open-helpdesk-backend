import * as dns from 'dns';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { PrivateNetworkUrlError } from '../../../src/shared/infrastructure/private-network';
import { publicHttpRequest, publicLookup } from '../../../src/shared/infrastructure/public-http-request';

// A real server on the loopback: whatever reaches it got past the guard
describe('Requests that may only reach public addresses', () => {
  let server: Server;
  let port: number;
  let hits: number;

  beforeAll(async () => {
    server = createServer((_req, res) => { hits++; res.end('ok'); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
  beforeEach(() => { hits = 0; });
  afterEach(() => jest.restoreAllMocks());

  it('refuses a private address written in the URL', async () => {
    await expect(publicHttpRequest(`http://127.0.0.1:${port}/`, { method: 'GET', timeoutMs: 2000 })).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    await expect(publicHttpRequest('http://[::1]/', { method: 'GET', timeoutMs: 2000 })).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    expect(hits).toBe(0);
  });

  it('refuses a name that resolves to a private address, checked on the connection itself', async () => {
    await expect(publicHttpRequest(`http://localhost:${port}/`, { method: 'GET', timeoutMs: 2000 })).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    expect(hits).toBe(0);
  });

  it('refuses a name that looked public when saved but points inside when connecting (DNS rebinding)', async () => {
    // What the connection resolves is what is checked: here the name now answers the loopback
    jest.spyOn(dns, 'lookup').mockImplementation(((_host: string, _options: unknown, callback: (e: null, a: dns.LookupAddress[]) => void) =>
      callback(null, [{ address: '127.0.0.1', family: 4 }])) as never);
    await expect(publicHttpRequest(`http://hooks.example.com:${port}/`, { method: 'POST', body: '{}', timeoutMs: 2000 })).rejects.toBeInstanceOf(PrivateNetworkUrlError);
    expect(hits).toBe(0);
  });

  it('only calls http and https', async () => {
    await expect(publicHttpRequest('ftp://example.com/x', { method: 'GET', timeoutMs: 2000 })).rejects.toThrow('Only http and https');
  });

  it('hands the connection a public address, one or all as asked', async () => {
    jest.spyOn(dns, 'lookup').mockImplementation(((_host: string, _options: unknown, callback: (e: null, a: dns.LookupAddress[]) => void) =>
      callback(null, [{ address: '93.184.216.34', family: 4 }, { address: '2606:2800:220:1::248', family: 6 }])) as never);
    const one = await new Promise((resolve) => publicLookup('example.com', {}, (error, address, family) => resolve({ error, address, family })));
    expect(one).toEqual({ error: null, address: '93.184.216.34', family: 4 });
    const all = await new Promise((resolve) => publicLookup('example.com', { all: true }, (error, addresses) => resolve({ error, addresses })));
    expect(all).toEqual({ error: null, addresses: [{ address: '93.184.216.34', family: 4 }, { address: '2606:2800:220:1::248', family: 6 }] });
  });

  it('refuses a name with any private address among its answers', async () => {
    jest.spyOn(dns, 'lookup').mockImplementation(((_host: string, _options: unknown, callback: (e: null, a: dns.LookupAddress[]) => void) =>
      callback(null, [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }])) as never);
    const result = await new Promise<{ error: unknown }>((resolve) => publicLookup('mixed.example.com', {}, (error) => resolve({ error })));
    expect(result.error).toBeInstanceOf(PrivateNetworkUrlError);
  });
});
