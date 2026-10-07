import {
  TicketReferenceFormat,
  TicketReferenceStyle,
  formatTicketReference,
  normalizeTicketReferencePrefix,
  parseTicketReference,
  ticketReferenceOf,
} from '../../../../src/ticket/domain/ticket-reference';
import { TicketReferenceFormats } from '../../../../src/ticket/domain/services/ticket-reference-formats';
import { WorkspaceTicketReference } from '../../../../src/workspace/domain/entities/workspace-ticket-reference';

const random = (secret: string, prefix = 'TK'): TicketReferenceFormat => ({ style: TicketReferenceStyle.RANDOM, prefix, secret });
const sequential = (prefix = 'TK'): TicketReferenceFormat => ({ style: TicketReferenceStyle.SEQUENTIAL, prefix, secret: null });

describe('Ticket references', () => {
  describe('sequential', () => {
    it('shows the counter with the workspace prefix', () => {
      expect(formatTicketReference(42, sequential('SUP'))).toBe('SUP-000042');
    });

    it('reads it back with that prefix, the default one or none', () => {
      const format = sequential('SUP');
      expect(parseTicketReference('SUP-000042', format)).toBe(42);
      expect(parseTicketReference('sup42', format)).toBe(42);
      expect(parseTicketReference('TK-000042', format)).toBe(42);
      expect(parseTicketReference('42', format)).toBe(42);
    });

    it('does not take a word with digits for a reference', () => {
      expect(parseTicketReference('ABC123', sequential('SUP'))).toBeNull();
      expect(parseTicketReference('v2', sequential())).toBeNull();
    });
  });

  describe('random', () => {
    const format = random('workspace-secret');

    it('is a fixed-length code from an unambiguous alphabet', () => {
      for (const n of [1, 2, 3, 42, 999999, 887_503_680]) {
        expect(formatTicketReference(n, format)).toMatch(/^TK-[2-9A-HJKMNP-Z]{7}$/);
      }
    });

    it('never repeats and always reads back, across a large range', () => {
      const seen = new Set<string>();
      for (let n = 1; n <= 20000; n++) {
        const reference = formatTicketReference(n, format);
        expect(seen.has(reference)).toBe(false);
        seen.add(reference);
        expect(parseTicketReference(reference, format)).toBe(n);
      }
    });

    it('reads back at the ends of its range', () => {
      for (const n of [1, 887_503_679, 887_503_680]) {
        expect(parseTicketReference(formatTicketReference(n, format), format)).toBe(n);
      }
    });

    it('gives consecutive tickets unrelated references', () => {
      const a = formatTicketReference(100, format).slice(3);
      const b = formatTicketReference(101, format).slice(3);
      const shared = [...a].filter((char, i) => b[i] === char).length;
      expect(shared).toBeLessThan(4);
    });

    it('depends on the workspace secret', () => {
      expect(formatTicketReference(42, random('one'))).not.toBe(formatTicketReference(42, random('two')));
      expect(parseTicketReference(formatTicketReference(42, random('one')), random('two'))).not.toBe(42);
    });

    it('rejects a mistyped character or two swapped neighbours', () => {
      const reference = formatTicketReference(4242, format);
      const code = reference.slice(3);
      const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
      for (let i = 0; i < code.length; i++) {
        const other = alphabet[(alphabet.indexOf(code[i]) + 1) % alphabet.length];
        const typo = code.slice(0, i) + other + code.slice(i + 1);
        expect(parseTicketReference(`TK-${typo}`, format)).toBeNull();
      }
      const swapped = code[1] + code[0] + code.slice(2);
      if (swapped !== code) expect(parseTicketReference(`TK-${swapped}`, format)).toBeNull();
    });

    it('accepts the code with or without prefix, in any case, and the old counter too', () => {
      const reference = formatTicketReference(77, format);
      expect(parseTicketReference(reference.toLowerCase(), format)).toBe(77);
      expect(parseTicketReference(reference.slice(3), format)).toBe(77);
      expect(parseTicketReference('TK-000077', format)).toBe(77);
    });

    it('falls back to the counter past the range it covers', () => {
      expect(formatTicketReference(887_503_681, format)).toBe('TK-887503681');
    });

    it('is shown as sequential while it has no secret yet', () => {
      expect(formatTicketReference(42, { style: TicketReferenceStyle.RANDOM, prefix: 'TK', secret: null })).toBe('TK-000042');
    });
  });

  describe('prefix', () => {
    it('is 1 to 10 letters or digits, stored in upper case', () => {
      expect(normalizeTicketReferencePrefix(' acme ')).toBe('ACME');
      expect(normalizeTicketReferencePrefix('SUP2')).toBe('SUP2');
      expect(normalizeTicketReferencePrefix('')).toBeNull();
      expect(normalizeTicketReferencePrefix('TOO-LONG-PREFIX')).toBeNull();
      expect(normalizeTicketReferencePrefix('A-B')).toBeNull();
    });
  });
});

describe('Stored ticket references', () => {
  it('shows the reference the ticket was created with, whatever the format is now', () => {
    expect(ticketReferenceOf({ reference: 'OLD-000042', ticketNumber: 42 })).toBe('OLD-000042');
    expect(ticketReferenceOf({ reference: null, ticketNumber: 42 })).toBe('TK-000042');
  });

  it('searches a term as typed and with the workspace prefix', async () => {
    const formats = new TicketReferenceFormats({
      findByWorkspaceId: async () => new WorkspaceTicketReference({ workspaceId: 'ws-1', style: 'random', prefix: 'ACME', secret: 'k' }),
      save: async () => undefined,
    });
    expect(await formats.candidates('ws-1', ' 7qx4m2k ')).toEqual(['7QX4M2K', 'ACME-7QX4M2K']);
    expect(await formats.candidates('ws-1', 'acme-7qx4m2k')).toEqual(['ACME-7QX4M2K']);
    expect(await formats.candidates('ws-1', 'tk-000042')).toEqual(['TK-000042', 'ACME-TK-000042']);
    expect(await formats.candidates('ws-1', '  ')).toEqual([]);
  });
});
