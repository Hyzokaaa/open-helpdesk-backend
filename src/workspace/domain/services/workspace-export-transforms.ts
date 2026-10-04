import { WorkspaceExportData } from '../workspace-export';
import { DomainValidationError } from '../../../shared/domain/errors';

type Transform = (data: WorkspaceExportData) => WorkspaceExportData;

const TRANSFORMS: Record<string, Transform> = {
  '1.11.0': (data) => {
    // 1.11 → 1.12: add mentionedUserIds to comments, participants, aiCache
    data.comments.forEach((c: any) => {
      if (!c.mentionedUserIds) c.mentionedUserIds = [];
    });
    if (!data.participants) data.participants = [];
    data.tickets.forEach((t: any) => {
      if (!t.firstResponseBreached) t.firstResponseBreached = false;
      if (!t.resolutionBreached) t.resolutionBreached = false;
    });
    data.version = '1.12.0';
    return data;
  },
  '1.12.0': (data) => {
    // 1.12 → 1.13: tickets.category became a FK to ticket_categories. The
    // ticket keeps its category slug; the categories themselves travel in a
    // new top-level list so the import can recreate them by slug.
    if (!data.categories) data.categories = [];
    data.tickets.forEach((t: any) => {
      if (t.category === undefined) t.category = null;
    });
    data.version = '1.13.0';
    return data;
  },
  '1.13.0': (data) => {
    // 1.13 → 1.14: audit entries carry category, level and source. All new fields are
    // optional, so an older file only lacks them and the import uses the column defaults.
    data.version = '1.14.0';
    return data;
  },
  '1.14.0': (data) => {
    // 1.14 → 1.15: users carry isActive (absent means active); the workspace carries its
    // branding text. New sections start empty and new ticket and member fields are absent.
    if (!data.organizations) data.organizations = [];
    if (data.workspace && typeof data.workspace === 'object') {
      if (data.workspace.appName === undefined) data.workspace.appName = null;
      if (data.workspace.appSubtitle === undefined) data.workspace.appSubtitle = null;
    }
    data.version = '1.15.0';
    return data;
  },
  '1.15.0': (data) => data,
};

const VERSION_ORDER = ['1.11.0', '1.12.0', '1.13.0', '1.14.0', '1.15.0'];
const CURRENT_VERSION = '1.15.0';
const MIN_VERSION = '1.11.0';

/** Sections every supported version has; the transforms walk some of them. */
const SECTIONS_IN_EVERY_VERSION = [
  'users', 'tags', 'tickets', 'comments', 'attachments',
  'cannedResponses', 'customFields', 'csatResponses', 'auditLog',
] as const;

/** Negative, zero or positive like a comparator; NaN when either side is not a dotted number. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function applyTransforms(data: WorkspaceExportData): WorkspaceExportData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new DomainValidationError('Invalid export file: expected a JSON object');
  }
  if (typeof data.version !== 'string' || !data.version) {
    throw new DomainValidationError('Invalid export file: the "version" field is missing');
  }

  const startIdx = VERSION_ORDER.indexOf(data.version);
  if (startIdx === -1) {
    if (compareVersions(data.version, CURRENT_VERSION) > 0) {
      throw new DomainValidationError(
        `Export version ${data.version} was made by a newer Open Helpdesk; this server imports up to ${CURRENT_VERSION}. Upgrade it first.`,
      );
    }
    throw new DomainValidationError(
      `Unsupported export version ${data.version}: this server imports versions ${MIN_VERSION} to ${CURRENT_VERSION}`,
    );
  }

  for (const section of SECTIONS_IN_EVERY_VERSION) {
    if (!Array.isArray(data[section])) {
      throw new DomainValidationError(`Invalid export file: "${section}" must be a list`);
    }
  }

  let result = data;
  for (let i = startIdx; i < VERSION_ORDER.length; i++) {
    const transform = TRANSFORMS[VERSION_ORDER[i]];
    if (transform) result = transform(result);
  }

  result.version = CURRENT_VERSION;
  return result;
}

export { CURRENT_VERSION };
