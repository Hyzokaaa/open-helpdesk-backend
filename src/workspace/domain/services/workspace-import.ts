import { DataSource } from 'typeorm';
import { ulid } from 'ulid';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { WorkspaceExportData } from '../workspace-export';
import { applyTransforms } from './workspace-export-transforms';

export interface ImportResult {
  usersCreated: number;
  membersAdded: number;
  tagsImported: number;
  categoriesImported: number;
  ticketsImported: number;
  commentsImported: number;
  attachmentsImported: number;
  participantsImported: number;
  cannedResponsesImported: number;
  customFieldsImported: number;
  csatResponsesImported: number;
  auditLogImported: number;
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

function slugToName(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export class ImportWorkspace {
  constructor(private readonly dataSource: DataSource) {}

  async execute(targetWorkspaceId: string, rawData: WorkspaceExportData): Promise<ImportOutcome> {
    const data = applyTransforms(rawData);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const result: ImportResult = {
      usersCreated: 0, membersAdded: 0, tagsImported: 0, categoriesImported: 0, ticketsImported: 0,
      commentsImported: 0, attachmentsImported: 0, participantsImported: 0,
      cannedResponsesImported: 0, customFieldsImported: 0, csatResponsesImported: 0,
      auditLogImported: 0,
    };
    const newMembers: ImportedNewMember[] = [];

    try {
      // 1. Collect ALL referenced emails across the entire export
      const allEmailsSet = new Set<string>();
      for (const u of data.users) allEmailsSet.add(u.email);
      for (const t of data.tickets) {
        allEmailsSet.add(t.reporterEmail);
        if (t.assigneeEmail) allEmailsSet.add(t.assigneeEmail);
        if (t.resolvedByEmail) allEmailsSet.add(t.resolvedByEmail);
      }
      for (const c of data.comments) allEmailsSet.add(c.authorEmail);
      for (const a of data.attachments) { if (a.uploadedByEmail) allEmailsSet.add(a.uploadedByEmail); }
      for (const p of data.participants) allEmailsSet.add(p.userEmail);
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
      const unusablePassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      const memberMap = new Map(data.users.map((u) => [u.email, u]));
      for (const email of allEmails) {
        if (!emailToUserId.has(email)) {
          const id = ulid();
          const member = memberMap.get(email);
          const firstName = member?.firstName ?? email.split('@')[0];
          await qr.query(`
            INSERT INTO users (id, email, password, "firstName", "lastName", "isActive", "isSystemAdmin", "isEmailVerified", "autoCreated")
            VALUES ($1, $2, $3, $4, $5, true, false, false, $6)
          `, [id, email, unusablePassword, firstName, member?.lastName ?? '', !member]);
          emailToUserId.set(email, id);
          result.usersCreated++;
          if (member) newMembers.push({ userId: id, email, firstName });
        }
      }

      const userIdFor = (email: string | null) => email ? (emailToUserId.get(email) ?? null) : null;

      // 2. Add workspace members (skip if already member)
      for (const u of data.users) {
        const userId = emailToUserId.get(u.email);
        if (!userId) continue;
        const exists = await qr.query(
          `SELECT 1 FROM workspace_members WHERE "workspaceId" = $1 AND "userId" = $2`, [targetWorkspaceId, userId],
        );
        if (!exists.length) {
          await qr.query(`
            INSERT INTO workspace_members (id, "workspaceId", "userId", role)
            VALUES ($1, $2, $3, $4)
          `, [ulid(), targetWorkspaceId, userId, u.role]);
          result.membersAdded++;
        }
      }

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
      for (const t of data.tickets) {
        if (t.category && !wanted.has(t.category)) {
          wanted.set(t.category, { name: slugToName(t.category), color: 'blue', createdAt: null });
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

      // 3c. Custom fields — before tickets, whose values are keyed by definition id. A definition
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
        `SELECT name, "reporterId", "createdAt" FROM tickets WHERE "workspaceId" = $1 AND "deletedAt" IS NULL`, [targetWorkspaceId],
      );
      const existingTicketKeys = new Set(
        existingTickets.map((t: any) => `${t.name}|${t.reporterId}|${new Date(t.createdAt).toISOString().slice(0, 19)}`),
      );

      // Numbers are reassigned in the original order, whatever order the file lists tickets in
      const ticketsInOrder = [...data.tickets].sort(
        (a, b) => (Number(a.ticketNumber) || 0) - (Number(b.ticketNumber) || 0),
      );
      for (const t of ticketsInOrder) {
        const reporterId = userIdFor(t.reporterEmail);
        const ticketKey = `${t.name}|${reporterId}|${t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 19) : ''}`;
        if (existingTicketKeys.has(ticketKey)) continue;

        const newId = ulid();
        ticketNumber++;
        await qr.query(`
          INSERT INTO tickets (
            id, name, description, priority, status, "categoryId",
            "workspaceId", "reporterId", "assigneeId", "ticketNumber",
            "customFields", "discardReason", "portalToken",
            "firstResponseAt", "resolvedAt", "resolvedById",
            "firstResponseBreached", "resolutionBreached", "createdAt", "updatedAt"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        `, [
          newId, t.name, t.description, t.priority, t.status, categoryIdFor(t.category),
          targetWorkspaceId, userIdFor(t.reporterEmail), userIdFor(t.assigneeEmail), ticketNumber,
          JSON.stringify(remapCustomFields(t.customFields)), t.discardReason, null,
          t.firstResponseAt, t.resolvedAt, userIdFor(t.resolvedByEmail),
          t.firstResponseBreached, t.resolutionBreached, t.createdAt, t.updatedAt,
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
        if (!newTicketId) continue;
        const newId = ulid();
        await qr.query(`
          INSERT INTO comments (id, content, "ticketId", "authorId", "mentionedUserIds", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [newId, c.content, newTicketId, userIdFor(c.authorEmail), Array.isArray(c.mentionedUserIds) ? c.mentionedUserIds.join(',') : (c.mentionedUserIds ?? ''), c.createdAt]);
        commentIdMap.set(c.id, newId);
        result.commentsImported++;
      }

      // 6. Attachments
      for (const a of data.attachments) {
        const newTicketId = a.ticketId ? ticketIdMap.get(a.ticketId) : null;
        const newCommentId = a.commentId ? commentIdMap.get(a.commentId) : null;
        if (a.ticketId && !newTicketId) continue;
        await qr.query(`
          INSERT INTO attachments (id, "fileName", "originalName", "mimeType", size, "s3Key", "ticketId", "commentId", "uploadedById", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [ulid(), a.fileName, a.originalName, a.mimeType, a.size, a.s3Key, newTicketId, newCommentId, userIdFor(a.uploadedByEmail), a.createdAt]);
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
      for (const cs of data.csatResponses) {
        const newTicketId = ticketIdMap.get(cs.ticketId);
        if (!newTicketId) continue;
        await qr.query(`
          INSERT INTO csat_responses (id, "ticketId", "workspaceId", token, rating, "respondedAt", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [ulid(), newTicketId, targetWorkspaceId, ulid(), cs.rating, cs.respondedAt, cs.createdAt]);
        result.csatResponsesImported++;
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
      for (const a of data.auditLog) {
        const key = auditKey(a.action, a.entityType, userIdFor(a.userEmail), a.createdAt);
        if (existingAuditKeys.has(key)) continue;
        existingAuditKeys.add(key);
        const entityId = a.entityType === 'ticket'
          ? (ticketIdMap.get(a.entityId) ?? a.entityId)
          : a.entityId;
        await qr.query(`
          INSERT INTO audit_log_entries (id, action, "entityType", "entityId", "userId", "workspaceId", metadata, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [ulid(), a.action, a.entityType, entityId, userIdFor(a.userEmail), targetWorkspaceId, JSON.stringify(a.metadata), a.createdAt]);
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
