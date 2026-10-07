import { DataSource } from 'typeorm';
import { ulid } from 'ulid';
import { WorkspaceExportData, WorkspaceExportFile, WorkspaceExportMissingFile } from '../workspace-export';
import { CURRENT_VERSION } from './workspace-export-transforms';
import { formatTicketReference, ticketReferenceFormatOf } from '../../../ticket/domain/ticket-reference';
import { WorkspaceTicketReference } from '../entities/workspace-ticket-reference';
import { ExtractMentions } from '../../../comment/domain/services/comment-extract-mentions';
import { StorageService } from '../../../shared/domain/storage-service';
import { IMPORT_LINK_TYPES as LINK, ImportLinkType } from '../workspace-import-link';

const extractMentions = new ExtractMentions();

/** A simple-array column (comments.mentionedUserIds, webhooks.events), which raw SQL returns as comma-joined text. */
function simpleArrayOf(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  return typeof value === 'string' && value ? value.split(',') : [];
}

/** A stored file the export carries, under the archive path the JSON refers to it by. */
export interface WorkspaceExportFileSource {
  path: string;
  storageKey: string;
  size: number;
}

export interface WorkspaceExportBundle {
  data: WorkspaceExportData;
  /** In archive order. Only files storage has; the missing ones are listed in data.missingFiles. */
  files: WorkspaceExportFileSource[];
}

/** Something in the JSON that refers to a stored file, filled in once storage has been asked. */
interface FileReference {
  storageKey: string;
  missing: WorkspaceExportMissingFile;
  /** Sets the archive path (null when missing) and the size of the bytes carried. */
  apply(file: string | null, size: number | null): void;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

const STAT_CONCURRENCY = 8;

export interface ExportOptions {
  /**
   * Carry the passwords and secrets of the workspace configuration (mailbox IMAP passwords, the
   * email sender's SMTP password, webhook secrets). Off by default: without it they are absent.
   */
  includeCredentials?: boolean;
}

export class ExportWorkspace {
  /** Without storage, files are listed as carried without checking them (no bytes can follow). */
  constructor(private readonly dataSource: DataSource, private readonly storage?: StorageService) {}

  async execute(workspaceId: string, options: ExportOptions = {}): Promise<WorkspaceExportData> {
    return (await this.prepare(workspaceId, options)).data;
  }

  /**
   * The export JSON plus the stored files it refers to. Storage keys never reach the JSON: each
   * file gets an archive path. A file storage no longer has stays as metadata with `file: null`
   * and is listed in `missingFiles`, so one lost object never fails the whole export.
   */
  async prepare(workspaceId: string, options: ExportOptions = {}): Promise<WorkspaceExportBundle> {
    const references: FileReference[] = [];
    const data = await this.collect(workspaceId, references, options.includeCredentials === true);

    const sizes: (number | null | undefined)[] = new Array(references.length).fill(undefined);
    if (this.storage) {
      const storage = this.storage;
      let next = 0;
      const worker = async () => {
        while (next < references.length) {
          const index = next++;
          sizes[index] = (await storage.stat(references[index].storageKey))?.size ?? null;
        }
      };
      await Promise.all(Array.from({ length: Math.min(STAT_CONCURRENCY, references.length) }, worker));
    }

    const files: WorkspaceExportFileSource[] = [];
    const missingFiles: WorkspaceExportMissingFile[] = [];
    references.forEach((reference, index) => {
      const size = sizes[index];
      if (size === null) {
        reference.apply(null, null);
        missingFiles.push(reference.missing);
        return;
      }
      const path = `files/${ulid()}`;
      reference.apply(path, size ?? null);
      files.push({ path, storageKey: reference.storageKey, size: size ?? 0 });
    });
    data.missingFiles = missingFiles;
    return { data, files };
  }

  private async collect(workspaceId: string, references: FileReference[], includeCredentials: boolean): Promise<WorkspaceExportData> {
    /** A logo or icon: stored under a key ending in its image extension, its type kept nowhere else. */
    const imageFile = (key: string, missing: Omit<WorkspaceExportMissingFile, 'fileName'>): WorkspaceExportFile => {
      const fileName = key.split('/').pop() || 'image';
      const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
      const ref: WorkspaceExportFile = {
        file: null,
        fileName,
        mimeType: MIME_BY_EXTENSION[extension] ?? 'application/octet-stream',
        size: null,
      };
      references.push({
        storageKey: key,
        missing: { ...missing, fileName },
        apply: (file, size) => { ref.file = file; ref.size = size; },
      });
      return ref;
    };

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();

    try {
      const workspace = await qr.query(
        `SELECT name, description, "slaPolicy", metadata, "appName", "appSubtitle", logo, icon, "customDomain" FROM workspaces WHERE id = $1`, [workspaceId],
      );
      if (!workspace.length) throw new Error('Workspace not found');
      const ws = workspace[0];

      const members = await qr.query(`
        SELECT u.id, u.email, u."firstName", u."lastName", u."isActive", wm.role, wm."organizationId"
        FROM workspace_members wm JOIN users u ON u.id = wm."userId"
        WHERE wm."workspaceId" = $1
      `, [workspaceId]);

      const organizations = await qr.query(`
        SELECT id, name, description, notes, domains, logo, "createdAt"
        FROM organizations WHERE "workspaceId" = $1 AND "deletedAt" IS NULL
      `, [workspaceId]);

      const departments = await qr.query(`
        SELECT id, name, description, "createdAt"
        FROM departments WHERE "workspaceId" = $1 AND "deletedAt" IS NULL
      `, [workspaceId]);
      const departmentMembers = await qr.query(`
        SELECT dm."departmentId", dm."userId"
        FROM department_members dm JOIN departments d ON d.id = dm."departmentId"
        WHERE d."workspaceId" = $1 AND d."deletedAt" IS NULL
      `, [workspaceId]);

      const tags = await qr.query(
        `SELECT id, name, color, "createdAt" FROM tags WHERE "workspaceId" = $1`, [workspaceId],
      );

      const categories = await qr.query(
        `SELECT id, name, slug, color, "createdAt" FROM ticket_categories WHERE "workspaceId" = $1`, [workspaceId],
      );

      const projects = await qr.query(`
        SELECT p.id, p.name, p.description, p."createdAt",
          COALESCE(array_agg(tc.slug) FILTER (WHERE tc.slug IS NOT NULL), '{}') AS "categorySlugs"
        FROM projects p
        LEFT JOIN project_categories pc ON pc."projectId" = p.id
        LEFT JOIN ticket_categories tc ON tc.id = pc."categoryId"
        WHERE p."workspaceId" = $1 AND p."deletedAt" IS NULL
        GROUP BY p.id
      `, [workspaceId]);

      // tickets.category was replaced by a categoryId FK; the export keeps the
      // slug so older files and newer ones describe the category the same way.
      const tickets = await qr.query(`
        SELECT t.id, t.name, t.description, t.priority, t.status, tc.slug AS category,
          t."reporterId", t."assigneeId", t."ticketNumber", t.reference, t."customFields",
          t."discardReason", t."portalToken", t."firstResponseAt", t."resolvedAt",
          t."resolvedById", t."firstResponseBreached", t."resolutionBreached",
          t."organizationId", t."departmentId", t."projectId", t.source, t."registeredById", t."mailboxId",
          t."originDate", t."descriptionEditedAt", t."createdAt", t."updatedAt",
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

      const descriptionEdits = await qr.query(`
        SELECT e.id, e."ticketId", e.content, e."editedById", e."createdAt"
        FROM ticket_description_edits e JOIN tickets t ON t.id = e."ticketId"
        WHERE t."workspaceId" = $1 AND t."deletedAt" IS NULL
        ORDER BY e."createdAt"
      `, [workspaceId]);

      const commentEdits = await qr.query(`
        SELECT e.id, e."commentId", e.content, e."editedById", e."createdAt"
        FROM comment_edits e
        JOIN comments c ON c.id = e."commentId"
        JOIN tickets t ON t.id = c."ticketId"
        WHERE t."workspaceId" = $1 AND t."deletedAt" IS NULL
        ORDER BY e."createdAt"
      `, [workspaceId]);

      const attachments = await qr.query(`
        SELECT a.id, a."fileName", a."originalName", a."mimeType", a.size, a."s3Key",
          a."ticketId", a."commentId", a."uploadedById", a."createdAt"
        FROM attachments a JOIN tickets t ON a."ticketId" = t.id
        WHERE t."workspaceId" = $1 AND t."deletedAt" IS NULL AND a."stagedAt" IS NULL
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
        SELECT cs.id, cs."ticketId", cs.rating, cs."respondedAt", cs."createdAt"
        FROM csat_responses cs WHERE cs."workspaceId" = $1
      `, [workspaceId]);

      const kbCategories = await qr.query(
        `SELECT id, name, slug, icon, position, "createdAt" FROM kb_categories WHERE "workspaceId" = $1 ORDER BY position`, [workspaceId],
      );

      const kbArticles = await qr.query(`
        SELECT id, title, slug, content, status, position, "categoryId", "createdById", "createdAt", "updatedAt"
        FROM kb_articles WHERE "workspaceId" = $1 ORDER BY position
      `, [workspaceId]);

      const auditLog = await qr.query(`
        SELECT a.action, a."entityType", a."entityId", a."userId", a.metadata,
          a.category, a.level, a.source, a."createdAt"
        FROM audit_log_entries a WHERE a."workspaceId" = $1 ORDER BY a."createdAt"
      `, [workspaceId]);

      // Workspace configuration. Only this workspace's mailboxes: the platform's system mailbox has no
      // workspace. Passwords and secrets are read only when the export carries them. API keys never
      // travel: they are credentials of this installation.
      const mailboxes = await qr.query(`
        SELECT id, address, type, "imapHost", "imapPort", "imapUser", ${includeCredentials ? '"imapPass", ' : ''}encryption,
          "imapFolder", "pollInterval", "addressMode", "acceptedAddresses", "autoReply", "postProcessAction", "postProcessFolder"
        FROM mailboxes WHERE "workspaceId" = $1 ORDER BY "createdAt", id
      `, [workspaceId]);
      const emailRules = await qr.query(`
        SELECT id, name, position, "isActive", conditions, actions, "mailboxIds"
        FROM email_rules WHERE "workspaceId" = $1 ORDER BY position, "createdAt"
      `, [workspaceId]);
      const senders = await qr.query(`
        SELECT "smtpHost", "smtpPort", "smtpUser", ${includeCredentials ? '"smtpPass", ' : ''}"smtpFrom", encryption, "fromName", "fromEmail"
        FROM workspace_email_senders WHERE "workspaceId" = $1
      `, [workspaceId]);
      const webhooks = await qr.query(`
        SELECT id, url, events, ${includeCredentials ? 'secret, ' : ''}"createdAt"
        FROM webhooks WHERE "workspaceId" = $1 ORDER BY "createdAt", id
      `, [workspaceId]);
      const ticketReference = await qr.query(
        `SELECT style, prefix, secret FROM workspace_ticket_references WHERE "workspaceId" = $1`, [workspaceId],
      );
      // For a ticket stored without its reference, the one the workspace showed for it
      const referenceFormat = ticketReferenceFormatOf(
        ticketReference.length ? new WorkspaceTicketReference({ workspaceId, ...ticketReference[0] }) : null,
      );
      const analytics = await qr.query(`
        SELECT provider, "serverUrl", "siteId", "useCookies", "trackEvents", "shareWithInstallation"
        FROM workspace_analytics_settings WHERE "workspaceId" = $1
      `, [workspaceId]);

      // An entity this workspace got from an import keeps the identity it had in the file, so the
      // next import elsewhere (or back where it came from) recognises it; anything else is its own
      // origin. The earliest link wins when several files brought the same entity.
      const links = await qr.query(`
        SELECT "entityType", "sourceId", "targetId" FROM workspace_import_links
        WHERE "workspaceId" = $1 ORDER BY "createdAt", id
      `, [workspaceId]);
      const originById = new Map<string, string>();
      for (const l of links) {
        const key = `${l.entityType}|${l.targetId}`;
        if (!originById.has(key)) originById.set(key, l.sourceId);
      }
      const originOf = (type: ImportLinkType, id: string) => originById.get(`${type}|${id}`) ?? id;

      // Every user the file refers to, members or not (former members, past authors, mentioned
      // people), is listed with an id and email so the import can map it. A user that no longer
      // exists is exported as a null email, never as its raw id.
      const users = new Map<string, any>(members.map((m: any) => [m.id, m]));
      const referenced = new Set<string>();
      const refer = (id: string | null | undefined) => { if (id && !users.has(id)) referenced.add(id); };
      for (const t of tickets) { refer(t.reporterId); refer(t.assigneeId); refer(t.resolvedById); refer(t.registeredById); }
      for (const c of comments) {
        c.mentionedUserIds = simpleArrayOf(c.mentionedUserIds);
        refer(c.authorId);
        for (const id of [...c.mentionedUserIds, ...extractMentions.execute(c.content ?? '')]) refer(id);
      }
      for (const a of attachments) refer(a.uploadedById);
      for (const dm of departmentMembers) refer(dm.userId);
      for (const e of [...descriptionEdits, ...commentEdits]) refer(e.editedById);
      for (const p of participants) refer(p.userId);
      for (const a of auditLog) refer(a.userId);
      for (const a of kbArticles) refer(a.createdById);
      if (referenced.size) {
        const others = await qr.query(
          `SELECT id, email, "firstName", "lastName", "isActive" FROM users WHERE id = ANY($1)`, [[...referenced]],
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
          appName: ws.appName ?? null,
          appSubtitle: ws.appSubtitle ?? null,
          logoFile: ws.logo ? imageFile(ws.logo, { kind: 'workspace-logo', id: null }) : null,
          iconFile: ws.icon ? imageFile(ws.icon, { kind: 'workspace-icon', id: null }) : null,
        },
        users: [...users.values()].map((u: any) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: u.isActive !== false,
          ...(u.role ? { organizationId: u.organizationId ?? null } : {}),
        })),
        departments: departments.map((d: any) => ({
          id: d.id,
          originId: originOf(LINK.department, d.id),
          name: d.name,
          description: d.description ?? null,
          memberEmails: departmentMembers
            .filter((dm: any) => dm.departmentId === d.id)
            .map((dm: any) => emailFor(dm.userId))
            .filter((email: string | null): email is string => !!email),
          createdAt: d.createdAt?.toISOString(),
        })),
        organizations: organizations.map((o: any) => ({
          id: o.id,
          originId: originOf(LINK.organization, o.id),
          name: o.name,
          description: o.description ?? null,
          notes: o.notes ?? null,
          domains: o.domains ?? [],
          createdAt: o.createdAt?.toISOString(),
          logoFile: o.logo ? imageFile(o.logo, { kind: 'organization-logo', id: o.id }) : null,
        })),
        tags: tags.map((t: any) => ({
          id: t.id,
          originId: originOf(LINK.tag, t.id),
          name: t.name,
          color: t.color,
          createdAt: t.createdAt?.toISOString(),
        })),
        categories: categories.map((c: any) => ({
          id: c.id,
          originId: originOf(LINK.category, c.id),
          name: c.name,
          slug: c.slug,
          color: c.color,
          createdAt: c.createdAt?.toISOString(),
        })),
        projects: projects.map((p: any) => ({
          id: p.id,
          originId: originOf(LINK.project, p.id),
          name: p.name,
          description: p.description ?? null,
          categorySlugs: p.categorySlugs ?? [],
          createdAt: p.createdAt?.toISOString(),
        })),
        tickets: tickets.map((t: any) => ({
          id: t.id,
          originId: originOf(LINK.ticket, t.id),
          name: t.name,
          description: t.description,
          priority: t.priority,
          status: t.status,
          category: t.category ?? null,
          reporterEmail: emailFor(t.reporterId)!,
          assigneeEmail: emailFor(t.assigneeId),
          ticketNumber: t.ticketNumber,
          reference: t.reference ?? formatTicketReference(t.ticketNumber, referenceFormat),
          customFields: t.customFields ?? {},
          discardReason: t.discardReason,
          portalToken: t.portalToken,
          firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
          resolvedAt: t.resolvedAt?.toISOString() ?? null,
          resolvedByEmail: emailFor(t.resolvedById),
          firstResponseBreached: t.firstResponseBreached ?? false,
          resolutionBreached: t.resolutionBreached ?? false,
          tagIds: t.tagIds,
          organizationId: t.organizationId ?? null,
          departmentId: t.departmentId ?? null,
          projectId: t.projectId ?? null,
          source: t.source ?? 'ui',
          mailboxOriginId: t.mailboxId ? originOf(LINK.mailbox, t.mailboxId) : null,
          registeredByEmail: emailFor(t.registeredById),
          originDate: t.originDate?.toISOString() ?? null,
          descriptionEditedAt: t.descriptionEditedAt?.toISOString() ?? null,
          createdAt: t.createdAt?.toISOString() ?? null,
          updatedAt: t.updatedAt?.toISOString() ?? null,
        })),
        comments: comments.map((c: any) => ({
          id: c.id,
          originId: originOf(LINK.comment, c.id),
          content: c.content,
          ticketId: c.ticketId,
          authorEmail: emailFor(c.authorId),
          mentionedUserIds: c.mentionedUserIds,
          createdAt: c.createdAt?.toISOString(),
        })),
        descriptionEdits: descriptionEdits.map((e: any) => ({
          id: e.id,
          originId: originOf(LINK.descriptionEdit, e.id),
          ticketId: e.ticketId,
          content: e.content,
          editedByEmail: emailFor(e.editedById),
          createdAt: e.createdAt?.toISOString(),
        })),
        commentEdits: commentEdits.map((e: any) => ({
          id: e.id,
          originId: originOf(LINK.commentEdit, e.id),
          commentId: e.commentId,
          content: e.content,
          editedByEmail: emailFor(e.editedById),
          createdAt: e.createdAt?.toISOString(),
        })),
        attachments: attachments.map((a: any) => {
          const attachment = {
            id: a.id,
            originId: originOf(LINK.attachment, a.id),
            fileName: a.fileName,
            originalName: a.originalName,
            mimeType: a.mimeType,
            size: a.size,
            file: null as string | null,
            ticketId: a.ticketId,
            commentId: a.commentId,
            uploadedByEmail: emailFor(a.uploadedById),
            createdAt: a.createdAt?.toISOString(),
          };
          references.push({
            storageKey: a.s3Key,
            missing: { kind: 'attachment', id: a.id, fileName: a.originalName },
            // The size becomes that of the bytes actually carried, which the import records
            apply: (file, size) => { attachment.file = file; if (size !== null) attachment.size = size; },
          });
          return attachment;
        }),
        participants: participants.map((p: any) => ({
          ticketId: p.ticketId,
          userEmail: emailFor(p.userId),
          role: p.role,
        })),
        cannedResponses: cannedResponses.map((cr: any) => ({
          id: cr.id,
          originId: originOf(LINK.cannedResponse, cr.id),
          title: cr.title,
          content: cr.content,
          createdAt: cr.createdAt?.toISOString(),
        })),
        customFields: customFields.map((cf: any) => ({
          id: cf.id,
          originId: originOf(LINK.customField, cf.id),
          name: cf.name,
          type: cf.type,
          options: cf.options,
          position: cf.position,
          required: cf.required,
          createdAt: cf.createdAt?.toISOString(),
        })),
        csatResponses: csatResponses.map((cs: any) => ({
          id: cs.id,
          ticketId: cs.ticketId,
          rating: cs.rating,
          respondedAt: cs.respondedAt?.toISOString() ?? null,
          createdAt: cs.createdAt?.toISOString(),
        })),
        kbCategories: kbCategories.map((c: any) => ({
          id: c.id,
          originId: originOf(LINK.kbCategory, c.id),
          name: c.name,
          slug: c.slug,
          icon: c.icon ?? null,
          position: c.position,
          createdAt: c.createdAt?.toISOString(),
        })),
        kbArticles: kbArticles.map((a: any) => ({
          id: a.id,
          originId: originOf(LINK.kbArticle, a.id),
          title: a.title,
          slug: a.slug,
          content: a.content,
          status: a.status,
          position: a.position,
          categoryId: a.categoryId,
          createdByEmail: emailFor(a.createdById),
          createdAt: a.createdAt?.toISOString(),
          updatedAt: a.updatedAt?.toISOString() ?? null,
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
        mailboxes: mailboxes.map((m: any) => ({
          id: m.id,
          originId: originOf(LINK.mailbox, m.id),
          address: m.address,
          type: m.type,
          imapHost: m.imapHost ?? null,
          imapPort: m.imapPort ?? null,
          imapUser: m.imapUser ?? null,
          ...(includeCredentials ? { imapPass: m.imapPass ?? null } : {}),
          encryption: m.encryption,
          imapFolder: m.imapFolder ?? null,
          pollInterval: m.pollInterval ?? null,
          addressMode: m.addressMode,
          acceptedAddresses: Array.isArray(m.acceptedAddresses) ? m.acceptedAddresses : [],
          autoReply: m.autoReply !== false,
          postProcessAction: m.postProcessAction,
          postProcessFolder: m.postProcessFolder ?? null,
        })),
        emailRules: emailRules.map((r: any) => ({
          id: r.id,
          originId: originOf(LINK.emailRule, r.id),
          name: r.name,
          position: r.position,
          isActive: r.isActive !== false,
          conditions: Array.isArray(r.conditions) ? r.conditions : [],
          actions: Array.isArray(r.actions) ? r.actions : [],
          mailboxOriginIds: (Array.isArray(r.mailboxIds) ? r.mailboxIds : []).map((id: string) => originOf(LINK.mailbox, id)),
        })),
        emailSender: senders.length
          ? {
            smtpHost: senders[0].smtpHost,
            smtpPort: senders[0].smtpPort,
            smtpUser: senders[0].smtpUser,
            ...(includeCredentials ? { smtpPass: senders[0].smtpPass } : {}),
            smtpFrom: senders[0].smtpFrom,
            encryption: senders[0].encryption,
            fromName: senders[0].fromName ?? null,
            fromEmail: senders[0].fromEmail ?? null,
          }
          : null,
        webhooks: webhooks.map((w: any) => ({
          id: w.id,
          originId: originOf(LINK.webhook, w.id),
          url: w.url,
          events: simpleArrayOf(w.events),
          ...(includeCredentials ? { secret: w.secret } : {}),
        })),
        customDomain: ws.customDomain ?? null,
        analytics: analytics.length
          ? {
            provider: analytics[0].provider ?? null,
            serverUrl: analytics[0].serverUrl ?? null,
            siteId: analytics[0].siteId ?? null,
            useCookies: analytics[0].useCookies === true,
            trackEvents: analytics[0].trackEvents !== false,
            shareWithInstallation: analytics[0].shareWithInstallation !== false,
          }
          : null,
        // The key is not a credential: it only orders the references, and without it a workspace
        // moved elsewhere would show different ones
        ticketReference: ticketReference.length
          ? { style: ticketReference[0].style, prefix: ticketReference[0].prefix, secret: ticketReference[0].secret ?? null }
          : null,
        credentialsIncluded: includeCredentials,
      };
    } finally {
      await qr.release();
    }
  }
}
