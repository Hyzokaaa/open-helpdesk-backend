import { WorkspaceExportData } from '../workspace-export';
import { DomainValidationError } from '../../../shared/domain/errors';
import { formatTicketReference, ticketReferenceFormatOf } from '../../../ticket/domain/ticket-reference';
import { WorkspaceTicketReference } from '../entities/workspace-ticket-reference';

type Transform = (data: WorkspaceExportData) => WorkspaceExportData;

/** Sections whose rows carry an origin id since 1.17 (the edits only when they carry an id). */
const ORIGIN_SECTIONS = [
  'organizations', 'departments', 'tags', 'categories', 'projects', 'tickets', 'comments',
  'descriptionEdits', 'commentEdits', 'attachments', 'cannedResponses', 'customFields',
  'kbCategories', 'kbArticles',
] as const;

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
    if (!data.departments) data.departments = [];
    if (!data.projects) data.projects = [];
    if (!data.descriptionEdits) data.descriptionEdits = [];
    if (!data.commentEdits) data.commentEdits = [];
    if (!data.kbCategories) data.kbCategories = [];
    if (!data.kbArticles) data.kbArticles = [];
    if (data.workspace && typeof data.workspace === 'object') {
      if (data.workspace.appName === undefined) data.workspace.appName = null;
      if (data.workspace.appSubtitle === undefined) data.workspace.appSubtitle = null;
    }
    data.version = '1.15.0';
    return data;
  },
  '1.15.0': (data) => {
    // 1.15 → 1.16: files travel inside the .ohd archive. Attachments point at them with `file`
    // instead of the source storage key; organizations and the workspace carry their logos.
    // Older files carry no bytes, so their attachments have no file (and are skipped on import)
    // and their logos are absent. A source key is dropped: the import never stores one.
    data.attachments.forEach((a: any) => {
      if (a && typeof a === 'object') {
        a.file = null;
        delete a.s3Key;
      }
    });
    data.organizations.forEach((o: any) => {
      if (o && typeof o === 'object') o.logoFile = null;
    });
    if (data.workspace && typeof data.workspace === 'object') {
      data.workspace.logoFile = null;
      data.workspace.iconFile = null;
    }
    if (!data.missingFiles) data.missingFiles = [];
    data.version = '1.16.0';
    return data;
  },
  '1.16.0': (data) => {
    // 1.16 → 1.17: every entity carries an origin id. Before 1.17 an entity's identity is its own
    // id; edits carried no id and keep none (they are matched by editor and second).
    for (const section of ORIGIN_SECTIONS) {
      const rows = (data as any)[section];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (row && typeof row === 'object' && row.originId == null && typeof row.id === 'string') row.originId = row.id;
      }
    }
    data.version = '1.17.0';
    return data;
  },
  '1.17.0': (data) => {
    // 1.17 → 1.18: the workspace configuration travels too (mailboxes, email rules, the email
    // sender, webhooks, the custom domain). An older file carries none of it and no credentials.
    withConfigurationSections(data);
    data.version = '1.18.0';
    return data;
  },
  '1.18.0': (data) => {
    // 1.18 → 1.19: the workspace's analytics settings travel too. An older file carries none, and
    // a 1.18 file written by hand may leave out the configuration sections: they count as empty.
    withConfigurationSections(data);
    withAnalytics(data);
    data.version = '1.19.0';
    return data;
  },
  '1.19.0': (data) => {
    // 1.19 → 1.20: the ticket reference format travels too. An older file carries none.
    withAnalytics(withConfigurationSections(data));
    withTicketReference(data);
    data.version = '1.20.0';
    return data;
  },
  '1.20.0': (data) => {
    // 1.20 → 1.21: each ticket carries the reference it shows. An older file did not store it:
    // it is the one the file's format gives the ticket's number, which is what the source showed.
    withTicketReferences(withTicketReference(withAnalytics(withConfigurationSections(data))));
    data.version = '1.21.0';
    return data;
  },
  // A 1.21 file written by hand may leave out its newer sections: they count as absent
  '1.21.0': (data) => withTicketReferences(withTicketReference(withAnalytics(withConfigurationSections(data)))),
};

/** Tickets without a stored reference show the one their number has in the file's format. */
function withTicketReferences(data: WorkspaceExportData): WorkspaceExportData {
  const format = ticketReferenceFormatOf(data.ticketReference ? new WorkspaceTicketReference({ workspaceId: '', ...data.ticketReference }) : null);
  for (const ticket of data.tickets ?? []) {
    if (typeof ticket.reference !== 'string' || !ticket.reference.trim()) {
      ticket.reference = formatTicketReference(Number(ticket.ticketNumber) || 0, format);
    }
  }
  return data;
}

/** A file without the 1.20 section shows its references in the default format. */
function withTicketReference(data: WorkspaceExportData): WorkspaceExportData {
  if (data.ticketReference === undefined) data.ticketReference = null;
  return data;
}

/** A file without the 1.19 analytics section carries no analytics settings. */
function withAnalytics(data: WorkspaceExportData): WorkspaceExportData {
  if (data.analytics === undefined) data.analytics = null;
  return data;
}

/** Fills the 1.18 configuration sections a file lacks, leaving the ones it carries. */
function withConfigurationSections(data: WorkspaceExportData): WorkspaceExportData {
  if (data.mailboxes === undefined) data.mailboxes = [];
  if (data.emailRules === undefined) data.emailRules = [];
  if (data.emailSender === undefined) data.emailSender = null;
  if (data.webhooks === undefined) data.webhooks = [];
  if (data.customDomain === undefined) data.customDomain = null;
  if (data.credentialsIncluded === undefined) data.credentialsIncluded = false;
  return data;
}

const VERSION_ORDER = ['1.11.0', '1.12.0', '1.13.0', '1.14.0', '1.15.0', '1.16.0', '1.17.0', '1.18.0', '1.19.0', '1.20.0', '1.21.0'];
const CURRENT_VERSION = '1.21.0';
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
