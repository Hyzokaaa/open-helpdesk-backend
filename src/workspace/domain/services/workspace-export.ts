import { DataSource } from 'typeorm';
import { WorkspaceExportData } from '../workspace-export';
import { CURRENT_VERSION } from './workspace-export-transforms';
import { ExtractMentions } from '../../../comment/domain/services/comment-extract-mentions';

const extractMentions = new ExtractMentions();

/** comments.mentionedUserIds is a simple-array column, which raw SQL returns as comma-joined text. */
function mentionedIdsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' && value ? value.split(',') : [];
}

export class ExportWorkspace {
  constructor(private readonly dataSource: DataSource) {}

  async execute(workspaceId: string): Promise<WorkspaceExportData> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();

    try {
      const workspace = await qr.query(
        `SELECT name, description, "slaPolicy", metadata FROM workspaces WHERE id = $1`, [workspaceId],
      );
      if (!workspace.length) throw new Error('Workspace not found');
      const ws = workspace[0];

      const members = await qr.query(`
        SELECT u.id, u.email, u."firstName", u."lastName", wm.role
        FROM workspace_members wm JOIN users u ON u.id = wm."userId"
        WHERE wm."workspaceId" = $1
      `, [workspaceId]);

      const tags = await qr.query(
        `SELECT id, name, color, "createdAt" FROM tags WHERE "workspaceId" = $1`, [workspaceId],
      );

      const categories = await qr.query(
        `SELECT id, name, slug, color, "createdAt" FROM ticket_categories WHERE "workspaceId" = $1`, [workspaceId],
      );

      // tickets.category was replaced by a categoryId FK; the export keeps the
      // slug so older files and newer ones describe the category the same way.
      const tickets = await qr.query(`
        SELECT t.id, t.name, t.description, t.priority, t.status, tc.slug AS category,
          t."reporterId", t."assigneeId", t."ticketNumber", t."customFields",
          t."discardReason", t."portalToken", t."firstResponseAt", t."resolvedAt",
          t."resolvedById", t."firstResponseBreached", t."resolutionBreached",
          t."createdAt", t."updatedAt",
          COALESCE(array_agg(tt."tagsId") FILTER (WHERE tt."tagsId" IS NOT NULL), '{}') as "tagIds"
        FROM tickets t
        LEFT JOIN ticket_categories tc ON tc.id = t."categoryId"
        LEFT JOIN ticket_tag tt ON tt."ticketsId" = t.id
        WHERE t."workspaceId" = $1 AND t."deletedAt" IS NULL
        GROUP BY t.id, tc.id
        ORDER BY t."ticketNumber"
      `, [workspaceId]);

      const comments = await qr.query(`
        SELECT c.id, c.content, c."ticketId", c."authorId", c."mentionedUserIds", c."createdAt"
        FROM comments c JOIN tickets t ON c."ticketId" = t.id
        WHERE t."workspaceId" = $1 AND t."deletedAt" IS NULL
      `, [workspaceId]);

      const attachments = await qr.query(`
        SELECT a.id, a."fileName", a."originalName", a."mimeType", a.size, a."s3Key",
          a."ticketId", a."commentId", a."uploadedById", a."createdAt"
        FROM attachments a JOIN tickets t ON a."ticketId" = t.id
        WHERE t."workspaceId" = $1 AND t."deletedAt" IS NULL
      `, [workspaceId]);

      const participants = await qr.query(`
        SELECT tp."ticketId", tp."userId", tp.role
        FROM ticket_participants tp JOIN tickets t ON tp."ticketId" = t.id
        WHERE t."workspaceId" = $1 AND t."deletedAt" IS NULL
      `, [workspaceId]);

      const cannedResponses = await qr.query(
        `SELECT id, title, content, "createdAt" FROM canned_responses WHERE "workspaceId" = $1`, [workspaceId],
      );

      const customFields = await qr.query(
        `SELECT id, name, type, options, position, required, "createdAt" FROM custom_field_definitions WHERE "workspaceId" = $1`, [workspaceId],
      );

      const csatResponses = await qr.query(`
        SELECT cs."ticketId", cs.rating, cs."respondedAt", cs."createdAt"
        FROM csat_responses cs WHERE cs."workspaceId" = $1
      `, [workspaceId]);

      const auditLog = await qr.query(`
        SELECT a.action, a."entityType", a."entityId", a."userId", a.metadata,
          a.category, a.level, a.source, a."createdAt"
        FROM audit_log_entries a WHERE a."workspaceId" = $1 ORDER BY a."createdAt"
      `, [workspaceId]);

      // Every user the file refers to, members or not (former members, past authors, mentioned
      // people), is listed with an id and email so the import can map it. A user that no longer
      // exists is exported as a null email, never as its raw id.
      const users = new Map<string, any>(members.map((m: any) => [m.id, m]));
      const referenced = new Set<string>();
      const refer = (id: string | null | undefined) => { if (id && !users.has(id)) referenced.add(id); };
      for (const t of tickets) { refer(t.reporterId); refer(t.assigneeId); refer(t.resolvedById); }
      for (const c of comments) {
        c.mentionedUserIds = mentionedIdsOf(c.mentionedUserIds);
        refer(c.authorId);
        for (const id of [...c.mentionedUserIds, ...extractMentions.execute(c.content ?? '')]) refer(id);
      }
      for (const a of attachments) refer(a.uploadedById);
      for (const p of participants) refer(p.userId);
      for (const a of auditLog) refer(a.userId);
      if (referenced.size) {
        const others = await qr.query(
          `SELECT id, email, "firstName", "lastName" FROM users WHERE id = ANY($1)`, [[...referenced]],
        );
        for (const u of others) users.set(u.id, { ...u, role: null });
      }
      const emailFor = (id: string | null) => (id ? users.get(id)?.email ?? null : null);

      return {
        version: CURRENT_VERSION,
        exportedAt: new Date().toISOString(),
        workspace: {
          name: ws.name,
          description: ws.description,
          slaPolicy: ws.slaPolicy,
          metadata: ws.metadata,
        },
        users: [...users.values()].map((u: any) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
        })),
        tags: tags.map((t: any) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          createdAt: t.createdAt?.toISOString(),
        })),
        categories: categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          color: c.color,
          createdAt: c.createdAt?.toISOString(),
        })),
        tickets: tickets.map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          priority: t.priority,
          status: t.status,
          category: t.category ?? null,
          reporterEmail: emailFor(t.reporterId)!,
          assigneeEmail: emailFor(t.assigneeId),
          ticketNumber: t.ticketNumber,
          customFields: t.customFields ?? {},
          discardReason: t.discardReason,
          portalToken: t.portalToken,
          firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
          resolvedAt: t.resolvedAt?.toISOString() ?? null,
          resolvedByEmail: emailFor(t.resolvedById),
          firstResponseBreached: t.firstResponseBreached ?? false,
          resolutionBreached: t.resolutionBreached ?? false,
          tagIds: t.tagIds,
          createdAt: t.createdAt?.toISOString() ?? null,
          updatedAt: t.updatedAt?.toISOString() ?? null,
        })),
        comments: comments.map((c: any) => ({
          id: c.id,
          content: c.content,
          ticketId: c.ticketId,
          authorEmail: emailFor(c.authorId),
          mentionedUserIds: c.mentionedUserIds,
          createdAt: c.createdAt?.toISOString(),
        })),
        attachments: attachments.map((a: any) => ({
          id: a.id,
          fileName: a.fileName,
          originalName: a.originalName,
          mimeType: a.mimeType,
          size: a.size,
          s3Key: a.s3Key,
          ticketId: a.ticketId,
          commentId: a.commentId,
          uploadedByEmail: emailFor(a.uploadedById),
          createdAt: a.createdAt?.toISOString(),
        })),
        participants: participants.map((p: any) => ({
          ticketId: p.ticketId,
          userEmail: emailFor(p.userId),
          role: p.role,
        })),
        cannedResponses: cannedResponses.map((cr: any) => ({
          id: cr.id,
          title: cr.title,
          content: cr.content,
          createdAt: cr.createdAt?.toISOString(),
        })),
        customFields: customFields.map((cf: any) => ({
          id: cf.id,
          name: cf.name,
          type: cf.type,
          options: cf.options,
          position: cf.position,
          required: cf.required,
          createdAt: cf.createdAt?.toISOString(),
        })),
        csatResponses: csatResponses.map((cs: any) => ({
          ticketId: cs.ticketId,
          rating: cs.rating,
          respondedAt: cs.respondedAt?.toISOString() ?? null,
          createdAt: cs.createdAt?.toISOString(),
        })),
        auditLog: auditLog.map((a: any) => ({
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          userEmail: emailFor(a.userId),
          metadata: a.metadata,
          category: a.category,
          level: a.level,
          source: a.source ?? null,
          createdAt: a.createdAt?.toISOString(),
        })),
      };
    } finally {
      await qr.release();
    }
  }
}
