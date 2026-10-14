import { Injectable } from '@nestjs/common';
import { promises as dns } from 'dns';
import { MailDnsLookup } from '../../domain/services/mail-server-resolve';

/** MailDnsLookup on the system's resolver. A name with no record answers empty, not an error. */
@Injectable()
export class NodeMailDnsLookup implements MailDnsLookup {
  async srv(name: string) {
    return dns.resolveSrv(name).catch(() => []);
  }

  async mx(domain: string) {
    return dns.resolveMx(domain).catch(() => []);
  }

  async exists(host: string) {
    return dns.resolve(host).then((records) => records.length > 0).catch(() => false);
  }
}
