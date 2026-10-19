import { NewCommentTemplate } from '../../../src/email/templates/new-comment.template';
import { StatusChangedTemplate } from '../../../src/email/templates/status-changed.template';
import { TicketConfirmationTemplate } from '../../../src/email/templates/ticket-confirmation.template';

// With the portal closed, someone who only ever wrote in gets no link: the email tells them to reply instead
describe('Ticket emails without a link to the ticket', () => {
  const REPLY = 'Reply to this email to add information.';
  const comment = (ticketUrl: string | null, canReply: boolean) => new NewCommentTemplate().html({
    ticketName: 't', ticketNumber: 'TK-1', ticketUrl, authorName: 'a', commentContent: 'hi', canReply, workspaceName: 'w', lang: 'en',
  });
  const status = (ticketUrl: string | null, canReply: boolean) => new StatusChangedTemplate().html({
    ticketName: 't', ticketUrl, oldStatus: 'open', newStatus: 'resolved', workspaceName: 'w', canReply, lang: 'en',
  });
  const confirmation = (ticketUrl: string | null, canReply: boolean) => new TicketConfirmationTemplate().html({ ticketName: 't', ticketUrl, canReply, lang: 'en' });

  it('shows the button and no reminder while there is a link', () => {
    for (const html of [comment('https://x/t', true), status('https://x/t', true), confirmation('https://x/t', true)]) {
      expect(html).toContain('href="https://x/t"');
      expect(html).not.toContain(REPLY);
    }
  });

  it('replaces the button with the reminder to reply when replies reach the ticket', () => {
    for (const html of [comment(null, true), status(null, true), confirmation(null, true)]) {
      expect(html).not.toContain('<a href');
      expect(html).toContain(REPLY);
    }
    expect(new TicketConfirmationTemplate().html({ ticketName: 't', ticketUrl: null, canReply: true, lang: 'es' })).toContain('Responde a este correo para añadir información.');
  });

  it('promises nothing when a reply would not reach the ticket either', () => {
    for (const html of [comment(null, false), status(null, false), confirmation(null, false)]) {
      expect(html).not.toContain(REPLY);
      expect(html).not.toContain('Open the ticket to respond');
    }
  });
});
