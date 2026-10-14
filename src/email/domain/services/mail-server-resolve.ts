/** What DNS answers that matters to find a domain's mail servers. */
export interface MailDnsLookup {
  /** SRV records, empty when there are none. */
  srv(name: string): Promise<{ name: string; port: number; priority: number }[]>;
  /** MX records, empty when there are none. */
  mx(domain: string): Promise<{ exchange: string; priority: number }[]>;
  /** Whether the host name resolves to an address. */
  exists(host: string): Promise<boolean>;
}

/**
 * Where a server was found: published for mail clients (SRV), a provider we know, the domain's MX,
 * or a usual name.
 */
export type MailServerSource = 'srv' | 'provider' | 'mx' | 'host';

export interface MailServer {
  host: string;
  port: number;
  source: MailServerSource;
}

export interface MailServers {
  smtp?: MailServer;
  imap?: MailServer;
}

// Big providers whose MX receives mail but is not where their users send or read it
const MICROSOFT = { smtp: { host: 'smtp.office365.com', port: 587 }, imap: { host: 'outlook.office365.com', port: 993 } };
const GOOGLE = { smtp: { host: 'smtp.gmail.com', port: 587 }, imap: { host: 'imap.gmail.com', port: 993 } };
const APPLE = { smtp: { host: 'smtp.mail.me.com', port: 587 }, imap: { host: 'imap.mail.me.com', port: 993 } };
const PROVIDERS: Record<string, { smtp: { host: string; port: number }; imap: { host: string; port: number } }> = {
  'gmail.com': GOOGLE, 'googlemail.com': GOOGLE,
  'outlook.com': MICROSOFT, 'hotmail.com': MICROSOFT, 'live.com': MICROSOFT, 'msn.com': MICROSOFT,
  'icloud.com': APPLE, 'me.com': APPLE, 'mac.com': APPLE,
  'yahoo.com': { smtp: { host: 'smtp.mail.yahoo.com', port: 587 }, imap: { host: 'imap.mail.yahoo.com', port: 993 } },
  'aol.com': { smtp: { host: 'smtp.aol.com', port: 587 }, imap: { host: 'imap.aol.com', port: 993 } },
  'zoho.com': { smtp: { host: 'smtp.zoho.com', port: 587 }, imap: { host: 'imap.zoho.com', port: 993 } },
  'gmx.com': { smtp: { host: 'mail.gmx.com', port: 587 }, imap: { host: 'imap.gmx.com', port: 993 } },
  'gmx.net': { smtp: { host: 'mail.gmx.net', port: 587 }, imap: { host: 'imap.gmx.net', port: 993 } },
};

const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/**
 * The sending (SMTP) and reading (IMAP) servers of an email domain, as the settings forms offer
 * them. In order of trust: the SRV records mail clients use (RFC 6186), then the settings of a big
 * provider we know (its MX only receives mail), then the domain's MX, then the usual names
 * (mail.<domain>, smtp.<domain>, imap.<domain>) when they exist. Nothing is returned for a server
 * that none of them gives, so the form can say it is only a guess.
 */
export class ResolveMailServer {
  constructor(private readonly dns: MailDnsLookup) {}

  async execute(domain: string): Promise<MailServers> {
    const name = domain.trim().toLowerCase();
    if (!DOMAIN.test(name)) return {};

    const result: MailServers = {};
    const firstSrv = async (record: string): Promise<MailServer | undefined> => {
      const records = await this.dns.srv(record).catch(() => []);
      const best = [...records].sort((a, b) => a.priority - b.priority)[0];
      return best && best.name ? { host: best.name, port: best.port, source: 'srv' } : undefined;
    };

    result.smtp = await firstSrv(`_submission._tcp.${name}`);
    result.imap = (await firstSrv(`_imaps._tcp.${name}`)) ?? (await firstSrv(`_imap._tcp.${name}`));

    const provider = PROVIDERS[name];
    if (provider) {
      result.smtp ??= { ...provider.smtp, source: 'provider' };
      result.imap ??= { ...provider.imap, source: 'provider' };
    }

    if (!result.smtp || !result.imap) {
      const mx = await this.dns.mx(name).catch(() => []);
      const best = [...mx].sort((a, b) => a.priority - b.priority)[0];
      if (best && best.exchange) {
        result.smtp ??= { host: best.exchange, port: 587, source: 'mx' };
        result.imap ??= { host: best.exchange, port: 993, source: 'mx' };
      }
    }

    const usual = async (prefixes: string[], port: number): Promise<MailServer | undefined> => {
      for (const prefix of prefixes) {
        const host = `${prefix}.${name}`;
        if (await this.dns.exists(host).catch(() => false)) return { host, port, source: 'host' };
      }
      return undefined;
    };
    result.smtp ??= await usual(['mail', 'smtp'], 587);
    result.imap ??= await usual(['mail', 'imap'], 993);

    if (!result.smtp) delete result.smtp;
    if (!result.imap) delete result.imap;
    return result;
  }
}
