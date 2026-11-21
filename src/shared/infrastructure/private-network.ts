import { BlockList, isIP } from 'net';
import { lookup } from 'dns/promises';
import { DomainValidationError } from '../domain/errors';

const privateRanges = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
] as const) privateRanges.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10]] as const) {
  privateRanges.addSubnet(network, prefix, 'ipv6');
}

/** Whether an address is loopback, private, link-local (cloud metadata) or otherwise not on the internet. */
export function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return privateRanges.check(mapped[1], 'ipv4');
  const family = isIP(address);
  if (family === 0) return true;
  return privateRanges.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Whether servers that someone other than the installation's administrator typed in (a
 * workspace's own chat server) may be on a private network. Allowed unless
 * ALLOW_PRIVATE_NETWORK_URLS=false: a hosted installation sets it, so a workspace cannot make the
 * server call its internal network; a self-hosted one keeps reaching servers on its LAN.
 */
export function privateNetworkUrlsAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ALLOW_PRIVATE_NETWORK_URLS?.trim().toLowerCase() !== 'false';
}

export class PrivateNetworkUrlError extends DomainValidationError {
  constructor() {
    super('That server is on a private network, which this installation does not allow');
  }
}

/** Refuses a URL whose host is, or resolves to, a private address. */
export async function ensurePublicUrl(url: string, resolve: (host: string) => Promise<string[]> = resolveHost): Promise<void> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : await resolve(host);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new PrivateNetworkUrlError();
}

async function resolveHost(host: string): Promise<string[]> {
  try {
    return (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    return [];
  }
}
