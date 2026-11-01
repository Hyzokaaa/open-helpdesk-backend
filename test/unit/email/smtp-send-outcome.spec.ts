import { smtpSendOutcome } from '../../../src/email/infrastructure/smtp-send-outcome';

describe('What the mail server said about an accepted send', () => {
  it('keeps the answer with its queue id, the Message-ID and the refused recipients', () => {
    expect(smtpSendOutcome({
      response: '250 2.0.0 Ok: queued as 4F2A1\r\n',
      messageId: '<m-1@x.com>',
      rejected: ['b@x.com', { address: 'c@x.com' }],
    })).toEqual({ response: '250 2.0.0 Ok: queued as 4F2A1', messageId: '<m-1@x.com>', rejected: ['b@x.com', 'c@x.com'] });
  });

  it('leaves out what the server did not give', () => {
    expect(smtpSendOutcome({ response: '250 Ok', rejected: [] })).toEqual({ response: '250 Ok' });
    expect(smtpSendOutcome(undefined)).toEqual({});
  });

  it('cuts a very long answer', () => {
    expect(smtpSendOutcome({ response: `250 ${'x'.repeat(2000)}` }).response).toHaveLength(500);
  });
});
