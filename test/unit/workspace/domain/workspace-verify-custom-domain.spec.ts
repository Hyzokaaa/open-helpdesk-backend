import {
  DnsLookup,
  keepsVerificationRecord,
  normalizeHost,
  parseCustomDomainTarget,
  pointsToInstallation,
} from '../../../../src/workspace/domain/services/workspace-verify-custom-domain';

describe('normalizeHost', () => {
  it('drops only the trailing dot of the DNS root', () => {
    expect(normalizeHost('proxy.example.com.')).toBe('proxy.example.com');
    expect(normalizeHost('proxy.example.com')).toBe('proxy.example.com');
  });

  it('compares case-insensitively and without surrounding spaces', () => {
    expect(normalizeHost('  Proxy.Example.COM. ')).toBe('proxy.example.com');
  });

  it('tells apart hosts that differ only in their last letter', () => {
    expect(normalizeHost('proxy.example.com')).not.toBe(normalizeHost('proxy.example.co'));
    expect(normalizeHost('proxy.example.com.')).toBe(normalizeHost('proxy.example.com'));
  });
});

describe('parseCustomDomainTarget', () => {
  it('keeps a plain host as it is', () => {
    expect(parseCustomDomainTarget('domains.example.com')).toBe('domains.example.com');
  });

  it('forgives what is pasted from a browser: scheme, path, port, trailing dot, case', () => {
    expect(parseCustomDomainTarget('https://dev.example.com')).toBe('dev.example.com');
    expect(parseCustomDomainTarget(' HTTPS://Dev.Example.com:8443/api/?x=1 ')).toBe('dev.example.com');
    expect(parseCustomDomainTarget('dev.example.com./')).toBe('dev.example.com');
    expect(parseCustomDomainTarget('http://dev.example.com#top')).toBe('dev.example.com');
  });

  it('is null when empty or still not a host name', () => {
    expect(parseCustomDomainTarget(undefined)).toBeNull();
    expect(parseCustomDomainTarget('   ')).toBeNull();
    expect(parseCustomDomainTarget('https://')).toBeNull();
    expect(parseCustomDomainTarget('localhost')).toBeNull();
    expect(parseCustomDomainTarget('not a host.com')).toBeNull();
    expect(parseCustomDomainTarget('-bad.example.com')).toBeNull();
  });
});

/** A resolver answering from a table; a missing name fails like ENOTFOUND. */
function lookup(records: { cname?: Record<string, string[]>; a?: Record<string, string[]>; txt?: Record<string, string[][]> }): DnsLookup {
  const answer = <T>(table: Record<string, T> | undefined, host: string): Promise<T> =>
    table?.[host] ? Promise.resolve(table[host]) : Promise.reject(new Error(`ENOTFOUND ${host}`));
  return {
    resolveCname: (host) => answer(records.cname, host),
    resolve4: (host) => answer(records.a, host),
    resolveTxt: (host) => answer(records.txt, host),
  };
}

const broken: DnsLookup = lookup({});

describe('pointsToInstallation', () => {
  it('passes with a CNAME to the target, ignoring case and the trailing dot', async () => {
    const dns = lookup({ cname: { 'help.acme.com': ['Proxy.Example.com.'] } });
    await expect(pointsToInstallation('help.acme.com', 'proxy.example.com', [dns])).resolves.toBe(true);
  });

  it('passes with an A record sharing an IP with the target', async () => {
    const dns = lookup({ a: { 'help.acme.com': ['1.1.1.1', '2.2.2.2'], 'proxy.example.com': ['2.2.2.2'] } });
    await expect(pointsToInstallation('help.acme.com', 'proxy.example.com', [dns])).resolves.toBe(true);
  });

  it('fails when neither the CNAME nor the IPs match', async () => {
    const dns = lookup({ cname: { 'help.acme.com': ['other.example.com'] }, a: { 'help.acme.com': ['1.1.1.1'], 'proxy.example.com': ['9.9.9.9'] } });
    await expect(pointsToInstallation('help.acme.com', 'proxy.example.com', [dns])).resolves.toBe(false);
  });

  it('passes with the public resolver when the server sees its own name differently', async () => {
    // A hosts file or the DNS of LXD answering 127.0.1.1 for the target, as on a container
    const system = lookup({ a: { 'help.acme.com': ['104.21.6.133'], 'proxy.example.com': ['127.0.1.1'] } });
    const publicDns = lookup({ a: { 'help.acme.com': ['104.21.6.133'], 'proxy.example.com': ['104.21.6.133'] } });
    await expect(pointsToInstallation('help.acme.com', 'proxy.example.com', [system, publicDns])).resolves.toBe(true);
  });

  it('still decides with the system resolver when the public one cannot be reached', async () => {
    const system = lookup({ cname: { 'help.acme.com': ['proxy.example.com'] } });
    await expect(pointsToInstallation('help.acme.com', 'proxy.example.com', [system, broken])).resolves.toBe(true);
    await expect(pointsToInstallation('help.acme.com', 'other.example.com', [system, broken])).resolves.toBe(false);
  });

  it('does not ask the public resolver when the system one already passes', async () => {
    const publicDns = { resolveCname: jest.fn(), resolve4: jest.fn(), resolveTxt: jest.fn() };
    const system = lookup({ cname: { 'help.acme.com': ['proxy.example.com'] } });
    await pointsToInstallation('help.acme.com', 'proxy.example.com', [system, publicDns]);
    expect(publicDns.resolveCname).not.toHaveBeenCalled();
  });
});

describe('keepsVerificationRecord', () => {
  const token = 'oh-verify=abc';

  it('passes when _oh-verify carries the token', async () => {
    const dns = lookup({ txt: { '_oh-verify.help.acme.com': [['other'], [token]] } });
    await expect(keepsVerificationRecord('help.acme.com', token, [dns])).resolves.toBe(true);
  });

  it('fails when the record is missing or has another token', async () => {
    const dns = lookup({ txt: { '_oh-verify.help.acme.com': [['oh-verify=old']] } });
    await expect(keepsVerificationRecord('help.acme.com', token, [dns])).resolves.toBe(false);
    await expect(keepsVerificationRecord('help.acme.com', token, [broken])).resolves.toBe(false);
  });

  it('passes with the public resolver when the system one does not see the record', async () => {
    const publicDns = lookup({ txt: { '_oh-verify.help.acme.com': [[token]] } });
    await expect(keepsVerificationRecord('help.acme.com', token, [broken, publicDns])).resolves.toBe(true);
  });
});
