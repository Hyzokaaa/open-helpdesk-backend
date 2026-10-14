import { stripQuotedReply } from '../../../src/email-inbound/domain/strip-quoted-reply';

describe('stripQuotedReply', () => {
  it('cuts the Gmail quote in English', () => {
    const text = 'Una cosa más.\n\nOn Mon, Oct 12, 2026 at 11:00 AM Support <noreply@x.com> wrote:\n> Hola\n> Carla';
    expect(stripQuotedReply(text)).toBe('Una cosa más.');
  });

  it('cuts the Gmail quote in Spanish, also when the attribution wraps', () => {
    expect(stripQuotedReply('Perfecto.\n\nEl lun, 12 oct 2026 a las 11:00, Soporte <noreply@x.com> escribió:\n> Hola'))
      .toBe('Perfecto.');
    expect(stripQuotedReply('Perfecto.\n\nEl lun, 12 oct 2026 a las 11:00, Soporte\n<noreply@x.com> escribió:\n> Hola'))
      .toBe('Perfecto.');
  });

  it('cuts the Thunderbird quote in Spanish', () => {
    expect(stripQuotedReply('Funciona correctamente, gracias.\n\nEn 14/10/2026 12:35, No Reply escribió:\n> Gracias por la espera.'))
      .toBe('Funciona correctamente, gracias.');
  });

  it('cuts the Outlook quote: underscores, or the From/Sent block', () => {
    const underscores = 'Yo también.\n\n________________________________\nFrom: Support <noreply@x.com>\nSent: Monday\n\nHola Carla';
    expect(stripQuotedReply(underscores)).toBe('Yo también.');
    const block = 'Yo también.\n\nDe: Soporte <noreply@x.com>\nEnviado: lunes, 12 de octubre de 2026 11:00\nPara: Carla\nAsunto: Re: impresora\n\nHola Carla';
    expect(stripQuotedReply(block)).toBe('Yo también.');
  });

  it('cuts at an original message separator', () => {
    expect(stripQuotedReply('Gracias.\n\n-----Original Message-----\nFrom: x')).toBe('Gracias.');
    expect(stripQuotedReply('Gracias.\n\n-----Mensaje original-----\nDe: x')).toBe('Gracias.');
  });

  it('keeps a message that only mentions such words in passing', () => {
    const text = 'El técnico dijo que viene mañana.\nDe: mi parte todo bien.';
    expect(stripQuotedReply(text)).toBe(text);
  });

  it('keeps the text when the quote is all there is', () => {
    expect(stripQuotedReply('> only a quote')).toBe('> only a quote');
  });
});
