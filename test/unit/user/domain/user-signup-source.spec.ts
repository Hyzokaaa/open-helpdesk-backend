import { knownSite, normalizeSignupSource } from '../../../../src/user/domain/user-signup-source';

describe('knownSite', () => {
  it('recognises a site by the end of its host, and by its own name as a tag', () => {
    expect(knownSite('old.reddit.com')).toBe('reddit');
    expect(knownSite('reddit')).toBe('reddit');
    expect(knownSite('google.com.mx')).toBe('google');
    expect(knownSite('news.ycombinator.com')).toBe('hacker-news');
    expect(knownSite('t.co')).toBe('x');
  });

  it('does not take a host that only looks like one', () => {
    expect(knownSite('notreddit.com')).toBeNull();
    expect(knownSite('example.com')).toBeNull();
  });
});

describe('normalizeSignupSource', () => {
  it('takes the channel from the referrer, keeping only its host', () => {
    const source = normalizeSignupSource({ referrer: 'https://www.reddit.com/r/selfhosted/comments/abc?x=1' });
    expect(source).toMatchObject({ channel: 'reddit', referrer: 'reddit.com' });
  });

  it('prefers what the link says (?ref=, then utm_source) over the referrer', () => {
    expect(normalizeSignupSource({ ref: 'Reddit', referrer: 'https://t.co/x' })?.channel).toBe('reddit');
    expect(normalizeSignupSource({ utmSource: 'newsletter', referrer: 'https://google.com/' })?.channel).toBe('newsletter');
    expect(normalizeSignupSource({ ref: ' My Partner! ', utmSource: 'google' })).toMatchObject({ channel: 'my-partner', ref: 'my-partner', utmSource: 'google' });
  });

  it('keeps an unknown referring site as its host, and nothing at all as direct', () => {
    expect(normalizeSignupSource({ referrer: 'https://blog.example.org/post' })?.channel).toBe('blog.example.org');
    expect(normalizeSignupSource({ landingPath: '/pricing' })?.channel).toBe('direct');
  });

  it('keeps the landing path without its query, and only real dates', () => {
    const source = normalizeSignupSource({ landingPath: '/pricing?token=secret#plans', firstSeenAt: '2026-10-20T10:00:00.000Z' });
    expect(source).toMatchObject({ landingPath: '/pricing', firstSeenAt: '2026-10-20T10:00:00.000Z' });
    expect(normalizeSignupSource({ landingPath: 'https://evil.example/x', firstSeenAt: 'yesterday' })).toMatchObject({ landingPath: null, firstSeenAt: null });
  });

  it('cleans and bounds what the browser sends', () => {
    const source = normalizeSignupSource({ utmCampaign: `launch\u0000${'x'.repeat(300)}`, referrer: 'javascript:alert(1)', utmMedium: 42 as unknown });
    expect(source?.utmCampaign?.length).toBeLessThanOrEqual(100);
    expect(source?.utmCampaign).not.toContain('\u0000');
    expect(source?.referrer).toBeNull();
    expect(source?.utmMedium).toBeNull();
  });

  it('is null without an object', () => {
    expect(normalizeSignupSource(null)).toBeNull();
    expect(normalizeSignupSource('reddit' as never)).toBeNull();
  });
});
