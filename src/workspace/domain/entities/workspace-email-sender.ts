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

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.smtpHost = props.smtpHost;
    this.smtpPort = props.smtpPort;
    this.smtpUser = props.smtpUser;
    this.smtpPass = props.smtpPass;
    this.smtpFrom = props.smtpFrom;
    this.encryption = props.encryption ?? 'tls';
  }

  getId(): string {
    return this.id.get();
  }

  getSmtpConfig(): SmtpConfig {
    return {
      host: this.smtpHost,
      port: this.smtpPort,
      user: this.smtpUser,
      pass: this.smtpPass,
      from: this.smtpFrom,
      secure: this.smtpPort === 465,
      encryption: this.encryption,
    };
  }
}
