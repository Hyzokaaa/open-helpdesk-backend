export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
}

export interface EmailService {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
