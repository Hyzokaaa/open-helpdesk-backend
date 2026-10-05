import { DataSource, QueryRunner } from 'typeorm';
import type { Readable } from 'node:stream';
import { ulid } from 'ulid';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { WorkspaceExportAttachment, WorkspaceExportData, WorkspaceExportOrganization } from '../workspace-export';
import { applyTransforms } from './workspace-export-transforms';
import { ExtractMentions } from '../../../comment/domain/services/comment-extract-mentions';
import { DomainValidationError } from '../../../shared/domain/errors';
import { WorkspaceRole } from '../enums/workspace-role.enum';
import { TicketPriority } from '../../../ticket/domain/enums/ticket-priority.enum';
import { TicketStatus } from '../../../ticket/domain/enums/ticket-status.enum';
import { TicketDiscardReason } from '../../../ticket/domain/enums/ticket-discard-reason.enum';
import { TicketSource } from '../../../ticket/domain/enums/ticket-source.enum';
import { ParticipantRole } from '../../../ticket/domain/enums/participant-role.enum';
import { CustomFieldType } from '../../../custom-field/domain/enums/custom-field-type.enum';
import { KbArticleStatus } from '../../../knowledge-base/domain/enums/kb-article-status.enum';
import { KB_SANITIZE_OPTIONS } from '../../../knowledge-base/domain/services/kb-article-create';
import { sanitizeHtml } from '../../../shared/domain/sanitize-html';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { StorageService } from '../../../shared/domain/storage-service';
import { attachmentStorageKey } from '../../../attachment/domain/attachment-storage-key';
import { IMPORT_LINK_ID_MAX, IMPORT_LINK_TYPES, ImportLinkType } from '../workspace-import-link';
import { MailboxType } from '../../../mailbox/domain/enums/mailbox-type.enum';
import { EmailRuleConditionField } from '../../../email-rule/domain/enums/email-rule-condition-field.enum';
import { EmailRuleOperator } from '../../../email-rule/domain/enums/email-rule-operator.enum';
import { EmailRuleActionType } from '../../../email-rule/domain/enums/email-rule-action-type.enum';
import { DOMAIN_REGEX } from './workspace-set-custom-domain';

export interface ImportResult {
  usersCreated: number;
  membersAdded: number;
  organizationsImported: number;
  departmentsImported: number;
  tagsImported: number;
  categoriesImported: number;
  projectsImported: number;
  ticketsImported: number;
  /**
   * Tickets the workspace already has (by identity, else same name, reporter and creation second)
   * that were left as they are: the option to complete them was off, or they lacked nothing.
   */
  ticketsAlreadyPresent: number;
  /**
   * Tickets the workspace already had that this import completed (completeExisting): at least one
   * empty field filled, or a tag, comment, edit, attachment or participant added. What it added
   * is counted in the other counters too.
   */
  ticketsCompleted: number;
  commentsImported: number;
  /** Comments not imported because their author is missing from the file or no longer exists. */
  commentsSkipped: number;
  descriptionEditsImported: number;
  commentEditsImported: number;
  attachmentsImported: number;
  /** Attachments not imported because the file does not carry their bytes (older exports, or missing at export time). */
  attachmentsSkipped: number;
  /** Attachments carried in the file but not imported because their ticket already existed here and was not completed. */
  attachmentsOfExistingTickets: number;
  participantsImported: number;
  cannedResponsesImported: number;
  customFieldsImported: number;
  csatResponsesImported: number;
  kbCategoriesImported: number;
  kbArticlesImported: number;
  auditLogImported: number;
  /** Mailboxes created, always paused; one with the same address here is reused as it is. */
  mailboxesImported: number;
  emailRulesImported: number;
  /** Webhooks created, always inactive; one with the same URL here is reused as it is. */
  webhooksImported: number;
  /** Why the custom domain was not applied although asked for (e.g. another workspace uses it); else null. */
  customDomainSkipped: string | null;
  /** Whether the file carried passwords and secrets. */
  credentialsIncluded: boolean;
  /** The target workspace settings this import overwrote, as asked by the caller. */
  settingsApplied: ImportSetting[];
}

/**
 * Workspace settings an import may overwrite in the target. None is touched unless asked for:
 * palette → metadata.palette (other metadata keys are kept), sla → slaPolicy,
 * description → description, branding → appName, appSubtitle, logo and icon (each when the file
 * carries it), name → name, emailSender → the workspace SMTP sender (only when the file carries
 * its password: without one it could not send), customDomain → customDomain, unverified and with a
 * new verification token (skipped when another workspace uses it).
 */
export const IMPORT_SETTINGS = ['palette', 'sla', 'description', 'branding', 'name', 'emailSender', 'customDomain'] as const;
export type ImportSetting = typeof IMPORT_SETTINGS[number];

/** The files of a decoded .ohd archive, by archive path. */
export interface ImportArchiveFiles {
  /** Size of the file at this path, or null when the archive does not carry it. */
  size(path: string): number | null;
  open(path: string): Readable;
}

export interface ImportOptions {
  overwrite?: string[];
  /** The archive's files. Without them (plain JSON, format 1) no attachment or logo is imported. */
  files?: ImportArchiveFiles;
  /**
   * Complete tickets the workspace already has instead of leaving them alone: fill only their
   * empty fields and add the children they lack. Nothing already there is changed or removed.
   */
  completeExisting?: boolean;
  /** The platform's own hostname, which a workspace cannot take as its custom domain. */
  primaryHost?: string;
  /**
   * Who runs the import. A custom domain held by another workspace is reported by that
   * workspace's name only when they are a member of it or a system admin.
   */
  importer?: { userId: string; isSystemAdmin: boolean };
}

/** Runs SQL: a DataSource or a QueryRunner. */
export interface SqlRunner {
  query(sql: string, params?: unknown[]): Promise<any>;
}

/** Another workspace of this installation that uses a custom domain. */
export interface CustomDomainOwner {
  id: string;
  name: string;
  /** Whether the user asked about is a member of it. */
  isMember: boolean;
}

/** The workspace other than `exceptWorkspaceId` whose custom domain is `domain` (any case), or null. */
export async function findCustomDomainOwner(
  runner: SqlRunner,
  domain: string,
  exceptWorkspaceId: string,
  userId: string | null = null,
): Promise<CustomDomainOwner | null> {
  const rows = await runner.query(
    `SELECT w.id, w.name, EXISTS (SELECT 1 FROM workspace_members m WHERE m."workspaceId" = w.id AND m."userId" = $3) AS "isMember" `
    + `FROM workspaces w WHERE lower(w."customDomain") = $1 AND w.id <> $2 LIMIT 1`,
    [domain.toLowerCase().trim(), exceptWorkspaceId, userId],
  );
  const row = rows?.[0];
  return row ? { id: String(row.id), name: String(row.name ?? ''), isMember: row.isMember === true } : null;
}

/**
 * Why an import did not set a custom domain another workspace uses, and what to do about it. The
 * other workspace is named only to someone who may know it: a member of it or a system admin.
 */
export function customDomainInUseMessage(domain: string, owner: CustomDomainOwner, canSeeOwner: boolean): string {
  const holder = canSeeOwner && owner.name ? `workspace "${owner.name}"` : 'another workspace';
  return `"${domain}" is used by ${holder}. Remove it there (Settings → Custom Domain) and import again with only "Set the custom domain" ticked.`;
}

/** Same types and sizes the branding and organization logo uploads accept. */
const LOGO_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};
const LOGO_MAX_BYTES = 1024 * 1024;
const ICON_MAX_BYTES = 512 * 1024;

/**
 * The objects an import stored before its transaction, keyed by what refers to them. Ids and keys
 * are chosen up front so that the transaction only inserts rows.
 */
interface StoredFiles {
  attachments: Map<WorkspaceExportAttachment, { id: string; key: string; size: number }>;
  /** `newId` is the id a new organization is created with; null when an existing one is reused. */
  organizations: Map<WorkspaceExportOrganization, { targetId: string; newId: string | null; key: string }>;
  workspaceLogo: string | null;
  workspaceIcon: string | null;
}

/** A member of the imported workspace whose account was just created, to be invited to set a password. */
export interface ImportedNewMember {
  userId: string;
  email: string;
  firstName: string;
}

export interface ImportOutcome {
  result: ImportResult;
  newMembers: ImportedNewMember[];
}

const LINK = IMPORT_LINK_TYPES;

/** The identity a row carries in the file: its origin id (1.17), else its own id; null for none. */
function originOf(row: { id?: string; originId?: string }): string | null {
  return row.originId || row.id || null;
}

/** Second-precision timestamp, the grain natural keys compare dates at. */
function secondOf(value: string | Date | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 19) : '';
}

const ticketKey = (name: string, reporterId: string | null, createdAt: string | Date | null) =>
  `${name}|${reporterId}|${secondOf(createdAt)}`;

/** The target workspace's import links, by `type|sourceId`. */
async function loadLinks(qr: QueryRunner, workspaceId: string): Promise<Map<string, string>> {
  const rows = await qr.query(
    `SELECT "entityType", "sourceId", "targetId" FROM workspace_import_links WHERE "workspaceId" = $1`, [workspaceId],
  );
  return new Map(rows.map((r: any) => [`${r.entityType}|${r.sourceId}`, r.targetId]));
}

/**
 * Finds the entity of the target workspace a file row stands for, by identity: (1) the entity a
 * link from an earlier import points at, if it still exists; (2) else an entity whose own id is
 * the origin id (content coming back to the workspace it was exported from). A stale link is
 * ignored. Natural keys (names, slugs...) are the caller's fallback.
 */
class ImportIdentity {
  constructor(private readonly links: Map<string, string>) {}

  find(type: ImportLinkType, originId: string | null, exists: (id: string) => boolean): string | undefined {
    if (!originId) return undefined;
    const linked = this.links.get(`${type}|${originId}`);
    if (linked && exists(linked)) return linked;
    return exists(originId) ? originId : undefined;
  }
}

/** The links this import writes: one per entity it created or matched, the last one per source winning. */
class ImportLinks {
  private readonly rows = new Map<string, { type: ImportLinkType; sourceId: string; targetId: string }>();

  record(type: ImportLinkType, sourceId: string | null, targetId: string | null | undefined): void {
    // An entity matched by its own id needs no link, and an id wider than the column cannot have one
    if (!sourceId || !targetId || sourceId === targetId) return;
    if (sourceId.length > IMPORT_LINK_ID_MAX || targetId.length > IMPORT_LINK_ID_MAX) return;
    this.rows.set(`${type}|${sourceId}`, { type, sourceId, targetId });
  }

  /** A link that already exists is kept, unless it was stale and this import chose another target. */
  async write(qr: QueryRunner, workspaceId: string): Promise<void> {
    const rows = [...this.rows.values()];
    for (let i = 0; i < rows.length; i += 500) {
      const params: unknown[] = [];
      const values = rows.slice(i, i + 500).map((r) => {
        params.push(ulid(), workspaceId, r.type, r.sourceId, r.targetId);
        const n = params.length;
        return `($${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n})`;
      });
      await qr.query(`
        INSERT INTO workspace_import_links (id, "workspaceId", "entityType", "sourceId", "targetId")
        VALUES ${values.join(', ')}
        ON CONFLICT ("workspaceId", "entityType", "sourceId")
        DO UPDATE SET "targetId" = EXCLUDED."targetId" WHERE workspace_import_links."targetId" <> EXCLUDED."targetId"
      `, params);
    }
  }
}

/**
 * The tickets of the target workspace each file ticket stands for: by identity, else by the
 * natural key (same name, reporter and creation second). Shared by the upload planning and the
 * transaction so both decide alike.
 */
function matchTickets(
  tickets: WorkspaceExportData['tickets'],
  existing: { id: string; name: string; reporterId: string; createdAt: string | Date }[],
  identity: ImportIdentity,
  reporterIdFor: (email: string) => string | null,
): Map<string, string> {
  const ids = new Set(existing.map((t) => t.id));
  const byKey = new Map(existing.map((t) => [ticketKey(t.name, t.reporterId, t.createdAt), t.id]));
  const matches = new Map<string, string>();
  for (const t of tickets) {
    let targetId = identity.find(LINK.ticket, originOf(t), (id) => ids.has(id));
    const reporterId = targetId ? null : reporterIdFor(t.reporterEmail);
    if (reporterId) targetId = byKey.get(ticketKey(t.name, reporterId, t.createdAt));
    if (targetId) matches.set(t.id, targetId);
  }
  return matches;
}

const EXISTING_TICKETS_SQL = `SELECT id, name, "reporterId", "createdAt" FROM tickets WHERE "workspaceId" = $1 AND "deletedAt" IS NULL`;

/**
 * The children (comments, edits, attachments) tickets being completed already have, by parent. A
 * file child is already there if identity finds one of the parent's own children, else if one has
 * the same natural key (content imported before links existed). Each existing child stands for
 * one file child at most.
 */
class ExistingChildren<T extends { id: string }> {
  private readonly byParent = new Map<string, T[]>();
  private readonly taken = new Set<string>();

  constructor(rows: T[], parentOf: (row: T) => string) {
    for (const row of rows) {
      const parent = parentOf(row);
      if (!this.byParent.has(parent)) this.byParent.set(parent, []);
      this.byParent.get(parent)!.push(row);
    }
  }

  find(identity: ImportIdentity, type: ImportLinkType, originId: string | null, parentId: string, sameKey: (row: T) => boolean): string | undefined {
    const rows = this.byParent.get(parentId) ?? [];
    const found = identity.find(type, originId, (id) => rows.some((r) => r.id === id))
      ?? rows.find((r) => !this.taken.has(r.id) && sameKey(r))?.id;
    if (found) this.taken.add(found);
    return found;
  }
}

type ExistingAttachment = { id: string; ticketId: string; originalName: string; size: number | string };

const EXISTING_ATTACHMENTS_SQL = `SELECT id, "ticketId", "originalName", size FROM attachments WHERE "ticketId" = ANY($1)`;

/** An attachment's natural key: the name it is shown under and its size. */
const sameAttachment = (a: WorkspaceExportAttachment) => (row: ExistingAttachment) =>
  row.originalName === (a.originalName || a.fileName || 'file') && Number(row.size) === Number(a.size);

/** The markup ExtractMentions reads: `@[Display Name](userId)`. */
const MENTION_MARKUP = /@\[([^\]]+)\]\(([^)]+)\)/g;

const extractMentions = new ExtractMentions();

/** Files exported before 1.14 may carry mentionedUserIds as the raw comma-joined column text. */
function mentionedIdsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === 'string' && id !== '');
  return typeof value === 'string' && value ? value.split(',') : [];
}

/**
 * Checks the shape of an (already upgraded) export before anything is written, so a bad file is
 * a 400 naming the offending field instead of a database error halfway through the transaction.
 */
function overwriteSettingsOf(keys: string[] | undefined): ImportSetting[] {
  const unknown = (keys ?? []).filter((k) => !(IMPORT_SETTINGS as readonly string[]).includes(k));
  if (unknown.length) {
    throw new DomainValidationError(
      `Unknown overwrite setting: ${unknown.join(', ')}. Allowed: ${IMPORT_SETTINGS.join(', ')}`,
    );
  }
  return IMPORT_SETTINGS.filter((k) => keys?.includes(k));
}

function validateExportData(data: WorkspaceExportData): void {
  const fail = (path: string, problem: string): never => {
    throw new DomainValidationError(`Invalid export file: ${path} ${problem}`);
  };
  const isText = (v: unknown) => typeof v === 'string' && v.trim() !== '';
  const isDate = (v: unknown) => (typeof v === 'string' || typeof v === 'number') && !Number.isNaN(new Date(v).getTime());
  const oneOf = (values: object) => Object.values(values) as unknown[];
  const each = (section: string, rows: unknown, check: (row: any, path: string) => void) => {
    if (!Array.isArray(rows)) return fail(`"${section}"`, 'must be a list');
    rows.forEach((row, i) => {
      const path = `${section}[${i}]`;
      if (!row || typeof row !== 'object') fail(path, 'must be an object');
      check(row, path);
    });
  };
  const text = (row: any, path: string, field: string) => {
    if (!isText(row[field])) fail(`${path}.${field}`, 'is required');
  };
  const optionalText = (row: any, path: string, field: string) => {
    if (row[field] != null && typeof row[field] !== 'string') fail(`${path}.${field}`, 'must be text or null');
  };
  const date = (row: any, path: string, field: string) => {
    if (!isDate(row[field])) fail(`${path}.${field}`, 'must be a valid date');
  };
  const optionalDate = (row: any, path: string, field: string) => {
    if (row[field] != null && !isDate(row[field])) fail(`${path}.${field}`, 'must be a valid date or null');
  };
  const member = (row: any, path: string, field: string, values: unknown[], nullable = false) => {
    if (nullable && row[field] == null) return;
    if (!values.includes(row[field])) fail(`${path}.${field}`, `must be one of: ${values.join(', ')}`);
  };

  const ws: any = data.workspace;
  if (!ws || typeof ws !== 'object' || Array.isArray(ws)) fail('"workspace"', 'must be an object');
  const isObjectOrNull = (v: unknown) => v == null || (typeof v === 'object' && !Array.isArray(v));
  if (ws.description != null && typeof ws.description !== 'string') fail('workspace.description', 'must be text or null');
  optionalText(ws, 'workspace', 'name');
  if (!isObjectOrNull(ws.slaPolicy)) fail('workspace.slaPolicy', 'must be an object or null');
  if (!isObjectOrNull(ws.metadata)) fail('workspace.metadata', 'must be an object or null');
  if (ws.metadata?.palette != null && typeof ws.metadata.palette !== 'string') fail('workspace.metadata.palette', 'must be text or null');
  // Column lengths of workspaces.appName / appSubtitle
  for (const [field, max] of [['appName', 50], ['appSubtitle', 30]] as const) {
    optionalText(ws, 'workspace', field);
    if (typeof ws[field] === 'string' && ws[field].length > max) fail(`workspace.${field}`, `must be at most ${max} characters`);
  }

  each('users', data.users, (u, p) => {
    text(u, p, 'email');
    optionalText(u, p, 'id');
    member(u, p, 'role', oneOf(WorkspaceRole), true);
    if (u.isActive != null && typeof u.isActive !== 'boolean') fail(`${p}.isActive`, 'must be true, false or absent');
    optionalText(u, p, 'organizationId');
  });
  const fileRef = (row: any, path: string, field: string) => {
    const ref = row[field];
    if (ref == null) return;
    if (typeof ref !== 'object' || Array.isArray(ref)) fail(`${path}.${field}`, 'must be an object or null');
    optionalText(ref, `${path}.${field}`, 'file');
    optionalText(ref, `${path}.${field}`, 'mimeType');
  };
  fileRef(ws, 'workspace', 'logoFile');
  fileRef(ws, 'workspace', 'iconFile');
  each('organizations', data.organizations, (o, p) => {
    fileRef(o, p, 'logoFile');
    text(o, p, 'id');
    text(o, p, 'name');
    optionalText(o, p, 'description');
    optionalText(o, p, 'notes');
    if (o.domains != null && !(Array.isArray(o.domains) && o.domains.every((d: unknown) => typeof d === 'string'))) {
      fail(`${p}.domains`, 'must be a list of text');
    }
    optionalDate(o, p, 'createdAt');
  });
  each('departments', data.departments, (d, p) => {
    text(d, p, 'id');
    text(d, p, 'name');
    optionalText(d, p, 'description');
    if (!Array.isArray(d.memberEmails) || !d.memberEmails.every(isText)) fail(`${p}.memberEmails`, 'must be a list of emails');
    optionalDate(d, p, 'createdAt');
  });
  each('tags', data.tags, (t, p) => { text(t, p, 'id'); text(t, p, 'name'); });
  each('categories', data.categories, (c, p) => { text(c, p, 'slug'); text(c, p, 'name'); });
  each('projects', data.projects, (pr, p) => {
    text(pr, p, 'id');
    text(pr, p, 'name');
    optionalText(pr, p, 'description');
    if (!Array.isArray(pr.categorySlugs) || !pr.categorySlugs.every(isText)) fail(`${p}.categorySlugs`, 'must be a list of slugs');
    optionalDate(pr, p, 'createdAt');
  });
  each('tickets', data.tickets, (t, p) => {
    text(t, p, 'id');
    text(t, p, 'name');
    text(t, p, 'reporterEmail');
    optionalText(t, p, 'assigneeEmail');
    optionalText(t, p, 'resolvedByEmail');
    date(t, p, 'createdAt');
    optionalDate(t, p, 'updatedAt');
    optionalDate(t, p, 'firstResponseAt');
    optionalDate(t, p, 'resolvedAt');
    member(t, p, 'priority', oneOf(TicketPriority));
    member(t, p, 'status', oneOf(TicketStatus));
    member(t, p, 'discardReason', oneOf(TicketDiscardReason), true);
    if (!Array.isArray(t.tagIds)) fail(`${p}.tagIds`, 'must be a list');
    optionalText(t, p, 'organizationId');
    optionalText(t, p, 'departmentId');
    optionalText(t, p, 'projectId');
    member(t, p, 'source', oneOf(TicketSource), true);
    optionalText(t, p, 'registeredByEmail');
    optionalDate(t, p, 'originDate');
    optionalDate(t, p, 'descriptionEditedAt');
    optionalText(t, p, 'mailboxOriginId');
    if (t.customFields != null && (typeof t.customFields !== 'object' || Array.isArray(t.customFields))) {
      fail(`${p}.customFields`, 'must be an object');
    }
  });
  each('comments', data.comments, (c, p) => {
    text(c, p, 'id');
    text(c, p, 'ticketId');
    optionalText(c, p, 'authorEmail');
    if (typeof c.content !== 'string') fail(`${p}.content`, 'must be text');
    date(c, p, 'createdAt');
  });
  for (const [section, idField] of [['descriptionEdits', 'ticketId'], ['commentEdits', 'commentId']] as const) {
    each(section, data[section], (e, p) => {
      text(e, p, idField);
      if (typeof e.content !== 'string') fail(`${p}.content`, 'must be text');
      optionalText(e, p, 'editedByEmail');
      date(e, p, 'createdAt');
    });
  }
  each('attachments', data.attachments, (a, p) => {
    text(a, p, 'id');
    optionalText(a, p, 'file');
    optionalText(a, p, 'originalName');
    optionalText(a, p, 'mimeType');
    optionalText(a, p, 'ticketId');
    optionalText(a, p, 'uploadedByEmail');
    date(a, p, 'createdAt');
  });
  each('participants', data.participants, (pt, p) => {
    text(pt, p, 'ticketId');
    optionalText(pt, p, 'userEmail');
    member(pt, p, 'role', oneOf(ParticipantRole));
  });
  each('cannedResponses', data.cannedResponses, (cr, p) => {
    text(cr, p, 'id');
    text(cr, p, 'title');
    if (typeof cr.content !== 'string') fail(`${p}.content`, 'must be text');
  });
  each('customFields', data.customFields, (cf, p) => {
    text(cf, p, 'id');
    text(cf, p, 'name');
    member(cf, p, 'type', oneOf(CustomFieldType));
    if (cf.options != null && !(Array.isArray(cf.options) && cf.options.every((o: unknown) => typeof o === 'string'))) {
      fail(`${p}.options`, 'must be a list of text or null');
    }
  });
  each('csatResponses', data.csatResponses, (cs, p) => {
    text(cs, p, 'ticketId');
    if (cs.rating != null && !(Number.isInteger(cs.rating) && cs.rating >= 1 && cs.rating <= 5)) {
      fail(`${p}.rating`, 'must be a whole number from 1 to 5 or null');
    }
  });
  const optionalPosition = (row: any, path: string) => {
    if (row.position != null && !Number.isInteger(row.position)) fail(`${path}.position`, 'must be a whole number');
  };
  each('kbCategories', data.kbCategories, (c, p) => {
    text(c, p, 'id');
    text(c, p, 'name');
    text(c, p, 'slug');
    optionalText(c, p, 'icon');
    optionalPosition(c, p);
  });
  each('kbArticles', data.kbArticles, (a, p) => {
    text(a, p, 'id');
    text(a, p, 'title');
    text(a, p, 'slug');
    text(a, p, 'categoryId');
    if (typeof a.content !== 'string') fail(`${p}.content`, 'must be text');
    member(a, p, 'status', oneOf(KbArticleStatus));
    optionalPosition(a, p);
    optionalText(a, p, 'createdByEmail');
    date(a, p, 'createdAt');
    optionalDate(a, p, 'updatedAt');
  });
  // Workspace configuration (1.18)
  const optionalInteger = (row: any, path: string, field: string, min: number, max = Number.MAX_SAFE_INTEGER) => {
    const v = row[field];
    if (v != null && !(Number.isInteger(v) && v >= min && v <= max)) fail(`${path}.${field}`, `must be a whole number from ${min}${max === Number.MAX_SAFE_INTEGER ? ' up' : ` to ${max}`} or null`);
  };
  const optionalBoolean = (row: any, path: string, field: string) => {
    if (row[field] != null && typeof row[field] !== 'boolean') fail(`${path}.${field}`, 'must be true, false or absent');
  };
  const textList = (row: any, path: string, field: string, optional = false) => {
    if (optional && row[field] == null) return;
    if (!Array.isArray(row[field]) || !row[field].every((v: unknown) => typeof v === 'string')) fail(`${path}.${field}`, 'must be a list of text');
  };
  each('mailboxes', data.mailboxes, (m, p) => {
    text(m, p, 'originId');
    text(m, p, 'address');
    member(m, p, 'type', oneOf(MailboxType));
    for (const field of ['imapHost', 'imapUser', 'imapPass', 'encryption', 'imapFolder', 'addressMode', 'postProcessAction', 'postProcessFolder']) {
      optionalText(m, p, field);
    }
    optionalInteger(m, p, 'imapPort', 1, 65535);
    optionalInteger(m, p, 'pollInterval', 1);
    textList(m, p, 'acceptedAddresses', true);
    optionalBoolean(m, p, 'autoReply');
  });
  each('emailRules', data.emailRules, (r, p) => {
    text(r, p, 'originId');
    text(r, p, 'name');
    optionalPosition(r, p);
    optionalBoolean(r, p, 'isActive');
    textList(r, p, 'mailboxOriginIds');
    each(`${p}.conditions`, r.conditions, (c, cp) => {
      member(c, cp, 'field', oneOf(EmailRuleConditionField));
      member(c, cp, 'operator', oneOf(EmailRuleOperator));
      if (typeof c.value !== 'string') fail(`${cp}.value`, 'must be text');
    });
    each(`${p}.actions`, r.actions, (a, ap) => {
      member(a, ap, 'type', oneOf(EmailRuleActionType));
      optionalText(a, ap, 'value');
    });
  });
  const sender: any = data.emailSender;
  if (sender != null) {
    if (typeof sender !== 'object' || Array.isArray(sender)) fail('"emailSender"', 'must be an object or null');
    text(sender, 'emailSender', 'smtpHost');
    if (!(Number.isInteger(sender.smtpPort) && sender.smtpPort >= 1 && sender.smtpPort <= 65535)) fail('emailSender.smtpPort', 'must be a whole number from 1 to 65535');
    if (typeof sender.smtpUser !== 'string') fail('emailSender.smtpUser', 'must be text');
    text(sender, 'emailSender', 'smtpFrom');
    for (const field of ['smtpPass', 'encryption', 'fromName', 'fromEmail']) optionalText(sender, 'emailSender', field);
  }
  each('webhooks', data.webhooks, (w, p) => {
    text(w, p, 'originId');
    text(w, p, 'url');
    if (!/^https?:\/\//i.test(w.url)) fail(`${p}.url`, 'must be an http or https URL');
    // events is a simple-array column: a comma would split an event in two
    if (!Array.isArray(w.events) || !w.events.every((e: unknown) => isText(e) && !(e as string).includes(','))) {
      fail(`${p}.events`, 'must be a list of event names');
    }
    optionalText(w, p, 'secret');
  });
  if (data.customDomain != null && typeof data.customDomain !== 'string') fail('"customDomain"', 'must be text or null');
  if (typeof data.credentialsIncluded !== 'boolean') fail('"credentialsIncluded"', 'must be true or false');

  const identified = [
    'organizations', 'departments', 'tags', 'categories', 'projects', 'tickets', 'comments', 'descriptionEdits',
    'commentEdits', 'attachments', 'cannedResponses', 'customFields', 'kbCategories', 'kbArticles',
    'mailboxes', 'emailRules', 'webhooks',
  ] as const;
  for (const section of identified) {
    each(section, data[section], (row, p) => {
      optionalText(row, p, 'id');
      optionalText(row, p, 'originId');
    });
  }
  each('auditLog', data.auditLog, (a, p) => {
    text(a, p, 'action');
    text(a, p, 'entityType');
    text(a, p, 'entityId');
    optionalText(a, p, 'userEmail');
    date(a, p, 'createdAt');
    member(a, p, 'category', oneOf(AuditCategory), true);
    member(a, p, 'level', oneOf(AuditLevel), true);
    optionalText(a, p, 'source');
  });
}

function slugToName(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Upgrades an export to the current version and checks its shape; throws DomainValidationError. */
export function prepareImportData(rawData: WorkspaceExportData): WorkspaceExportData {
  const data = applyTransforms(rawData);
  validateExportData(data);
  return data;
}

/** A value an import can apply: null, undefined and '' count as absent, as in ImportWorkspace. */
const present = (v: unknown) => v !== null && v !== undefined && v !== '';

export interface ImportPreview {
  /** The version the file was exported with, before any upgrade. */
  version: string;
  counts: {
    tickets: number;
    comments: number;
    users: number;
    categories: number;
    organizations: number;
    departments: number;
    projects: number;
    kbArticles: number;
    customFields: number;
    cannedResponses: number;
    /** Attachments the file carries, and the files (attachments and logos) in the archive. */
    attachments: number;
    files: number;
    filesBytes: number;
    mailboxes: number;
    emailRules: number;
    webhooks: number;
  };
  /** The workspace settings the file carries a value for; null or false when it has none. */
  settings: {
    palette: string | null;
    sla: boolean;
    description: string | null;
    branding: { appName: string | null; appSubtitle: string | null; logo: boolean; icon: boolean } | null;
    name: string | null;
    /** The sender's from address; hasCredentials says whether its password travels (needed to apply it). */
    emailSender: { fromAddress: string | null; hasCredentials: boolean } | null;
    customDomain: string | null;
    /**
     * Whether another workspace of this installation already uses the file's custom domain, in
     * which case the import skips it. Always false from buildImportPreview: see withCustomDomainConflict.
     */
    customDomainConflict: boolean;
  };
  /** Whether the file carries passwords and secrets. */
  credentialsIncluded: boolean;
}

/** What the decoded archive holds besides the JSON. */
export interface ImportArchiveSummary {
  files: number;
  bytes: number;
}

/** What importing this export would bring in, checked exactly as the import checks it. */
export function buildImportPreview(
  rawData: WorkspaceExportData,
  archive: ImportArchiveSummary = { files: 0, bytes: 0 },
): ImportPreview {
  const fileVersion = rawData && typeof rawData === 'object' ? (rawData as { version?: unknown }).version : undefined;
  const data = prepareImportData(rawData);
  const count = (rows: unknown) => (Array.isArray(rows) ? rows.length : 0);
  const ws = data.workspace;
  const palette = ws.metadata?.palette;
  const text = (v: unknown) => (present(v) ? (v as string) : null);
  return {
    version: typeof fileVersion === 'string' ? fileVersion : data.version,
    counts: {
      tickets: count(data.tickets),
      comments: count(data.comments),
      users: count(data.users),
      categories: count(data.categories),
      organizations: count(data.organizations),
      departments: count(data.departments),
      projects: count(data.projects),
      kbArticles: count(data.kbArticles),
      customFields: count(data.customFields),
      cannedResponses: count(data.cannedResponses),
      attachments: data.attachments.filter((a) => present(a.file)).length,
      files: archive.files,
      filesBytes: archive.bytes,
      mailboxes: count(data.mailboxes),
      emailRules: count(data.emailRules),
      webhooks: count(data.webhooks),
    },
    settings: {
      palette: present(palette) ? String(palette) : null,
      sla: present(ws.slaPolicy),
      description: text(ws.description),
      branding: present(ws.appName) || present(ws.appSubtitle) || present(ws.logoFile?.file) || present(ws.iconFile?.file)
        ? {
          appName: text(ws.appName),
          appSubtitle: text(ws.appSubtitle),
          logo: present(ws.logoFile?.file),
          icon: present(ws.iconFile?.file),
        }
        : null,
      name: text(ws.name),
      emailSender: data.emailSender
        ? {
          fromAddress: text(data.emailSender.fromEmail) ?? text(data.emailSender.smtpFrom),
          hasCredentials: present(data.emailSender.smtpPass),
        }
        : null,
      customDomain: text(data.customDomain),
      customDomainConflict: false,
    },
    credentialsIncluded: data.credentialsIncluded === true,
  };
}

/** The preview with customDomainConflict filled in, checked as the import checks it. */
export async function withCustomDomainConflict(
  runner: SqlRunner,
  preview: ImportPreview,
  targetWorkspaceId: string,
): Promise<ImportPreview> {
  const domain = preview.settings.customDomain;
  const conflict = present(domain) && (await findCustomDomainOwner(runner, String(domain), targetWorkspaceId)) !== null;
  return { ...preview, settings: { ...preview.settings, customDomainConflict: conflict } };
}

export class ImportWorkspace {
  /**
   * Without storage no file is imported. `onCleanupFailure` hears about objects this import
   * stored but could not delete after a rollback (or old logos it could not delete after a commit).
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage?: StorageService,
    private readonly onCleanupFailure?: (key: string, error: unknown) => void,
  ) {}

  async execute(targetWorkspaceId: string, rawData: WorkspaceExportData, options: ImportOptions = {}): Promise<ImportOutcome> {
    const settings = overwriteSettingsOf(options.overwrite);
    const complete = options.completeExisting === true;
    const data = prepareImportData(rawData);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();

    // Every object this import stores gets a new key for the target. A storage key from the file is
    // never used: it could point at another workspace's files.
    const storedKeys: string[] = [];
    const usedKeys = new Set<string>();
    const replacedKeys: string[] = [];
    const use = (key: string) => { usedKeys.add(key); return key; };

    const result: ImportResult = {
      usersCreated: 0, membersAdded: 0, organizationsImported: 0, departmentsImported: 0, tagsImported: 0, categoriesImported: 0, projectsImported: 0, ticketsImported: 0,
      ticketsAlreadyPresent: 0, commentsImported: 0, commentsSkipped: 0, descriptionEditsImported: 0, commentEditsImported: 0, attachmentsImported: 0, attachmentsSkipped: 0,
      ticketsCompleted: 0, attachmentsOfExistingTickets: 0, participantsImported: 0,
      cannedResponsesImported: 0, customFieldsImported: 0, csatResponsesImported: 0,
      kbCategoriesImported: 0, kbArticlesImported: 0, auditLogImported: 0,
      mailboxesImported: 0, emailRulesImported: 0, webhooksImported: 0, customDomainSkipped: null,
      credentialsIncluded: data.credentialsIncluded === true, settingsApplied: [],
    };
    const newMembers: ImportedNewMember[] = [];

    try {
      // Files are stored before the transaction starts, so no lock is held while bytes move
      const stored = await this.storeArchiveFiles(qr, targetWorkspaceId, data, settings, options.files, storedKeys, complete);
      await qr.startTransaction();
      try {
        // 0. Workspace settings — only the ones the caller asked to overwrite, and only when the file
        // carries a value: asking to overwrite something the file lacks must not clear the target's
        const ws = data.workspace;
        const params: unknown[] = [targetWorkspaceId];
        const sets: string[] = [];
        const set = (assignment: (param: string) => string, value: unknown) => {
          params.push(value);
          sets.push(assignment(`$${params.length}`));
        };
        const current = settings.includes('branding')
          ? (await qr.query(`SELECT logo, icon FROM workspaces WHERE id = $1`, [targetWorkspaceId]))[0] ?? {}
          : {};
        for (const key of settings) {
          if (key === 'branding') {
            // Keys of their own, not the upload endpoint's fixed logo.<ext>: storing over the current
            // logo would destroy it if this import then rolled back
            const logo = stored.workspaceLogo ? use(stored.workspaceLogo) : null;
            const icon = stored.workspaceIcon ? use(stored.workspaceIcon) : null;
            const text = present(ws.appName) || present(ws.appSubtitle);
            if (!text && !logo && !icon) continue;
            if (text) {
              set((v) => `"appName" = ${v}`, ws.appName ?? null);
              set((v) => `"appSubtitle" = ${v}`, ws.appSubtitle ?? null);
            }
            if (logo) {
              set((v) => `logo = ${v}`, logo);
              if (current.logo) replacedKeys.push(current.logo);
            }
            if (icon) {
              set((v) => `icon = ${v}`, icon);
              if (current.icon) replacedKeys.push(current.icon);
            }
            result.settingsApplied.push(key);
            continue;
          }
          if (key === 'emailSender') {
            // Only a sender the file carries a password for: a workspace with a sender sends all its
            // mail through it, so one that cannot authenticate would silently stop every email
            const sender = data.emailSender;
            if (!sender || !present(sender.smtpPass)) continue;
            await qr.query(`
              INSERT INTO workspace_email_senders (id, "workspaceId", "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom", encryption, "fromName", "fromEmail")
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT ("workspaceId") DO UPDATE SET
                "smtpHost" = EXCLUDED."smtpHost", "smtpPort" = EXCLUDED."smtpPort", "smtpUser" = EXCLUDED."smtpUser",
                "smtpPass" = EXCLUDED."smtpPass", "smtpFrom" = EXCLUDED."smtpFrom", encryption = EXCLUDED.encryption,
                "fromName" = EXCLUDED."fromName", "fromEmail" = EXCLUDED."fromEmail", "updatedAt" = now()
            `, [
              ulid(), targetWorkspaceId, sender.smtpHost, sender.smtpPort, sender.smtpUser, sender.smtpPass, sender.smtpFrom,
              sender.encryption || 'tls', sender.fromName ?? null, sender.fromEmail ?? null,
            ]);
            result.settingsApplied.push(key);
            continue;
          }
          if (key === 'customDomain') {
            if (!present(data.customDomain)) continue;
            const domain = String(data.customDomain).toLowerCase().trim();
            const skip = (reason: string) => { result.customDomainSkipped = reason; };
            if (!DOMAIN_REGEX.test(domain)) { skip(`"${domain}" is not a valid domain`); continue; }
            if (options.primaryHost && options.primaryHost.toLowerCase() === domain) {
              skip(`"${domain}" is the platform's own URL`);
              continue;
            }
            const [own] = await qr.query(`SELECT "customDomain" FROM workspaces WHERE id = $1`, [targetWorkspaceId]);
            // Already this workspace's domain: kept as it is, so a verified domain stays verified
            if ((own?.customDomain ?? '').toLowerCase() === domain) {
              result.settingsApplied.push(key);
              continue;
            }
            const owner = await findCustomDomainOwner(qr, domain, targetWorkspaceId, options.importer?.userId ?? null);
            if (owner) {
              skip(customDomainInUseMessage(domain, owner, owner.isMember || options.importer?.isSystemAdmin === true));
              continue;
            }
            // Unverified, with a new token generated as SetCustomDomain does: the DNS proof is redone here
            set((v) => `"customDomain" = ${v}`, domain);
            sets.push('"customDomainVerified" = false');
            set((v) => `"domainVerificationToken" = ${v}`, `oh-verify=${randomBytes(16).toString('hex')}`);
          } else if (key === 'name' && present(ws.name)) {
            set((v) => `name = ${v}`, ws.name);
          } else if (key === 'palette' && present(ws.metadata?.palette)) {
            set((v) => `metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('palette', ${v}::text)`, ws.metadata?.palette);
          } else if (key === 'sla' && present(ws.slaPolicy)) {
            set((v) => `"slaPolicy" = ${v}`, JSON.stringify(ws.slaPolicy));
          } else if (key === 'description' && present(ws.description)) {
            set((v) => `description = ${v}`, ws.description);
          } else {
            continue;
          }
          result.settingsApplied.push(key);
        }
        if (sets.length) await qr.query(`UPDATE workspaces SET ${sets.join(', ')} WHERE id = $1`, params);

        // 1. Collect ALL referenced emails across the entire export
        const allEmailsSet = new Set<string>();
        for (const u of data.users) allEmailsSet.add(u.email);
        for (const t of data.tickets) {
          allEmailsSet.add(t.reporterEmail);
          if (t.assigneeEmail) allEmailsSet.add(t.assigneeEmail);
          if (t.resolvedByEmail) allEmailsSet.add(t.resolvedByEmail);
          if (t.registeredByEmail) allEmailsSet.add(t.registeredByEmail);
        }
        for (const c of data.comments) { if (c.authorEmail) allEmailsSet.add(c.authorEmail); }
        for (const a of data.attachments) { if (a.uploadedByEmail) allEmailsSet.add(a.uploadedByEmail); }
        for (const e of [...data.descriptionEdits, ...data.commentEdits]) { if (e.editedByEmail) allEmailsSet.add(e.editedByEmail); }
        for (const p of data.participants) { if (p.userEmail) allEmailsSet.add(p.userEmail); }
        for (const a of data.kbArticles) { if (a.createdByEmail) allEmailsSet.add(a.createdByEmail); }
        for (const d of data.departments) for (const email of d.memberEmails) allEmailsSet.add(email);
        // System and anonymous portal events have no user; they keep a null userId on import
        for (const a of data.auditLog) { if (a.userEmail) allEmailsSet.add(a.userEmail); }

        const allEmails = [...allEmailsSet];

        // Map existing users by email
        const emailToUserId = new Map<string, string>();
        if (allEmails.length) {
          const existingUsers = await qr.query(
            `SELECT id, email FROM users WHERE email = ANY($1)`, [allEmails],
          );
          for (const u of existingUsers) emailToUserId.set(u.email, u.id);
        }

        // Create missing users. The file only names them, so nobody may sign in as them yet: the
        // password is the hash of a random secret that is thrown away, and the email is not verified.
        // Members are invited to set a password; people who only appear in the history (old
        // reporters, authors) are created like inbound email senders and can recover access later.
        // An account deactivated in the source stays deactivated: it keeps its membership and
        // history, but is not invited. An account that already exists here is left as it is.
        const unusablePassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
        // users also lists non-members the history refers to (role null): named, but not members
        const knownUsers = new Map(data.users.map((u) => [u.email, u]));
        for (const email of allEmails) {
          if (!emailToUserId.has(email)) {
            const id = ulid();
            const known = knownUsers.get(email);
            const member = known?.role ? known : undefined;
            const isActive = known?.isActive !== false;
            const firstName = known?.firstName ?? email.split('@')[0];
            await qr.query(`
              INSERT INTO users (id, email, password, "firstName", "lastName", "isActive", "isSystemAdmin", "isEmailVerified", "autoCreated")
              VALUES ($1, $2, $3, $4, $5, $6, false, false, $7)
            `, [id, email, unusablePassword, firstName, known?.lastName ?? '', isActive, !member]);
            emailToUserId.set(email, id);
            result.usersCreated++;
            if (member && isActive) newMembers.push({ userId: id, email, firstName });
          }
        }

        const userIdFor = (email: string | null) => email ? (emailToUserId.get(email) ?? null) : null;

        // Source user id → target user id, for ids carried inside the data (mentions, audit). Files
        // before 1.14 list no ids; an id that is already a user here (same instance) is kept as is.
        const sourceUserIdMap = new Map<string, string>();
        for (const u of data.users) {
          const targetId = u.id ? emailToUserId.get(u.email) : undefined;
          if (u.id && targetId) sourceUserIdMap.set(u.id, targetId);
        }
        const unmappedIds = new Set<string>();
        for (const c of data.comments) {
          for (const id of [...mentionedIdsOf(c.mentionedUserIds), ...extractMentions.execute(c.content ?? '')]) {
            if (!sourceUserIdMap.has(id)) unmappedIds.add(id);
          }
        }
        for (const e of data.commentEdits) {
          for (const id of extractMentions.execute(e.content ?? '')) {
            if (!sourceUserIdMap.has(id)) unmappedIds.add(id);
          }
        }
        if (unmappedIds.size) {
          const sameInstance = await qr.query(`SELECT id FROM users WHERE id = ANY($1)`, [[...unmappedIds]]);
          for (const u of sameInstance) sourceUserIdMap.set(u.id, u.id);
        }
        // Mentions point at target users; a mention of someone unknown here degrades to plain text
        const remapMentionMarkup = (content: string) => content.replace(MENTION_MARKUP, (_markup: string, name: string, id: string) => {
          const targetId = sourceUserIdMap.get(id);
          return targetId ? `@[${name}](${targetId})` : `@${name}`;
        });

        // Identity: what earlier imports created or matched here. Every entity this import creates
        // or matches is linked in turn, so the next import of the same content finds it by identity
        // even after it was renamed here.
        const identity = new ImportIdentity(await loadLinks(qr, targetWorkspaceId));
        const links = new ImportLinks();
        const idsOf = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));

        // 1b. Organizations — before members and tickets, which point at them. One the target
        // workspace already has (by identity, else by name) is reused, and gets the carried logo
        // only if it has none.
        const organizationIdMap = new Map<string, string>();
        const existingOrganizations = await qr.query(
          `SELECT id, name, logo FROM organizations WHERE "workspaceId" = $1 AND "deletedAt" IS NULL`, [targetWorkspaceId],
        );
        const existingOrganizationIds = idsOf(existingOrganizations);
        const organizationIdByName = new Map<string, string>(existingOrganizations.map((o: any) => [o.name, o.id]));
        const organizationsWithLogo = new Set<string>(existingOrganizations.filter((o: any) => o.logo).map((o: any) => o.id));
        for (const o of data.organizations) {
          let targetId = identity.find(LINK.organization, originOf(o), (id) => existingOrganizationIds.has(id))
            ?? organizationIdByName.get(o.name);
          const logo = stored.organizations.get(o);
          if (targetId && !organizationsWithLogo.has(targetId) && logo?.targetId === targetId) {
            await qr.query(`UPDATE organizations SET logo = $2 WHERE id = $1`, [targetId, use(logo.key)]);
            organizationsWithLogo.add(targetId);
          }
          if (!targetId) {
            targetId = logo?.newId ?? ulid();
            // domains is jsonb: node-pg would send a bare array as a Postgres array literal
            await qr.query(`
              INSERT INTO organizations (id, name, description, notes, domains, "workspaceId", "createdAt")
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [targetId, o.name, o.description ?? null, o.notes ?? null, JSON.stringify(o.domains ?? []), targetWorkspaceId, o.createdAt ?? new Date().toISOString()]);
            organizationIdByName.set(o.name, targetId);
            result.organizationsImported++;
            if (logo?.newId === targetId) {
              await qr.query(`UPDATE organizations SET logo = $2 WHERE id = $1`, [targetId, use(logo.key)]);
              organizationsWithLogo.add(targetId);
            }
          }
          organizationIdMap.set(o.id, targetId);
          links.record(LINK.organization, originOf(o), targetId);
        }
        const organizationIdFor = (id: string | null | undefined) => id ? (organizationIdMap.get(id) ?? null) : null;

        // 2. Add workspace members (skip if already member). An existing member keeps the
        // organization it has here; one without any gets the imported one.
        for (const u of data.users) {
          const userId = emailToUserId.get(u.email);
          if (!userId || !u.role) continue;
          const organizationId = organizationIdFor(u.organizationId);
          const exists = await qr.query(
            `SELECT 1 FROM workspace_members WHERE "workspaceId" = $1 AND "userId" = $2`, [targetWorkspaceId, userId],
          );
          if (!exists.length) {
            await qr.query(`
              INSERT INTO workspace_members (id, "workspaceId", "userId", role, "organizationId")
              VALUES ($1, $2, $3, $4, $5)
            `, [ulid(), targetWorkspaceId, userId, u.role, organizationId]);
            result.membersAdded++;
          } else if (organizationId) {
            await qr.query(`
              UPDATE workspace_members SET "organizationId" = $3
              WHERE "workspaceId" = $1 AND "userId" = $2 AND "organizationId" IS NULL
            `, [targetWorkspaceId, userId, organizationId]);
          }
        }

        // 2b. Departments and their members — before tickets. One the target workspace already has
        // (by identity, else by name) is reused; its members are added to, never replaced.
        const departmentIdMap = new Map<string, string>();
        const existingDepartments = await qr.query(
          `SELECT id, name FROM departments WHERE "workspaceId" = $1 AND "deletedAt" IS NULL`, [targetWorkspaceId],
        );
        const existingDepartmentIds = idsOf(existingDepartments);
        const departmentIdByName = new Map<string, string>(existingDepartments.map((d: any) => [d.name, d.id]));
        for (const d of data.departments) {
          let targetId = identity.find(LINK.department, originOf(d), (id) => existingDepartmentIds.has(id))
            ?? departmentIdByName.get(d.name);
          if (!targetId) {
            targetId = ulid();
            await qr.query(`
              INSERT INTO departments (id, name, description, "workspaceId", "createdAt")
              VALUES ($1, $2, $3, $4, $5)
            `, [targetId, d.name, d.description ?? null, targetWorkspaceId, d.createdAt ?? new Date().toISOString()]);
            departmentIdByName.set(d.name, targetId);
            result.departmentsImported++;
          }
          departmentIdMap.set(d.id, targetId);
          links.record(LINK.department, originOf(d), targetId);
          for (const email of d.memberEmails) {
            const userId = userIdFor(email);
            if (!userId) continue;
            await qr.query(`
              INSERT INTO department_members (id, "departmentId", "userId")
              VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
            `, [ulid(), targetId, userId]);
          }
        }
        const departmentIdFor = (id: string | null | undefined) => id ? (departmentIdMap.get(id) ?? null) : null;

        // 3. Tags — map old ID → new ID, reuse existing by identity, else by name
        const tagIdMap = new Map<string, string>();
        const existingTags = await qr.query(
          `SELECT id, name FROM tags WHERE "workspaceId" = $1`, [targetWorkspaceId],
        );
        const existingTagIds = idsOf(existingTags);
        const existingTagsByName = new Map<string, string>();
        for (const t of existingTags) existingTagsByName.set(t.name, t.id);

        for (const tag of data.tags) {
          const existingId = identity.find(LINK.tag, originOf(tag), (id) => existingTagIds.has(id))
            ?? existingTagsByName.get(tag.name);
          if (existingId) {
            tagIdMap.set(tag.id, existingId);
            links.record(LINK.tag, originOf(tag), existingId);
          } else {
            const newId = ulid();
            await qr.query(`
              INSERT INTO tags (id, name, color, "workspaceId", "createdAt")
              VALUES ($1, $2, $3, $4, $5)
            `, [newId, tag.name, tag.color, targetWorkspaceId, tag.createdAt]);
            tagIdMap.set(tag.id, newId);
            existingTagsByName.set(tag.name, newId);
            links.record(LINK.tag, originOf(tag), newId);
            result.tagsImported++;
          }
        }

        // 3b. Categories — resolve by identity, else by slug, reuse the target workspace's own,
        // create the rest. Files older than 1.13 carry no categories list, only the slug on each
        // ticket. Tickets and projects name categories by the file's slug, which a category matched
        // by identity may no longer have here: they resolve through `categoryIdByFileSlug`.
        const categoryIdBySlug = new Map<string, string>();
        const existingCategories = await qr.query(
          `SELECT id, slug FROM ticket_categories WHERE "workspaceId" = $1`, [targetWorkspaceId],
        );
        for (const c of existingCategories) categoryIdBySlug.set(c.slug, c.id);
        const existingCategoryIds = idsOf(existingCategories);
        const categoryIdByFileSlug = new Map<string, string>();
        for (const c of data.categories ?? []) {
          const matched = identity.find(LINK.category, originOf(c), (id) => existingCategoryIds.has(id));
          if (matched && !categoryIdByFileSlug.has(c.slug)) categoryIdByFileSlug.set(c.slug, matched);
        }

        const wanted = new Map<string, { name: string; color: string; createdAt: string | null }>();
        for (const c of data.categories ?? []) {
          wanted.set(c.slug, { name: c.name, color: c.color ?? 'blue', createdAt: c.createdAt ?? null });
        }
        for (const slug of [...data.tickets.map((t) => t.category), ...data.projects.flatMap((p) => p.categorySlugs)]) {
          if (slug && !wanted.has(slug)) {
            wanted.set(slug, { name: slugToName(slug), color: 'blue', createdAt: null });
          }
        }
        for (const [slug, c] of wanted) {
          if (categoryIdByFileSlug.has(slug)) continue;
          const existingId = categoryIdBySlug.get(slug);
          if (existingId) {
            categoryIdByFileSlug.set(slug, existingId);
            continue;
          }
          const newId = ulid();
          await qr.query(`
            INSERT INTO ticket_categories (id, name, slug, color, "workspaceId", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [newId, c.name, slug, c.color, targetWorkspaceId, c.createdAt ?? new Date().toISOString()]);
          categoryIdBySlug.set(slug, newId);
          categoryIdByFileSlug.set(slug, newId);
          result.categoriesImported++;
        }
        for (const c of data.categories ?? []) links.record(LINK.category, originOf(c), categoryIdByFileSlug.get(c.slug));
        const categoryIdFor = (slug: string | null | undefined) => slug ? (categoryIdByFileSlug.get(slug) ?? null) : null;

        // 3c. Projects and their categories — after categories, before tickets. One the target
        // workspace already has (by identity, else by name) is reused; its category links are added
        // to, never replaced.
        const projectIdMap = new Map<string, string>();
        const existingProjects = await qr.query(
          `SELECT id, name FROM projects WHERE "workspaceId" = $1 AND "deletedAt" IS NULL`, [targetWorkspaceId],
        );
        const existingProjectIds = idsOf(existingProjects);
        const projectIdByName = new Map<string, string>(existingProjects.map((p: any) => [p.name, p.id]));
        for (const p of data.projects) {
          let targetId = identity.find(LINK.project, originOf(p), (id) => existingProjectIds.has(id))
            ?? projectIdByName.get(p.name);
          if (!targetId) {
            targetId = ulid();
            await qr.query(`
              INSERT INTO projects (id, name, description, "workspaceId", "createdAt")
              VALUES ($1, $2, $3, $4, $5)
            `, [targetId, p.name, p.description ?? null, targetWorkspaceId, p.createdAt ?? new Date().toISOString()]);
            projectIdByName.set(p.name, targetId);
            result.projectsImported++;
          }
          projectIdMap.set(p.id, targetId);
          links.record(LINK.project, originOf(p), targetId);
          for (const slug of p.categorySlugs) {
            const categoryId = categoryIdFor(slug);
            if (!categoryId) continue;
            await qr.query(
              `INSERT INTO project_categories ("projectId", "categoryId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [targetId, categoryId],
            );
          }
        }
        const projectIdFor = (id: string | null | undefined) => id ? (projectIdMap.get(id) ?? null) : null;

        // 3d. Custom fields — before tickets, whose values are keyed by definition id. A definition the
        // target workspace has by identity, or one with the same name and type, is reused.
        const customFieldIdMap = new Map<string, string>();
        const existingFields = await qr.query(
          `SELECT id, name, type FROM custom_field_definitions WHERE "workspaceId" = $1`, [targetWorkspaceId],
        );
        const fieldKey = (name: string, type: string) => `${name}|${type}`;
        const existingFieldIds = new Map<string, string>(
          existingFields.map((f: any) => [fieldKey(f.name, f.type), f.id]),
        );
        const existingFieldIdSet = idsOf(existingFields);
        for (const cf of data.customFields) {
          const existingId = identity.find(LINK.customField, originOf(cf), (id) => existingFieldIdSet.has(id))
            ?? existingFieldIds.get(fieldKey(cf.name, cf.type));
          if (existingId) {
            customFieldIdMap.set(cf.id, existingId);
            links.record(LINK.customField, originOf(cf), existingId);
            continue;
          }
          const newId = ulid();
          // options is jsonb: node-pg would send a bare array as a Postgres array literal
          await qr.query(`
            INSERT INTO custom_field_definitions (id, name, type, options, position, required, "workspaceId", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [newId, cf.name, cf.type, cf.options == null ? null : JSON.stringify(cf.options), cf.position, cf.required, targetWorkspaceId, cf.createdAt]);
          customFieldIdMap.set(cf.id, newId);
          existingFieldIds.set(fieldKey(cf.name, cf.type), newId);
          links.record(LINK.customField, originOf(cf), newId);
          result.customFieldsImported++;
        }
        // Values whose definition is not in the file have nothing to point at and are dropped
        const remapCustomFields = (values: Record<string, unknown> | null | undefined) => {
          const remapped: Record<string, unknown> = {};
          for (const [oldId, value] of Object.entries(values ?? {})) {
            const newId = customFieldIdMap.get(oldId);
            if (newId) remapped[newId] = value;
          }
          return remapped;
        };

        // 3e. Mailboxes — before tickets, which point at them. One the target workspace already has (by
        // identity, else by address) is reused as it is; the rest are created paused, so nothing is
        // polled until someone reviews and activates them here. Without a password in the file the
        // IMAP password stays NULL, which the poller and the connection test treat as unconfigured.
        const mailboxIdMap = new Map<string, string>();
        /** File mailbox id (and origin id) → target id, for audit entries. */
        const mailboxIdBySourceId = new Map<string, string>();
        const existingMailboxes = await qr.query(
          `SELECT id, address FROM mailboxes WHERE "workspaceId" = $1`, [targetWorkspaceId],
        );
        const existingMailboxIds = idsOf(existingMailboxes);
        const mailboxIdByAddress = new Map<string, string>(existingMailboxes.map((m: any) => [String(m.address).toLowerCase(), m.id]));
        for (const m of data.mailboxes) {
          const origin = originOf(m);
          let targetId = identity.find(LINK.mailbox, origin, (id) => existingMailboxIds.has(id))
            ?? mailboxIdByAddress.get(m.address.toLowerCase());
          if (!targetId) {
            targetId = ulid();
            await qr.query(`
              INSERT INTO mailboxes (
                id, address, "workspaceId", "isActive", type, "imapHost", "imapPort", "imapUser", "imapPass",
                encryption, "imapFolder", "pollInterval", "addressMode", "acceptedAddresses", "autoReply",
                "postProcessAction", "postProcessFolder"
              ) VALUES ($1, $2, $3, false, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            `, [
              targetId, m.address, targetWorkspaceId, m.type, m.imapHost ?? null, m.imapPort ?? null, m.imapUser ?? null,
              present(m.imapPass) ? m.imapPass : null, m.encryption || 'tls', m.imapFolder ?? 'INBOX', m.pollInterval ?? 30,
              m.addressMode || 'address', JSON.stringify(m.acceptedAddresses ?? []), m.autoReply !== false,
              m.postProcessAction || 'none', m.postProcessFolder ?? null,
            ]);
            mailboxIdByAddress.set(m.address.toLowerCase(), targetId);
            result.mailboxesImported++;
          }
          if (origin) mailboxIdMap.set(origin, targetId);
          for (const id of [m.id, origin]) if (id) mailboxIdBySourceId.set(id, targetId);
          links.record(LINK.mailbox, origin, targetId);
        }
        const mailboxIdFor = (originId: string | null | undefined) => originId ? (mailboxIdMap.get(originId) ?? null) : null;

        // 3f. Email rules — after mailboxes and the catalog their actions name. One the target
        // workspace already has (by identity, else by name) is left as it is. Mailbox ids and action
        // values are remapped to this workspace; what cannot be is dropped, so a rule never points
        // at another workspace's rows. A rule limited to mailboxes none of which could be mapped
        // would apply to every mailbox: it is created inactive instead.
        const categoryIdBySourceId = new Map<string, string>();
        for (const c of data.categories) {
          const targetId = categoryIdByFileSlug.get(c.slug);
          if (targetId) categoryIdBySourceId.set(c.id, targetId);
        }
        const remapAction = (action: { type: string; value?: string }): { type: string; value?: string } | null => {
          const one = (map: { get(id: string): string | undefined }) => {
            const targetId = action.value ? map.get(action.value) : undefined;
            return targetId ? { type: action.type, value: targetId } : null;
          };
          switch (action.type) {
            case EmailRuleActionType.SET_DEPARTMENT: return one(departmentIdMap);
            case EmailRuleActionType.SET_CATEGORY: return one(categoryIdBySourceId);
            case EmailRuleActionType.SET_ORGANIZATION: return one(organizationIdMap);
            case EmailRuleActionType.ASSIGN_TO: return one(sourceUserIdMap);
            case EmailRuleActionType.ADD_TAGS: {
              const tagIds = (action.value ?? '').split(',').map((id) => tagIdMap.get(id)).filter((id): id is string => !!id);
              return tagIds.length ? { type: action.type, value: tagIds.join(',') } : null;
            }
            default: return action.value == null ? { type: action.type } : { type: action.type, value: action.value };
          }
        };
        const emailRuleIdBySourceId = new Map<string, string>();
        const existingRules = await qr.query(`SELECT id, name FROM email_rules WHERE "workspaceId" = $1`, [targetWorkspaceId]);
        const existingRuleIds = idsOf(existingRules);
        const ruleIdByName = new Map<string, string>(existingRules.map((r: any) => [r.name, r.id]));
        for (const r of data.emailRules) {
          const origin = originOf(r);
          let targetId = identity.find(LINK.emailRule, origin, (id) => existingRuleIds.has(id)) ?? ruleIdByName.get(r.name);
          if (!targetId) {
            targetId = ulid();
            const mailboxIds = [...new Set(r.mailboxOriginIds.map((id) => mailboxIdMap.get(id)).filter((id): id is string => !!id))];
            const widened = r.mailboxOriginIds.length > 0 && mailboxIds.length === 0;
            const actions = r.actions.map(remapAction).filter((a): a is { type: string; value?: string } => !!a);
            await qr.query(`
              INSERT INTO email_rules (id, "workspaceId", name, position, "isActive", "mailboxIds", conditions, actions)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              targetId, targetWorkspaceId, r.name, r.position ?? 0, r.isActive !== false && !widened,
              JSON.stringify(mailboxIds), JSON.stringify(r.conditions), JSON.stringify(actions),
            ]);
            ruleIdByName.set(r.name, targetId);
            result.emailRulesImported++;
          }
          for (const id of [r.id, origin]) if (id) emailRuleIdBySourceId.set(id, targetId);
          links.record(LINK.emailRule, origin, targetId);
        }

        // 4. Tickets — map old ID → new ID, skip duplicates
        const ticketIdMap = new Map<string, string>();
        // Same lock as TypeOrmTicketRepository.create, so a ticket created meanwhile cannot take a number
        await qr.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [targetWorkspaceId]);
        const maxNumResult = await qr.query(
          `SELECT COALESCE(MAX("ticketNumber"), 0) as max FROM tickets WHERE "workspaceId" = $1`, [targetWorkspaceId],
        );
        let ticketNumber = Number(maxNumResult[0].max);

        // Tickets the workspace already has (by identity, else same name, reporter and second)
        const existingTickets = await qr.query(EXISTING_TICKETS_SQL, [targetWorkspaceId]);
        const ticketMatches = matchTickets(data.tickets, existingTickets, identity, userIdFor);
        // A ticket skipped as already imported still anchors its audit entries to the existing ticket
        const alreadyImportedTicketIds = new Map<string, string>();

        // Numbers are reassigned in the original order, whatever order the file lists tickets in
        const ticketsInOrder = [...data.tickets].sort(
          (a, b) => (Number(a.ticketNumber) || 0) - (Number(b.ticketNumber) || 0),
        );
        for (const t of ticketsInOrder) {
          const existingTicketId = ticketMatches.get(t.id);
          if (existingTicketId) {
            alreadyImportedTicketIds.set(t.id, existingTicketId);
            links.record(LINK.ticket, originOf(t), existingTicketId);
            continue;
          }

          const newId = ulid();
          ticketNumber++;
          await qr.query(`
            INSERT INTO tickets (
              id, name, description, priority, status, "categoryId",
              "workspaceId", "reporterId", "assigneeId", "ticketNumber",
              "customFields", "discardReason", "portalToken",
              "firstResponseAt", "resolvedAt", "resolvedById",
              "firstResponseBreached", "resolutionBreached", "createdAt", "updatedAt",
              "organizationId", "departmentId", "projectId",
              source, "registeredById", "originDate", "descriptionEditedAt", "mailboxId"
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
          `, [
            newId, t.name, sanitizeHtml(t.description ?? ''), t.priority, t.status, categoryIdFor(t.category),
            targetWorkspaceId, userIdFor(t.reporterEmail), userIdFor(t.assigneeEmail), ticketNumber,
            JSON.stringify(remapCustomFields(t.customFields)), t.discardReason, null,
            t.firstResponseAt, t.resolvedAt, userIdFor(t.resolvedByEmail),
            t.firstResponseBreached, t.resolutionBreached, t.createdAt, t.updatedAt,
            organizationIdFor(t.organizationId), departmentIdFor(t.departmentId), projectIdFor(t.projectId),
            t.source ?? TicketSource.UI, userIdFor(t.registeredByEmail ?? null), t.originDate ?? null, t.descriptionEditedAt ?? null,
            mailboxIdFor(t.mailboxOriginId),
          ]);
          ticketIdMap.set(t.id, newId);
          links.record(LINK.ticket, originOf(t), newId);

          // ticket_tag
          for (const oldTagId of t.tagIds) {
            const newTagId = tagIdMap.get(oldTagId);
            if (newTagId) {
              await qr.query(
                `INSERT INTO ticket_tag ("ticketsId", "tagsId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [newId, newTagId],
              );
            }
          }
          result.ticketsImported++;
        }

        // 4b. Completing tickets already here, when asked: only what they lack is added. A field is
        // filled only while empty (and in SQL only if it still is); `source` only replaces 'ui', the
        // default every ticket gets, with the channel the file names; a custom field value only
        // adds a key the ticket does not have; tags are only added. Name, description, status,
        // priority, assignee, category, reporter, number and dates already set are never touched.
        // Children (comments, edits, attachments, participants) are completed further down.
        const completing = new Map<string, string>(complete ? alreadyImportedTicketIds : []);
        const completingIds = [...new Set(completing.values())];
        const completedTickets = new Set<string>();
        if (completingIds.length) {
          const rows = await qr.query(`
            SELECT id, "departmentId", "projectId", "organizationId", "registeredById", "originDate",
              "descriptionEditedAt", source, "customFields", "mailboxId"
            FROM tickets WHERE id = ANY($1)
          `, [completingIds]);
          const current = new Map<string, any>(rows.map((r: any) => [r.id, r]));
          const tagsOf = new Map<string, Set<string>>();
          for (const r of await qr.query(`SELECT "ticketsId", "tagsId" FROM ticket_tag WHERE "ticketsId" = ANY($1)`, [completingIds])) {
            if (!tagsOf.has(r.ticketsId)) tagsOf.set(r.ticketsId, new Set());
            tagsOf.get(r.ticketsId)!.add(r.tagsId);
          }
          for (const t of ticketsInOrder) {
            const targetId = completing.get(t.id);
            const row = targetId ? current.get(targetId) : undefined;
            if (!targetId || !row) continue;
            const params: unknown[] = [targetId];
            const sets: string[] = [];
            const fill = (column: string, value: unknown) => {
              if (row[column] != null || !present(value)) return;
              params.push(value);
              sets.push(`"${column}" = COALESCE("${column}", $${params.length})`);
              row[column] = value;
            };
            fill('departmentId', departmentIdFor(t.departmentId));
            fill('projectId', projectIdFor(t.projectId));
            fill('organizationId', organizationIdFor(t.organizationId));
            fill('registeredById', userIdFor(t.registeredByEmail ?? null));
            fill('originDate', t.originDate);
            fill('descriptionEditedAt', t.descriptionEditedAt);
            fill('mailboxId', mailboxIdFor(t.mailboxOriginId));
            if ((row.source ?? TicketSource.UI) === TicketSource.UI && present(t.source) && t.source !== TicketSource.UI) {
              params.push(t.source);
              sets.push(`source = CASE WHEN source = '${TicketSource.UI}' THEN $${params.length} ELSE source END`);
              row.source = t.source;
            }
            const values = row.customFields && typeof row.customFields === 'object' ? row.customFields : {};
            const missing = Object.fromEntries(
              Object.entries(remapCustomFields(t.customFields)).filter(([key, value]) => !(key in values) && present(value)),
            );
            if (Object.keys(missing).length) {
              params.push(JSON.stringify(missing));
              // jsonb || keeps the right-hand value of a key both sides have: the ticket's own wins
              sets.push(`"customFields" = $${params.length}::jsonb || COALESCE("customFields", '{}'::jsonb)`);
              row.customFields = { ...missing, ...values };
            }
            if (sets.length) {
              await qr.query(`UPDATE tickets SET ${sets.join(', ')} WHERE id = $1`, params);
              completedTickets.add(targetId);
            }
            if (!tagsOf.has(targetId)) tagsOf.set(targetId, new Set());
            const tags = tagsOf.get(targetId)!;
            for (const oldTagId of t.tagIds) {
              const tagId = tagIdMap.get(oldTagId);
              if (!tagId || tags.has(tagId)) continue;
              await qr.query(
                `INSERT INTO ticket_tag ("ticketsId", "tagsId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [targetId, tagId],
              );
              tags.add(tagId);
              completedTickets.add(targetId);
            }
          }
        }

        // 5. Comments — map old ID → new ID. On a ticket being completed, a comment already there
        // (by identity, else same author and second) is mapped to, not added again.
        const commentIdMap = new Map<string, string>();
        const existingComments = new ExistingChildren<{ id: string; ticketId: string; authorId: string; createdAt: Date }>(
          completingIds.length
            ? await qr.query(`SELECT id, "ticketId", "authorId", "createdAt" FROM comments WHERE "ticketId" = ANY($1)`, [completingIds])
            : [],
          (c) => c.ticketId,
        );
        /** Existing comments of completed tickets that file comments were mapped to. */
        const matchedCommentIds = new Set<string>();
        for (const c of data.comments) {
          const completingTicketId = completing.get(c.ticketId);
          const newTicketId = ticketIdMap.get(c.ticketId) ?? completingTicketId;
          // comments.authorId is NOT NULL: a comment whose author no longer exists has nobody to
          // belong to, and attributing it to someone else would misrepresent who wrote it
          const authorId = userIdFor(c.authorEmail);
          if (!newTicketId) continue;
          if (completingTicketId) {
            const existingId = existingComments.find(identity, LINK.comment, originOf(c), completingTicketId,
              (row) => row.authorId === authorId && secondOf(row.createdAt) === secondOf(c.createdAt));
            if (existingId) {
              commentIdMap.set(c.id, existingId);
              matchedCommentIds.add(existingId);
              links.record(LINK.comment, originOf(c), existingId);
              continue;
            }
          }
          if (!authorId) {
            result.commentsSkipped++;
            continue;
          }
          const newId = ulid();
          const mentioned = new Set<string>();
          for (const id of mentionedIdsOf(c.mentionedUserIds)) {
            const targetId = sourceUserIdMap.get(id);
            if (targetId) mentioned.add(targetId);
          }
          // Same sanitizing as content created in the app: the file is user-supplied
          const content = sanitizeHtml(remapMentionMarkup(c.content ?? ''));
          await qr.query(`
            INSERT INTO comments (id, content, "ticketId", "authorId", "mentionedUserIds", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [newId, content, newTicketId, authorId, [...mentioned].join(','), c.createdAt]);
          commentIdMap.set(c.id, newId);
          links.record(LINK.comment, originOf(c), newId);
          if (completingTicketId) completedTickets.add(completingTicketId);
          result.commentsImported++;
        }

        // 5b. Edit history — for tickets and comments created by this run, and the ones being
        // completed, where an edit already there (by identity, else same editor and second) is not
        // added again; so a plain re-import adds none. editedById is NOT NULL: an edit whose editor
        // no longer exists is skipped.
        type ExistingEdit = { id: string; parentId: string; editedById: string; createdAt: Date };
        const sameEdit = (e: { createdAt: string }, editorId: string | null) =>
          (row: ExistingEdit) => row.editedById === editorId && secondOf(row.createdAt) === secondOf(e.createdAt);
        const existingDescriptionEdits = new ExistingChildren<ExistingEdit>(
          completingIds.length
            ? await qr.query(`SELECT id, "ticketId" AS "parentId", "editedById", "createdAt" FROM ticket_description_edits WHERE "ticketId" = ANY($1)`, [completingIds])
            : [],
          (e) => e.parentId,
        );
        for (const e of data.descriptionEdits) {
          const completingTicketId = completing.get(e.ticketId);
          const ticketId = ticketIdMap.get(e.ticketId) ?? completingTicketId;
          const editorId = userIdFor(e.editedByEmail);
          if (!ticketId) continue;
          if (completingTicketId) {
            const existingId = existingDescriptionEdits.find(identity, LINK.descriptionEdit, originOf(e), completingTicketId, sameEdit(e, editorId));
            if (existingId) {
              links.record(LINK.descriptionEdit, originOf(e), existingId);
              continue;
            }
          }
          if (!editorId) continue;
          if (completingTicketId) completedTickets.add(completingTicketId);
          const editId = ulid();
          await qr.query(`
            INSERT INTO ticket_description_edits (id, content, "ticketId", "editedById", "createdAt")
            VALUES ($1, $2, $3, $4, $5)
          `, [editId, sanitizeHtml(e.content ?? ''), ticketId, editorId, e.createdAt]);
          links.record(LINK.descriptionEdit, originOf(e), editId);
          result.descriptionEditsImported++;
        }
        const existingCommentEdits = new ExistingChildren<ExistingEdit>(
          matchedCommentIds.size
            ? await qr.query(`SELECT id, "commentId" AS "parentId", "editedById", "createdAt" FROM comment_edits WHERE "commentId" = ANY($1)`, [[...matchedCommentIds]])
            : [],
          (e) => e.parentId,
        );
        const ticketOfComment = new Map(data.comments.map((c) => [c.id, c.ticketId]));
        for (const e of data.commentEdits) {
          const commentId = commentIdMap.get(e.commentId);
          const editorId = userIdFor(e.editedByEmail);
          if (!commentId) continue;
          if (matchedCommentIds.has(commentId)) {
            const existingId = existingCommentEdits.find(identity, LINK.commentEdit, originOf(e), commentId, sameEdit(e, editorId));
            if (existingId) {
              links.record(LINK.commentEdit, originOf(e), existingId);
              continue;
            }
          }
          if (!editorId) continue;
          const completingTicketId = completing.get(ticketOfComment.get(e.commentId) ?? '');
          if (completingTicketId) completedTickets.add(completingTicketId);
          const editId = ulid();
          await qr.query(`
            INSERT INTO comment_edits (id, content, "commentId", "editedById", "createdAt")
            VALUES ($1, $2, $3, $4, $5)
          `, [editId, sanitizeHtml(remapMentionMarkup(e.content)), commentId, editorId, e.createdAt]);
          links.record(LINK.commentEdit, originOf(e), editId);
          result.commentEditsImported++;
        }

        // 6. Attachments — on a ticket being completed, one already there (by identity, else same
        // name and size) is mapped to, not added again
        const attachmentIdMap = new Map<string, string>();
        const existingAttachments = new ExistingChildren<ExistingAttachment>(
          completingIds.length ? await qr.query(EXISTING_ATTACHMENTS_SQL, [completingIds]) : [],
          (a) => a.ticketId,
        );
        for (const a of data.attachments) {
          const completingTicketId = a.ticketId ? completing.get(a.ticketId) : undefined;
          const newTicketId = a.ticketId ? (ticketIdMap.get(a.ticketId) ?? completingTicketId) : null;
          const newCommentId = a.commentId ? commentIdMap.get(a.commentId) : null;
          if (completingTicketId) {
            const existingId = existingAttachments.find(identity, LINK.attachment, originOf(a), completingTicketId, sameAttachment(a));
            if (existingId) {
              attachmentIdMap.set(a.id, existingId);
              links.record(LINK.attachment, originOf(a), existingId);
              continue;
            }
          }
          if (a.ticketId && !newTicketId) {
            // Counted here, where the transaction decides, rather than in the upload planning: the
            // planning only avoids storing these files, and a ticket appearing in between would
            // otherwise be counted by one and not the other. Only files the archive carries count,
            // as the preview counts them.
            if (alreadyImportedTicketIds.has(a.ticketId) && present(a.file)) result.attachmentsOfExistingTickets++;
            continue;
          }
          // Only bytes carried in the archive are imported, already stored under the target's own key,
          // the way an upload stores them. A row pointing at the source's key would serve its file.
          const file = stored.attachments.get(a);
          if (!file) {
            result.attachmentsSkipped++;
            continue;
          }
          const { id: newAttachmentId, key, size } = file;
          use(key);
          const originalName = a.originalName || a.fileName || 'file';
          await qr.query(`
            INSERT INTO attachments (id, "fileName", "originalName", "mimeType", size, "s3Key", "ticketId", "commentId", "uploadedById", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [newAttachmentId, a.fileName || originalName, originalName, a.mimeType || 'application/octet-stream', size, key, newTicketId, newCommentId, userIdFor(a.uploadedByEmail), a.createdAt]);
          attachmentIdMap.set(a.id, newAttachmentId);
          links.record(LINK.attachment, originOf(a), newAttachmentId);
          if (completingTicketId) completedTickets.add(completingTicketId);
          result.attachmentsImported++;
        }

        // 7. Participants — the unique constraint keeps one already there from being added again
        for (const p of data.participants) {
          const completingTicketId = completing.get(p.ticketId);
          const newTicketId = ticketIdMap.get(p.ticketId) ?? completingTicketId;
          const userId = userIdFor(p.userEmail);
          if (!newTicketId || !userId) continue;
          const inserted = await qr.query(`
            INSERT INTO ticket_participants (id, "ticketId", "userId", role)
            VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id
          `, [ulid(), newTicketId, userId, p.role]);
          // ON CONFLICT DO NOTHING returns no row when the participant was already there
          if (inserted.length) {
            result.participantsImported++;
            if (completingTicketId) completedTickets.add(completingTicketId);
          }
        }

        // A ticket matched here counts as completed when something was added to it, else as present
        result.ticketsCompleted = completedTickets.size;
        result.ticketsAlreadyPresent = [...alreadyImportedTicketIds.values()].filter((id) => !completedTickets.has(id)).length;

        // 8. Canned responses — reuse the target workspace's own by identity, else by title, so a
        // re-import adds none
        const cannedIdMap = new Map<string, string>();
        const existingCanned = await qr.query(
          `SELECT id, title FROM canned_responses WHERE "workspaceId" = $1`, [targetWorkspaceId],
        );
        const existingCannedIds = idsOf(existingCanned);
        const cannedIdByTitle = new Map<string, string>(existingCanned.map((cr: any) => [cr.title, cr.id]));
        for (const cr of data.cannedResponses) {
          const existingId = identity.find(LINK.cannedResponse, originOf(cr), (id) => existingCannedIds.has(id))
            ?? cannedIdByTitle.get(cr.title);
          if (existingId) {
            cannedIdMap.set(cr.id, existingId);
            links.record(LINK.cannedResponse, originOf(cr), existingId);
            continue;
          }
          const newId = ulid();
          await qr.query(`
            INSERT INTO canned_responses (id, title, content, "workspaceId", "createdAt")
            VALUES ($1, $2, $3, $4, $5)
          `, [newId, cr.title, cr.content, targetWorkspaceId, cr.createdAt]);
          cannedIdMap.set(cr.id, newId);
          cannedIdByTitle.set(cr.title, newId);
          links.record(LINK.cannedResponse, originOf(cr), newId);
          result.cannedResponsesImported++;
        }

        // 9. Webhooks — one the target workspace already has (by identity, else by URL) is left as it
        // is; the rest are created inactive, so nothing is delivered until someone reviews them here.
        // Without a secret in the file each gets a new random one, generated as CreateWebhook does.
        const webhookIdBySourceId = new Map<string, string>();
        const existingWebhooks = await qr.query(`SELECT id, url FROM webhooks WHERE "workspaceId" = $1`, [targetWorkspaceId]);
        const existingWebhookIds = idsOf(existingWebhooks);
        const webhookIdByUrl = new Map<string, string>(existingWebhooks.map((w: any) => [w.url, w.id]));
        for (const w of data.webhooks) {
          const origin = originOf(w);
          let targetId = identity.find(LINK.webhook, origin, (id) => existingWebhookIds.has(id)) ?? webhookIdByUrl.get(w.url);
          if (!targetId) {
            targetId = ulid();
            await qr.query(`
              INSERT INTO webhooks (id, "workspaceId", url, events, secret, "isActive")
              VALUES ($1, $2, $3, $4, $5, false)
            `, [targetId, targetWorkspaceId, w.url, w.events.join(','), present(w.secret) ? w.secret : randomBytes(32).toString('hex')]);
            webhookIdByUrl.set(w.url, targetId);
            result.webhooksImported++;
          }
          for (const id of [w.id, origin]) if (id) webhookIdBySourceId.set(id, targetId);
          links.record(LINK.webhook, origin, targetId);
        }

        // 10. CSAT responses
        const csatIdMap = new Map<string, string>();
        for (const cs of data.csatResponses) {
          const newTicketId = ticketIdMap.get(cs.ticketId);
          if (!newTicketId) continue;
          const newCsatId = ulid();
          await qr.query(`
            INSERT INTO csat_responses (id, "ticketId", "workspaceId", token, rating, "respondedAt", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [newCsatId, newTicketId, targetWorkspaceId, ulid(), cs.rating, cs.respondedAt, cs.createdAt]);
          if (cs.id) csatIdMap.set(cs.id, newCsatId);
          result.csatResponsesImported++;
        }

        // 10b. Knowledge base — categories reused by identity, else by slug; an article the target
        // workspace already has (by identity, else by slug) is skipped. Content is sanitized as the
        // KB create service does.
        const kbCategoryIdMap = new Map<string, string>();
        const existingKbCategories = await qr.query(
          `SELECT id, slug FROM kb_categories WHERE "workspaceId" = $1`, [targetWorkspaceId],
        );
        const existingKbCategoryIds = idsOf(existingKbCategories);
        const kbCategoryIdBySlug = new Map<string, string>(existingKbCategories.map((c: any) => [c.slug, c.id]));
        for (const c of data.kbCategories) {
          let targetId = identity.find(LINK.kbCategory, originOf(c), (id) => existingKbCategoryIds.has(id))
            ?? kbCategoryIdBySlug.get(c.slug);
          if (!targetId) {
            targetId = ulid();
            const createdAt = c.createdAt ?? new Date().toISOString();
            await qr.query(`
              INSERT INTO kb_categories (id, name, slug, icon, position, "workspaceId", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [targetId, c.name, c.slug, c.icon ?? null, c.position ?? 0, targetWorkspaceId, createdAt, createdAt]);
            kbCategoryIdBySlug.set(c.slug, targetId);
            result.kbCategoriesImported++;
          }
          kbCategoryIdMap.set(c.id, targetId);
          links.record(LINK.kbCategory, originOf(c), targetId);
        }
        const kbArticleIdMap = new Map<string, string>();
        const existingKbArticles = await qr.query(
          `SELECT id, slug FROM kb_articles WHERE "workspaceId" = $1`, [targetWorkspaceId],
        );
        const existingKbArticleIds = idsOf(existingKbArticles);
        const kbArticleIdBySlug = new Map<string, string>(existingKbArticles.map((a: any) => [a.slug, a.id]));
        for (const a of data.kbArticles) {
          const existingId = identity.find(LINK.kbArticle, originOf(a), (id) => existingKbArticleIds.has(id))
            ?? kbArticleIdBySlug.get(a.slug);
          if (existingId) {
            kbArticleIdMap.set(a.id, existingId);
            links.record(LINK.kbArticle, originOf(a), existingId);
            continue;
          }
          // categoryId and createdById are NOT NULL
          const categoryId = kbCategoryIdMap.get(a.categoryId);
          const createdById = userIdFor(a.createdByEmail);
          if (!categoryId || !createdById) continue;
          const newId = ulid();
          await qr.query(`
            INSERT INTO kb_articles (id, title, slug, content, status, position, "categoryId", "workspaceId", "createdById", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            newId, a.title, a.slug, sanitizeHtml(a.content, KB_SANITIZE_OPTIONS), a.status, a.position ?? 0,
            categoryId, targetWorkspaceId, createdById, a.createdAt, a.updatedAt ?? a.createdAt,
          ]);
          kbArticleIdBySlug.set(a.slug, newId);
          kbArticleIdMap.set(a.id, newId);
          links.record(LINK.kbArticle, originOf(a), newId);
          result.kbArticlesImported++;
        }

        // 11. Audit log — skip entries already imported, like tickets, so a second import adds no history
        const auditKey = (action: string, entityType: string, userId: string | null, createdAt: string | Date) =>
          `${action}|${entityType}|${userId ?? ''}|${new Date(createdAt).toISOString().slice(0, 19)}`;
        const existingAudit = await qr.query(
          `SELECT action, "entityType", "userId", "createdAt" FROM audit_log_entries WHERE "workspaceId" = $1`, [targetWorkspaceId],
        );
        const existingAuditKeys = new Set<string>(
          existingAudit.map((e: any) => auditKey(e.action, e.entityType, e.userId, e.createdAt)),
        );
        // Entries point at what this import created (or reused). Entity types the import does not
        // carry (API keys, invitations...) keep their source id.
        const categoryIdMap = categoryIdBySourceId;
        const auditTicketIdMap = new Map([...alreadyImportedTicketIds, ...ticketIdMap]);
        const workspaceIdMap = { get: () => targetWorkspaceId };
        const entityIdMaps: Record<string, { get(id: string): string | undefined }> = {
          ticket: auditTicketIdMap,
          comment: commentIdMap,
          attachment: attachmentIdMap,
          tag: tagIdMap,
          'ticket-category': categoryIdMap,
          'custom-field': customFieldIdMap,
          'canned-response': cannedIdMap,
          csat: csatIdMap,
          organization: organizationIdMap,
          department: departmentIdMap,
          project: projectIdMap,
          'kb-category': kbCategoryIdMap,
          'kb-article': kbArticleIdMap,
          mailbox: mailboxIdBySourceId,
          'email-rule': emailRuleIdBySourceId,
          webhook: webhookIdBySourceId,
          user: sourceUserIdMap,
          workspace: workspaceIdMap,
        };
        const metadataIdMaps: Record<string, { get(id: string): string | undefined }> = {
          ticketId: auditTicketIdMap,
          commentId: commentIdMap,
          attachmentId: attachmentIdMap,
          tagId: tagIdMap,
          categoryId: categoryIdMap,
          organizationId: organizationIdMap,
          departmentId: departmentIdMap,
          projectId: projectIdMap,
          mailboxId: mailboxIdBySourceId,
          webhookId: webhookIdBySourceId,
          workspaceId: workspaceIdMap,
          userId: sourceUserIdMap,
          assigneeId: sourceUserIdMap,
          previousAssigneeId: sourceUserIdMap,
          memberUserId: sourceUserIdMap,
          participantUserId: sourceUserIdMap,
          requesterId: sourceUserIdMap,
          targetUserId: sourceUserIdMap,
        };
        const remapMetadata = (metadata: Record<string, unknown> | null) => {
          if (!metadata || typeof metadata !== 'object') return metadata;
          const remapped = { ...metadata };
          for (const [key, map] of Object.entries(metadataIdMaps)) {
            const value = remapped[key];
            if (typeof value === 'string') remapped[key] = map.get(value) ?? value;
          }
          return remapped;
        };

        for (const a of data.auditLog) {
          const key = auditKey(a.action, a.entityType, userIdFor(a.userEmail), a.createdAt);
          if (existingAuditKeys.has(key)) continue;
          existingAuditKeys.add(key);
          const entityId = entityIdMaps[a.entityType]?.get(a.entityId) ?? a.entityId;
          await qr.query(`
            INSERT INTO audit_log_entries (id, action, "entityType", "entityId", "userId", "workspaceId", metadata, category, level, source, "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            ulid(), a.action, a.entityType, entityId, userIdFor(a.userEmail), targetWorkspaceId, JSON.stringify(remapMetadata(a.metadata)),
            a.category ?? 'ticket', a.level ?? 'info', a.source ?? null, a.createdAt,
          ]);
          result.auditLogImported++;
        }

        await links.write(qr, targetWorkspaceId);
        await qr.commitTransaction();
      } catch (error) {
        await qr.rollbackTransaction().catch(() => undefined);
        throw error;
      }
    } catch (error) {
      await this.deleteQuietly(storedKeys);
      throw error;
    } finally {
      await qr.release();
    }
    // Objects stored for rows the transaction did not insert after all, and the logo and icon this
    // import replaced, are no longer referenced
    await this.deleteQuietly([
      ...storedKeys.filter((key) => !usedKeys.has(key)),
      ...replacedKeys.filter((key) => !storedKeys.includes(key)),
    ]);
    return { result, newMembers };
  }

  /**
   * Stores the archive's files under new target keys before the transaction. What the
   * transaction will skip is decided first from plain reads, so files for rows that will not be
   * inserted are not stored; if that changes meanwhile, the unused objects are deleted after commit.
   * Every key stored is pushed to `storedKeys` before its upload, so a failure can clean up.
   */
  private async storeArchiveFiles(
    qr: QueryRunner,
    targetWorkspaceId: string,
    data: WorkspaceExportData,
    settings: ImportSetting[],
    files: ImportArchiveFiles | undefined,
    storedKeys: string[],
    completeExisting = false,
  ): Promise<StoredFiles> {
    const stored: StoredFiles = { attachments: new Map(), organizations: new Map(), workspaceLogo: null, workspaceIcon: null };
    const archive = this.storage ? files : undefined;
    if (!archive) return stored;
    const sizeOf = (path: string | null | undefined) => (path ? archive.size(path) : null);
    const store = async (path: string, key: string, mimeType: string | undefined, size: number) => {
      storedKeys.push(key);
      await this.storage!.putStream(key, archive.open(path), mimeType || 'application/octet-stream', size);
      return key;
    };
    /** A carried logo or icon of an accepted type and size, stored under `keyFor(ext)`; else null. */
    const storeImage = async (ref: { file?: string | null; mimeType?: string } | null | undefined, maxBytes: number, keyFor: (ext: string) => string) => {
      const size = sizeOf(ref?.file);
      const ext = ref?.mimeType ? LOGO_EXTENSIONS[ref.mimeType] : undefined;
      if (size === null || !ext || size > maxBytes) return null;
      return store(ref!.file!, keyFor(ext), ref!.mimeType, size);
    };

    if (settings.includes('branding')) {
      // Keys of their own, not the upload endpoint's fixed logo.<ext>: storing over the current
      // logo would destroy it if this import then rolled back
      const ws = data.workspace;
      stored.workspaceLogo = await storeImage(ws.logoFile, LOGO_MAX_BYTES, (ext) => `workspaces/${targetWorkspaceId}/logo-${ulid()}${ext}`);
      stored.workspaceIcon = await storeImage(ws.iconFile, ICON_MAX_BYTES, (ext) => `workspaces/${targetWorkspaceId}/icon-${ulid()}${ext}`);
    }

    // Organizations: a new one gets the key the organization logo upload uses, under the id it
    // will be created with; a reused one without a logo gets a key of its own; one with a logo none
    // The same identity the transaction matches by, read once
    let identity: ImportIdentity | undefined;
    const identityNow = async () => (identity ??= new ImportIdentity(await loadLinks(qr, targetWorkspaceId)));

    if (data.organizations.some((o) => sizeOf(o.logoFile?.file) !== null)) {
      const existing = await qr.query(
        `SELECT id, name, logo FROM organizations WHERE "workspaceId" = $1 AND "deletedAt" IS NULL`, [targetWorkspaceId],
      );
      const existingById = new Map<string, { id: string; logo: string | null }>(existing.map((o: any) => [o.id, o]));
      const existingByName = new Map<string, { id: string; logo: string | null }>(existing.map((o: any) => [o.name, o]));
      const planned = new Set<string>();
      const ids = await identityNow();
      for (const o of data.organizations) {
        const matchedId = ids.find(LINK.organization, originOf(o), (id) => existingById.has(id));
        const reused = matchedId ? existingById.get(matchedId) : existingByName.get(o.name);
        // One logo per target: a reused organization by its id, a new one by the name it is created under
        const plan = reused ? `id|${reused.id}` : `name|${o.name}`;
        if (planned.has(plan) || reused?.logo) continue;
        planned.add(plan);
        const targetId = reused?.id ?? ulid();
        const key = await storeImage(o.logoFile, LOGO_MAX_BYTES, (ext) =>
          reused ? `organizations/${targetId}/logo-${ulid()}${ext}` : `organizations/${targetId}/logo${ext}`);
        if (key) stored.organizations.set(o, { targetId, newId: reused ? null : targetId, key });
      }
    }

    // Attachments of tickets the import will create; a ticket already here (matched as the
    // transaction matches it) brings none, unless it is being completed: then only the ones it
    // does not have yet, decided as the transaction decides
    const carried = data.attachments.filter((a) => sizeOf(a.file) !== null);
    if (carried.length) {
      const reporters = [...new Set(data.tickets.map((t) => t.reporterEmail))];
      const reporterIds = new Map<string, string>(
        (await qr.query(`SELECT id, email FROM users WHERE email = ANY($1)`, [reporters])).map((u: any) => [u.email, u.id]),
      );
      const existingTickets = await qr.query(EXISTING_TICKETS_SQL, [targetWorkspaceId]);
      const ids = await identityNow();
      const matches = matchTickets(data.tickets, existingTickets, ids, (email) => reporterIds.get(email) ?? null);
      const matchedIds = [...new Set(matches.values())];
      const existing = completeExisting && matchedIds.length
        ? new ExistingChildren<ExistingAttachment>(await qr.query(EXISTING_ATTACHMENTS_SQL, [matchedIds]), (a) => a.ticketId)
        : undefined;
      const fileTickets = new Set(data.tickets.map((t) => t.id));
      for (const a of carried) {
        if (!a.ticketId || !fileTickets.has(a.ticketId)) continue;
        const matched = matches.get(a.ticketId);
        if (matched && (!existing || existing.find(ids, LINK.attachment, originOf(a), matched, sameAttachment(a)))) continue;
        const id = ulid();
        const size = sizeOf(a.file)!;
        const key = attachmentStorageKey(id, a.originalName || a.fileName || 'file');
        await store(a.file!, key, a.mimeType, size);
        stored.attachments.set(a, { id, key, size });
      }
    }
    return stored;
  }

  /** Best effort: a failure is reported, never thrown, so it cannot hide the original outcome. */
  private async deleteQuietly(keys: string[]): Promise<void> {
    if (!this.storage) return;
    for (const key of keys) {
      try {
        await this.storage.delete(key);
      } catch (error) {
        this.onCleanupFailure?.(key, error);
      }
    }
  }
}
