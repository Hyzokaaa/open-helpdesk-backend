import {
  formatTicketNumber,
  parseTicketNumber,
} from '../../../../src/ticket/domain/ticket-number';

describe('formatTicketNumber', () => {
  it('should pad numbers to six digits', () => {
    expect(formatTicketNumber(1)).toBe('TK-000001');
    expect(formatTicketNumber(42)).toBe('TK-000042');
    expect(formatTicketNumber(999999)).toBe('TK-999999');
  });

  it('should keep growing past six digits instead of truncating', () => {
    expect(formatTicketNumber(1000000)).toBe('TK-1000000');
    expect(formatTicketNumber(12345678)).toBe('TK-12345678');
  });

  it('should format the zero left by tickets that never got a number', () => {
    expect(formatTicketNumber(0)).toBe('TK-000000');
  });
});

describe('parseTicketNumber', () => {
  it('should read a bare counter', () => {
    expect(parseTicketNumber('42')).toBe(42);
    expect(parseTicketNumber('  42  ')).toBe(42);
  });

  it('should read the formatted reference in its usual spellings', () => {
    expect(parseTicketNumber('TK-000042')).toBe(42);
    expect(parseTicketNumber('tk-000042')).toBe(42);
    expect(parseTicketNumber('TK000042')).toBe(42);
    expect(parseTicketNumber('TK 42')).toBe(42);
    expect(parseTicketNumber('0000042')).toBe(42);
  });

  it('should not truncate numbers past the padding', () => {
    expect(parseTicketNumber('TK-1000000')).toBe(1000000);
  });

  it('should return null for terms that are not a reference', () => {
    expect(parseTicketNumber('impresora')).toBeNull();
    expect(parseTicketNumber('error 42')).toBeNull();
    expect(parseTicketNumber('TK-')).toBeNull();
    expect(parseTicketNumber('42-TK')).toBeNull();
    expect(parseTicketNumber('')).toBeNull();
  });

  it('should reject zero so it never matches the unnumbered tickets', () => {
    expect(parseTicketNumber('0')).toBeNull();
    expect(parseTicketNumber('TK-000000')).toBeNull();
  });
});
