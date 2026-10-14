import { BadRequestException } from '@nestjs/common';
import { findNullCharacter, RejectNullCharactersPipe } from '../../../src/shared/nest/pipes/reject-null-characters.pipe';

describe('RejectNullCharactersPipe', () => {
  const pipe = new RejectNullCharactersPipe();

  it('passes values without null characters through unchanged', () => {
    const body = { name: 'Printer', tags: ['a', 'b'], custom: { region: 'EU', count: 3, ok: true, none: null } };
    expect(pipe.transform(body)).toBe(body);
    expect(pipe.transform('plain')).toBe('plain');
    expect(pipe.transform(undefined)).toBeUndefined();
  });

  it('rejects a null character in a top-level field with its name', () => {
    expect(() => pipe.transform({ imapFolder: 'INBOX\u0000' })).toThrow(new BadRequestException('imapFolder must not contain null characters'));
  });

  it('finds null characters in nested objects and arrays', () => {
    expect(findNullCharacter({ customFields: { region: 'E\u0000U' } })).toBe('customFields.region');
    expect(findNullCharacter({ acceptedAddresses: ['a@x.com', 'b\u0000@x.com'] })).toBe('acceptedAddresses[1]');
  });

  it('rejects a null character in a bare string such as a route param', () => {
    expect(() => pipe.transform('abc\u0000')).toThrow('value must not contain null characters');
  });

  it('ignores binary buffers', () => {
    expect(findNullCharacter({ file: Buffer.from([0, 1, 2]) })).toBeNull();
  });
});
