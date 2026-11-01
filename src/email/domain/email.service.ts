export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

export interface SendEmailResult {
  success: boolean;
  mock?: boolean;
  /** Why the send failed, as the server or provider said it; never credentials */
  error?: string;
  /** What kind of failure it was (see `connectionErrorKind`), for the client to explain */
  errorCode?: string;
  /** What the mail server answered on a send it accepted ("250 2.0.0 Ok: queued as 4F2A1"), to find the email in its logs */
  response?: string;
  /** The Message-ID the email went out with */
  messageId?: string;
  /** Recipients the server refused while taking the rest */
  rejected?: string[];
  /** Which sender was used: the workspace's own SMTP or the installation's service */
  via?: 'workspace' | 'global';
}

export interface EmailService {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
