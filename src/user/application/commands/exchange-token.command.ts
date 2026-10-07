import { TokenService } from '../../../shared/domain/token-service';
import { Command } from '../../../shared/domain/command';
import { ExchangeToken } from '../../domain/services/user-exchange-token';
import { AddWorkspaceMember } from '../../../workspace/domain/services/workspace-add-member';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  email: string;
  firstName: string;
  lastName: string;
  role: WorkspaceRole;
  workspaceId: string;
  /** Whether the API key may also create and sign in supervisors and admins. */
  allowElevatedRoles: boolean;
  /** The key that asked, and the user it belongs to, for the audit entry. */
  apiKeyId?: string;
  actorUserId?: string;
}

export interface ExchangeTokenResponse {
  accessToken: string;
  user: { id: string; email: string };
}

export class ExchangeTokenCommand implements Command<Props, ExchangeTokenResponse> {
  constructor(
    private readonly exchangeToken: ExchangeToken,
    private readonly addWorkspaceMember: AddWorkspaceMember,
    private readonly tokenService: TokenService,
    private readonly accessTokenTtl: string,
    private readonly createAuditLog?: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<ExchangeTokenResponse> {
    const user = await this.exchangeToken.execute({
      email: props.email,
      firstName: props.firstName,
      lastName: props.lastName,
      workspaceId: props.workspaceId,
      role: props.role,
      allowElevatedRoles: props.allowElevatedRoles,
    });

    // An existing account must already be a member, so adding one means the account was just created
    let created = false;
    try {
      await this.addWorkspaceMember.execute({
        workspaceId: props.workspaceId,
        userId: user.getId(),
        role: props.role,
      });
      created = true;
    } catch {
      // Already a member — ignore
    }

    // A session handed out by a key, possibly for an account it just created, is never silent
    await this.createAuditLog?.execute({
      action: AuditAction.API_SESSION_EXCHANGED,
      entityType: 'user',
      entityId: user.getId(),
      userId: props.actorUserId ?? null,
      workspaceId: props.workspaceId,
      metadata: {
        email: user.email,
        userCreated: created,
        ...(created ? { role: props.role } : {}),
        ...(props.apiKeyId ? { apiKeyId: props.apiKeyId } : {}),
      },
      category: AuditCategory.USER,
      level: created && props.role !== WorkspaceRole.AGENT && props.role !== WorkspaceRole.USER
        ? AuditLevel.WARNING
        : AuditLevel.INFO,
      source: 'api',
    });

    const payload = {
      sub: user.getId(),
      email: user.email,
      isSystemAdmin: user.isSystemAdmin,
      isEmailVerified: user.isEmailVerified,
    };
    const accessToken = this.tokenService.sign(payload, { expiresIn: this.accessTokenTtl });

    return {
      accessToken,
      user: { id: user.getId(), email: user.email },
    };
  }
}
