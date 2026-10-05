import { CsatSurveyTemplate } from '../../../src/email/templates/csat-survey.template';
import { EmailVerificationTemplate } from '../../../src/email/templates/email-verification.template';
import { importWelcomeEmail } from '../../../src/email/templates/import-welcome.template';
import { NewCommentTemplate } from '../../../src/email/templates/new-comment.template';
import { PasswordResetTemplate } from '../../../src/email/templates/password-reset.template';
import { StatusChangedTemplate } from '../../../src/email/templates/status-changed.template';
import { TicketAssignedTemplate } from '../../../src/email/templates/ticket-assigned.template';
import { TicketConfirmationTemplate } from '../../../src/email/templates/ticket-confirmation.template';
import { TicketCreatedTemplate } from '../../../src/email/templates/ticket-created.template';
import { TransferRequestTemplate } from '../../../src/email/templates/transfer-request.template';
import { UpgradeAvailableTemplate } from '../../../src/email/templates/upgrade-available.template';
import { invitationEmail } from '../../../src/email/templates/workspace-invitation.template';

const EVIL = '<a href="https://evil.example">x</a><script>1</script>';
const EVIL_ESCAPED = '&lt;a href=&quot;https://evil.example&quot;&gt;x&lt;/a&gt;&lt;script&gt;1&lt;/script&gt;';
/** A value that tries to break out of a quoted href attribute. */
const EVIL_URL = 'https://ok.example/x"><a href="https://evil.example">y</a>';
/** A value that tries to add a mail header through the subject. */
const EVIL_LINE = 'Title\r\nBcc: victim@example.com';

interface Rendered {
  name: string;
  html: string;
  subject: string;
}

function render(lang: string): Rendered[] {
  const csat = new CsatSurveyTemplate();
  const csatData = { ticketName: EVIL, workspaceName: EVIL, surveyBaseUrl: EVIL_URL, lang };

  const verification = new EmailVerificationTemplate();
  const verificationData = { firstName: EVIL, verificationUrl: EVIL_URL, lang };

  const reset = new PasswordResetTemplate();
  const resetData = { firstName: EVIL, resetUrl: EVIL_URL, lang };

  const welcome = importWelcomeEmail({ to: 'a@b.c', firstName: EVIL, workspaceName: EVIL, resetUrl: EVIL_URL, workspaceUrl: EVIL_URL, lang });
  const invitation = invitationEmail({ to: 'a@b.c', workspaceName: EVIL, inviterName: EVIL, invitationUrl: EVIL_URL, workspaceUrl: EVIL_URL, lang });

  const comment = new NewCommentTemplate();
  const commentData = { ticketName: EVIL, ticketNumber: EVIL, ticketUrl: EVIL_URL, authorName: EVIL, commentPreview: `${EVIL}\nline2`, workspaceName: EVIL, lang };

  const status = new StatusChangedTemplate();
  const statusData = { ticketName: EVIL, ticketUrl: EVIL_URL, oldStatus: 'open', newStatus: 'closed', workspaceName: EVIL, lang };

  const assigned = new TicketAssignedTemplate();
  const assignedData = { ticketName: EVIL, ticketUrl: EVIL_URL, workspaceName: EVIL, assigneeName: EVIL, lang };

  const confirmation = new TicketConfirmationTemplate();
  const confirmationData = { ticketName: EVIL, portalUrl: EVIL_URL, lang };

  const created = new TicketCreatedTemplate();
  const createdData = { ticketName: EVIL, ticketUrl: EVIL_URL, reporterName: EVIL, priority: 'high', category: EVIL, workspaceName: EVIL, lang };

  const transfer = new TransferRequestTemplate();
  const transferCreated = { ticketName: EVIL, ticketUrl: EVIL_URL, requesterName: EVIL, workspaceName: EVIL, lang };
  const transferResolved = { ticketName: EVIL, ticketUrl: EVIL_URL, resolution: 'accepted' as const, workspaceName: EVIL, lang };

  const upgrade = new UpgradeAvailableTemplate();
  const upgradeData = { version: EVIL, releaseUrl: EVIL_URL, lang };

  return [
    { name: 'csat-survey', html: csat.html(csatData), subject: csat.subject(csatData) },
    { name: 'email-verification', html: verification.html(verificationData), subject: verification.subject(verificationData) },
    { name: 'password-reset', html: reset.html(resetData), subject: reset.subject(resetData) },
    { name: 'import-welcome', html: welcome.html, subject: welcome.subject },
    { name: 'workspace-invitation', html: invitation.html, subject: invitation.subject },
    { name: 'new-comment', html: comment.html(commentData), subject: comment.subject(commentData) },
    { name: 'status-changed', html: status.html(statusData), subject: status.subject(statusData) },
    { name: 'ticket-assigned', html: assigned.assignedHtml(assignedData), subject: assigned.assignedSubject(assignedData) },
    { name: 'ticket-unassigned', html: assigned.unassignedHtml(assignedData), subject: assigned.unassignedSubject(assignedData) },
    { name: 'ticket-confirmation', html: confirmation.html(confirmationData), subject: confirmation.subject(confirmationData) },
    { name: 'ticket-created', html: created.html(createdData), subject: created.subject(createdData) },
    { name: 'transfer-request-created', html: transfer.createdHtml(transferCreated), subject: transfer.createdSubject(transferCreated) },
    { name: 'transfer-request-resolved', html: transfer.resolvedHtml(transferResolved), subject: transfer.resolvedSubject(transferResolved) },
    { name: 'upgrade-available', html: upgrade.html(upgradeData), subject: upgrade.subject(upgradeData) },
  ];
}

describe('email templates escape user and tenant values', () => {
  for (const lang of ['en', 'es']) {
    for (const r of render(lang)) {
      describe(`${r.name} (${lang})`, () => {
        it('renders no injected link or script', () => {
          expect(r.html).not.toContain('<a href="https://evil.example"');
          expect(r.html).not.toContain('<script>');
        });

        it('keeps a URL value inside its href attribute', () => {
          expect(r.html).not.toContain('x"><a');
        });

        it('shows the injected markup as escaped text where a user value is displayed', () => {
          expect(r.html).toContain(EVIL_ESCAPED);
        });
      });
    }
  }

  it('escapes every field that is displayed (spot check per template)', () => {
    const count = (html: string) => html.split('&lt;script&gt;').length - 1;
    const byName = Object.fromEntries(render('en').map((r) => [r.name, r.html]));
    expect(count(byName['ticket-created'])).toBe(4); // reporter, workspace, title, category
    expect(count(byName['new-comment'])).toBe(4); // author, preview, ticket number, workspace
    expect(count(byName['ticket-assigned'])).toBe(3); // assignee, workspace, title
    expect(count(byName['workspace-invitation'])).toBe(2); // inviter, workspace
    expect(count(byName['upgrade-available'])).toBe(2); // version in title and body
  });

  it('keeps line breaks of the comment preview as <br>', () => {
    const html = new NewCommentTemplate().html({ ticketName: 't', ticketUrl: 'u', authorName: 'a', commentPreview: 'one\ntwo', workspaceName: 'w', lang: 'en' });
    expect(html).toContain('one<br>two');
  });

  it('renders subjects as single-line plain text', () => {
    const all: Rendered[] = [];
    const lang = 'en';
    const created = new TicketCreatedTemplate();
    const data = { ticketName: EVIL_LINE, ticketUrl: 'u', reporterName: 'r', priority: 'high', category: '', workspaceName: EVIL_LINE, lang };
    all.push({ name: 'ticket-created', html: '', subject: created.subject(data) });
    const comment = new NewCommentTemplate();
    all.push({ name: 'new-comment', html: '', subject: comment.subject({ ticketName: EVIL_LINE, ticketNumber: 'TK-1', ticketUrl: 'u', authorName: 'a', commentPreview: '', workspaceName: 'w', lang }) });
    all.push(...render(lang));

    for (const r of all) {
      expect(r.subject).not.toMatch(/[\r\n]/);
      expect(r.subject).not.toContain('&lt;');
    }
    expect(all[0].subject).toContain('Bcc: victim@example.com');
  });

  it('keeps angle brackets in subjects, which mail clients never read as HTML', () => {
    const subject = new TicketCreatedTemplate().subject({ ticketName: 'Error <500> when price < 10', ticketUrl: 'u', reporterName: 'r', priority: 'high', category: '', workspaceName: 'w', lang: 'en' });
    expect(subject).toContain('Error <500> when price < 10');
  });
});
