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
  /** Which sender was used: the workspace's own SMTP or the installation's service */
  via?: 'workspace' | 'global';
}

export interface EmailService {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
