import { ExtractEmailReply, MAX_EMAIL_TEXT } from '../../../../src/email-inbound/domain/services/email-reply-extract';
import { htmlToText } from '../../../../src/email-inbound/domain/email-reply-html-rules';
import { NewCommentTemplate } from '../../../../src/email/templates/new-comment.template';

const extract = (text: string, html?: string) => new ExtractEmailReply().execute({ text, html });
const OUR_EMAIL = [
  '##- Escribe tu respuesta encima de esta línea -##',
  'Open Helpdesk',
  'Ana Pérez:',
  'Hemos revisado la impresora.',
  'Ver ticket',
].join('\n');

describe('ExtractEmailReply', () => {
  describe('our marker', () => {
    it('cuts at the marker and at the attribution right above it (Gmail, plain text part)', () => {
      const text = `Gracias, ya funciona.\n\nEl mar, 14 oct 2026 a las 12:35, Soporte <soporte@acme.com> escribió:\n\n${OUR_EMAIL.split('\n').map((l) => `> ${l}`).join('\n')}`;
      const result = extract(text);
      expect(result).toMatchObject({ reply: 'Gracias, ya funciona.', method: 'marker' });
      expect(result.quoted).toContain('escribió:');
      expect(result.quoted).toContain('Hemos revisado la impresora.');
    });

    it('takes the whole Outlook header block above the marker, and nothing of the reply', () => {
      const text = [
        'Para: el equipo de compras, gracias.',
        '',
        '________________________________',
        'Von: Soporte <soporte@acme.com>',
        'Gesendet: Dienstag, 14. Oktober 2026 12:35',
        'An: kunde@example.de',
        'Betreff: Re: Drucker',
        '',
        OUR_EMAIL,
      ].join('\n');
      expect(extract(text)).toMatchObject({ reply: 'Para: el equipo de compras, gracias.', method: 'marker' });
    });

    it('keeps everything when nothing was written above the marker', () => {
      expect(extract(OUR_EMAIL)).toMatchObject({ method: 'none', quoted: '' });
    });
  });

  describe('HTML structure', () => {
    const gmail = (lang: { attribution: string }) => `<div dir="ltr">Merci, c'est réparé.</div><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">${lang.attribution}<br></div><blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex">Hemos revisado la impresora.</blockquote></div>`;

    it('cuts the Gmail quote in any language', () => {
      for (const attribution of [
        'Le mar. 14 oct. 2026 à 12:35, Soporte &lt;soporte@acme.com&gt; a écrit :',
        'Am Di., 14. Okt. 2026 um 12:35 Uhr schrieb Soporte &lt;soporte@acme.com&gt;:',
        'Il giorno mar 14 ott 2026 alle ore 12:35 Soporte &lt;soporte@acme.com&gt; ha scritto:',
      ]) {
        const result = extract('ignored by the html path', gmail({ attribution }));
        expect(result).toMatchObject({ reply: "Merci, c'est réparé.", method: 'html' });
        expect(result.quoted).toContain('Hemos revisado la impresora.');
      }
    });

    it('cuts Outlook at its header block, taking the quoted message that follows', () => {
      const html = `<div>Danke, alles gut.</div><div id="appendonsend"></div><hr><div id="divRplyFwdMsg"><b>Von:</b> Soporte &lt;soporte@acme.com&gt;<br><b>Gesendet:</b> Dienstag, 14. Oktober 2026 12:35</div><div>Hemos revisado la impresora.</div>`;
      const result = extract('ignored', html);
      expect(result).toMatchObject({ reply: 'Danke, alles gut.', method: 'html' });
      expect(result.quoted).toContain('Hemos revisado la impresora.');
    });

    it('cuts Thunderbird and Apple Mail quotes', () => {
      const thunderbird = `<p>Gracias.</p><div class="moz-cite-prefix">En 14/10/2026 a las 12:35, Soporte escribió:<br></div><blockquote type="cite">Hemos revisado la impresora.</blockquote>`;
      const apple = `<div>Thanks!</div><div><br><blockquote type="cite"><div>On 14 Oct 2026, at 12:35, Soporte &lt;soporte@acme.com&gt; wrote:</div><div>Hemos revisado la impresora.</div></blockquote></div>`;
      expect(extract('x', thunderbird)).toMatchObject({ reply: 'Gracias.', method: 'html' });
      expect(extract('x', apple)).toMatchObject({ reply: 'Thanks!', method: 'html' });
    });

    it('cuts nothing when the sender answered between the quoted parts', () => {
      const inline = `<div>Ver abajo.</div><div class="gmail_quote"><div class="gmail_attr">El mar, 14 oct 2026, Soporte &lt;s@acme.com&gt; escribió:</div><blockquote class="gmail_quote">¿Qué modelo es?</blockquote><div>Es una HP 4100.</div><blockquote class="gmail_quote">¿Desde cuándo falla?</blockquote><div>Desde ayer.</div></div>`;
      const thunderbird = `<p>Ver abajo.</p><blockquote type="cite">¿Qué modelo es?</blockquote><p>Es una HP 4100.</p>`;
      expect(extract(htmlToText(inline), inline).method).not.toBe('html');
      expect(extract(htmlToText(inline), inline).reply).toContain('Desde ayer.');
      expect(extract(htmlToText(thunderbird), thunderbird).reply).toContain('Es una HP 4100.');
    });
  });

  describe('text rules', () => {
    it('cuts attributions in several languages when only quoted lines follow', () => {
      for (const attribution of [
        'On Tue, 14 Oct 2026 at 12:35, Support <support@acme.com> wrote:',
        'Le mar. 14 oct. 2026 à 12:35, Support <support@acme.com> a écrit :',
        'Am 14.10.2026 um 12:35 schrieb Support <support@acme.com>:',
        'Em ter., 14 de out. de 2026 às 12:35, Support <support@acme.com> escreveu:',
        'Op 14 okt. 2026 om 12:35 schreef Support <support@acme.com>:',
      ]) {
        const result = extract(`Thanks, solved.\n\n${attribution}\n> We checked the printer.\n> Regards`);
        expect(result).toMatchObject({ reply: 'Thanks, solved.', method: 'text' });
      }
    });

    it('accepts an attribution wrapped over two lines', () => {
      const text = 'Gracias.\n\nEl mar, 14 oct 2026 a las 12:35, Soporte Técnico de Acme\n<soporte@acme.com> escribió:\n> Hola';
      expect(extract(text)).toMatchObject({ reply: 'Gracias.', method: 'text' });
    });

    it('cuts a plain-text Outlook header block, with its rule above it', () => {
      const text = 'Merci.\n\n-----Message d\'origine-----\nDe : Support <support@acme.com>\nEnvoyé : mardi 14 octobre 2026 12:35\nÀ : client@example.fr\nObjet : Imprimante\n\nNous avons vérifié.';
      expect(extract(text)).toMatchObject({ reply: 'Merci.', method: 'text' });
    });
  });

  describe('cases kept from the previous rules', () => {
    it.each([
      ['Gmail in English', 'Una cosa más.\n\nOn Mon, Oct 12, 2026 at 11:00 AM Support <noreply@x.com> wrote:\n> Hola\n> Carla', 'Una cosa más.'],
      ['Gmail in Spanish', 'Perfecto.\n\nEl lun, 12 oct 2026 a las 11:00, Soporte <noreply@x.com> escribió:\n> Hola', 'Perfecto.'],
      ['Gmail in Spanish, wrapped', 'Perfecto.\n\nEl lun, 12 oct 2026 a las 11:00, Soporte\n<noreply@x.com> escribió:\n> Hola', 'Perfecto.'],
      ['Thunderbird in Spanish', 'Funciona correctamente, gracias.\n\nEn 14/10/2026 12:35, No Reply escribió:\n> Gracias por la espera.', 'Funciona correctamente, gracias.'],
      ['Outlook underscores', 'Yo también.\n\n________________________________\nFrom: Support <noreply@x.com>\nSent: Monday\n\nHola Carla', 'Yo también.'],
      ['Outlook header block', 'Yo también.\n\nDe: Soporte <noreply@x.com>\nEnviado: lunes, 12 de octubre de 2026 11:00\nPara: Carla\nAsunto: Re: impresora\n\nHola Carla', 'Yo también.'],
      ['Original Message', 'Gracias.\n\n-----Original Message-----\nFrom: x', 'Gracias.'],
      ['Mensaje original', 'Gracias.\n\n-----Mensaje original-----\nDe: x', 'Gracias.'],
    ])('%s', (_label, text, reply) => {
      expect(extract(text)).toMatchObject({ reply, method: 'text' });
    });
  });

  describe("never cuts the sender's own words", () => {
    it.each([
      ['a sentence that ends like an attribution', 'En resumen, como el técnico escribió:\nreinicié el router y volvió la conexión.'],
      ['a line that starts with ">"', 'El disco está casi lleno:\n> 50 GB usados de 60\nlo que dice el panel.'],
      ['a rule of underscores as a separator', 'Antes:\n______________\nDespués: todo bien.'],
      ['"De:" in a sentence', 'De: mi parte, todo correcto.\nGracias.'],
      ['"From:" in a sentence', 'From: the logs I see a timeout.\nTo: be checked tomorrow.'],
      ['an attribution with nothing quoted after it', 'On Monday, as you wrote:\nthe printer is fixed.'],
    ])('%s', (_label, text) => {
      expect(extract(text)).toMatchObject({ reply: text, method: 'none', quoted: '' });
    });

    it('keeps an answer written between quoted lines', () => {
      const text = 'Ver abajo.\n\nOn Tue, 14 Oct 2026, Support <s@acme.com> wrote:\n> Which model?\nHP 4100.\n> Since when?\nYesterday.';
      expect(extract(text).reply).toContain('Yesterday.');
    });

    it('keeps everything when the email is only a quote', () => {
      const text = 'On Tue, 14 Oct 2026, Support <s@acme.com> wrote:\n> Which model?';
      expect(extract(text).reply).toBe(text);
    });
  });

  it('finds the marker of our own emails once a mail client quotes them, in both languages', () => {
    for (const lang of ['en', 'es']) {
      const ours = new NewCommentTemplate().html({
        ticketName: 'Impresora', ticketUrl: 'https://x/t/1', authorName: 'Ana', commentContent: '<p>Hemos revisado la impresora.</p>',
        canReply: true, workspaceName: 'Acme', lang,
      });
      const quoted = htmlToText(ours).split('\n').map((line) => `> ${line}`).join('\n');
      const result = extract(`Gracias.\n\nOn Tue, 14 Oct 2026 at 12:35, Acme <soporte@acme.com> wrote:\n${quoted}`);
      expect(result).toMatchObject({ reply: 'Gracias.', method: 'marker' });
    }
  });

  it('puts no marker in emails that cannot be answered', () => {
    const html = new NewCommentTemplate().html({
      ticketName: 'x', ticketUrl: 'https://x', authorName: 'Ana', commentContent: '<p>x</p>', canReply: false, workspaceName: 'Acme', lang: 'en',
    });
    expect(html).not.toContain('##-');
  });

  it('folds the signature with the quote instead of dropping it', () => {
    const result = extract('Gracias.\n-- \nAna Pérez\nAcme S.L.');
    expect(result.reply).toBe('Gracias.');
    expect(result.quoted).toContain('Ana Pérez');
  });

  it('cuts a reply past 1 MB, saying so', () => {
    const result = extract('a'.repeat(MAX_EMAIL_TEXT + 10));
    expect(result.reply.endsWith('[…]')).toBe(true);
    expect(result.reply.length).toBeLessThan(MAX_EMAIL_TEXT + 10);
  });
});
