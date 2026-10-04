import { WorkspaceExportData } from '../workspace-export';

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
  '1.14.0': (data) => data,
};

const VERSION_ORDER = ['1.11.0', '1.12.0', '1.13.0', '1.14.0'];
const CURRENT_VERSION = '1.14.0';
const MIN_VERSION = '1.11.0';

export function applyTransforms(data: WorkspaceExportData): WorkspaceExportData {
  if (!data.version) {
    throw new Error('Export file is missing version field');
  }

  const startIdx = VERSION_ORDER.indexOf(data.version);
  if (startIdx === -1) {
    if (data.version === CURRENT_VERSION) return data;
    throw new Error(`Unsupported export version: ${data.version}. Minimum supported: ${MIN_VERSION}`);
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
