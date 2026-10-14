import { eachEmailRecipient } from '../../../src/email/domain/each-email-recipient';

describe('eachEmailRecipient', () => {
  it('yields one single-address send per recipient, with its language', () => {
    const byLanguage = new Map([
      ['es', ['carla@x.com', 'colega@x.com']],
      ['en', ['agent@x.com']],
    ]);
    expect(eachEmailRecipient(byLanguage)).toEqual([
      ['es', ['carla@x.com']],
      ['es', ['colega@x.com']],
      ['en', ['agent@x.com']],
    ]);
  });

  it('sends once to an address listed twice', () => {
    expect(eachEmailRecipient(new Map([['es', ['a@x.com', 'a@x.com']]]))).toEqual([['es', ['a@x.com']]]);
  });

  it('yields nothing without recipients', () => {
    expect(eachEmailRecipient(new Map())).toEqual([]);
  });
});
