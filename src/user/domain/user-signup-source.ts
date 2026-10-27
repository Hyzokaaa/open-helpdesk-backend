/**
 * Where a person came from before signing up, as their browser saw it on their first visit:
 * the referring site, the campaign of the link (utm_*) or a ?ref= tag. It is self-reported
 * data, like any analytics, so it is only cleaned and bounded, never trusted for anything else.
 */
export interface UserSignupSource {
  /** What the source amounts to: a known site (`reddit`, `google`…), a tag of the link, a referring host, or `direct` */
  channel: string;
  /** The referring site, host only */
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  ref: string | null;
  /** The first page seen, without its query */
  landingPath: string | null;
  /** When that first visit happened (ISO 8601) */
  firstSeenAt: string | null;
}

export interface RawSignupSource {
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  ref?: unknown;
  landingPath?: unknown;
  firstSeenAt?: unknown;
}

const MAX_TAG = 100;
const MAX_PATH = 200;

/** Known sites by the end of their host; the first match wins. */
const KNOWN_SITES: [string, string][] = [
  ['reddit.com', 'reddit'],
  ['redd.it', 'reddit'],
  ['news.ycombinator.com', 'hacker-news'],
  ['producthunt.com', 'product-hunt'],
  ['github.com', 'github'],
  ['linkedin.com', 'linkedin'],
  ['lnkd.in', 'linkedin'],
  ['t.co', 'x'],
  ['x.com', 'x'],
  ['twitter.com', 'x'],
  ['facebook.com', 'facebook'],
  ['fb.com', 'facebook'],
  ['instagram.com', 'instagram'],
  ['youtube.com', 'youtube'],
  ['youtu.be', 'youtube'],
  ['stackoverflow.com', 'stack-exchange'],
  ['stackexchange.com', 'stack-exchange'],
  ['serverfault.com', 'stack-exchange'],
  ['superuser.com', 'stack-exchange'],
  ['alternativeto.net', 'alternativeto'],
  ['bing.com', 'bing'],
  ['duckduckgo.com', 'duckduckgo'],
  ['yahoo.com', 'yahoo'],
  ['chatgpt.com', 'chatgpt'],
  ['chat.openai.com', 'chatgpt'],
  ['perplexity.ai', 'perplexity'],
  ['claude.ai', 'claude'],
];

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  // Control characters out, spaces collapsed: it is shown in a table, never interpreted
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : null;
}

/** A tag as a lowercase slug, so `Reddit`, `reddit ` and `REDDIT` count as one. */
function tag(value: unknown): string | null {
  const clean = text(value, MAX_TAG)?.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || null;
}

/** The host of a referrer given as a URL or as a bare host. */
function hostOf(value: unknown): string | null {
  const clean = text(value, 500);
  if (!clean) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(clean) ? clean : `https://${clean}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    return /^[a-z0-9.-]+$/.test(host) && host.includes('.') ? host : null;
  } catch {
    return null;
  }
}

/** The known site of a host or tag (`old.reddit.com` → `reddit`, `google.es` → `google`). */
export function knownSite(hostOrTag: string): string | null {
  if (/(^|\.)google\.[a-z.]+$/.test(hostOrTag)) return 'google';
  for (const [suffix, site] of KNOWN_SITES) {
    if (hostOrTag === suffix || hostOrTag.endsWith(`.${suffix}`)) return site;
  }
  return KNOWN_SITES.some(([, site]) => site === hostOrTag) || hostOrTag === 'google' ? hostOrTag : null;
}

/**
 * The cleaned source, or null when the browser sent nothing usable. The channel prefers what
 * the link says (?ref=, then utm_source) over the referrer, which apps and strict browsers drop.
 */
export function normalizeSignupSource(raw: RawSignupSource | null | undefined): UserSignupSource | null {
  if (!raw || typeof raw !== 'object') return null;
  const referrer = hostOf(raw.referrer);
  const ref = tag(raw.ref);
  const utmSource = tag(raw.utmSource);
  const path = text(raw.landingPath, MAX_PATH)?.split(/[?#]/)[0] ?? null;
  const landingPath = path?.startsWith('/') ? path : null;
  const seen = text(raw.firstSeenAt, 40);
  const firstSeenAt = seen && !Number.isNaN(Date.parse(seen)) ? new Date(seen).toISOString() : null;

  const label = ref ?? utmSource;
  const channel = label
    ? knownSite(label) ?? label
    : referrer ? knownSite(referrer) ?? referrer : 'direct';

  return {
    channel,
    referrer,
    utmSource,
    utmMedium: tag(raw.utmMedium),
    utmCampaign: tag(raw.utmCampaign),
    ref,
    landingPath,
    firstSeenAt,
  };
}
