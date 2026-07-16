import { DataSource } from 'typeorm';
import { ulid } from 'ulid';
import * as bcrypt from 'bcrypt';
import { WorkspaceExportData } from '../workspace-export';
import { applyTransforms } from './workspace-export-transforms';

const DEFAULT_PASSWORD = 'user1234';

export interface ImportResult {
  usersCreated: number;
  membersAdded: number;
  tagsImported: number;
  ticketsImported: number;
  commentsImported: number;
  attachmentsImported: number;
  participantsImported: number;
  cannedResponsesImported: number;
  customFieldsImported: number;
  csatResponsesImported: number;
  auditLogImported: number;
}

export class ImportWorkspace {
  constructor(private readonly dataSource: DataSource) {}

  async execute(targetWorkspaceId: string, rawData: WorkspaceExportData): Promise<ImportResult> {
    const data = applyTransforms(rawData);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const result: ImportResult = {
      usersCreated: 0, membersAdded: 0, tagsImported: 0, ticketsImported: 0,
      commentsImported: 0, attachmentsImported: 0, participantsImported: 0,
      cannedResponsesImported: 0, customFieldsImported: 0, csatResponsesImported: 0,
      auditLogImported: 0,
    };

    try {
      // 1. Collect ALL referenced emails across the entire export
      const allEmailsSet = new Set<string>();
      for (const u of data.users) allEmailsSet.add(u.email);
      for (const t of data.tickets) {
        allEmailsSet.add(t.creatorEmail);
        if (t.assigneeEmail) allEmailsSet.add(t.assigneeEmail);
        if (t.resolvedByEmail) allEmailsSet.add(t.resolvedByEmail);
      }
      for (const c of data.comments) allEmailsSet.add(c.authorEmail);
      for (const a of data.attachments) { if (a.uploadedByEmail) allEmailsSet.add(a.uploadedByEmail); }
      for (const p of data.participants) allEmailsSet.add(p.userEmail);
      for (const a of data.auditLog) allEmailsSet.add(a.userEmail);

      const allEmails = [...allEmailsSet];

      // Map existing users by email
      const emailToUserId = new Map<string, string>();
      if (allEmails.length) {
        const existingUsers = await qr.query(
          `SELECT id, email FROM users WHERE email = ANY($1)`, [allEmails],
        );
        for (const u of existingUsers) emailToUserId.set(u.email, u.id);
      }

      // Create missing users — use member data if available, else minimal record
      const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      const memberMap = new Map(data.users.map((u) => [u.email, u]));
      for (const email of allEmails) {
        if (!emailToUserId.has(email)) {
          const id = ulid();
          const member = memberMap.get(email);
          await qr.query(`
            INSERT INTO users (id, email, password, "firstName", "lastName", "isActive", "isSystemAdmin", "isEmailVerified")
            VALUES ($1, $2, $3, $4, $5, true, false, true)
          `, [id, email, hashedPassword, member?.firstName ?? email.split('@')[0], member?.lastName ?? '']);
          emailToUserId.set(email, id);
          result.usersCreated++;
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

      // 3. Tags — map old ID → new ID
      const tagIdMap = new Map<string, string>();
      for (const tag of data.tags) {
        const newId = ulid();
        await qr.query(`
          INSERT INTO tags (id, name, color, "workspaceId", "createdAt")
          VALUES ($1, $2, $3, $4, $5)
        `, [newId, tag.name, tag.color, targetWorkspaceId, tag.createdAt]);
        tagIdMap.set(tag.id, newId);
        result.tagsImported++;
      }

      // 4. Tickets — map old ID → new ID, find max ticketNumber
      const ticketIdMap = new Map<string, string>();
      const maxNumResult = await qr.query(
        `SELECT COALESCE(MAX("ticketNumber"), 0) as max FROM tickets WHERE "workspaceId" = $1`, [targetWorkspaceId],
      );
      let ticketNumber = Number(maxNumResult[0].max);

      for (const t of data.tickets) {
        const newId = ulid();
        ticketNumber++;
        await qr.query(`
          INSERT INTO tickets (
            id, name, description, priority, status, category,
            "workspaceId", "creatorId", "assigneeId", "ticketNumber",
            "customFields", "discardReason", "portalToken",
            "firstResponseAt", "resolvedAt", "resolvedById",
            "firstResponseBreached", "resolutionBreached", "createdAt", "updatedAt"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        `, [
          newId, t.name, t.description, t.priority, t.status, t.category,
          targetWorkspaceId, userIdFor(t.creatorEmail), userIdFor(t.assigneeEmail), ticketNumber,
          JSON.stringify(t.customFields), t.discardReason, null,
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
        await qr.query(`
          INSERT INTO ticket_participants (id, "ticketId", "userId", role)
          VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING
        `, [ulid(), newTicketId, userId, p.role]);
        result.participantsImported++;
      }

      // 8. Canned responses
      for (const cr of data.cannedResponses) {
        await qr.query(`
          INSERT INTO canned_responses (id, title, content, "workspaceId", "createdAt")
          VALUES ($1, $2, $3, $4, $5)
        `, [ulid(), cr.title, cr.content, targetWorkspaceId, cr.createdAt]);
        result.cannedResponsesImported++;
      }

      // 9. Custom fields
      for (const cf of data.customFields) {
        await qr.query(`
          INSERT INTO custom_field_definitions (id, name, type, options, position, required, "workspaceId", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [ulid(), cf.name, cf.type, cf.options, cf.position, cf.required, targetWorkspaceId, cf.createdAt]);
        result.customFieldsImported++;
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

      // 11. Audit log
      for (const a of data.auditLog) {
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
      return result;
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
