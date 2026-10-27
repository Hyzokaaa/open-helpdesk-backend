import { Command } from '../../../shared/domain/command';
import { ConfirmCustomDomain, CustomDomainConfirmation } from '../../domain/services/workspace-confirm-custom-domain';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  workspaceId: string;
  userId: string;
}

export class ConfirmCustomDomainCommand implements Command<Props, CustomDomainConfirmation> {
  constructor(
    private readonly confirmCustomDomain: ConfirmCustomDomain,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<CustomDomainConfirmation> {
    const result = await this.confirmCustomDomain.execute({ workspaceId: props.workspaceId });

    // Same entry as when the daily check finds it again, with who asked for the check
    if (result.recovered) {
      await this.createAuditLog.execute({
        action: AuditAction.WORKSPACE_CUSTOM_DOMAIN_RECOVERED,
        entityType: 'workspace',
        entityId: props.workspaceId,
        userId: props.userId,
        workspaceId: props.workspaceId,
        metadata: { domain: result.domain, dnsValid: result.dnsValid, txtValid: result.txtValid },
        category: AuditCategory.WORKSPACE,
        level: AuditLevel.INFO,
        source: 'ui',
      });
    }

    return result;
  }
}
