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
  '1.12.0': (data) => data,
};

const VERSION_ORDER = ['1.11.0', '1.12.0'];
const CURRENT_VERSION = '1.12.0';
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
