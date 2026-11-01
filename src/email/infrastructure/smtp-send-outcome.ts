import { SendEmailResult } from '../domain/email.service';

/** Longer answers are cut: the server's text comes from outside and only its start tells anything */
const MAX_RESPONSE_LENGTH = 500;

interface SentMessageInfo {
  response?: unknown;
  messageId?: unknown;
  rejected?: unknown;
}

/**
 * What the server said about a send it accepted, as nodemailer returns it: the answer with its
 * queue id, the Message-ID and any recipient it refused while taking the rest.
 */
export function smtpSendOutcome(info: SentMessageInfo | null | undefined): Omit<SendEmailResult, 'success'> {
  if (!info) return {};
  const response = typeof info.response === 'string' ? info.response.trim().slice(0, MAX_RESPONSE_LENGTH) : '';
  const messageId = typeof info.messageId === 'string' ? info.messageId : '';
  const rejected = Array.isArray(info.rejected)
    ? info.rejected
        .map((r) => (typeof r === 'string' ? r : typeof r?.address === 'string' ? r.address : ''))
        .filter(Boolean)
    : [];
  return {
    ...(response && { response }),
    ...(messageId && { messageId }),
    ...(rejected.length > 0 && { rejected }),
  };
}
