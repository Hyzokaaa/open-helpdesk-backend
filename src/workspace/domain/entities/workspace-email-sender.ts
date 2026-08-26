import { Id } from '../../../shared/domain/id';

interface Props {
  id: string;
  workspaceId: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  encryption?: string;
  fromName?: string | null;
  fromEmail?: string | null;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
  encryption: string;
}

export class WorkspaceEmailSender {
  readonly id: Id;
  workspaceId: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  encryption: string;
  fromName: string | null;
  fromEmail: string | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.smtpHost = props.smtpHost;
    this.smtpPort = props.smtpPort;
    this.smtpUser = props.smtpUser;
    this.smtpPass = props.smtpPass;
    this.smtpFrom = props.smtpFrom;
    this.encryption = props.encryption ?? 'tls';
    this.fromName = props.fromName ?? null;
    this.fromEmail = props.fromEmail ?? null;
  }

  getId(): string {
    return this.id.get();
  }

  getSmtpConfig(): SmtpConfig {
    const email = this.fromEmail || this.smtpFrom;
    const from = this.fromName ? `${this.fromName} <${email}>` : email;

    return {
      host: this.smtpHost,
      port: this.smtpPort,
      user: this.smtpUser,
      pass: this.smtpPass,
      from,
      secure: this.smtpPort === 465,
      encryption: this.encryption,
    };
  }
}
