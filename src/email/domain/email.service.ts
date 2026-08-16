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
}

export interface EmailService {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
