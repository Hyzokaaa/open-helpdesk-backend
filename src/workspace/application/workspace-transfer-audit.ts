import { CreateAuditLogEntry } from '../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../audit-log/domain/enums/audit-level.enum';
import { DomainError } from '../../shared/domain/errors';
import type { WorkspaceExportBundle } from '../domain/services/workspace-export';
import type { ImportResult } from '../domain/services/workspace-import';

/**
 * Audit metadata is flat, key → string, number or boolean, so the audit log can show every value
 * as it is. Nothing nested goes in.
 */
export type FlatMetadata = Record<string, string | number | boolean>;

/** What an export file carried, counted from the bundle it was written from. */
export interface ExportSummary {
  /** The export JSON version (e.g. 1.17.0). */
  formatVersion: string;
  includeCredentials: boolean;
  tickets: number;
  /** Attachments whose bytes travel in the file. */
  attachments: number;
  /** Files in the archive: attachments and logos. */
  files: number;
  filesBytes: number;
}

export function exportSummaryOf(bundle: WorkspaceExportBundle, includeCredentials: boolean): ExportSummary {
  const data = bundle.data;
  return {
    formatVersion: String(data.version ?? ''),
    includeCredentials,
    tickets: Array.isArray(data.tickets) ? data.tickets.length : 0,
    attachments: Array.isArray(data.attachments) ? data.attachments.filter((a) => !!a.file).length : 0,
    files: bundle.files.length,
    filesBytes: bundle.files.reduce((sum, file) => sum + (file.size ?? 0), 0),
  };
}

/** Where an import read its export from. A URL is reduced to its host: the path is a secret token. */
export interface ImportSourceInfo {
  source: 'file' | 'url' | 'direct';
  fileName?: string;
  urlHost?: string;
}

export function importSourceOf(fileName: string | null | undefined, url: string | null | undefined): ImportSourceInfo {
  if (fileName) return { source: 'file', fileName };
  if (url) {
    let urlHost = '';
    try {
      urlHost = new URL(url).host;
    } catch {
      urlHost = 'invalid URL';
    }
    return { source: 'url', urlHost };
  }
  return { source: 'direct' };
}

const UNEXPECTED_IMPORT_FAILURE = 'The import failed because of an unexpected error';

/**
 * The reason an import failed, as the user was told it: the message of a domain error or of a
 * client-side HTTP error. Anything else (a database or programming error) gets a generic message,
 * so neither stack traces nor internal details reach the audit log.
 */
export function importFailureReason(error: unknown): string {
  if (error instanceof DomainError && error.message) return error.message;
  const http = error as { getStatus?: () => number; message?: unknown } | null;
  if (http && typeof http.getStatus === 'function' && typeof http.message === 'string') {
    const status = http.getStatus();
    if (status >= 400 && status < 500) return http.message;
  }
  return UNEXPECTED_IMPORT_FAILURE;
}

function sourceMetadata(info: ImportSourceInfo): FlatMetadata {
  const metadata: FlatMetadata = { source: info.source };
  if (info.fileName) metadata.fileName = info.fileName;
  if (info.urlHost) metadata.urlHost = info.urlHost;
  return metadata;
}

function exportMetadata(summary: ExportSummary): FlatMetadata {
  return {
    formatVersion: summary.formatVersion,
    includeCredentials: summary.includeCredentials,
    tickets: summary.tickets,
    attachments: summary.attachments,
    files: summary.files,
    filesBytes: summary.filesBytes,
  };
}

/** Credentials leaving the system deserve a second look in the audit log. */
const exportLevel = (includeCredentials: boolean) => (includeCredentials ? AuditLevel.WARNING : AuditLevel.INFO);

/** What an import result says, flat: every counter that is not zero, plus the notes that apply. */
export function importResultMetadata(result: ImportResult): FlatMetadata {
  const metadata: FlatMetadata = {};
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'number' && value !== 0) metadata[key] = value;
  }
  metadata.settingsApplied = result.settingsApplied.join(',');
  metadata.credentialsIncluded = result.credentialsIncluded === true;
  if (result.customDomainSkipped) metadata.customDomainSkipped = result.customDomainSkipped;
  return metadata;
}

/**
 * The audit trail of moving a workspace out (exports, export links) and in (imports), one entry
 * per outcome, category workspace, about the workspace itself.
 */
export class WorkspaceTransferAudit {
  constructor(private readonly auditLog: CreateAuditLogEntry) {}

  /** A file downloaded straight from the export endpoint. `completed` is false when it was cut short. */
  async exported(props: { workspaceId: string; userId: string; summary: ExportSummary; completed: boolean }) {
    await this.record(AuditAction.WORKSPACE_EXPORTED, props.workspaceId, props.userId, exportLevel(props.summary.includeCredentials), {
      ...exportMetadata(props.summary),
      completed: props.completed,
    });
  }

  /** An export link created; nothing has left yet, so there is nothing to count. */
  async exportLinkCreated(props: { workspaceId: string; userId: string; formatVersion: string; includeCredentials: boolean; expiresAt: Date }) {
    await this.record(AuditAction.WORKSPACE_EXPORT_CREATED, props.workspaceId, props.userId, exportLevel(props.includeCredentials), {
      formatVersion: props.formatVersion,
      includeCredentials: props.includeCredentials,
      expiresAt: props.expiresAt.toISOString(),
    });
  }

  /** An export link downloaded. The link is public, so there is no user, only the requester's address. */
  async exportLinkDownloaded(props: { workspaceId: string; summary: ExportSummary; completed: boolean; expiresAt?: Date; ip?: string | null }) {
    const metadata: FlatMetadata = { ...exportMetadata(props.summary), completed: props.completed };
    if (props.expiresAt) metadata.expiresAt = props.expiresAt.toISOString();
    if (props.ip) metadata.ip = props.ip;
    await this.record(AuditAction.WORKSPACE_EXPORT_LINK_DOWNLOADED, props.workspaceId, null, exportLevel(props.summary.includeCredentials), metadata);
  }

  async importCompleted(props: {
    workspaceId: string;
    userId: string;
    source: ImportSourceInfo;
    /** The version the file was exported with, before any upgrade. */
    formatVersion: string | null;
    completeExisting: boolean;
    overwrite: string[];
    result: ImportResult;
    durationMs: number;
  }) {
    const metadata: FlatMetadata = { ...sourceMetadata(props.source) };
    if (props.formatVersion) metadata.formatVersion = props.formatVersion;
    metadata.completeExisting = props.completeExisting;
    metadata.overwrite = props.overwrite.join(',');
    Object.assign(metadata, importResultMetadata(props.result));
    metadata.durationMs = props.durationMs;
    await this.record(AuditAction.WORKSPACE_IMPORT_COMPLETED, props.workspaceId, props.userId, AuditLevel.INFO, metadata);
  }

  async importFailed(props: { workspaceId: string; userId: string; source: ImportSourceInfo; reason: string; durationMs: number }) {
    await this.record(AuditAction.WORKSPACE_IMPORT_FAILED, props.workspaceId, props.userId, AuditLevel.ERROR, {
      ...sourceMetadata(props.source),
      reason: props.reason,
      durationMs: props.durationMs,
    });
  }

  private async record(action: AuditAction, workspaceId: string, userId: string | null, level: AuditLevel, metadata: FlatMetadata) {
    await this.auditLog.execute({
      action,
      entityType: 'workspace',
      entityId: workspaceId,
      userId,
      workspaceId,
      metadata,
      category: AuditCategory.WORKSPACE,
      level,
      source: 'ui',
    });
  }
}
