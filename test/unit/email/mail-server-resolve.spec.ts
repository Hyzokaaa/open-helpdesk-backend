import { MailDnsLookup, ResolveMailServer } from '../../../src/email/domain/services/mail-server-resolve';

/** A DNS that answers only what each test gives it */
function fakeDns(records: {
  srv?: Record<string, { name: string; port: number; priority: number }[]>;
  mx?: Record<string, { exchange: string; priority: number }[]>;
  hosts?: string[];
}): MailDnsLookup & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    srv: async (name) => { asked.push(name); return records.srv?.[name] ?? []; },
    mx: async (domain) => { asked.push(`mx:${domain}`); return records.mx?.[domain] ?? []; },
    exists: async (host) => { asked.push(`a:${host}`); return (records.hosts ?? []).includes(host); },
  };
}

describe('ResolveMailServer', () => {
  it('takes the servers mail clients are pointed to (SRV) first, the lowest priority first', async () => {
    const dns = fakeDns({
      srv: {
        '_submission._tcp.acme.test': [{ name: 'backup.acme.test', port: 587, priority: 20 }, { name: 'smtp.acme.test', port: 465, priority: 10 }],
        '_imaps._tcp.acme.test': [{ name: 'imap.acme.test', port: 993, priority: 0 }],
      },
    });
    expect(await new ResolveMailServer(dns).execute('acme.test')).toEqual({
      smtp: { host: 'smtp.acme.test', port: 465, source: 'srv' },
      imap: { host: 'imap.acme.test', port: 993, source: 'srv' },
    });
  });

  it('falls back to the MX of the domain, on the usual ports', async () => {
    const dns = fakeDns({ mx: { 'openhelpdesk.network': [{ exchange: 'mail.openhelpdesk.network', priority: 10 }] } });
    expect(await new ResolveMailServer(dns).execute('openhelpdesk.network')).toEqual({
      smtp: { host: 'mail.openhelpdesk.network', port: 587, source: 'mx' },
      imap: { host: 'mail.openhelpdesk.network', port: 993, source: 'mx' },
    });
  });

  it('uses the known settings of a big provider before its MX, which only receives mail', async () => {
    const dns = fakeDns({ mx: { 'outlook.com': [{ exchange: 'outlook-com.olc.protection.outlook.com', priority: 5 }] } });
    expect(await new ResolveMailServer(dns).execute('outlook.com')).toEqual({
      smtp: { host: 'smtp.office365.com', port: 587, source: 'provider' },
      imap: { host: 'outlook.office365.com', port: 993, source: 'provider' },
    });
  });

  it('tries the usual names when the domain publishes nothing', async () => {
    const dns = fakeDns({ hosts: ['smtp.acme.test', 'imap.acme.test'] });
    expect(await new ResolveMailServer(dns).execute('acme.test')).toEqual({
      smtp: { host: 'smtp.acme.test', port: 587, source: 'host' },
      imap: { host: 'imap.acme.test', port: 993, source: 'host' },
    });
  });

  it('returns nothing it could not find, so the form can say it is a guess', async () => {
    expect(await new ResolveMailServer(fakeDns({})).execute('nada.test')).toEqual({});
  });

  it('does not ask DNS about something that is not a domain', async () => {
    const dns = fakeDns({});
    for (const input of ['', 'localhost', 'a b.com', '-x.com', 'x'.repeat(300) + '.com']) {
      expect(await new ResolveMailServer(dns).execute(input)).toEqual({});
    }
    expect(dns.asked).toEqual([]);
  });

  it('reads the domain in any case and without spaces around it', async () => {
    const dns = fakeDns({ mx: { 'acme.test': [{ exchange: 'mx.acme.test', priority: 1 }] } });
    expect((await new ResolveMailServer(dns).execute('  ACME.test ')).smtp?.host).toBe('mx.acme.test');
  });
});
