import { Id } from '../../../shared/domain/id';

export interface SlaPriorityTargets {
  critical: number | null;
  high: number | null;
  medium: number | null;
  low: number | null;
}

export interface SlaPolicy {
  firstResponse: SlaPriorityTargets;
  resolution: SlaPriorityTargets;
}

interface Props {
  id: string;
  name: string;
  slug: string;
  description: string;
  accountId?: string | null;
  palette?: string | null;
  slaPolicy?: SlaPolicy | null;
  systemMailboxEnabled?: boolean;
  customDomain?: string | null;
  customDomainVerified?: boolean;
  domainVerificationToken?: string | null;
}

export class Workspace {
  readonly id: Id;
  name: string;
  slug: string;
  description: string;
  accountId: string | null;
  palette: string | null;
  slaPolicy: SlaPolicy | null;
  systemMailboxEnabled: boolean;
  customDomain: string | null;
  customDomainVerified: boolean;
  domainVerificationToken: string | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.name = props.name;
    this.slug = props.slug;
    this.description = props.description;
    this.accountId = props.accountId ?? null;
    this.palette = props.palette ?? null;
    this.slaPolicy = props.slaPolicy ?? null;
    this.systemMailboxEnabled = props.systemMailboxEnabled ?? true;
    this.customDomain = props.customDomain ?? null;
    this.customDomainVerified = props.customDomainVerified ?? false;
    this.domainVerificationToken = props.domainVerificationToken ?? null;
  }

  getId(): string {
    return this.id.get();
  }
}
