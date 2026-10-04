import { DataSource } from 'typeorm';
import { ulid } from 'ulid';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { WorkspaceExportData } from '../workspace-export';
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

export interface ImportResult {
  usersCreated: number;
  membersAdded: number;
  organizationsImported: number;
  departmentsImported: number;
  tagsImported: number;
  categoriesImported: number;
  projectsImported: number;
  ticketsImported: number;
  commentsImported: number;
  /** Comments not imported because their author is missing from the file or no longer exists. */
  commentsSkipped: number;
  descriptionEditsImported: number;
  commentEditsImported: number;
  attachmentsImported: number;
  participantsImported: number;
  cannedResponsesImported: number;
  customFieldsImported: number;
  csatResponsesImported: number;
  kbCategoriesImported: number;
  kbArticlesImported: number;
  auditLogImported: number;
  /** The target workspace settings this import overwrote, as asked by the caller. */
  settingsApplied: ImportSetting[];
}

/**
 * Workspace settings an import may overwrite in the target. None is touched unless asked for:
 * palette → metadata.palette (other metadata keys are kept), sla → slaPolicy,
 * description → description, branding → appName and appSubtitle (not the logo or icon).
 */
export const IMPORT_SETTINGS = ['palette', 'sla', 'description', 'branding'] as const;
export type ImportSetting = typeof IMPORT_SETTINGS[number];

export interface ImportOptions {
  overwrite?: string[];
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
  each('organizations', data.organizations, (o, p) => {
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
  };
  /** The workspace settings the file carries a value for; null or false when it has none. */
  settings: {
    palette: string | null;
    sla: boolean;
    description: string | null;
    branding: { appName: string | null; appSubtitle: string | null } | null;
  };
}

/** What importing this export would bring in, checked exactly as the import checks it. */
export function buildImportPreview(rawData: WorkspaceExportData): ImportPreview {
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
    },
    settings: {
      palette: present(palette) ? String(palette) : null,
      sla: present(ws.slaPolicy),
      description: text(ws.description),
      branding: present(ws.appName) || present(ws.appSubtitle)
        ? { appName: text(ws.appName), appSubtitle: text(ws.appSubtitle) }
        : null,
    },
  };
}

export class ImportWorkspace {
  constructor(private readonly dataSource: DataSource) {}

  async execute(targetWorkspaceId: string, rawData: WorkspaceExportData, options: ImportOptions = {}): Promise<ImportOutcome> {
    const settings = overwriteSettingsOf(options.overwrite);
    const data = prepareImportData(rawData);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const result: ImportResult = {
      usersCreated: 0, membersAdded: 0, organizationsImported: 0, departmentsImported: 0, tagsImported: 0, categoriesImported: 0, projectsImported: 0, ticketsImported: 0,
      commentsImported: 0, commentsSkipped: 0, descriptionEditsImported: 0, commentEditsImported: 0, attachmentsImported: 0, participantsImported: 0,
      cannedResponsesImported: 0, customFieldsImported: 0, csatResponsesImported: 0,
      kbCategoriesImported: 0, kbArticlesImported: 0, auditLogImported: 0, settingsApplied: [],
    };
    const newMembers: ImportedNewMember[] = [];

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
      for (const key of settings) {
        if (key === 'palette' && present(ws.metadata?.palette)) {
          set((v) => `metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('palette', ${v}::text)`, ws.metadata?.palette);
        } else if (key === 'sla' && present(ws.slaPolicy)) {
          set((v) => `"slaPolicy" = ${v}`, JSON.stringify(ws.slaPolicy));
        } else if (key === 'description' && present(ws.description)) {
          set((v) => `description = ${v}`, ws.description);
        } else if (key === 'branding' && (present(ws.appName) || present(ws.appSubtitle))) {
          set((v) => `"appName" = ${v}`, ws.appName ?? null);
          set((v) => `"appSubtitle" = ${v}`, ws.appSubtitle ?? null);
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

      // 1b. Organizations — before members and tickets, which point at them. One with the same
      // name in the target workspace is reused. The logo file is not carried.
      const organizationIdMap = new Map<string, string>();
      const existingOrganizations = await qr.query(
        `SELECT id, name FROM organizations WHERE "workspaceId" = $1 AND "deletedAt" IS NULL`, [targetWorkspaceId],
      );
      const organizationIdByName = new Map<string, string>(existingOrganizations.map((o: any) => [o.name, o.id]));
      for (const o of data.organizations) {
        let targetId = organizationIdByName.get(o.name);
        if (!targetId) {
          targetId = ulid();
          // domains is jsonb: node-pg would send a bare array as a Postgres array literal
          await qr.query(`
            INSERT INTO organizations (id, name, description, notes, domains, "workspaceId", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [targetId, o.name, o.description ?? null, o.notes ?? null, JSON.stringify(o.domains ?? []), targetWorkspaceId, o.createdAt ?? new Date().toISOString()]);
          organizationIdByName.set(o.name, targetId);
          result.organizationsImported++;
        }
        organizationIdMap.set(o.id, targetId);
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

      // 2b. Departments and their members — before tickets. One with the same name in the
      // target workspace is reused; its members are added to, never replaced.
      const departmentIdMap = new Map<string, string>();
      const existingDepartments = await qr.query(
        `SELECT id, name FROM departments WHERE "workspaceId" = $1 AND "deletedAt" IS NULL`, [targetWorkspaceId],
      );
      const departmentIdByName = new Map<string, string>(existingDepartments.map((d: any) => [d.name, d.id]));
      for (const d of data.departments) {
        let targetId = departmentIdByName.get(d.name);
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

      // 3. Tags — map old ID → new ID, reuse existing by name
      const tagIdMap = new Map<string, string>();
      const existingTags = await qr.query(
        `SELECT id, name FROM tags WHERE "workspaceId" = $1`, [targetWorkspaceId],
      );
      const existingTagsByName = new Map<string, string>();
      for (const t of existingTags) existingTagsByName.set(t.name, t.id);

      for (const tag of data.tags) {
        const existingId = existingTagsByName.get(tag.name);
        if (existingId) {
          tagIdMap.set(tag.id, existingId);
        } else {
          const newId = ulid();
          await qr.query(`
            INSERT INTO tags (id, name, color, "workspaceId", "createdAt")
            VALUES ($1, $2, $3, $4, $5)
          `, [newId, tag.name, tag.color, targetWorkspaceId, tag.createdAt]);
          tagIdMap.set(tag.id, newId);
          existingTagsByName.set(tag.name, newId);
          result.tagsImported++;
        }
      }

      // 3b. Categories — resolve by slug, reuse the target workspace's own, create the rest.
      // Files older than 1.13 carry no categories list, only the slug on each ticket.
      const categoryIdBySlug = new Map<string, string>();
      const existingCategories = await qr.query(
        `SELECT id, slug FROM ticket_categories WHERE "workspaceId" = $1`, [targetWorkspaceId],
      );
      for (const c of existingCategories) categoryIdBySlug.set(c.slug, c.id);

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
        if (categoryIdBySlug.has(slug)) continue;
        const newId = ulid();
        await qr.query(`
          INSERT INTO ticket_categories (id, name, slug, color, "workspaceId", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [newId, c.name, slug, c.color, targetWorkspaceId, c.createdAt ?? new Date().toISOString()]);
        categoryIdBySlug.set(slug, newId);
        result.categoriesImported++;
      }
      const categoryIdFor = (slug: string | null | undefined) => slug ? (categoryIdBySlug.get(slug) ?? null) : null;

      // 3c. Projects and their categories — after categories, before tickets. One with the same
      // name in the target workspace is reused; its category links are added to, never replaced.
      const projectIdMap = new Map<string, string>();
      const existingProjects = await qr.query(
        `SELECT id, name FROM projects WHERE "workspaceId" = $1 AND "deletedAt" IS NULL`, [targetWorkspaceId],
      );
      const projectIdByName = new Map<string, string>(existingProjects.map((p: any) => [p.name, p.id]));
      for (const p of data.projects) {
        let targetId = projectIdByName.get(p.name);
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

      // 3d. Custom fields — before tickets, whose values are keyed by definition id. A definition
      // with the same name and type in the target workspace is reused instead of duplicated.
      const customFieldIdMap = new Map<string, string>();
      const existingFields = await qr.query(
        `SELECT id, name, type FROM custom_field_definitions WHERE "workspaceId" = $1`, [targetWorkspaceId],
      );
      const fieldKey = (name: string, type: string) => `${name}|${type}`;
      const existingFieldIds = new Map<string, string>(
        existingFields.map((f: any) => [fieldKey(f.name, f.type), f.id]),
      );
      for (const cf of data.customFields) {
        const existingId = existingFieldIds.get(fieldKey(cf.name, cf.type));
        if (existingId) {
          customFieldIdMap.set(cf.id, existingId);
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

      // 4. Tickets — map old ID → new ID, skip duplicates
      const ticketIdMap = new Map<string, string>();
      // Same lock as TypeOrmTicketRepository.create, so a ticket created meanwhile cannot take a number
      await qr.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [targetWorkspaceId]);
      const maxNumResult = await qr.query(
        `SELECT COALESCE(MAX("ticketNumber"), 0) as max FROM tickets WHERE "workspaceId" = $1`, [targetWorkspaceId],
      );
      let ticketNumber = Number(maxNumResult[0].max);

      // Build set of existing tickets to detect duplicates
      const existingTickets = await qr.query(
        `SELECT id, name, "reporterId", "createdAt" FROM tickets WHERE "workspaceId" = $1 AND "deletedAt" IS NULL`, [targetWorkspaceId],
      );
      const existingTicketKeys = new Map<string, string>(
        existingTickets.map((t: any) => [`${t.name}|${t.reporterId}|${new Date(t.createdAt).toISOString().slice(0, 19)}`, t.id]),
      );
      // A ticket skipped as already imported still anchors its audit entries to the existing ticket
      const alreadyImportedTicketIds = new Map<string, string>();

      // Numbers are reassigned in the original order, whatever order the file lists tickets in
      const ticketsInOrder = [...data.tickets].sort(
        (a, b) => (Number(a.ticketNumber) || 0) - (Number(b.ticketNumber) || 0),
      );
      for (const t of ticketsInOrder) {
        const reporterId = userIdFor(t.reporterEmail);
        const ticketKey = `${t.name}|${reporterId}|${t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 19) : ''}`;
        const existingTicketId = existingTicketKeys.get(ticketKey);
        if (existingTicketId) {
          alreadyImportedTicketIds.set(t.id, existingTicketId);
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
            source, "registeredById", "originDate", "descriptionEditedAt"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
        `, [
          newId, t.name, sanitizeHtml(t.description ?? ''), t.priority, t.status, categoryIdFor(t.category),
          targetWorkspaceId, userIdFor(t.reporterEmail), userIdFor(t.assigneeEmail), ticketNumber,
          JSON.stringify(remapCustomFields(t.customFields)), t.discardReason, null,
          t.firstResponseAt, t.resolvedAt, userIdFor(t.resolvedByEmail),
          t.firstResponseBreached, t.resolutionBreached, t.createdAt, t.updatedAt,
          organizationIdFor(t.organizationId), departmentIdFor(t.departmentId), projectIdFor(t.projectId),
          t.source ?? TicketSource.UI, userIdFor(t.registeredByEmail ?? null), t.originDate ?? null, t.descriptionEditedAt ?? null,
        ]);
        ticketIdMap.set(t.id, newId);

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

      // 5. Comments — map old ID → new ID
      const commentIdMap = new Map<string, string>();
      for (const c of data.comments) {
        const newTicketId = ticketIdMap.get(c.ticketId);
        // comments.authorId is NOT NULL: a comment whose author no longer exists has nobody to
        // belong to, and attributing it to someone else would misrepresent who wrote it
        const authorId = userIdFor(c.authorEmail);
        if (!newTicketId) continue;
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
        result.commentsImported++;
      }

      // 5b. Edit history — only for tickets and comments created by this run, so a re-import
      // adds none. editedById is NOT NULL: an edit whose editor no longer exists is skipped.
      for (const e of data.descriptionEdits) {
        const ticketId = ticketIdMap.get(e.ticketId);
        const editorId = userIdFor(e.editedByEmail);
        if (!ticketId || !editorId) continue;
        await qr.query(`
          INSERT INTO ticket_description_edits (id, content, "ticketId", "editedById", "createdAt")
          VALUES ($1, $2, $3, $4, $5)
        `, [ulid(), sanitizeHtml(e.content ?? ''), ticketId, editorId, e.createdAt]);
        result.descriptionEditsImported++;
      }
      for (const e of data.commentEdits) {
        const commentId = commentIdMap.get(e.commentId);
        const editorId = userIdFor(e.editedByEmail);
        if (!commentId || !editorId) continue;
        await qr.query(`
          INSERT INTO comment_edits (id, content, "commentId", "editedById", "createdAt")
          VALUES ($1, $2, $3, $4, $5)
        `, [ulid(), sanitizeHtml(remapMentionMarkup(e.content)), commentId, editorId, e.createdAt]);
        result.commentEditsImported++;
      }

      // 6. Attachments
      const attachmentIdMap = new Map<string, string>();
      for (const a of data.attachments) {
        const newTicketId = a.ticketId ? ticketIdMap.get(a.ticketId) : null;
        const newCommentId = a.commentId ? commentIdMap.get(a.commentId) : null;
        if (a.ticketId && !newTicketId) continue;
        const newAttachmentId = ulid();
        await qr.query(`
          INSERT INTO attachments (id, "fileName", "originalName", "mimeType", size, "s3Key", "ticketId", "commentId", "uploadedById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [newAttachmentId, a.fileName, a.originalName, a.mimeType, a.size, a.s3Key, newTicketId, newCommentId, userIdFor(a.uploadedByEmail), a.createdAt]);
        attachmentIdMap.set(a.id, newAttachmentId);
        result.attachmentsImported++;
      }

      // 7. Participants
      for (const p of data.participants) {
        const newTicketId = ticketIdMap.get(p.ticketId);
        const userId = userIdFor(p.userEmail);
        if (!newTicketId || !userId) continue;
        const inserted = await qr.query(`
          INSERT INTO ticket_participants (id, "ticketId", "userId", role)
          VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id
        `, [ulid(), newTicketId, userId, p.role]);
        // ON CONFLICT DO NOTHING returns no row when the participant was already there
        if (inserted.length) result.participantsImported++;
      }

      // 8. Canned responses — reuse the target workspace's own by title, so a re-import adds none
      const cannedIdMap = new Map<string, string>();
      const existingCanned = await qr.query(
        `SELECT id, title FROM canned_responses WHERE "workspaceId" = $1`, [targetWorkspaceId],
      );
      const cannedIdByTitle = new Map<string, string>(existingCanned.map((cr: any) => [cr.title, cr.id]));
      for (const cr of data.cannedResponses) {
        const existingId = cannedIdByTitle.get(cr.title);
        if (existingId) {
          cannedIdMap.set(cr.id, existingId);
          continue;
        }
        const newId = ulid();
        await qr.query(`
          INSERT INTO canned_responses (id, title, content, "workspaceId", "createdAt")
          VALUES ($1, $2, $3, $4, $5)
        `, [newId, cr.title, cr.content, targetWorkspaceId, cr.createdAt]);
        cannedIdMap.set(cr.id, newId);
        cannedIdByTitle.set(cr.title, newId);
        result.cannedResponsesImported++;
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

      // 10b. Knowledge base — categories reused by slug; an article whose slug the target
      // workspace already has is skipped. Content is sanitized as the KB create service does.
      const kbCategoryIdMap = new Map<string, string>();
      const existingKbCategories = await qr.query(
        `SELECT id, slug FROM kb_categories WHERE "workspaceId" = $1`, [targetWorkspaceId],
      );
      const kbCategoryIdBySlug = new Map<string, string>(existingKbCategories.map((c: any) => [c.slug, c.id]));
      for (const c of data.kbCategories) {
        let targetId = kbCategoryIdBySlug.get(c.slug);
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
      }
      const kbArticleIdMap = new Map<string, string>();
      const existingKbArticles = await qr.query(
        `SELECT id, slug FROM kb_articles WHERE "workspaceId" = $1`, [targetWorkspaceId],
      );
      const kbArticleIdBySlug = new Map<string, string>(existingKbArticles.map((a: any) => [a.slug, a.id]));
      for (const a of data.kbArticles) {
        const existingId = kbArticleIdBySlug.get(a.slug);
        if (existingId) {
          kbArticleIdMap.set(a.id, existingId);
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
      // carry (mailboxes, webhooks, email rules...) keep their source id.
      const categoryIdMap = new Map<string, string>();
      for (const c of data.categories) {
        const targetId = categoryIdBySlug.get(c.slug);
        if (targetId) categoryIdMap.set(c.id, targetId);
      }
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

      await qr.commitTransaction();
      return { result, newMembers };
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
