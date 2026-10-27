import { promises as dns } from 'dns';
import { DomainValidationError, EntityNotFoundError } from '../../../shared/domain/errors';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

interface VerifyCustomDomainProps {
  workspaceId: string;
}

export interface DomainVerificationResult {
  verified: boolean;
  dnsValid: boolean;
  txtValid: boolean;
  cnameTarget: string;
  txtRecord: string;
}

/** DNS names compare case-insensitively and may carry the root's trailing dot. */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * The host from CUSTOM_DOMAIN_CNAME_TARGET, forgiving what people paste from a browser: a scheme,
 * a path, a port or the trailing dot. Null when it is empty or still not a host name.
 */
export function parseCustomDomainTarget(raw: string | null | undefined): string | null {
  const host = normalizeHost(raw ?? '')
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/:\d*$/, '')
    .replace(/\.$/, '');
  return HOSTNAME.test(host) ? host : null;
}

/** The DNS queries the checks need; the system resolver and a public one both provide them. */
export interface DnsLookup {
  resolveCname(host: string): Promise<string[]>;
  resolve4(host: string): Promise<string[]>;
  resolveTxt(host: string): Promise<string[][]>;
}

const publicResolver = new dns.Resolver({ timeout: 3000, tries: 1 });
publicResolver.setServers(['1.1.1.1', '8.8.8.8']);

/**
 * The system resolver first, then a public one. The server can see its own names differently from
 * the rest of the world (a hosts file, the DNS of LXD or Docker, a company DNS), and a domain that
 * points here for everyone else must not fail for that. Where outbound DNS is blocked, the public
 * resolver only adds its timeout, and the system answer still decides.
 */
const DEFAULT_LOOKUPS: DnsLookup[] = [dns, publicResolver];

export class VerifyCustomDomain {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly expectedCnameTarget: string,
  ) {}

  async execute(props: VerifyCustomDomainProps): Promise<DomainVerificationResult> {
    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');
    if (!workspace.customDomain) throw new DomainValidationError('No custom domain configured');
    if (!workspace.domainVerificationToken) throw new DomainValidationError('No verification token');

    const domain = workspace.customDomain;
    const token = workspace.domainVerificationToken;

    const dnsValid = await this.checkDns(domain);
    const txtValid = await keepsVerificationRecord(domain, token);

    if (dnsValid && txtValid) {
      workspace.customDomainVerified = true;
      workspace.customDomainCheckFailures = 0;
      workspace.customDomainFailingSince = null;
      await this.repository.update(workspace);
    }

    return {
      verified: dnsValid && txtValid,
      dnsValid,
      txtValid,
      cnameTarget: this.expectedCnameTarget,
      txtRecord: token,
    };
  }

  private checkDns(domain: string): Promise<boolean> {
    return pointsToInstallation(domain, this.expectedCnameTarget);
  }

}

/** Whether the domain still publishes the TXT record that proved it belongs to the workspace. */
export async function keepsVerificationRecord(domain: string, token: string, lookups: DnsLookup[] = DEFAULT_LOOKUPS): Promise<boolean> {
  for (const lookup of lookups) {
    try {
      const txtRecords = await lookup.resolveTxt(`_oh-verify.${domain}`);
      if (txtRecords.flat().some((t) => t === token)) return true;
    } catch {}
  }
  return false;
}

/** Whether the domain's DNS points to the installation: a CNAME to the target, or an A record with its IPs. */
export async function pointsToInstallation(domain: string, cnameTarget: string, lookups: DnsLookup[] = DEFAULT_LOOKUPS): Promise<boolean> {
  for (const lookup of lookups) {
    if (await pointsToInstallationWith(lookup, domain, cnameTarget)) return true;
  }
  return false;
}

async function pointsToInstallationWith(lookup: DnsLookup, domain: string, cnameTarget: string): Promise<boolean> {
  try {
    const cnames = await lookup.resolveCname(domain);
    const expected = normalizeHost(cnameTarget);
    if (cnames.some((c) => normalizeHost(c) === expected)) return true;
  } catch {}

  // Fallback: an A record resolving to the same IPs as the target, both seen by the same resolver
  try {
    const domainIps = await lookup.resolve4(domain);
    const serverIps = await lookup.resolve4(cnameTarget);
    if (domainIps.some((ip) => serverIps.includes(ip))) return true;
  } catch {}

  return false;
}
